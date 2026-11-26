<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Response;
use CRM\Support\NavMap;

requireMethod('GET');
$user = requireApiAuth();

Response::success(NavMap::forUser($user));
