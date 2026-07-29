<?php

declare(strict_types=1);

namespace CRM\Jewellery;

use CRM\Accounting\Ledgers;
use CRM\Accounting\VoucherService;
use CRM\Database\Database;
use CRM\Support\Audit;
use CRM\Support\NumberSequence;

/**
 * Buying stock from vendors (plan/08 §2).
 *
 * One transaction turns a purchase into: new/updated inventory, stock-in rows,
 * and the balanced voucher
 *     Dr Inventory (per metal) + Dr GST Input   Cr Vendor
 *
 * A line may be:
 *   tagged  — a unique piece; creates its own inventory_items row
 *   bulk    — adds weight/value to an existing pool
 *   service — karigar making charges etc.; no stock, posts to Wages
 */
final class PurchaseService
{
    public static function create(array $input, ?int $userId): int
    {
        $supplierId = (int) ($input['supplier_id'] ?? 0);
        $lines = $input['items'] ?? [];
        $date = (string) ($input['purchase_date'] ?? date('Y-m-d'));

        if ($supplierId <= 0) {
            throw new \RuntimeException('Choose a vendor.');
        }
        if ($lines === []) {
            throw new \RuntimeException('Add at least one line to the purchase.');
        }

        return Database::transaction(static function () use ($supplierId, $lines, $date, $input, $userId): int {
            $vendor = Database::fetchOne('SELECT id, name, gstin FROM suppliers WHERE id = :id', ['id' => $supplierId]);
            if ($vendor === null) {
                throw new \RuntimeException('Vendor not found.');
            }

            $purchaseNo = NumberSequence::next('purchase');
            $purchaseId = Database::insert('purchases', [
                'purchase_no' => $purchaseNo,
                'supplier_id' => $supplierId,
                'purchase_date' => $date,
                'status' => 'received',
                'invoice_ref' => $input['bill_ref'] ?? null,
                'notes' => $input['notes'] ?? null,
                'created_by' => $userId,
            ]);

            $subtotal = 0.0;
            $taxTotal = 0.0;
            $inventoryDebits = [];     // metal => value
            $serviceTotal = 0.0;

            foreach ($lines as $line) {
                $kind = (string) ($line['kind'] ?? 'bulk');   // tagged | bulk | service
                $qty = max(0.0, (float) ($line['qty'] ?? 1));
                // a tagged piece is entered with gross/net weight, bulk metal with a
                // single `weight` — accept whichever the caller sent
                $weight = max(0.0, (float) (
                    $line['weight']
                    ?? $line['net_weight']
                    ?? $line['gross_weight']
                    ?? 0
                ));
                $ratePerGram = max(0.0, (float) ($line['rate_per_gram'] ?? 0));
                $makingCharge = max(0.0, (float) ($line['making_charge'] ?? 0));
                $taxRate = max(0.0, (float) ($line['tax_rate'] ?? 0));
                $metal = ($line['metal'] ?? null) === 'silver' ? 'silver' : 'gold';
                $purityId = isset($line['purity_id']) && $line['purity_id'] !== null ? (int) $line['purity_id'] : null;

                $amount = $kind === 'service'
                    ? round((float) ($line['amount'] ?? 0), 2)
                    : round($weight * $ratePerGram * ($kind === 'bulk' ? 1 : $qty) + $makingCharge, 2);

                if ($amount <= 0 && $kind !== 'service') {
                    throw new \RuntimeException('Each purchase line needs a value.');
                }

                $tax = round($amount * $taxRate / 100, 2);
                $subtotal += $amount;
                $taxTotal += $tax;

                $itemId = null;
                if ($kind !== 'service') {
                    $itemId = $kind === 'tagged'
                        ? self::createTaggedItem($line, $metal, $purityId, $weight, $amount, $userId)
                        : self::resolveBulkItem($line, $metal, $purityId, $userId);
                    if ($weight <= 0) {
                        throw new \RuntimeException('Each stock line needs a weight.');
                    }

                    StockService::record(
                        itemId: $itemId,
                        direction: 'in',
                        reason: 'purchase',
                        qty: $kind === 'tagged' ? 1 : $qty,
                        weight: $weight,
                        value: $amount,
                        ratePerGram: $ratePerGram > 0 ? $ratePerGram : null,
                        purchaseId: $purchaseId,
                        notes: 'Purchase ' . $purchaseNo,
                        userId: $userId
                    );

                    $inventoryDebits[$metal] = ($inventoryDebits[$metal] ?? 0) + $amount;
                } else {
                    $serviceTotal += $amount;
                }

                Database::insert('purchase_items', [
                    'purchase_id' => $purchaseId,
                    'item_id' => $itemId,
                    'description' => $line['description'] ?? null,
                    'metal' => $kind === 'service' ? null : $metal,
                    'purity_id' => $purityId,
                    'qty' => $qty,
                    'weight' => $weight,
                    'rate' => $ratePerGram,
                    'rate_per_gram' => $ratePerGram,
                    'making_charge' => $makingCharge,
                    'tax_rate' => $taxRate,
                    'tax_amount' => $tax,
                    'line_total' => round($amount + $tax, 2),
                ]);
            }

            // inter-state → IGST, otherwise CGST+SGST
            $interState = self::isInterState($vendor['gstin'] ?? null);
            [$cgst, $sgst, $igst] = Pricing::splitTax(round($taxTotal, 2), $interState);

            $beforeRounding = round($subtotal + $taxTotal, 2);
            [$roundOff, $grandTotal] = Pricing::roundOff($beforeRounding);

            Database::execute(
                'UPDATE purchases SET subtotal = :s, tax_total = :t, cgst = :c, sgst = :sg, igst = :i,
                                      round_off = :ro, grand_total = :g WHERE id = :id',
                [
                    's' => round($subtotal, 2), 't' => round($taxTotal, 2),
                    'c' => $cgst, 'sg' => $sgst, 'i' => $igst,
                    'ro' => $roundOff, 'g' => $grandTotal, 'id' => $purchaseId,
                ]
            );

            // ---- voucher: Dr Inventory/Wages + Dr GST Input   Cr Vendor ----
            $entries = [];
            foreach ($inventoryDebits as $metal => $value) {
                $entries[] = ['ledger_id' => Ledgers::system('inventory', $metal), 'dr' => round($value, 2)];
            }
            if ($serviceTotal > 0.005) {
                $entries[] = ['ledger_id' => Ledgers::system('expense'), 'dr' => round($serviceTotal, 2)];
            }
            if ($taxTotal > 0.005) {
                $entries[] = ['ledger_id' => Ledgers::system('gst_input'), 'dr' => round($taxTotal, 2)];
            }
            if (abs($roundOff) > 0.001) {
                $roundLedger = Ledgers::system('round_off');
                $entries[] = $roundOff > 0
                    ? ['ledger_id' => $roundLedger, 'cr' => $roundOff]
                    : ['ledger_id' => $roundLedger, 'dr' => abs($roundOff)];
            }
            $entries[] = ['ledger_id' => Ledgers::vendor($supplierId), 'cr' => $grandTotal];

            $voucherId = VoucherService::post(
                vtype: 'purchase',
                vdate: $date,
                entries: $entries,
                narration: 'Purchase ' . $purchaseNo . ' — ' . $vendor['name'],
                refType: 'purchase',
                refId: $purchaseId,
                userId: $userId
            );

            Database::execute('UPDATE purchases SET voucher_id = :v WHERE id = :id', ['v' => $voucherId, 'id' => $purchaseId]);
            Database::execute(
                'UPDATE inventory_transactions SET voucher_id = :v WHERE purchase_id = :p',
                ['v' => $voucherId, 'p' => $purchaseId]
            );

            Audit::log($userId, 'purchase.create', 'purchases', $purchaseId, null, [
                'purchase_no' => $purchaseNo,
                'grand_total' => $grandTotal,
            ]);

            return $purchaseId;
        });
    }

