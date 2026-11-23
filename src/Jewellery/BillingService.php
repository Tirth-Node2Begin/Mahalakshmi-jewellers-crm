<?php

declare(strict_types=1);

namespace CRM\Jewellery;

use CRM\Accounting\Ledgers;
use CRM\Accounting\VoucherService;
use CRM\Database\Database;
use CRM\Support\Audit;
use CRM\Support\NumberSequence;

/**
 * Bill finalisation — the concurrency-critical path (plan/07 §2).
 *
 * A draft touches nothing: no number, no stock, no ledger. finalize() then does
 * ALL of this inside ONE transaction, so multiple counters can bill at once:
 *
 *   1. lock every tagged piece (ascending id → no deadlock cycles)
 *   2. lock bulk SKUs and check availability
 *   3. allocate the invoice number under a row lock (gap-free, unique)
 *   4. write stock-out rows and flip tagged pieces to 'sold'
 *   5. post the balanced sale voucher (+ COGS)
 *   6. take in old metal
 *   7. record payments and post their receipt voucher
 *
 * Any failure rolls the whole thing back — a half-billed sale cannot exist.
 */
final class BillingService
{
    /** Finalise a draft invoice. Returns the invoice id. */
    public static function finalize(int $invoiceId, array $input, ?int $userId): int
    {
        return Database::transaction(static function () use ($invoiceId, $input, $userId): int {
            $invoice = Database::fetchOne(
                'SELECT * FROM invoices WHERE id = :id FOR UPDATE',
                ['id' => $invoiceId]
            );
            if ($invoice === null) {
                throw new \RuntimeException('Bill not found.');
            }
            if ($invoice['status'] === 'final') {
                throw new \DomainException('This bill is already finalised.');
            }
            if ($invoice['status'] === 'cancelled') {
                throw new \DomainException('This bill was cancelled.');
            }

            $lines = Database::fetchAll(
                'SELECT * FROM invoice_items WHERE invoice_id = :id ORDER BY inventory_item_id, id',
                ['id' => $invoiceId]
            );
            if ($lines === []) {
                throw new \RuntimeException('Add at least one item before saving the bill.');
            }

            $billDate = (string) $invoice['invoice_date'];
            $isWalkIn = $invoice['customer_id'] === null;

            // ---------- 1 & 2. lock stock (ascending item id avoids deadlocks) ----------
            $locked = [];
            $itemIds = array_values(array_unique(array_filter(array_map(
                static fn (array $l): ?int => $l['inventory_item_id'] !== null ? (int) $l['inventory_item_id'] : null,
                $lines
            ))));
            sort($itemIds);

            foreach ($itemIds as $itemId) {
                $itemLines = array_values(array_filter(
                    $lines,
                    static fn (array $l): bool => (int) ($l['inventory_item_id'] ?? 0) === $itemId
                ));
                $tracking = Database::fetchValue(
                    'SELECT tracking FROM inventory_items WHERE id = :id',
                    ['id' => $itemId]
                );

                if ($tracking === 'tagged') {
                    $locked[$itemId] = StockService::lockTaggedForSale($itemId);
                } else {
                    $qty = array_sum(array_map(static fn (array $l): float => (float) $l['qty'], $itemLines));
                    $weight = array_sum(array_map(static fn (array $l): float => (float) $l['net_weight'], $itemLines));
                    $locked[$itemId] = StockService::lockBulkForSale($itemId, $qty, $weight);
                }
            }

            // ---------- 3. invoice number (row-locked sequence) ----------
            $invoiceNo = NumberSequence::next('invoice');

            // ---------- totals (recomputed server-side; the client is never trusted) ----------
            $totals = self::totalsFromLines($lines);
            $oldMetal = Database::fetchAll(
                'SELECT * FROM invoice_old_metal WHERE invoice_id = :id',
                ['id' => $invoiceId]
            );
            $oldMetalValue = round(array_sum(array_map(
                static fn (array $o): float => (float) $o['value'],
                $oldMetal
            )), 2);

            // the whole-bill discount PLUS every per-line discount: both are real
            // money off the bill and both belong in Discount Given
            $discount = round((float) $invoice['bill_discount'] + $totals['discount'], 2);
            $beforeRounding = round(
                $totals['metal'] + $totals['making'] - $discount + $totals['tax'] - $oldMetalValue,
                2
            );
            [$roundOff, $grandTotal] = Pricing::roundOff($beforeRounding);

            Database::execute(
                "UPDATE invoices SET
                    invoice_no = :no, status = 'final', finalized_at = NOW(),
                    subtotal = :sub, metal_total = :metal, making_total = :making,
                    discount_total = :disc, tax_total = :tax, cgst = :cgst, sgst = :sgst, igst = :igst,
                    old_metal_value = :old, round_off = :ro, grand_total = :gt
                  WHERE id = :id",
                [
                    'no' => $invoiceNo,
                    'sub' => round($totals['metal'] + $totals['making'], 2),
                    'disc' => $discount,
                    'metal' => $totals['metal'],
                    'making' => $totals['making'],
                    'tax' => $totals['tax'],
                    'cgst' => $totals['cgst'],
                    'sgst' => $totals['sgst'],
                    'igst' => $totals['igst'],
                    'old' => $oldMetalValue,
                    'ro' => $roundOff,
                    'gt' => $grandTotal,
                    'id' => $invoiceId,
                ]
            );

            // ---------- 4. stock out + COGS ----------
            $cogsTotal = 0.0;
            $inventoryCredits = [];      // inventory ledger id => cost released

            foreach ($lines as $line) {
                $itemId = $line['inventory_item_id'] !== null ? (int) $line['inventory_item_id'] : null;
                if ($itemId === null) {
                    continue;            // making-only / custom line: no stock effect
                }
                $item = $locked[$itemId];
                $qty = (float) $line['qty'];
                $weight = (float) $line['net_weight'];

                // tagged pieces carry their own cost; bulk uses the pool's weighted average
                $cost = $item['tracking'] === 'tagged'
                    ? round((float) $item['avg_cost'] * (float) $item['net_weight'], 2)
                    : round(StockService::avgCostPerGram($itemId) * $weight, 2);

                StockService::record(
                    itemId: $itemId,
                    direction: 'out',
                    reason: 'sale',
                    qty: $qty,
                    weight: $weight,
                    value: $cost,
                    ratePerGram: (float) $line['rate_per_gram'],
                    invoiceId: $invoiceId,
                    userId: $userId
                );

                if ($item['tracking'] === 'tagged') {
                    StockService::setTaggedStatus($itemId, 'sold');
                }

                Database::execute(
                    'UPDATE invoice_items SET cost_value = :c WHERE id = :id',
                    ['c' => $cost, 'id' => $line['id']]
                );

                $cogsTotal += $cost;
                // relieve the SAME ledger this stock was taken in on — an
                // old-metal bucket leaves Inventory — Old Metal, not its metal
                $inventoryLedger = Ledgers::inventoryForItem(
                    $item['item_type'] ?? null,
                    $item['metal'] ?? null
                );
                $inventoryCredits[$inventoryLedger] = ($inventoryCredits[$inventoryLedger] ?? 0) + $cost;
            }

            // ---------- 5. the sale voucher ----------
            $entries = [];

            // what the customer owes (walk-ins sit on a control ledger until paid)
            $debtorLedger = $isWalkIn
                ? Ledgers::system('customer')
                : Ledgers::customer((int) $invoice['customer_id']);
            $entries[] = ['ledger_id' => $debtorLedger, 'dr' => $grandTotal];

            // old metal received reduces the cash owed and enters stock at its credited value
            if ($oldMetalValue > 0) {
                $entries[] = ['ledger_id' => Ledgers::system('old_metal'), 'dr' => $oldMetalValue];
            }
            if ($discount > 0) {
                $entries[] = ['ledger_id' => Ledgers::system('discount'), 'dr' => $discount];
            }

            foreach ($totals['metal_by_type'] as $metal => $amount) {
                if ($amount > 0) {
                    $entries[] = ['ledger_id' => Ledgers::system('sales', $metal), 'cr' => $amount];
                }
            }
            if ($totals['making'] > 0) {
                $entries[] = ['ledger_id' => Ledgers::system('making'), 'cr' => $totals['making']];
            }
            if ($totals['tax'] > 0) {
                $entries[] = ['ledger_id' => Ledgers::system('gst_output'), 'cr' => $totals['tax']];
            }
            if (abs($roundOff) > 0.001) {
                $roundLedger = Ledgers::system('round_off');
                $entries[] = $roundOff > 0
                    ? ['ledger_id' => $roundLedger, 'cr' => $roundOff]
                    : ['ledger_id' => $roundLedger, 'dr' => abs($roundOff)];
            }

            // cost of goods sold — makes the P&L show true gross profit
            if ($cogsTotal > 0.005) {
                $entries[] = ['ledger_id' => Ledgers::system('cogs'), 'dr' => round($cogsTotal, 2)];
                foreach ($inventoryCredits as $ledgerId => $cost) {
                    if ($cost > 0.005) {
                        $entries[] = ['ledger_id' => (int) $ledgerId, 'cr' => round($cost, 2)];
                    }
                }
            }

            $voucherId = VoucherService::post(
                vtype: 'sale',
                vdate: $billDate,
                entries: $entries,
                narration: 'Bill ' . $invoiceNo,
                refType: 'invoice',
                refId: $invoiceId,
                userId: $userId
            );
            Database::execute('UPDATE invoices SET voucher_id = :v WHERE id = :id', ['v' => $voucherId, 'id' => $invoiceId]);

            // ---------- 6. old metal into stock ----------
            foreach ($oldMetal as $om) {
                $bucketId = self::oldMetalBucket((string) $om['metal'], $om['purity_id'] !== null ? (int) $om['purity_id'] : null, $userId);
                StockService::record(
                    itemId: $bucketId,
                    direction: 'in',
                    reason: 'old_metal_in',
                    qty: 1,
                    weight: (float) $om['net_weight'],
                    value: (float) $om['value'],
                    ratePerGram: (float) $om['rate_per_gram'],
                    invoiceId: $invoiceId,
                    voucherId: $voucherId,
                    notes: 'Exchange on ' . $invoiceNo,
                    userId: $userId
                );
            }

            // ---------- 7. payments taken at the counter ----------
            $payments = $input['payments'] ?? [];
            foreach ($payments as $payment) {
                $amount = round((float) ($payment['amount'] ?? 0), 2);
                if ($amount <= 0) {
                    continue;
                }
                PaymentService::receiveForInvoice(
                    invoiceId: $invoiceId,
                    customerId: $invoice['customer_id'] !== null ? (int) $invoice['customer_id'] : null,
                    amount: $amount,
                    mode: (string) ($payment['mode'] ?? 'cash'),
                    bankAccountId: isset($payment['bank_account_id']) ? (int) $payment['bank_account_id'] : null,
                    refNo: $payment['ref_no'] ?? null,
                    date: $billDate,
                    userId: $userId
                );
            }

            self::recomputePaid($invoiceId);

            // a walk-in must leave nothing outstanding
            if ($isWalkIn) {
                $paid = (float) Database::fetchValue('SELECT paid_amount FROM invoices WHERE id = :id', ['id' => $invoiceId]);
                if ($paid + 0.01 < $grandTotal) {
                    throw new \RuntimeException('A walk-in bill must be paid in full. Add the customer to bill on credit.');
                }
            }

            Audit::log($userId, 'invoice.finalize', 'invoices', $invoiceId, null, [
                'invoice_no' => $invoiceNo,
                'grand_total' => $grandTotal,
                'voucher_id' => $voucherId,
            ]);

            return $invoiceId;
        });
    }

