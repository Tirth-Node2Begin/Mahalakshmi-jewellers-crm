<?php

declare(strict_types=1);

/**
 * One-off repair: bring tagged pieces back to a legal ledger position.
 *
 * A tagged piece is ONE physical item, so the stock ledger may only ever say it
 * is there (qty 1 at its own weight) or gone (qty 0, weight 0). Two now-closed
 * holes broke that:
 *
 *   1. the stock-adjustment screen accepted an "in" correction on a tagged
 *      piece, so a single ring could be told it was six rings and 100 g — which
 *      also parked real money on the Inventory ledger for stock that was never
 *      there (api/stock.php, case 'adjust');
 *   2. billing only checked a piece's `status`, so a piece created but never
 *      received could be sold, driving its ledger negative at zero cost
 *      (StockService::lockTaggedForSale).
 *
 * Both are fixed, but the rows they already wrote are still on the books. This
 * script writes a CORRECTING stock movement for each affected piece — nothing is
 * deleted — and, where the correction carries value, a reversing voucher through
 * the usual Stock Adjustment map, so the Inventory ledger and the stock ledger
 * move together.
 *
 * The correction is valued at the item's own weighted-average cost per gram, so
 * removing phantom weight removes exactly the money that phantom weight put on
 * the Inventory ledger.
 *
 * Run:  php cli/repair-tagged-stock.php            (dry run — prints the plan)
 *       php cli/repair-tagged-stock.php --apply     (writes it)
 *
 * Safe to re-run: once a piece sits in a legal position it is no longer
 * selected. Verify afterwards with `php cli/verify-ledger.php`.
 */

if (PHP_SAPI !== 'cli') {
    exit("CLI only\n");
}

require_once dirname(__DIR__) . '/src/bootstrap.php';

use CRM\Accounting\Ledgers;
use CRM\Accounting\VoucherService;
use CRM\Database\Database;
use CRM\Jewellery\StockService;
use CRM\Support\Audit;
use CRM\Support\NumberSequence;

$apply = in_array('--apply', $argv, true);

echo "Tagged stock repair" . ($apply ? '' : ' (dry run — pass --apply to write)') . "\n";
echo "-------------------\n";

// the same drift the verify-ledger tagged check reports
$broken = Database::fetchAll(
    "SELECT i.id, i.item_code, i.name, i.status, i.item_type, i.metal, i.net_weight,
            COALESCE((SELECT SUM(CASE WHEN type = 'in' THEN qty ELSE -qty END)
                        FROM inventory_transactions WHERE item_id = i.id), 0) AS net_qty,
            COALESCE((SELECT SUM(CASE WHEN type = 'in' THEN weight ELSE -weight END)
                        FROM inventory_transactions WHERE item_id = i.id), 0) AS net_weight_ledger,
            (SELECT COUNT(*) FROM inventory_transactions WHERE item_id = i.id) AS moves
       FROM inventory_items i
      WHERE i.tracking = 'tagged' AND i.is_active = 1
     HAVING (i.status = 'in_stock' AND moves > 0 AND net_qty <> 1)
         OR (i.status IN ('sold', 'removed') AND net_qty <> 0)
      ORDER BY i.id"
);

if ($broken === []) {
    echo "  Nothing to repair — every tagged piece sits in a legal position.\n";
    exit(0);
}

