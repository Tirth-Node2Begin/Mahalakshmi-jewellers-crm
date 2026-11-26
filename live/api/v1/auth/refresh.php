<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/src/Support/api_bootstrap.php';

use CRM\Auth\AuthService;
use CRM\Core\Response;
use CRM\Security\CsrfToken;

requireMethod('POST');

// CSRF-protect the rotation (all legitimate callers hold the readable CSRF cookie).
CsrfToken::protect();

Response::success(AuthService::refresh());