    /**
     * Cancel a finalised bill: reverse stock, restore tagged pieces, cancel the
     * voucher. Receipts stay as on-account credit for the customer.
     */
    public static function cancel(int $invoiceId, string $reason, ?int $userId): void
    {
        if (trim($reason) === '') {
            throw new \RuntimeException('A reason is required to cancel a bill.');
        }

        Database::transaction(static function () use ($invoiceId, $reason, $userId): void {
            $invoice = Database::fetchOne('SELECT * FROM invoices WHERE id = :id FOR UPDATE', ['id' => $invoiceId]);
            if ($invoice === null) {
                throw new \RuntimeException('Bill not found.');
            }
            if ($invoice['status'] !== 'final') {
                throw new \DomainException('Only a finalised bill can be cancelled.');
            }

            // reverse every stock movement this bill made
            $moves = Database::fetchAll(
                'SELECT * FROM inventory_transactions WHERE invoice_id = :id',
                ['id' => $invoiceId]
            );
            foreach ($moves as $move) {
                StockService::record(
                    itemId: (int) $move['item_id'],
                    direction: $move['type'] === 'out' ? 'in' : 'out',
                    reason: 'return',
                    qty: (float) $move['qty'],
                    weight: (float) $move['weight'],
                    value: (float) $move['value'],
                    ratePerGram: $move['rate_per_gram'] !== null ? (float) $move['rate_per_gram'] : null,
                    invoiceId: $invoiceId,
                    notes: 'Reversal — bill cancelled',
                    userId: $userId
                );
                if ($move['type'] === 'out') {
                    $tracking = Database::fetchValue(
                        'SELECT tracking FROM inventory_items WHERE id = :id',
                        ['id' => $move['item_id']]
                    );
                    if ($tracking === 'tagged') {
                        StockService::setTaggedStatus((int) $move['item_id'], 'in_stock');
                    }
                }
            }

            if ($invoice['voucher_id'] !== null) {
                VoucherService::cancel((int) $invoice['voucher_id'], $reason, $userId);
            }

            Database::execute(
                "UPDATE invoices SET status = 'cancelled', cancelled_by = :u, cancelled_at = NOW(), cancel_reason = :r
                  WHERE id = :id",
                ['u' => $userId, 'r' => mb_substr($reason, 0, 255), 'id' => $invoiceId]
            );

            Audit::log($userId, 'invoice.cancel', 'invoices', $invoiceId, ['status' => 'final'], [
                'status' => 'cancelled',
                'reason' => $reason,
            ]);
        });
    }

