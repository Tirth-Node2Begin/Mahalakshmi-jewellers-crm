<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/src/Support/api_bootstrap.php';

use CRM\Auth\AuthService;
use CRM\Core\Env;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Middleware\RateLimitMiddleware;
use CRM\Validation\Validator;

requireMethod('POST');

RateLimitMiddleware::check(
    'auth.login',
    Env::int('LOGIN_RATE_LIMIT', 15),
    Env::int('LOGIN_RATE_WINDOW', 300)
);

$data = Validator::validate(Request::json(), [
    'username' => 'required|string|max:150',
    'password' => 'required|string|max:255',
    'remember_me' => 'nullable|boolean',
]);

$result = AuthService::login($data['username'], $data['password'], (bool) ($data['remember_me'] ?? false));

RateLimitMiddleware::reset('auth.login');

Response::success($result);
