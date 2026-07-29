<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/src/Support/api_bootstrap.php';

use CRM\Auth\AuthException;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Middleware\RateLimitMiddleware;
use CRM\Validation\Validator;

requireMethod('POST');

RateLimitMiddleware::check('auth.verify_otp', 10, 900);

$data = Validator::validate(Request::json(), [
    'email' => 'required|email|max:150',
    'otp' => 'required|string|min:6|max:6',
]);

$user = Database::fetchOne('SELECT id FROM users WHERE email = :e AND is_active = 1', ['e' => $data['email']]);
$row = $user !== null
    ? Database::fetchOne(
        'SELECT * FROM password_reset_otps WHERE user_id = :u AND used_at IS NULL ORDER BY id DESC LIMIT 1',
        ['u' => $user['id']]
    )
    : null;

if ($row === null || strtotime((string) $row['expires_at']) < time()) {
    throw new AuthException('Invalid or expired code.', 401);
}
if ((int) $row['attempts'] >= 5) {
    throw new AuthException('Too many wrong attempts. Request a new code.', 429);
}

if (!hash_equals((string) $row['otp_hash'], hash('sha256', $data['otp']))) {
    Database::execute('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = :id', ['id' => $row['id']]);
    throw new AuthException('Invalid or expired code.', 401);
}

$resetToken = bin2hex(random_bytes(32));
Database::execute(
    'UPDATE password_reset_otps SET reset_token_hash = :h, expires_at = :e WHERE id = :id',
    ['h' => hash('sha256', $resetToken), 'e' => date('Y-m-d H:i:s', time() + 600), 'id' => $row['id']]
);

Response::success(['reset_token' => $resetToken]);
