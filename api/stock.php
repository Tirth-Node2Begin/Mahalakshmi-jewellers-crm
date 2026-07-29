<?php

declare(strict_types=1);

/**
 * Jewellery stock (plan/06): weight/purity/HUID-aware item master, stock
 * summary, movements, adjustments and opening stock.
 *
 * Stock is always derived from inventory_transactions — the columns on
 * inventory_items are a cache StockService refreshes after every movement.
 */

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Accounting\Ledgers;
use CRM\Accounting\VoucherService;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Jewellery\RateService;
use CRM\Jewellery\StockService;
use CRM\Support\Audit;
use CRM\Support\NumberSequence;
use CRM\Validation\Validator;

$user = requireApiAuth();
$canSeeCost = checkPermission('reports.stock') || checkPermission('accounting.read');

if (Request::method() === 'GET') {
    requirePermission('inventory.read');
    $view = (string) ($_GET['view'] ?? 'items');

    if ($view === 'summary') {
        Response::success([
            'summary' => StockService::summary(),
            'purities' => RateService::purities(),
        ]);
    }

    if ($view === 'detail') {
        $id = (int) ($_GET['id'] ?? 0);
        $item = Database::fetchOne(
            'SELECT i.*, p.code AS purity_code, p.label AS purity_label, c.name AS category_name
               FROM inventory_items i
          LEFT JOIN purities p ON p.id = i.purity_id
          LEFT JOIN inventory_categories c ON c.id = i.category_id
              WHERE i.id = :id',
            ['id' => $id]
        );
        if ($item === null) {
            Response::error('NOT_FOUND', 'Item not found.', 404);
        }
        if (!$canSeeCost) {
            unset($item['avg_cost']);
        }
        $item['availability'] = StockService::availability($id);
        $item['movements'] = Database::fetchAll(
            "SELECT t.id, t.created_at, t.type, t.reason, t.qty, t.weight, t.rate_per_gram,
                    t.adjustment_reason, inv.invoice_no, pur.purchase_no, u.full_name AS user_name
               FROM inventory_transactions t
          LEFT JOIN invoices inv ON inv.id = t.invoice_id
          LEFT JOIN purchases pur ON pur.id = t.purchase_id
          LEFT JOIN users u ON u.id = t.created_by
              WHERE t.item_id = :id ORDER BY t.id DESC LIMIT 200",
            ['id' => $id]
        );
        Response::success(['item' => $item]);
    }

    // default: item list
    $sql = "SELECT i.id, i.item_code, i.name, i.metal, i.tracking, i.status, i.huid, i.barcode,
                   i.gross_weight, i.net_weight, i.stone_weight, i.making_type, i.making_value,
                   i.hsn_code, i.current_stock, i.is_active,
                   p.code AS purity_code, c.name AS category_name"
        . ($canSeeCost ? ', i.avg_cost' : '') . "
              FROM inventory_items i
         LEFT JOIN purities p ON p.id = i.purity_id
         LEFT JOIN inventory_categories c ON c.id = i.category_id
             WHERE i.is_active = 1";
    $params = [];

    foreach ([
        'metal' => 'i.metal = :metal',
        'purity_id' => 'i.purity_id = :purity_id',
        'category_id' => 'i.category_id = :category_id',
        'tracking' => 'i.tracking = :tracking',
        'status' => 'i.status = :status',
    ] as $key => $clause) {
        if (!empty($_GET[$key])) {
            $sql .= " AND {$clause}";
            $params[$key] = $_GET[$key];
        }
    }
    if (!empty($_GET['search'])) {
        $sql .= ' AND (i.item_code LIKE :q1 OR i.name LIKE :q2 OR i.huid LIKE :q3 OR i.barcode LIKE :q4)';
        $like = '%' . $_GET['search'] . '%';
        $params += ['q1' => $like, 'q2' => $like, 'q3' => $like, 'q4' => $like];
    }
    $sql .= ' ORDER BY i.item_code DESC LIMIT 300';

    Response::success([
        'items' => Database::fetchAll($sql, $params),
        'purities' => RateService::purities(),
        'categories' => Database::fetchAll(
            'SELECT id, name, item_type FROM inventory_categories WHERE is_active = 1 ORDER BY name'
        ),
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    case 'save_item':
        requirePermission('inventory.manage');
        $data = Validator::validate($body, [
            'id' => 'nullable|int|min:1',
            'name' => 'required|string|max:150',
            'metal' => 'required|in:gold,silver',
            'purity_id' => 'required|int|min:1',
            'tracking' => 'required|in:tagged,bulk',
            'category_id' => 'nullable|int|min:1',
            'gross_weight' => 'nullable|numeric|min:0',
            'net_weight' => 'nullable|numeric|min:0',
            'making_type' => 'nullable|in:per_gram,fixed,percent',
            'making_value' => 'nullable|numeric|min:0',
            'huid' => 'nullable|string|max:10',
            'hsn_code' => 'nullable|string|max:10',
            'barcode' => 'nullable|string|max:40',
        ]);

        $gross = (float) ($data['gross_weight'] ?? 0);
        $net = (float) ($data['net_weight'] ?? 0);
        if ($net > $gross + 0.0005) {
            Response::error('VALIDATION_ERROR', 'Net weight cannot be more than gross weight.', 422, [
                'net_weight' => 'Cannot exceed gross weight.',
            ]);
        }

        $fields = [
            'name' => $data['name'],
            'metal' => $data['metal'],
            'purity_id' => (int) $data['purity_id'],
            'tracking' => $data['tracking'],
            'category_id' => $data['category_id'] !== null ? (int) $data['category_id'] : null,
            'gross_weight' => round($gross, 3),
            'net_weight' => round($net, 3),
            'stone_weight' => round(max(0, $gross - $net), 3),
            'making_type' => $data['making_type'] ?? 'per_gram',
            'making_value' => (float) ($data['making_value'] ?? 0),
            'huid' => $data['huid'] ?: null,
            'hsn_code' => $data['hsn_code'] ?: '7113',
            'barcode' => $data['barcode'] ?: null,
        ];

        if (!empty($data['id'])) {
            $id = (int) $data['id'];
            Database::execute(
                'UPDATE inventory_items SET name = :name, metal = :metal, purity_id = :purity_id,
                        tracking = :tracking, category_id = :category_id, gross_weight = :gross_weight,
                        net_weight = :net_weight, stone_weight = :stone_weight, making_type = :making_type,
                        making_value = :making_value, huid = :huid, hsn_code = :hsn_code, barcode = :barcode
                  WHERE id = :id',
                $fields + ['id' => $id]
            );
            Audit::log($user->id, 'item.update', 'inventory_items', $id, null, $fields);
            Response::success(['id' => $id, 'message' => 'Item saved.']);
        }

        $unitId = Database::fetchValue("SELECT id FROM units WHERE short_name = 'g' LIMIT 1")
            ?? Database::fetchValue('SELECT id FROM units LIMIT 1');

        $id = Database::transaction(static function () use ($fields, $data, $unitId, $user): int {
            return Database::insert('inventory_items', $fields + [
                'item_code' => NumberSequence::next($data['tracking'] === 'tagged' ? 'item_st' : 'item_rm'),
                'item_type' => $data['tracking'] === 'tagged' ? 'stock' : 'raw_material',
                'unit_id' => (int) $unitId,
                'status' => 'in_stock',
                'created_by' => $user->id,
            ]);
        });
        Audit::log($user->id, 'item.create', 'inventory_items', $id, null, $fields);
        Response::success(['id' => $id, 'message' => 'Item created.'], 201);

    case 'adjust':
        // stock correction — a written reason is mandatory and always audited
        requirePermission('inventory.adjust');
        $data = Validator::validate($body, [
            'item_id' => 'required|int|min:1',
            'direction' => 'required|in:in,out',
            'qty' => 'nullable|numeric|min:0',
            'weight' => 'required|numeric|min:0.001',
            'reason' => 'required|string|max:255',
        ]);

        $itemId = (int) $data['item_id'];
        $weight = (float) $data['weight'];
        $qty = (float) ($data['qty'] ?? 1);
        $direction = (string) $data['direction'];

        Database::transaction(static function () use ($itemId, $direction, $qty, $weight, $data, $user): void {
            $item = Database::fetchOne(
                'SELECT id, item_code, metal, tracking, status FROM inventory_items WHERE id = :id FOR UPDATE',
                ['id' => $itemId]
            );
            if ($item === null) {
                throw new RuntimeException('Item not found.');
            }

            $costPerGram = StockService::avgCostPerGram($itemId);
            $value = round($costPerGram * $weight, 2);

            if ($direction === 'out') {
                $available = StockService::availability($itemId);
                if ($weight > $available['weight'] + 0.0005) {
                    throw new DomainException(sprintf(
                        'Only %.3f g of %s is in stock.',
                        $available['weight'],
                        $item['item_code']
                    ));
                }
            }

            // value the correction so the books follow the stock
            $voucherId = null;
            if ($value > 0.005) {
                $inventoryLedger = $item['metal'] !== null
                    ? Ledgers::system('inventory', (string) $item['metal'])
                    : Ledgers::system('old_metal');
                $lossLedger = Ledgers::system('stock_adjust');

                $voucherId = VoucherService::post(
                    vtype: 'adjustment',
                    vdate: date('Y-m-d'),
                    entries: $direction === 'out'
                        ? [['ledger_id' => $lossLedger, 'dr' => $value], ['ledger_id' => $inventoryLedger, 'cr' => $value]]
                        : [['ledger_id' => $inventoryLedger, 'dr' => $value], ['ledger_id' => $lossLedger, 'cr' => $value]],
                    narration: 'Stock adjustment — ' . $data['reason'],
                    refType: 'stock_adjustment',
                    refId: $itemId,
                    userId: $user->id
                );
            }

            StockService::record(
                itemId: $itemId,
                direction: $direction,
                reason: 'adjustment',
                qty: $qty,
                weight: $weight,
                value: $value,
                voucherId: $voucherId,
                notes: 'Adjustment ' . NumberSequence::next('adjustment'),
                adjustmentReason: (string) $data['reason'],
                userId: $user->id
            );

            if ($item['tracking'] === 'tagged' && $direction === 'out') {
                StockService::setTaggedStatus($itemId, 'removed');
            }

            Audit::log($user->id, 'stock.adjust', 'inventory_items', $itemId, null, [
                'direction' => $direction,
                'weight' => $weight,
                'reason' => $data['reason'],
            ]);
        });

        Response::success(['message' => 'Stock adjusted.']);

    case 'opening':
        // setup-time opening stock: posts against Opening Balances Equity
        requirePermission('inventory.opening');
        $data = Validator::validate($body, [
            'item_id' => 'required|int|min:1',
            'qty' => 'nullable|numeric|min:0',
            'weight' => 'required|numeric|min:0.001',
            'value' => 'required|numeric|min:0',
        ]);

        $itemId = (int) $data['item_id'];
        $weight = (float) $data['weight'];
        $value = (float) $data['value'];

        Database::transaction(static function () use ($itemId, $data, $weight, $value, $user): void {
            $item = Database::fetchOne('SELECT id, metal FROM inventory_items WHERE id = :id', ['id' => $itemId]);
            if ($item === null) {
                throw new RuntimeException('Item not found.');
            }
            $inventoryLedger = $item['metal'] !== null
                ? Ledgers::system('inventory', (string) $item['metal'])
                : Ledgers::system('old_metal');

            $voucherId = VoucherService::post(
                vtype: 'opening',
                vdate: date('Y-m-d'),
                entries: [
                    ['ledger_id' => $inventoryLedger, 'dr' => $value],
                    ['ledger_id' => Ledgers::system('opening_equity'), 'cr' => $value],
                ],
                narration: 'Opening stock',
                refType: 'opening_stock',
                refId: $itemId,
                userId: $user->id
            );

            StockService::record(
                itemId: $itemId,
                direction: 'in',
                reason: 'opening',
                qty: (float) ($data['qty'] ?? 1),
                weight: $weight,
                value: $value,
                ratePerGram: $weight > 0 ? round($value / $weight, 2) : null,
                voucherId: $voucherId,
                notes: 'Opening stock',
                userId: $user->id
            );

            Audit::log($user->id, 'stock.opening', 'inventory_items', $itemId, null, [
                'weight' => $weight,
                'value' => $value,
            ]);
        });

        Response::success(['message' => 'Opening stock recorded.']);

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
