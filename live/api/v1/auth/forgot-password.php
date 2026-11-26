<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Middleware\RateLimitMiddleware;
use CRM\Security\AuditLogger;
use CRM\Support\Mailer;
use CRM\Validation\Validator;

requireMethod('POST');

RateLimitMiddleware::check('auth.forgot', 5, 900);

$data = Validator::validate(Request::json(), [
    'email' => 'required|email|max:150',
]);

$user = Database::fetchOne('SELECT id, email, full_name FROM users WHERE email = :e AND is_active = 1', ['e' => $data['email']]);

// Same response whether or not the account exists (no user enumeration).
if ($user !== null) {
    $otp = (string) random_int(100000, 999999);
    Database::execute('DELETE FROM password_reset_otps WHERE user_id = :u', ['u' => $user['id']]);
    Database::insert('password_reset_otps', [
        'user_id' => (int) $user['id'],
        'otp_hash' => hash('sha256', $otp),
        'expires_at' => date('Y-m-d H:i:s', time() + 600),
    ]);
    Mailer::send(
        (string) $user['email'],
        'Mahalakshmi Jewellers CRM — password reset code',
        "Hi {$user['full_name']},\n\nYour password reset code is: $otp\nIt expires in 10 minutes.\n\nIf you didn't request this, ignore this email."
    );
    AuditLogger::log('password.otp_sent', (int) $user['id']);
}

Response::success(['message' => 'If that email exists, a reset code has been sent.']);
