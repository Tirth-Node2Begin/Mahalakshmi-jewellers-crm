<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Validation\Validator;
use CRM\Vendors\VendorRepository;
use CRM\Vendors\VendorService;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('vendors.read');
    $view = $_GET['view'] ?? 'list';

    if ($view === 'detail') {
        $detail = VendorRepository::detail((int) ($_GET['id'] ?? 0));
        if ($detail === null) {
            Response::error('NOT_FOUND', 'Vendor not found.', 404);
        }
        Response::success($detail);
    }

    if ($view === 'picklist') {
        $makersOnly = ($_GET['role'] ?? '') === 'maker';
        Response::success(['vendors' => VendorRepository::pickList($makersOnly)]);
    }

    if ($view === 'types') {
        Response::success(['types' => VendorService::customTypes()]);
    }

    Response::success([
        'vendors' => VendorRepository::list([
            'vendor_type' => $_GET['vendor_type'] ?? null,
            'status' => $_GET['status'] ?? null,
            'search' => $_GET['search'] ?? null,
        ]),
        'stats' => VendorRepository::stats(),
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    case 'save':
        requirePermission('vendors.manage');
        $id = VendorService::save($body, $user);
        Response::success(['message' => 'Vendor saved.', 'id' => $id]);

    case 'add_type':
        requirePermission('vendors.manage');
        Response::success(['message' => 'Type added.', 'type' => VendorService::addType($body, $user)]);

    case 'toggle':
        requirePermission('vendors.manage');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        VendorService::toggle((int) $data['id']);
        Response::success(['message' => 'Vendor updated.']);

    case 'delete':
        requirePermission('vendors.manage');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        VendorService::delete((int) $data['id']);
        Response::success(['message' => 'Vendor deleted.']);

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
