<?php

declare(strict_types=1);

namespace CRM\Security;

use CRM\Auth\AuthException;
use CRM\Core\Env;
use CRM\Core\Request;

/**
 * Double-submit CSRF: a JS-readable cookie whose value is `random.hmac(random)`.
 * Mutations must echo the cookie in the X-CSRF-Token header; both the match and
 * the HMAC integrity are verified.
 */
final class CsrfToken
{
    public static function issue(): string
    {
        $random = bin2hex(random_bytes(16));
        $token = $random . '.' . self::sign($random);
        Cookie::set(Cookie::CSRF, $token, 60 * 60 * 24 * 30, '/', false);
        return $token;
    }

    public static function protect(): void
    {
        if (!Request::isMutation()) {
            return;
        }
        $header = Request::header('X-CSRF-Token');
        $cookie = Request::cookie(Cookie::CSRF);
        if ($header === null || $cookie === null || !hash_equals($cookie, $header) || !self::isValid($header)) {
            throw new AuthException('CSRF token missing or invalid.', 419);
        }
    }

    private static function isValid(string $token): bool
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            return false;
        }
        return hash_equals(self::sign($parts[0]), $parts[1]);
    }

    private static function sign(string $random): string
    {
        $secret = Env::get('CSRF_SECRET', '') ?? '';
        return hash_hmac('sha256', $random, $secret);
    }
}