    /** Cancel a purchase — blocked once any of its tagged pieces has been sold. */
    public static function cancel(int $purchaseId, string $reason, ?int $userId): void
    {
        if (trim($reason) === '') {
            throw new \RuntimeException('A reason is required to cancel a purchase.');
        }

        Database::transaction(static function () use ($purchaseId, $reason, $userId): void {
            $purchase = Database::fetchOne('SELECT * FROM purchases WHERE id = :id FOR UPDATE', ['id' => $purchaseId]);
            if ($purchase === null) {
                throw new \RuntimeException('Purchase not found.');
            }
            if ($purchase['status'] === 'cancelled') {
                throw new \DomainException('That purchase is already cancelled.');
            }

            $sold = Database::fetchValue(
                "SELECT i.item_code
                   FROM purchase_items pi
                   JOIN inventory_items i ON i.id = pi.item_id
                  WHERE pi.purchase_id = :p AND i.tracking = 'tagged' AND i.status = 'sold'
                  LIMIT 1",
                ['p' => $purchaseId]
            );
            if ($sold !== null) {
                throw new \DomainException("Cannot cancel — item {$sold} from this purchase has already been sold.");
            }

            foreach (Database::fetchAll('SELECT * FROM inventory_transactions WHERE purchase_id = :p', ['p' => $purchaseId]) as $move) {
                StockService::record(
                    itemId: (int) $move['item_id'],
                    direction: 'out',
                    reason: 'return',
                    qty: (float) $move['qty'],
                    weight: (float) $move['weight'],
                    value: (float) $move['value'],
                    purchaseId: $purchaseId,
                    notes: 'Reversal — purchase cancelled',
                    userId: $userId
                );
                $tracking = Database::fetchValue('SELECT tracking FROM inventory_items WHERE id = :id', ['id' => $move['item_id']]);
                if ($tracking === 'tagged') {
                    StockService::setTaggedStatus((int) $move['item_id'], 'removed');
                }
            }

            if ($purchase['voucher_id'] !== null) {
                VoucherService::cancel((int) $purchase['voucher_id'], $reason, $userId);
            }
            Database::execute(
                "UPDATE purchases SET status = 'cancelled', cancel_reason = :r WHERE id = :id",
                ['r' => mb_substr($reason, 0, 255), 'id' => $purchaseId]
            );

            Audit::log($userId, 'purchase.cancel', 'purchases', $purchaseId, ['status' => $purchase['status']], [
                'status' => 'cancelled',
                'reason' => $reason,
            ]);
        });
    }

