<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Inventory\InventoryRepository;
use CRM\Inventory\InventoryService;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('inventory.read');
    $view = $_GET['view'] ?? 'list';

    if ($view === 'detail') {
        $id = (int) ($_GET['id'] ?? 0);
        $detail = InventoryRepository::detail($id);
        if ($detail === null) {
            Response::error('NOT_FOUND', 'Item not found.', 404);
        }
        Response::success($detail);
    }

    if ($view === 'picklist') {
        Response::success(['items' => InventoryRepository::pickList($_GET['item_type'] ?? null)]);
    }

    Response::success(InventoryRepository::list([
        'item_type' => $_GET['item_type'] ?? null,
        'category_id' => $_GET['category_id'] ?? null,
        'search' => $_GET['search'] ?? null,
        'low_stock' => $_GET['low_stock'] ?? null,
        'status' => $_GET['status'] ?? 'active',
    ]));
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    case 'create':
        requirePermission('inventory.manage');
        $id = InventoryService::createItem($body, $user);
        Response::success(['message' => 'Item created.', 'id' => $id], 201);

    case 'update':
        requirePermission('inventory.manage');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        InventoryService::updateItem((int) $data['id'], $body, $user);
        Response::success(['message' => 'Item updated.']);

    case 'toggle':
        requirePermission('inventory.manage');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        InventoryService::toggleItem((int) $data['id']);
        Response::success(['message' => 'Item updated.']);

    case 'adjust':
        requirePermission('inventory.adjust');
        $txId = InventoryService::adjust($body, $user);
        Response::success(['message' => 'Stock adjusted.', 'transaction_id' => $txId], 201);

    case 'save_category':
        requirePermission('inventory.manage');
        $id = InventoryService::saveCategory($body);
        Response::success(['message' => 'Category saved.', 'id' => $id]);

    case 'toggle_category':
        requirePermission('inventory.manage');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        InventoryService::toggleCategory((int) $data['id']);
        Response::success(['message' => 'Category updated.']);

    case 'save_unit':
        requirePermission('inventory.manage');
        $id = InventoryService::saveUnit($body);
        Response::success(['message' => 'Unit saved.', 'id' => $id]);

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
