<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Auth\AuthException;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Security\AuditLogger;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    $profile = Database::fetchOne(
        'SELECT id, username, full_name, email, mobile, avatar_color, last_login_at, password_changed_at, created_at
         FROM users WHERE id = :id',
        ['id' => $user->id]
    );
    $sessions = Database::fetchAll(
        'SELECT id, ip_address, user_agent, last_used_at, created_at
         FROM auth_sessions
         WHERE user_id = :u AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY COALESCE(last_used_at, created_at) DESC
         LIMIT 20',
        ['u' => $user->id]
    );
    foreach ($sessions as &$s) {
        $s['is_current'] = ((int) $s['id']) === $user->sessionId;
    }
    unset($s);

    Response::success(['profile' => $profile, 'sessions' => $sessions, 'roles' => $user->roles]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    case 'update_profile': {
        $data = Validator::validate($body, [
            'full_name' => 'required|string|max:120',
            'email' => 'nullable|email|max:150',
            'mobile' => 'nullable|string|max:20',
        ]);
        if ($data['email'] !== null && Database::fetchValue(
            'SELECT id FROM users WHERE email = :e AND id <> :id', ['e' => $data['email'], 'id' => $user->id]
        ) !== null) {
            Response::error('CONFLICT', 'Email already in use.', 409);
        }
        Database::execute(
            'UPDATE users SET full_name = :f, email = :e, mobile = :m WHERE id = :id',
            ['f' => $data['full_name'], 'e' => $data['email'], 'm' => $data['mobile'], 'id' => $user->id]
        );
        Response::success(['message' => 'Profile updated.']);
    }

    case 'change_password': {
        $data = Validator::validate($body, [
            'current_password' => 'required|string|max:255',
            'password' => 'required|string|min:8|max:255',
        ]);
        $row = Database::fetchOne('SELECT password_hash FROM users WHERE id = :id', ['id' => $user->id]);
        if ($row === null || !password_verify($data['current_password'], (string) $row['password_hash'])) {
            throw new AuthException('Current password is incorrect.', 401);
        }
        Database::transaction(static function () use ($data, $user): void {
            Database::execute(
                'UPDATE users SET password_hash = :h, must_change_password = 0, password_changed_at = NOW() WHERE id = :id',
                ['h' => password_hash($data['password'], PASSWORD_DEFAULT), 'id' => $user->id]
            );
            // revoke every OTHER session — the current one stays alive
            Database::execute(
                "UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'password_change'
                 WHERE user_id = :u AND id <> :sid AND revoked_at IS NULL",
                ['u' => $user->id, 'sid' => $user->sessionId]
            );
        });
        AuditLogger::log('password.change', $user->id);
        Response::success(['message' => 'Password changed.']);
    }

    case 'revoke_session': {
        $data = Validator::validate($body, ['session_id' => 'required|int|min:1']);
        $session = Database::fetchOne(
            'SELECT id FROM auth_sessions WHERE id = :id AND user_id = :u AND revoked_at IS NULL',
            ['id' => $data['session_id'], 'u' => $user->id]
        );
        if ($session === null) {
            Response::error('NOT_FOUND', 'Session not found.', 404);
        }
        Database::execute(
            "UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'user_revoked' WHERE id = :id",
            ['id' => $data['session_id']]
        );
        AuditLogger::log('session.revoked', $user->id, ['session_id' => $data['session_id']]);

        // Revoking the current session behaves like logout (planning/08 §6): clear cookies.
        $wasCurrent = ((int) $data['session_id']) === $user->sessionId;
        if ($wasCurrent) {
            \CRM\Security\Cookie::clear(\CRM\Security\Cookie::ACCESS);
            \CRM\Security\Cookie::clear(\CRM\Security\Cookie::REFRESH, \CRM\Security\Cookie::REFRESH_PATH);
            \CRM\Security\Cookie::clear(\CRM\Security\Cookie::CSRF);
        }
        Response::success(['message' => 'Session revoked.', 'was_current' => $wasCurrent]);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
