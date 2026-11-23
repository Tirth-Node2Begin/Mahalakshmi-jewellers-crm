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
requirePermission('rbac.manage');
$canManageNonGstAccess = GstVisibility::canManageNonGstAccess($user);

function isNonGstRole(array $role): bool
{
    return (string) ($role['name'] ?? '') === 'non_gst_billing';
}

function isNonGstPermission(array $permission): bool
{
    return (string) ($permission['resource'] ?? '') === 'invoices'
        && (string) ($permission['action'] ?? '') === 'non_gst';
}

if (Request::method() === 'GET') {
    $module = (string) ($_GET['module'] ?? 'roles');

    switch ($module) {
        case 'roles':
            $roleVisibilitySql = $canManageNonGstAccess ? '' : " WHERE r.name <> 'non_gst_billing'";
            $grantCountSql = $canManageNonGstAccess
                ? 'COUNT(DISTINCT g.permission_id)'
                : "COUNT(DISTINCT CASE
                    WHEN NOT (gp.resource = 'invoices' AND gp.action = 'non_gst') THEN g.permission_id
                  END)";
            $roles = Database::fetchAll(
                "SELECT r.*, COUNT(DISTINCT ura.user_id) AS user_count,
                        {$grantCountSql} AS grant_count
                 FROM roles r
                 LEFT JOIN user_role_assignments ura ON ura.role_id = r.id AND ura.is_active = 1
                 LEFT JOIN role_permission_grants g ON g.role_id = r.id
                 LEFT JOIN permissions gp ON gp.id = g.permission_id
                 {$roleVisibilitySql}
                 GROUP BY r.id ORDER BY r.id"
            );
            Response::success(['roles' => $roles]);

        case 'permissions':
            $permissionVisibilitySql = $canManageNonGstAccess
                ? ''
                : " AND NOT (resource = 'invoices' AND action = 'non_gst')";
            $permissions = Database::fetchAll(
                "SELECT id, resource, action, description
                   FROM permissions
                  WHERE is_active = 1{$permissionVisibilitySql}
                  ORDER BY resource, action"
            );
            Response::success(['permissions' => $permissions]);

        case 'role_grants':
            $roleId = (int) ($_GET['role_id'] ?? 0);
            $role = Database::fetchOne('SELECT * FROM roles WHERE id = :id', ['id' => $roleId]);
            if ($role === null || (!$canManageNonGstAccess && isNonGstRole($role))) {
                Response::error('NOT_FOUND', 'Role not found.', 404);
            }
            $grantVisibilitySql = $canManageNonGstAccess
                ? ''
                : " AND NOT (p.resource = 'invoices' AND p.action = 'non_gst')";
            $grants = Database::fetchAll(
                "SELECT g.permission_id
                   FROM role_permission_grants g
                   JOIN permissions p ON p.id = g.permission_id
                  WHERE g.role_id = :r{$grantVisibilitySql}",
                ['r' => $roleId]
            );
            Response::success(['permission_ids' => array_map('intval', array_column($grants, 'permission_id'))]);

        default:
            Response::error('BAD_REQUEST', 'Unknown module.', 400);
    }
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    case 'save_role': {
        $data = Validator::validate($body, [
            'id' => 'nullable|int|min:1',
            'name' => 'required|string|min:2|max:60',
            'display_name' => 'required|string|max:100',
            'description' => 'nullable|string|max:255',
            'data_scope' => 'required|in:all,own',
        ]);
        $slug = strtolower(preg_replace('/[^a-z0-9_]+/', '_', strtolower($data['name'])) ?? '');
        if ($slug === '') {
            Response::error('VALIDATION_ERROR', 'Validation failed.', 422, ['name' => 'Invalid role name.']);
        }

        if ($data['id'] !== null) {
            $role = Database::fetchOne('SELECT * FROM roles WHERE id = :id', ['id' => $data['id']]);
            if ($role === null) {
                Response::error('NOT_FOUND', 'Role not found.', 404);
            }
            if (!$canManageNonGstAccess && isNonGstRole($role)) {
                Response::error('NOT_FOUND', 'Role not found.', 404);
            }
            if ((int) $role['is_system'] === 1) {
                Response::error('FORBIDDEN', 'System roles cannot be edited.', 403);
            }
            Database::execute(
                'UPDATE roles SET display_name = :d, description = :desc, data_scope = :s WHERE id = :id',
                ['d' => $data['display_name'], 'desc' => $data['description'], 's' => $data['data_scope'], 'id' => $data['id']]
            );
            Audit::log($user->id, 'rbac.save_role', 'roles', (int) $data['id'], null, $data);
            Response::success(['message' => 'Role updated.']);
        }

        if (Database::fetchValue('SELECT id FROM roles WHERE name = :n', ['n' => $slug]) !== null) {
            Response::error('CONFLICT', 'A role with that name already exists.', 409);
        }
        if (!$canManageNonGstAccess && $slug === 'non_gst_billing') {
            Response::error('FORBIDDEN', 'Only Admin can manage Non GST billing access.', 403);
        }
        $newId = Database::insert('roles', [
            'name' => $slug,
            'display_name' => $data['display_name'],
            'description' => $data['description'],
            'data_scope' => $data['data_scope'],
        ]);
        Audit::log($user->id, 'rbac.save_role', 'roles', $newId, null, $data);
        Response::success(['message' => 'Role created.', 'id' => $newId], 201);
    }

    case 'delete_role': {
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        $role = Database::fetchOne('SELECT * FROM roles WHERE id = :id', ['id' => $data['id']]);
        if ($role === null) {
            Response::error('NOT_FOUND', 'Role not found.', 404);
        }
        if (!$canManageNonGstAccess && isNonGstRole($role)) {
            Response::error('NOT_FOUND', 'Role not found.', 404);
        }
        if ((int) $role['is_system'] === 1) {
            Response::error('FORBIDDEN', 'System roles cannot be deleted.', 403);
        }
        $assigned = (int) Database::fetchValue(
            'SELECT COUNT(*) FROM user_role_assignments WHERE role_id = :r AND is_active = 1',
            ['r' => $data['id']]
        );
        if ($assigned > 0) {
            Response::error('CONFLICT', "Role is assigned to $assigned user(s). Reassign them first.", 409);
        }
        Database::execute('UPDATE roles SET is_active = 0 WHERE id = :id', ['id' => $data['id']]);
        Audit::log($user->id, 'rbac.delete_role', 'roles', (int) $data['id']);
        Response::success(['message' => 'Role deactivated.']);
    }

    case 'save_role_grants': {
        $data = Validator::validate($body, [
            'role_id' => 'required|int|min:1',
            'permission_ids' => 'required|array',
        ]);
        $role = Database::fetchOne('SELECT * FROM roles WHERE id = :id', ['id' => $data['role_id']]);
        if ($role === null) {
            Response::error('NOT_FOUND', 'Role not found.', 404);
        }
        if (!$canManageNonGstAccess && isNonGstRole($role)) {
            Response::error('NOT_FOUND', 'Role not found.', 404);
        }
        if ((int) $role['is_system'] === 1) {
            Response::error('FORBIDDEN', 'System role grants are fixed.', 403);
        }
        $permissionIds = array_unique(array_map('intval', (array) $body['permission_ids']));
        foreach ($permissionIds as $pid) {
            $permission = Database::fetchOne(
                'SELECT id, resource, action FROM permissions WHERE id = :p AND is_active = 1',
                ['p' => $pid]
            );
            if ($permission === null) {
                throw new RuntimeException('Unknown permission in grant list.');
            }
            if (!$canManageNonGstAccess && isNonGstPermission($permission)) {
                Response::error('FORBIDDEN', 'Only Admin can manage Non GST billing access.', 403);
            }
        }
        Database::transaction(static function () use ($data, $permissionIds, $canManageNonGstAccess): void {
            if ($canManageNonGstAccess) {
                Database::execute('DELETE FROM role_permission_grants WHERE role_id = :r', ['r' => $data['role_id']]);
            } else {
                Database::execute(
                    "DELETE g FROM role_permission_grants g
                      JOIN permissions p ON p.id = g.permission_id
                     WHERE g.role_id = :r
                       AND NOT (p.resource = 'invoices' AND p.action = 'non_gst')",
                    ['r' => $data['role_id']]
                );
            }
            foreach ($permissionIds as $pid) {
                if (Database::fetchValue('SELECT id FROM permissions WHERE id = :p AND is_active = 1', ['p' => $pid]) === null) {
                    throw new RuntimeException('Unknown permission in grant list.');
                }
                Database::insert('role_permission_grants', ['role_id' => (int) $data['role_id'], 'permission_id' => $pid]);
            }
        });
        Audit::log($user->id, 'rbac.save_role_grants', 'roles', (int) $data['role_id'], null,
            ['permission_ids' => $body['permission_ids']]);
        Response::success(['message' => 'Grants saved.']);
    }

    case 'save_permission': {
        // Register or re-describe a resource.action permission (planning/03 §2, 08 §6).
        // Permissions are enforced by code — this only manages the catalog rows that
        // roles can grant; unknown resource.action pairs simply never match anything.
        // NOTE: the permission's action is sent as `perm_action` so it never collides
        // with the dispatch `action` key of the request body.
        $data = Validator::validate($body, [
            'resource' => 'required|string|min:2|max:60',
            'perm_action' => 'required|string|min:2|max:40',
            'description' => 'nullable|string|max:255',
        ]);
        $resource = strtolower(preg_replace('/[^a-z0-9_.]+/', '', strtolower($data['resource'])) ?? '');
        $action = strtolower(preg_replace('/[^a-z0-9_]+/', '', strtolower($data['perm_action'])) ?? '');
        if ($resource === '' || $action === '') {
            Response::error('VALIDATION_ERROR', 'Validation failed.', 422, ['resource' => 'Invalid resource or action.']);
        }
        if (!$canManageNonGstAccess && $resource === 'invoices' && $action === 'non_gst') {
            Response::error('FORBIDDEN', 'Only Admin can manage Non GST billing access.', 403);
        }
        Database::execute(
            'INSERT INTO permissions (resource, action, description) VALUES (:r, :a, :d)
             ON DUPLICATE KEY UPDATE description = :d2, is_active = 1',
            ['r' => $resource, 'a' => $action, 'd' => $data['description'], 'd2' => $data['description']]
        );
        $id = (int) Database::fetchValue('SELECT id FROM permissions WHERE resource = :r AND action = :a', ['r' => $resource, 'a' => $action]);
        Audit::log($user->id, 'rbac.save_permission', 'permissions', $id, null, ['resource' => $resource, 'action' => $action]);
        Response::success(['message' => 'Permission saved.', 'id' => $id], 201);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
