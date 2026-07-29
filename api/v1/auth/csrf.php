<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/src/Support/api_bootstrap.php';

use CRM\Core\Response;
use CRM\Security\CsrfToken;

requireMethod('GET');

Response::success(['csrf_token' => CsrfToken::issue()]);
