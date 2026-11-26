<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Response;
use CRM\Reports\DashboardRepository;

$user = requireApiAuth();
requireMethod('GET');
requirePermission('dashboard.read');

$months = isset($_GET['months']) ? (int) $_GET['months'] : 12;

Response::success(DashboardRepository::payload($user, $months));
