<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Support\Audit;
use CRM\Support\GstVisibility;
use CRM\Validation\Validator;

$user = requireApiAuth();
$canManageNonGstAccess = GstVisibility::canManageNonGstAccess($user);

if (Request::method() === 'GET') {
    requirePermission('users.read');
    $roleVisibilityJoin = $canManageNonGstAccess ? '' : " AND r.name <> 'non_gst_billing'";
    $roleVisibilityWhere = $canManageNonGstAccess ? '' : " AND name <> 'non_gst_billing'";
    $rows = Database::fetchAll(
        "SELECT u.id, u.username, u.full_name, u.email, u.mobile, u.avatar_color,
                u.is_active, u.must_change_password, u.last_login_at, u.created_at,
                GROUP_CONCAT(r.name ORDER BY r.id) AS role_slugs,
                GROUP_CONCAT(r.display_name ORDER BY r.id) AS role_names
         FROM users u
         LEFT JOIN user_role_assignments ura ON ura.user_id = u.id AND ura.is_active = 1
              AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
         LEFT JOIN roles r ON r.id = ura.role_id AND r.is_active = 1{$roleVisibilityJoin}
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT 200"
    );
    foreach ($rows as &$row) {
        $row['roles'] = $row['role_slugs'] !== null ? explode(',', (string) $row['role_slugs']) : [];
        $row['role_display'] = $row['role_names'] !== null ? explode(',', (string) $row['role_names']) : [];
        unset($row['role_slugs'], $row['role_names']);
    }
    unset($row);

    $roles = Database::fetchAll(
        "SELECT id, name, display_name, data_scope
           FROM roles
          WHERE is_active = 1{$roleVisibilityWhere}
          ORDER BY id"
    );
    Response::success(['users' => $rows, 'roles' => $roles]);
}

requireMethod('POST');
requirePermission('users.manage');

$body = Request::json();
$action = (string) ($body['action'] ?? '');

/**
 * Replace a user's role set (validates role ids, transactional).
 * Privilege-escalation guards (planning/08 §1 — RBAC editing reserved to super_admin):
 *  - only a super_admin may grant a system role (super_admin);
 *  - a user may never change their own role set (blocks self-escalation).
 */
function assignRoles(int $userId, array $roleIds, \CRM\Auth\AuthUser $actor): void
{
    if ($userId === $actor->id) {
        \CRM\Core\Response::error('FORBIDDEN', 'You cannot change your own roles.', 403);
    }
    $roleIds = array_values(array_unique(array_map('intval', $roleIds)));

    $canManageNonGstAccess = GstVisibility::canManageNonGstAccess($actor);

    // resolve requested roles once; reject unknown/inactive
    $roles = [];
    foreach ($roleIds as $roleId) {
        $role = Database::fetchOne('SELECT id, name, is_system FROM roles WHERE id = :r AND is_active = 1', ['r' => $roleId]);
        if ($role === null) {
            throw new RuntimeException('Unknown role selected.');
        }
        if (!$canManageNonGstAccess && (string) $role['name'] === 'non_gst_billing') {
            \CRM\Core\Response::error('FORBIDDEN', 'Only Admin can assign Non GST billing access.', 403);
        }
        $roles[] = $role;
    }
    $wantsSystemRole = array_filter($roles, static fn (array $r): bool => (int) $r['is_system'] === 1) !== [];
    if ($wantsSystemRole && !$actor->isSuperAdmin()) {
        \CRM\Core\Response::error('FORBIDDEN', 'Only a super admin can grant system roles.', 403);
    }

    Database::transaction(static function () use ($userId, $roles, $actor, $canManageNonGstAccess): void {
        if ($canManageNonGstAccess) {
            Database::execute('UPDATE user_role_assignments SET is_active = 0 WHERE user_id = :u', ['u' => $userId]);
        } else {
            Database::execute(
                "UPDATE user_role_assignments ura
                   JOIN roles r ON r.id = ura.role_id
                    SET ura.is_active = 0
                  WHERE ura.user_id = :u
                    AND r.name <> 'non_gst_billing'",
                ['u' => $userId]
            );
        }
        foreach ($roles as $role) {
            Database::execute(
                'INSERT INTO user_role_assignments (user_id, role_id, assigned_by, is_active)
                 VALUES (:u, :r, :by, 1)
                 ON DUPLICATE KEY UPDATE is_active = 1, assigned_by = :by2, expires_at = NULL',
                ['u' => $userId, 'r' => (int) $role['id'], 'by' => $actor->id, 'by2' => $actor->id]
            );
        }
    });
}