$plans = [];
foreach ($broken as $item) {
    $itemId = (int) $item['id'];
    $inStock = $item['status'] === 'in_stock';

    // where the ledger SHOULD be: one piece at its own weight, or nothing at all
    $targetQty = $inStock ? 1.0 : 0.0;
    $targetWeight = $inStock ? round((float) $item['net_weight'], 3) : 0.0;

    $qtyDelta = round($targetQty - (float) $item['net_qty'], 3);
    $weightDelta = round($targetWeight - (float) $item['net_weight_ledger'], 3);

    $direction = ($qtyDelta < 0 || $weightDelta < 0) ? 'out' : 'in';
    $costPerGram = StockService::avgCostPerGram($itemId);
    $value = round(abs($weightDelta) * $costPerGram, 2);

    $plans[] = [
        'item_id' => $itemId,
        'item_code' => (string) $item['item_code'],
        'name' => (string) $item['name'],
        'status' => (string) $item['status'],
        'item_type' => $item['item_type'],
        'metal' => $item['metal'],
        'from' => sprintf('qty %.3f / %.3f g', (float) $item['net_qty'], (float) $item['net_weight_ledger']),
        'to' => sprintf('qty %.3f / %.3f g', $targetQty, $targetWeight),
        'direction' => $direction,
        'qty' => abs($qtyDelta),
        'weight' => abs($weightDelta),
        'value' => $value,
    ];
}

foreach ($plans as $plan) {
    printf(
        "  %-9s %-26s %-9s %s  →  %s\n",
        $plan['item_code'],
        mb_substr($plan['name'], 0, 26),
        $plan['status'],
        $plan['from'],
        $plan['to']
    );
    printf(
        "            correction: %s qty %.3f, %.3f g, %s\n",
        strtoupper($plan['direction']),
        $plan['qty'],
        $plan['weight'],
        $plan['value'] > 0.005 ? '₹' . number_format($plan['value'], 2) . ' (reversing voucher)' : 'no value'
    );
}

if (!$apply) {
    echo "\n" . count($plans) . " piece(s) would be corrected. Re-run with --apply to write.\n";
    exit(0);
}

$userId = (int) (Database::fetchValue(
    "SELECT id FROM users WHERE username = 'admin' OR email LIKE 'admin@%' ORDER BY id LIMIT 1"
) ?? 0) ?: null;

$written = 0;
foreach ($plans as $plan) {
    Database::transaction(static function () use ($plan, $userId, &$written): void {
        $reason = 'Correction: a tagged piece holds one item only';

        $voucherId = null;
        if ($plan['value'] > 0.005) {
            $inventoryLedger = Ledgers::inventoryForItem($plan['item_type'], $plan['metal']);
            $lossLedger = Ledgers::system('stock_adjust');
            $voucherId = VoucherService::post(
                vtype: 'adjustment',
                vdate: date('Y-m-d'),
                entries: $plan['direction'] === 'out'
                    ? [
                        ['ledger_id' => $lossLedger, 'dr' => $plan['value']],
                        ['ledger_id' => $inventoryLedger, 'cr' => $plan['value']],
                    ]
                    : [
                        ['ledger_id' => $inventoryLedger, 'dr' => $plan['value']],
                        ['ledger_id' => $lossLedger, 'cr' => $plan['value']],
                    ],
                narration: 'Stock adjustment — ' . $reason,
                refType: 'stock_adjustment',
                refId: $plan['item_id'],
                userId: $userId
            );
        }

        StockService::record(
            itemId: $plan['item_id'],
            direction: $plan['direction'],
            reason: 'adjustment',
            qty: $plan['qty'],
            weight: $plan['weight'],
            value: $plan['value'],
            voucherId: $voucherId,
            notes: 'Adjustment ' . NumberSequence::next('adjustment'),
            adjustmentReason: $reason,
            userId: $userId
        );

        Audit::log($userId, 'stock.repair_tagged', 'inventory_items', $plan['item_id'], [
            'position' => $plan['from'],
        ], [
            'position' => $plan['to'],
            'direction' => $plan['direction'],
            'qty' => $plan['qty'],
            'weight' => $plan['weight'],
            'value' => $plan['value'],
            'voucher_id' => $voucherId,
            'reason' => $reason,
        ]);

        $written++;
    });
    echo "  corrected {$plan['item_code']}\n";
}

echo "\n{$written} piece(s) corrected. Now run: php cli/verify-ledger.php\n";
