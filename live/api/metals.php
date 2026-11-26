<?php

declare(strict_types=1);

/**
 * The metal master (gold, silver, platinum, …).
 *
 * Reading is open to anyone who can see stock, because every screen that picks a
 * metal needs the list. Adding one is `inventory.manage` — it writes two system
 * ledgers and a purity alongside the metal itself (see Metals::create).
 */

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Jewellery\Metals;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('inventory.read');
    Response::success(['metals' => Metals::all()]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    case 'create': {
        requirePermission('inventory.manage');
        $data = Validator::validate($body, [
            'name' => 'required|string|max:60',
            // derived from the name when the caller leaves it out
            'code' => 'nullable|string|max:30',
            // a metal with no purity cannot be priced, so the first one comes with it
            'purity_code' => 'required|string|max:10',
            'purity_label' => 'nullable|string|max:40',
            'fineness' => 'required|numeric|min:0.0001|max:1',
        ]);

        $metal = Metals::create($data, $user->id);
        Response::success([
            'metal' => $metal,
            'message' => $metal['name'] . ' added. You can now set its daily rate.',
        ], 201);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
