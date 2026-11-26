<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/src/Support/api_bootstrap.php';

use CRM\Auth\AuthException;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Middleware\RateLimitMiddleware;
use CRM\Security\AuditLogger;
use CRM\Validation\Validator;

requireMethod('POST');

RateLimitMiddleware::check('auth.reset', 10, 900);

$data = Validator::validate(Request::json(), [
    'email' => 'required|email|max:150',
    'reset_token' => 'required|string|min:64|max:64',
    'password' => 'required|string|min:8|max:255',
]);

$user = Database::fetchOne('SELECT id FROM users WHERE email = :e AND is_active = 1', ['e' => $data['email']]);
$row = $user !== null
    ? Database::fetchOne(
        'SELECT * FROM password_reset_otps
         WHERE user_id = :u AND used_at IS NULL AND reset_token_hash = :h
         ORDER BY id DESC LIMIT 1',
        ['u' => $user['id'], 'h' => hash('sha256', $data['reset_token'])]
    )
    : null;

if ($row === null || strtotime((string) $row['expires_at']) < time()) {
    throw new AuthException('Reset link expired. Start again.', 401);
}

Database::transaction(static function () use ($user, $row, $data): void {
    Database::execute(
        'UPDATE users SET password_hash = :h, must_change_password = 0, password_changed_at = NOW() WHERE id = :id',
        ['h' => password_hash($data['password'], PASSWORD_DEFAULT), 'id' => $user['id']]
    );
    Database::execute('UPDATE password_reset_otps SET used_at = NOW() WHERE id = :id', ['id' => $row['id']]);
    // sign out everywhere
    Database::execute(
        "UPDATE auth_sessions SET revoked_at = NOW(), revoke_reason = 'password_reset'
         WHERE user_id = :u AND revoked_at IS NULL",
        ['u' => $user['id']]
    );
});

AuditLogger::log('password.reset', (int) $user['id']);

Response::success(['message' => 'Password updated. Please log in.']);