switch ($action) {
    case 'create': {
        $data = Validator::validate($body, [
            'username' => 'required|string|min:3|max:60',
            'full_name' => 'required|string|max:120',
            'email' => 'nullable|email|max:150',
            'mobile' => 'nullable|string|max:20',
            'password' => 'required|string|min:8|max:255',
            'role_ids' => 'required|array|min:1',
        ]);
        if (!preg_match('/^[a-zA-Z0-9._-]+$/', $data['username'])) {
            Response::error('VALIDATION_ERROR', 'Validation failed.', 422, ['username' => 'Username may only contain letters, numbers, dots, dashes.']);
        }
        // Case-SENSITIVE: `admin` and `Admin` are distinct accounts, so only an
        // exact-case match is a conflict. COLLATE matches users.username's own
        // collation, keeping the unique index in play.
        if (Database::fetchValue(
            'SELECT id FROM users WHERE username COLLATE utf8mb4_bin = :u',
            ['u' => $data['username']]
        ) !== null) {
            Response::error('CONFLICT', 'Username already taken.', 409);
        }
        if ($data['email'] !== null && Database::fetchValue('SELECT id FROM users WHERE email = :e', ['e' => $data['email']]) !== null) {
            Response::error('CONFLICT', 'Email already in use.', 409);
        }

        $colors = ['#6C63FF', '#FF6DA8', '#3FD16F', '#F5A623', '#4DA6FF', '#BE123C'];
        // one transaction: user + roles land (or fail) together
        $newId = Database::transaction(static function () use ($data, $body, $user, $colors): int {
            $newId = Database::insert('users', [
                'username' => $data['username'],
                'password_hash' => password_hash($data['password'], PASSWORD_DEFAULT),
                'full_name' => $data['full_name'],
                'email' => $data['email'],
                'mobile' => $data['mobile'],
                'avatar_color' => $colors[array_rand($colors)],
                'must_change_password' => 1,
            ]);
            assignRoles($newId, (array) $body['role_ids'], $user);
            return $newId;
        });
        Audit::log($user->id, 'users.create', 'users', $newId, null, ['username' => $data['username']]);
        Response::success(['message' => 'User created.', 'id' => $newId], 201);
    }

    case 'update': {
        $data = Validator::validate($body, [
            'id' => 'required|int|min:1',
            'full_name' => 'required|string|max:120',
            'email' => 'nullable|email|max:150',
            'mobile' => 'nullable|string|max:20',
        ]);
        $target = Database::fetchOne('SELECT * FROM users WHERE id = :id', ['id' => $data['id']]);
        if ($target === null) {
            Response::error('NOT_FOUND', 'User not found.', 404);
        }
        if ($data['email'] !== null && Database::fetchValue(
            'SELECT id FROM users WHERE email = :e AND id <> :id', ['e' => $data['email'], 'id' => $data['id']]
        ) !== null) {
            Response::error('CONFLICT', 'Email already in use.', 409);
        }
        Database::execute(
            'UPDATE users SET full_name = :f, email = :e, mobile = :m WHERE id = :id',
            ['f' => $data['full_name'], 'e' => $data['email'], 'm' => $data['mobile'], 'id' => $data['id']]
        );
        Audit::log($user->id, 'users.update', 'users', (int) $data['id'],
            ['full_name' => $target['full_name'], 'email' => $target['email'], 'mobile' => $target['mobile']],
            ['full_name' => $data['full_name'], 'email' => $data['email'], 'mobile' => $data['mobile']]);
        Response::success(['message' => 'User updated.']);
    }

    case 'toggle_active': {
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        if ((int) $data['id'] === $user->id) {
            Response::error('CONFLICT', 'You cannot deactivate your own account.', 409);
        }
        $target = Database::fetchOne('SELECT id, is_active FROM users WHERE id = :id', ['id' => $data['id']]);
        if ($target === null) {
            Response::error('NOT_FOUND', 'User not found.', 404);
        }
        $newState = ((int) $target['is_active']) === 1 ? 0 : 1;
        Database::transaction(static function () use ($data, $newState): void {
            Database::execute('UPDATE users SET is_active = :s WHERE id = :id', ['s' => $newState, 'id' => $data['id']]);
            if ($newState === 0) {
                Database::execute(
                    "UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'deactivated'
                     WHERE user_id = :u AND revoked_at IS NULL",
                    ['u' => $data['id']]
                );
            }
        });
        Audit::log($user->id, 'users.toggle_active', 'users', (int) $data['id'], null, ['is_active' => $newState]);
        Response::success(['message' => $newState === 1 ? 'User activated.' : 'User deactivated.']);
    }

    case 'reset_password': {
        // credentials action: change username, set a temporary password, or both.
        // Only a password reset revokes sessions — a rename alone keeps them alive.
        $data = Validator::validate($body, [
            'id' => 'required|int|min:1',
            'username' => 'nullable|string|min:3|max:60',
            'password' => 'nullable|string|min:8|max:255',
        ]);
        $target = Database::fetchOne('SELECT id, username FROM users WHERE id = :id', ['id' => $data['id']]);
        if ($target === null) {
            Response::error('NOT_FOUND', 'User not found.', 404);
        }

        $newUsername = $data['username'] !== null ? trim((string) $data['username']) : null;
        if ($newUsername === $target['username']) {
            // `===` is case-sensitive, matching the case-sensitive username rule:
            // a change of casing alone IS a rename, not a no-op.
            $newUsername = null; // unchanged — not a rename
        }
        if ($newUsername !== null) {
            if (!preg_match('/^[a-zA-Z0-9._-]+$/', $newUsername)) {
                Response::error('VALIDATION_ERROR', 'Validation failed.', 422, ['username' => 'Username may only contain letters, numbers, dots, dashes.']);
            }
            if (Database::fetchValue(
                'SELECT id FROM users WHERE username COLLATE utf8mb4_bin = :u AND id <> :id',
                ['u' => $newUsername, 'id' => $data['id']]
            ) !== null) {
                Response::error('CONFLICT', 'Username already taken.', 409);
            }
        }
        if ($newUsername === null && $data['password'] === null) {
            Response::error('VALIDATION_ERROR', 'Validation failed.', 422, ['password' => 'Change the username or set a temporary password.']);
        }

        Database::transaction(static function () use ($data, $newUsername): void {
            if ($newUsername !== null) {
                Database::execute('UPDATE users SET username = :u WHERE id = :id', ['u' => $newUsername, 'id' => $data['id']]);
            }
            if ($data['password'] !== null) {
                Database::execute(
                    'UPDATE users SET password_hash = :h, must_change_password = 1, password_changed_at = NOW() WHERE id = :id',
                    ['h' => password_hash($data['password'], PASSWORD_DEFAULT), 'id' => $data['id']]
                );
                Database::execute(
                    "UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'admin_reset'
                     WHERE user_id = :u AND revoked_at IS NULL",
                    ['u' => $data['id']]
                );
            }
        });
        Audit::log($user->id, 'users.reset_password', 'users', (int) $data['id'],
            $newUsername !== null ? ['username' => $target['username']] : null,
            ($newUsername !== null ? ['username' => $newUsername] : [])
                + ($data['password'] !== null ? ['password_reset' => true] : []));
        Response::success(['message' => $data['password'] !== null
            ? 'Credentials updated — the user must change the password at next login.'
            : 'Username updated.']);
    }

    case 'assign_roles': {
        $data = Validator::validate($body, [
            'id' => 'required|int|min:1',
            'role_ids' => 'required|array|min:1',
        ]);
        if (Database::fetchValue('SELECT id FROM users WHERE id = :id', ['id' => $data['id']]) === null) {
            Response::error('NOT_FOUND', 'User not found.', 404);
        }
        assignRoles((int) $data['id'], (array) $body['role_ids'], $user);
        Audit::log($user->id, 'users.assign_roles', 'users', (int) $data['id'], null, ['role_ids' => $body['role_ids']]);
        Response::success(['message' => 'Roles updated.']);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
