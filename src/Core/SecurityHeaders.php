<?php

declare(strict_types=1);

namespace CRM\Core;

final class SecurityHeaders
{
    /** Strict headers for JSON API responses. */
    public static function apply(): void
    {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: same-origin');
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
        if (Env::bool('APP_FORCE_HTTPS')) {
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
    }
}
