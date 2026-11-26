<?php

declare(strict_types=1);

namespace CRM\Middleware;

use CRM\Core\Env;
use CRM\Core\Request;

final class CorsMiddleware
{
    public static function handle(): void
    {
        $origin = Request::origin();
        if ($origin === null) {
            return; // same-origin or non-browser
        }
        $allowed = Env::csv('CORS_ALLOWED_ORIGINS');
        if (!in_array($origin, $allowed, true)) {
            return; // unknown origin gets no CORS headers → browser blocks it
        }
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');

        if (Request::method() === 'OPTIONS') {
            header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
            header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, Authorization');
            header('Access-Control-Max-Age: 86400');
            http_response_code(204);
            exit;
        }
    }
}
