<?php

declare(strict_types=1);

namespace CRM\Security;

use CRM\Core\Env;

final class Cookie
{
    public const ACCESS = 'crm_access_token';
    public const REFRESH = 'crm_refresh_token';
    public const CSRF = 'crm_csrf_token';

    // Refresh cookie path. Must be a prefix of the deployed refresh endpoint URL
    // so the browser actually sends it back. In production the CRM API is served
    // under /crm (…/crm/api/v1/auth/refresh.php), which the old '/api/v1/auth'
    // value did NOT cover — sessions silently died at the 15-min access-token
    // expiry. '/' works in both local dev and the /crm-prefixed deployment.
    public const REFRESH_PATH = '/';

    public static function set(string $name, string $value, int $ttlSeconds, string $path = '/', bool $httpOnly = true): void
    {
        setcookie($name, $value, [
            'expires' => $ttlSeconds > 0 ? time() + $ttlSeconds : 0,
            'path' => $path,
            'domain' => Env::get('COOKIE_DOMAIN', '') ?? '',
            'secure' => Env::bool('COOKIE_SECURE'),
            'httponly' => $httpOnly,
            'samesite' => Env::get('COOKIE_SAMESITE', 'Lax') ?? 'Lax',
        ]);
    }

    public static function clear(string $name, string $path = '/'): void
    {
        setcookie($name, '', [
            'expires' => time() - 3600,
            'path' => $path,
            'domain' => Env::get('COOKIE_DOMAIN', '') ?? '',
            'secure' => Env::bool('COOKIE_SECURE'),
            'httponly' => true,
            'samesite' => Env::get('COOKIE_SAMESITE', 'Lax') ?? 'Lax',
        ]);
    }
}
