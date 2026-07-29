<?php

declare(strict_types=1);

/**
 * Entry point for every api/*.php endpoint:
 *   require_once __DIR__ . '/../src/Support/api_bootstrap.php';
 * Sets up autoload/env, security headers, CORS, the exception→envelope
 * mapping, and the global auth/permission helper functions.
 */

require_once dirname(__DIR__) . '/bootstrap.php';

use CRM\Auth\AuthException;
use CRM\Auth\AuthService;
use CRM\Auth\AuthUser;
use CRM\Auth\PermissionException;
use CRM\Auth\PermissionService;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Core\SecurityHeaders;
use CRM\Middleware\CorsMiddleware;
use CRM\Security\Cookie;
use CRM\Security\CsrfToken;
use CRM\Validation\ValidationException;

ob_start();
SecurityHeaders::apply();
CorsMiddleware::handle();

set_exception_handler(static function (\Throwable $e): void {
    if ($e instanceof ValidationException) {
        Response::error('VALIDATION_ERROR', 'Validation failed.', 422, $e->errors());
    }
    if ($e instanceof AuthException) {
        $code = match ($e->status()) {
            419 => 'CSRF_ERROR',
            429 => 'RATE_LIMITED',
            default => 'AUTH_ERROR',
        };
        Response::error($code, $e->getMessage(), $e->status());
    }
    if ($e instanceof PermissionException) {
        Response::error('FORBIDDEN', 'You do not have permission to do that.', 403);
    }
    if ($e instanceof \DomainException) {
        Response::error('CONFLICT', $e->getMessage(), 409);
    }
    if ($e instanceof \RuntimeException) {
        Response::error('BAD_REQUEST', $e->getMessage(), 400);
    }
    error_log('[leadspark] ' . $e::class . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    Response::error('INTERNAL_ERROR', 'Something went wrong. Please try again.', 500);
});

/** @var AuthUser|null request-scoped authenticated user */
$GLOBALS['__crm_user'] = null;

/** Authenticate via the access-token cookie; CSRF-protect mutations. */
function requireApiAuth(): AuthUser
{
    if ($GLOBALS['__crm_user'] instanceof AuthUser) {
        return $GLOBALS['__crm_user'];
    }
    $jwt = Request::cookie(Cookie::ACCESS);
    if ($jwt === null) {
        throw new AuthException('Authentication required.', 401);
    }
    CsrfToken::protect();
    $user = AuthService::userFromAccessToken($jwt);
    $GLOBALS['__crm_user'] = $user;
    return $user;
}

function currentUser(): AuthUser
{
    return requireApiAuth();
}

function requirePermission(string $permission): void
{
    PermissionService::assert(requireApiAuth(), $permission);
}

function checkPermission(string $permission): bool
{
    return PermissionService::can(requireApiAuth(), $permission);
}

function requireMethod(string ...$methods): void
{
    if (!in_array(Request::method(), array_map('strtoupper', $methods), true)) {
        Response::error('METHOD_NOT_ALLOWED', 'Method not allowed.', 405);
    }
}