    /** paid_amount is always recomputed from the receipts, never incremented. */
    public static function recomputePaid(int $invoiceId): void
    {
        Database::execute(
            "UPDATE invoices SET paid_amount = (
                 SELECT COALESCE(SUM(amount), 0) FROM invoice_payments
                  WHERE invoice_id = :id1 AND status = 'active'
             ) WHERE id = :id2",
            ['id1' => $invoiceId, 'id2' => $invoiceId]
        );
    }

    /** @param list<array<string,mixed>> $lines */
    private static function totalsFromLines(array $lines): array
    {
        $metal = 0.0;
        $making = 0.0;
        $lineDiscount = 0.0;
        $cgst = 0.0;
        $sgst = 0.0;
        $igst = 0.0;
        $metalByType = [];

        foreach ($lines as $line) {
            $metalValue = (float) $line['metal_value'];
            $metal += $metalValue;
            $making += (float) $line['making_charge'];
            $lineDiscount += (float) $line['discount'];
            $cgst += (float) $line['cgst'];
            $sgst += (float) $line['sgst'];
            $igst += (float) $line['igst'];

            $type = self::metalOfLine($line);
            $metalByType[$type] = ($metalByType[$type] ?? 0) + $metalValue;
        }

        return [
            'metal' => round($metal, 2),
            'making' => round($making, 2),
            'discount' => round($lineDiscount, 2),
            'cgst' => round($cgst, 2),
            'sgst' => round($sgst, 2),
            'igst' => round($igst, 2),
            'tax' => round($cgst + $sgst + $igst, 2),
            'metal_by_type' => array_map(static fn (float $v): float => round($v, 2), $metalByType),
        ];
    }

    private static function metalOfLine(array $line): string
    {
        if ($line['inventory_item_id'] === null) {
            return Metals::GOLD;
        }
        $metal = Database::fetchValue(
            'SELECT metal FROM inventory_items WHERE id = :id',
            ['id' => $line['inventory_item_id']]
        );
        return Metals::normalise($metal);
    }

    /** The bulk SKU that holds old metal of a given metal+purity (created on demand). */
    private static function oldMetalBucket(string $metal, ?int $purityId, ?int $userId): int
    {
        $existing = Database::fetchValue(
            "SELECT id FROM inventory_items
              WHERE item_type = 'old_metal' AND metal = :m
                AND (purity_id <=> :p) LIMIT 1",
            ['m' => $metal, 'p' => $purityId]
        );
        if ($existing !== null) {
            return (int) $existing;
        }

        $categoryId = Database::fetchValue(
            "SELECT id FROM inventory_categories WHERE name = 'Old Metal' LIMIT 1"
        );
        $unitId = Database::fetchValue("SELECT id FROM units WHERE short_name IN ('g','gm') LIMIT 1")
            ?? Database::fetchValue('SELECT id FROM units LIMIT 1');
        $purityCode = $purityId !== null
            ? Database::fetchValue('SELECT code FROM purities WHERE id = :p', ['p' => $purityId])
            : null;

        return Database::insert('inventory_items', [
            'item_code' => NumberSequence::next('item_rm'),
            'name' => 'Old ' . ucfirst($metal) . ($purityCode !== null ? ' ' . $purityCode : ''),
            'item_type' => 'old_metal',
            'metal' => $metal,
            'purity_id' => $purityId,
            'tracking' => 'bulk',
            'category_id' => $categoryId !== null ? (int) $categoryId : null,
            'unit_id' => (int) $unitId,
            'created_by' => $userId,
        ]);
    }
}
