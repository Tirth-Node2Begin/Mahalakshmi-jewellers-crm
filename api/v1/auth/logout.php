<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/src/Support/api_bootstrap.php';

use CRM\Auth\AuthException;
use CRM\Auth\AuthService;
use CRM\Core\Response;
use CRM\Security\CsrfToken;

requireMethod('POST');

// Best-effort CSRF: a user must always be able to log out (even with an expired
// access token), but a valid CSRF token is checked when present to reject
// cross-site forced logout. A missing token still clears the session.
try {
    CsrfToken::protect();
} catch (AuthException) {
    // proceed — clearing the session is the safe outcome
}

AuthService::logout();

Response::success(['message' => 'Logged out.']);