    private static function createTaggedItem(array $line, string $metal, ?int $purityId, float $weight, float $cost, ?int $userId): int
    {
        $netWeight = (float) ($line['net_weight'] ?? $weight);
        $grossWeight = (float) ($line['gross_weight'] ?? $weight);
        if ($netWeight > $grossWeight + 0.0005) {
            throw new \RuntimeException('Net weight cannot exceed gross weight.');
        }

        $unitId = Database::fetchValue("SELECT id FROM units WHERE short_name IN ('g','gm') LIMIT 1")
            ?? Database::fetchValue('SELECT id FROM units LIMIT 1');

        return Database::insert('inventory_items', [
            'item_code' => NumberSequence::next('item_st'),
            'name' => (string) ($line['description'] ?? 'Jewellery item'),
            'item_type' => 'stock',
            'metal' => $metal,
            'purity_id' => $purityId,
            'tracking' => 'tagged',
            'category_id' => isset($line['category_id']) ? (int) $line['category_id'] : null,
            'unit_id' => (int) $unitId,
            'gross_weight' => round($grossWeight, 3),
            'net_weight' => round($netWeight, 3),
            'stone_weight' => round(max(0, $grossWeight - $netWeight), 3),
            'making_type' => (string) ($line['making_type'] ?? 'per_gram'),
            'making_value' => (float) ($line['making_value'] ?? 0),
            'huid' => $line['huid'] ?? null,
            'hsn_code' => (string) ($line['hsn_code'] ?? '7113'),
            'barcode' => $line['barcode'] ?? null,
            'status' => 'in_stock',
            'avg_cost' => $netWeight > 0.0005 ? round($cost / $netWeight, 2) : 0,
            'created_by' => $userId,
        ]);
    }

    private static function resolveBulkItem(array $line, string $metal, ?int $purityId, ?int $userId): int
    {
        if (!empty($line['item_id'])) {
            return (int) $line['item_id'];
        }

        $existing = Database::fetchValue(
            "SELECT id FROM inventory_items
              WHERE tracking = 'bulk' AND item_type = 'raw_material' AND metal = :m AND (purity_id <=> :p)
              LIMIT 1",
            ['m' => $metal, 'p' => $purityId]
        );
        if ($existing !== null) {
            return (int) $existing;
        }

        $unitId = Database::fetchValue("SELECT id FROM units WHERE short_name IN ('g','gm') LIMIT 1")
            ?? Database::fetchValue('SELECT id FROM units LIMIT 1');
        $purityCode = $purityId !== null
            ? Database::fetchValue('SELECT code FROM purities WHERE id = :p', ['p' => $purityId])
            : null;

        return Database::insert('inventory_items', [
            'item_code' => NumberSequence::next('item_rm'),
            'name' => ucfirst($metal) . ($purityCode !== null ? ' ' . $purityCode : '') . ' (bulk)',
            'item_type' => 'raw_material',
            'metal' => $metal,
            'purity_id' => $purityId,
            'tracking' => 'bulk',
            'unit_id' => (int) $unitId,
            'created_by' => $userId,
        ]);
    }

    /** Vendor GSTIN state code differs from ours → IGST. */
    private static function isInterState(?string $vendorGstin): bool
    {
        if ($vendorGstin === null || strlen($vendorGstin) < 2) {
            return false;
        }
        $ownGstin = (string) Database::fetchValue(
            "SELECT svalue FROM settings WHERE skey = 'company_gstin' LIMIT 1"
        );
        if (strlen($ownGstin) < 2) {
            return false;
        }
        return substr($vendorGstin, 0, 2) !== substr($ownGstin, 0, 2);
    }
}
