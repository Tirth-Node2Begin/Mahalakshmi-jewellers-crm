<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/src/Support/api_bootstrap.php';

use CRM\Auth\AuthService;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Security\Cookie;

requireMethod('GET');

// Never 401s: the frontend probes this quietly and falls back to refresh.
$jwt = Request::cookie(Cookie::ACCESS);
if ($jwt === null) {
    Response::success(['authenticated' => false]);
}

try {
    $user = AuthService::userFromAccessToken($jwt);
    Response::success(['authenticated' => true, 'user' => $user->toArray()]);
} catch (\Throwable) {
    Response::success(['authenticated' => false]);
}
