<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Auth\PermissionService;
use CRM\Core\Response;

requireMethod('GET');
$user = requireApiAuth();

Response::success([
    'permissions' => PermissionService::permissionsFor($user),
    'data_scope' => PermissionService::dataScope($user),
]);
