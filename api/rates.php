<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Jewellery\RateService;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('rates.read');
    $date = (string) ($_GET['date'] ?? date('Y-m-d'));

    Response::success([
        'date' => $date,
        'purities' => RateService::purities($date),
        'rates_set' => RateService::ratesSetFor($date),
        'history' => RateService::history(30),
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? 'set');

switch ($action) {
    case 'set': {
        requirePermission('rates.set');
        $data = Validator::validate($body, [
            'date' => 'nullable|date',
            'rates' => 'required|array|min:1',
        ]);
        $date = $data['date'] ?? date('Y-m-d');

        // rates arrives as { purity_id: rate_per_gram }
        RateService::setRates($data['rates'], $date, $user->id);
        Response::success(['message' => "Today's rates saved."]);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
