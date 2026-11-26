<?php

declare(strict_types=1);

namespace CRM\Invoices;

use CRM\Auth\AuthUser;
use CRM\Database\Database;
use CRM\Inventory\InventoryService;
use CRM\Support\CustomerTimeline;
use CRM\Support\NumberSequence;
use CRM\Validation\Validator;

/**
 * Invoice money engine (planning/09). Invariants:
 * - totals recomputed from line items on every mutation
 * - paid_amount recomputed from payments (bounced cheques excluded)
 * - status is explicit, never derived: draft → final → cancelled. "Unpaid / part paid"
 *   is not a status, it is `status='final' AND paid_amount < grand_total`.
 * - every money mutation runs inside Database::transaction()
 * Stock lines are validated but do NOT move inventory until Phase 5.
 */
final class InvoiceService
{
    public const PAYMENT_MODES = ['cash', 'upi', 'bank', 'card', 'cheque'];

    // --------------------------------------------------------------- create

    public static function create(array $body, AuthUser $user): int
    {
        $header = self::validateHeader($body);
        $items = self::validateItems($body['items'] ?? []);

        if (Database::fetchValue('SELECT id FROM customers WHERE id = :c AND is_active = 1', ['c' => $header['customer_id']]) === null) {
            throw new \RuntimeException('Customer not found.');
        }

        return Database::transaction(static function () use ($header, $items, $user): int {
            $invoiceNo = NumberSequence::next('invoice');
            $invoiceId = Database::insert('invoices', $header + [
                'invoice_no' => $invoiceNo,
                'status' => 'draft',
                'created_by' => $user->id,
            ]);
            self::replaceItems($invoiceId, $items);
            self::recomputeTotals($invoiceId);
            return $invoiceId;
        });
    }

    public static function update(int $id, array $body, AuthUser $user): void
    {
        $invoice = self::findOrFail($id, $user);
        // Only drafts are editable — a finalized bill has already moved stock and gone to the
        // customer, so it is immutable (cancel + re-create to change one).
        if ($invoice['status'] !== 'draft') {
            throw new \DomainException('Only a draft bill can be edited. Cancel this bill and create a new one to change it.');
        }
        $header = self::validateHeader($body);
        $items = self::validateItems($body['items'] ?? []);

        Database::transaction(static function () use ($id, $invoice, $header, $items): void {
            // re-check draft under a row lock (a concurrent finalize must not be overwritten)
            $locked = Database::fetchOne('SELECT status FROM invoices WHERE id = :id FOR UPDATE', ['id' => $id]);
            if ($locked === null || $locked['status'] !== 'draft') {
                throw new \DomainException('Only a draft bill can be edited. Cancel this bill and create a new one to change it.');
            }
            unset($header['customer_id']); // customer fixed after creation
            $set = implode(', ', array_map(static fn (string $c): string => "`$c` = :$c", array_keys($header)));
            Database::execute("UPDATE invoices SET $set WHERE id = :pk", $header + ['pk' => $id]);
            self::replaceItems($id, $items);
            // guard: cannot reduce total below what's already paid
            $grand = self::recomputeTotals($id, apply: false);
            if ($grand + 0.001 < (float) $invoice['paid_amount']) {
                throw new \DomainException('Invoice total cannot be reduced below the amount already paid — delete or refund payments first.');
            }
            self::recomputeTotals($id);
        });
    }

    /** draft → final. Moves ready-stock lines OUT of inventory (the sale is now confirmed). */
    public static function finalize(int $id, AuthUser $user): void
    {
        $invoice = self::findOrFail($id, $user);
        if ($invoice['status'] !== 'draft') {
            throw new \DomainException('Only draft invoices can be finalized.');
        }
        Database::transaction(static function () use ($id, $invoice, $user): void {
            // re-check status under a row lock so two finalizes can't both post stock (TOCTOU)
            $locked = Database::fetchOne('SELECT status FROM invoices WHERE id = :id FOR UPDATE', ['id' => $id]);
            if ($locked === null || $locked['status'] !== 'draft') {
                throw new \DomainException('Only draft invoices can be finalized.');
            }
            Database::execute("UPDATE invoices SET status = 'final', finalized_at = NOW() WHERE id = :id", ['id' => $id]);
            // Stock OUT for every ready-stock line. postMovement() locks the item and refuses to
            // go negative, so finalizing fails cleanly if the stock isn't there.
            foreach (self::stockLineTotals($id) as $line) {
                InventoryService::postMovement(
                    (int) $line['inventory_item_id'], 'out', 'sale',
                    (float) $line['qty'], null, ['invoice_id' => $id], $user->id
                );
            }
            CustomerTimeline::log((int) $invoice['customer_id'], 'invoice_created',
                "Bill {$invoice['invoice_no']} finalized (" . number_format((float) $invoice['grand_total'], 2) . ').',
                'invoices', $id, $user->id);
        });
    }

    /** @return list<array{inventory_item_id:int,qty:float}> stock lines summed per item (avoids per-line partial checks). */
    private static function stockLineTotals(int $invoiceId): array
    {
        return Database::fetchAll(
            "SELECT inventory_item_id, SUM(qty) AS qty FROM invoice_items
             WHERE invoice_id = :id AND item_type IN ('tagged','bulk') AND inventory_item_id IS NOT NULL
             GROUP BY inventory_item_id
             ORDER BY inventory_item_id", // deterministic lock order avoids deadlocks
            ['id' => $invoiceId]
        );
    }

    public static function cancel(int $id, AuthUser $user): void
    {
        $invoice = self::findOrFail($id, $user);
        if ($invoice['status'] === 'cancelled') {
            return;
        }
        // block if ANY payment rows exist — even fully-bounced ones (Codex #6):
        // paid_amount can be 0 while bounced-cheque history remains.
        Database::transaction(static function () use ($id, $user): void {
            // lock + re-read under the lock so a concurrent finalize/payment can't slip past
            $locked = Database::fetchOne('SELECT status FROM invoices WHERE id = :id FOR UPDATE', ['id' => $id]);
            if ($locked === null || $locked['status'] === 'cancelled') {
                return; // nothing to do
            }
            $paymentCount = (int) Database::fetchValue('SELECT COUNT(*) FROM invoice_payments WHERE invoice_id = :id', ['id' => $id]);
            if ($paymentCount > 0) {
                throw new \DomainException('Cannot cancel an invoice that has payment records — delete or refund them first.');
            }
            $wasFinalized = $locked['status'] !== 'draft';
            // put stock back if it was taken out at finalize
            if ($wasFinalized) {
                foreach (self::stockLineTotals($id) as $line) {
                    InventoryService::postMovement(
                        (int) $line['inventory_item_id'], 'in', 'sale_reversal',
                        (float) $line['qty'], null, ['invoice_id' => $id], $user->id
                    );
                }
            }
            Database::execute("UPDATE invoices SET status = 'cancelled', cancelled_by = :u, cancelled_at = NOW() WHERE id = :id", ['u' => $user->id, 'id' => $id]);
        });
    }

    /**
     * Reopen a finalized (un-paid) bill back to draft so it can be edited: puts the stock
     * back, exactly like cancel() but keeps the bill and leaves it editable.
     * Blocked once any payment exists — remove the receipt first (paid tax invoices stay locked).
     */
    public static function reopen(int $id, AuthUser $user): void
    {
        $invoice = self::findOrFail($id, $user);
        if ($invoice['status'] === 'draft') {
            return; // already editable
        }
        if ($invoice['status'] === 'cancelled') {
            throw new \DomainException('A cancelled bill cannot be reopened — create a new one.');
        }
        Database::transaction(static function () use ($id, $user): void {
            $locked = Database::fetchOne('SELECT status FROM invoices WHERE id = :id FOR UPDATE', ['id' => $id]);
            if ($locked === null || $locked['status'] === 'draft') {
                return;
            }
            if ($locked['status'] === 'cancelled') {
                throw new \DomainException('A cancelled bill cannot be reopened — create a new one.');
            }
            $paymentCount = (int) Database::fetchValue('SELECT COUNT(*) FROM invoice_payments WHERE invoice_id = :id', ['id' => $id]);
            if ($paymentCount > 0) {
                throw new \DomainException('This bill has a payment recorded — delete the receipt first, then reopen it to edit.');
            }
            // put the ready-stock back that finalize took out
            foreach (self::stockLineTotals($id) as $line) {
                InventoryService::postMovement(
                    (int) $line['inventory_item_id'], 'in', 'sale_reversal',
                    (float) $line['qty'], null, ['invoice_id' => $id], $user->id
                );
            }
            Database::execute("UPDATE invoices SET status = 'draft', finalized_at = NULL WHERE id = :id", ['id' => $id]);
        });
    }

    public static function delete(int $id, AuthUser $user): void
    {
        $invoice = self::findOrFail($id, $user);
        if ($invoice['status'] !== 'draft') {
            throw new \DomainException('Only draft invoices can be deleted — cancel a finalised bill instead.');
        }
        Database::transaction(static function () use ($id): void {
            // re-check draft under a row lock (a concurrent finalize must not be deleted mid-flight)
            $locked = Database::fetchOne('SELECT status FROM invoices WHERE id = :id FOR UPDATE', ['id' => $id]);
            if ($locked === null || $locked['status'] !== 'draft') {
                throw new \DomainException('Only draft invoices can be deleted — cancel a finalised bill instead.');
            }
            Database::execute('DELETE FROM invoices WHERE id = :id', ['id' => $id]); // items cascade
        });
    }

    // -------------------------------------------------------------- payments

    public static function addPayment(int $invoiceId, array $body, AuthUser $user): int
    {
        $invoice = self::findOrFail($invoiceId, $user);
        if (in_array($invoice['status'], ['draft', 'cancelled'], true)) {
            throw new \DomainException('Finalize the invoice before recording a payment.');
        }

        $data = Validator::validate($body, [
            'amount' => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'payment_mode' => 'required|in:' . implode(',', self::PAYMENT_MODES),
            'bank_account_id' => 'nullable|int|min:1',
            'cheque_number' => 'nullable|string|max:50',
            'cheque_date' => 'nullable|date',
            'cheque_bank' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:500',
        ]);

        $amount = round((float) $data['amount'], 2);
        self::assertBankIfNeeded($data['payment_mode'], $data['bank_account_id'] ?? null);

        return Database::transaction(static function () use ($invoiceId, $invoice, $data, $amount, $user): int {
            // lock the invoice row so concurrent payments can't both pass the cap (Codex #5)
            $locked = Database::fetchOne('SELECT grand_total FROM invoices WHERE id = :id FOR UPDATE', ['id' => $invoiceId]);
            $currentPaid = (float) Database::fetchValue(
                "SELECT COALESCE(SUM(amount), 0) FROM invoice_payments
                 WHERE invoice_id = :id AND (payment_mode <> 'cheque' OR cheque_status <> 'bounced' OR cheque_status IS NULL)
                   AND status <> 'cancelled'",
                ['id' => $invoiceId]
            );
            $balance = (float) $locked['grand_total'] - $currentPaid;
            if ($amount > $balance + 0.001) {
                throw new \DomainException('Payment exceeds the outstanding balance (₹' . number_format($balance, 2) . ').');
            }
            $isCheque = $data['payment_mode'] === 'cheque';
            $paymentId = Database::insert('invoice_payments', [
                'invoice_id' => $invoiceId,
                'receipt_no' => NumberSequence::next('receipt'),
                'amount' => $amount,
                'payment_date' => $data['payment_date'],
                'payment_mode' => $data['payment_mode'],
                'bank_account_id' => $data['bank_account_id'] ?? null,
                'cheque_number' => $data['cheque_number'] ?? null,
                'cheque_date' => $data['cheque_date'] ?? null,
                'cheque_bank' => $data['cheque_bank'] ?? null,
                'cheque_status' => $isCheque ? 'pending' : null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $user->id,
            ]);
            self::recomputePaid($invoiceId);
            CustomerTimeline::log((int) $invoice['customer_id'], 'payment_received',
                'Payment ₹' . number_format($amount, 2) . " on {$invoice['invoice_no']}", 'invoices', $invoiceId, $user->id);
            return $paymentId;
        });
    }

    public static function deletePayment(int $paymentId, AuthUser $user): void
    {
        $payment = Database::fetchOne('SELECT * FROM invoice_payments WHERE id = :id', ['id' => $paymentId]);
        if ($payment === null) {
            throw new \RuntimeException('Payment not found.');
        }
        self::findOrFail((int) $payment['invoice_id'], $user); // scope check via parent invoice
        Database::transaction(static function () use ($payment): void {
            Database::execute('DELETE FROM invoice_payments WHERE id = :id', ['id' => $payment['id']]);
            self::recomputePaid((int) $payment['invoice_id']);
        });
    }

    /** Cheque lifecycle: pending → deposited → cleared | bounced (bounce excludes it from paid). */
    public static function updateChequeStatus(int $paymentId, string $status, ?int $depositBankId, AuthUser $user): void
    {
        $payment = Database::fetchOne('SELECT * FROM invoice_payments WHERE id = :id', ['id' => $paymentId]);
        if ($payment === null || $payment['payment_mode'] !== 'cheque') {
            throw new \RuntimeException('Cheque payment not found.');
        }
        self::findOrFail((int) $payment['invoice_id'], $user); // scope check via parent invoice
        if (!in_array($status, ['deposited', 'cleared', 'bounced'], true)) {
            throw new \RuntimeException('Invalid cheque status.');
        }
        // allowed transitions (Codex #4): pending→deposited/bounced, deposited→cleared/bounced.
        // 'cleared' is terminal; a bounced cheque cannot be silently re-cleared.
        $current = (string) ($payment['cheque_status'] ?? 'pending');
        $allowed = [
            'pending' => ['deposited', 'bounced'],
            'deposited' => ['cleared', 'bounced'],
            'cleared' => [],
            'bounced' => [],
        ];
        if (!in_array($status, $allowed[$current] ?? [], true)) {
            throw new \DomainException("A $current cheque cannot be marked $status.");
        }
        if ($status === 'deposited' && $depositBankId === null && $payment['bank_account_id'] === null) {
            throw new \DomainException('Pick a bank account to deposit the cheque into.');
        }

        Database::transaction(static function () use ($payment, $status, $depositBankId, $user): void {
            $clearedAt = $status === 'cleared' ? 'NOW()' : 'cheque_cleared_at';
            $bank = $depositBankId !== null ? ':bank' : 'bank_account_id';
            $params = ['s' => $status, 'id' => $payment['id']];
            if ($depositBankId !== null) {
                $params['bank'] = $depositBankId;
            }
            Database::execute(
                "UPDATE invoice_payments SET cheque_status = :s, bank_account_id = $bank, cheque_cleared_at = $clearedAt WHERE id = :id",
                $params
            );
            // recompute — bounced cheques drop out of paid_amount
            self::recomputePaid((int) $payment['invoice_id']);
            if ($status === 'bounced') {
                $invoice = Database::fetchOne('SELECT customer_id, invoice_no FROM invoices WHERE id = :id', ['id' => $payment['invoice_id']]);
                if ($invoice !== null) {
                    CustomerTimeline::log((int) $invoice['customer_id'], 'payment_bounced',
                        "Cheque bounced on {$invoice['invoice_no']}", 'invoices', (int) $payment['invoice_id'], $user->id);
                }
            }
        });
    }

    // ------------------------------------------------------- recompute core

    /**
     * Per-line figures — the SINGLE place line math is defined so replaceItems()
     * and recomputeTotals() can never diverge. Discount is capped at the line
     * base so a total can never go negative (Codex gate #3).
     * @return array{base:float,discount:float,taxAmount:float,lineTotal:float}
     */
    private static function lineFigures(float $qty, float $rate, float $discount, float $taxRate): array
    {
        $base = round($qty * $rate, 2);
        $discount = min(max(0, $discount), $base); // capped: 0 ≤ discount ≤ base
        $afterDiscount = $base - $discount;
        $taxAmount = round($afterDiscount * $taxRate / 100, 2);
        return [
            'base' => $base,
            'discount' => $discount,
            'taxAmount' => $taxAmount,
            'lineTotal' => round($afterDiscount + $taxAmount, 2),
        ];
    }

    /** @return float grand total (also persisted unless apply=false) */
    private static function recomputeTotals(int $invoiceId, bool $apply = true): float
    {
        $items = Database::fetchAll('SELECT * FROM invoice_items WHERE invoice_id = :id', ['id' => $invoiceId]);
        $subtotal = 0.0;
        $discountTotal = 0.0;
        $taxTotal = 0.0;
        foreach ($items as $item) {
            $f = self::lineFigures((float) $item['qty'], (float) $item['rate'], (float) $item['discount'], (float) $item['tax_rate']);
            $subtotal += $f['base'];
            $discountTotal += $f['discount'];
            $taxTotal += $f['taxAmount'];
        }
        $beforeOldGold = round($subtotal - $discountTotal + $taxTotal, 2);
        // jewellery old-gold exchange: adjustment reduces the payable, capped so grand ≥ 0
        $oldGold = (float) Database::fetchValue('SELECT old_gold_adjustment FROM invoices WHERE id = :id', ['id' => $invoiceId]);
        $oldGold = round(min(max(0.0, $oldGold), $beforeOldGold), 2);
        $grand = round($beforeOldGold - $oldGold, 2);
        // intra-state GST split (CGST = SGST = half); IGST left 0 (single-store, mostly intra-state)
        $cgst = round($taxTotal / 2, 2);
        $sgst = round($taxTotal - $cgst, 2);
        if ($apply) {
            Database::execute(
                'UPDATE invoices SET subtotal = :s, discount_total = :d, tax_total = :t,
                        cgst = :cg, sgst = :sg, igst = 0, old_gold_adjustment = :og, grand_total = :g WHERE id = :id',
                ['s' => round($subtotal, 2), 'd' => round($discountTotal, 2), 't' => round($taxTotal, 2),
                 'cg' => $cgst, 'sg' => $sgst, 'og' => $oldGold, 'g' => $grand, 'id' => $invoiceId]
            );
            self::recomputePaid($invoiceId);
        }
        return $grand;
    }

    /**
     * Recompute paid_amount (bounced cheques and cancelled receipts excluded).
     * Status is NOT derived: it stays draft | final | cancelled. Settlement is read
     * from paid_amount vs grand_total wherever it is needed.
     */
    private static function recomputePaid(int $invoiceId): void
    {
        $paid = (float) Database::fetchValue(
            "SELECT COALESCE(SUM(amount), 0) FROM invoice_payments
             WHERE invoice_id = :id AND (payment_mode <> 'cheque' OR cheque_status <> 'bounced' OR cheque_status IS NULL)
               AND status <> 'cancelled'",
            ['id' => $invoiceId]
        );
        Database::execute('UPDATE invoices SET paid_amount = :p WHERE id = :id', ['p' => round($paid, 2), 'id' => $invoiceId]);
    }

    private static function replaceItems(int $invoiceId, array $items): void
    {
        Database::execute('DELETE FROM invoice_items WHERE invoice_id = :id', ['id' => $invoiceId]);
        $sort = 0;
        foreach ($items as $item) {
            $f = self::lineFigures((float) $item['qty'], (float) $item['rate'], (float) $item['discount'], (float) $item['tax_rate']);
            Database::insert('invoice_items', [
                'invoice_id' => $invoiceId,
                'item_type' => $item['item_type'],
                'inventory_item_id' => $item['inventory_item_id'],
                'description' => $item['description'],
                'qty' => $item['qty'],
                'unit' => $item['unit'],
                'rate' => $item['rate'],
                'discount' => $f['discount'], // store the capped discount
                'tax_rate' => $item['tax_rate'],
                'tax_amount' => $f['taxAmount'],
                'line_total' => $f['lineTotal'],
                'metal_type' => $item['metal_type'],
                'gross_wt' => $item['gross_wt'],
                'net_wt' => $item['net_wt'],
                'stone_wt' => $item['stone_wt'],
                'purity' => $item['purity'],
                'making_charge' => $item['making_charge'],
                'wastage_pct' => $item['wastage_pct'],
                'hsn_code' => $item['hsn_code'],
                'diamond_wt' => $item['diamond_wt'],
                'diamond_grade' => $item['diamond_grade'],
                'sort_order' => $sort++,
            ]);
        }
    }

    // ------------------------------------------------------------- validation

    private static function validateHeader(array $body): array
    {
        $data = Validator::validate($body, [
            'customer_id' => 'required|int|min:1',
            'invoice_date' => 'required|date',
            'due_date' => 'nullable|date',
            'sale_type' => 'nullable|in:ready,custom',
            'old_gold_adjustment' => 'nullable|numeric|min:0',
            'hallmark_no' => 'nullable|string|max:40',
            'huid' => 'nullable|string|max:40',
            'warranty_months' => 'nullable|int|min:0',
            'notes' => 'nullable|string|max:500',
            'terms' => 'nullable|string|max:1000',
        ]);
        return [
            'customer_id' => (int) $data['customer_id'],
            'invoice_date' => $data['invoice_date'],
            'due_date' => $data['due_date'],
            'sale_type' => $data['sale_type'] ?? 'ready',
            'old_gold_adjustment' => round((float) ($data['old_gold_adjustment'] ?? 0), 2),
            'hallmark_no' => $data['hallmark_no'],
            'huid' => $data['huid'],
            'warranty_months' => isset($data['warranty_months']) ? (int) $data['warranty_months'] : null,
            'notes' => $data['notes'],
            'terms' => $data['terms'],
        ];
    }

    private static function validateItems(mixed $items): array
    {
        if (!is_array($items) || $items === []) {
            throw new \RuntimeException('An invoice needs at least one line item.');
        }
        $clean = [];
        foreach ($items as $raw) {
            if (!is_array($raw)) {
                continue;
            }
            $item = Validator::validate($raw, [
                'item_type' => 'nullable|in:tagged,bulk,making,custom',
                'inventory_item_id' => 'nullable|int|min:1',
                'description' => 'required|string|max:255',
                'qty' => 'required|numeric|min:0.001',
                'unit' => 'nullable|string|max:20',
                'rate' => 'required|numeric|min:0',
                'discount' => 'nullable|numeric|min:0',
                'tax_rate' => 'nullable|numeric|min:0|max:28',
                'metal_type' => 'nullable|string|max:30',
                'gross_wt' => 'nullable|numeric|min:0',
                'net_wt' => 'nullable|numeric|min:0',
                'stone_wt' => 'nullable|numeric|min:0',
                'purity' => 'nullable|string|max:10',
                'making_charge' => 'nullable|numeric|min:0',
                'wastage_pct' => 'nullable|numeric|min:0',
                'hsn_code' => 'nullable|string|max:12',
                'diamond_wt' => 'nullable|numeric|min:0',
                'diamond_grade' => 'nullable|string|max:30',
            ]);
            // a ready-stock line must point at a real, active stock item so finalize actually moves stock
            if (in_array($item['item_type'] ?? 'custom', ['tagged', 'bulk'], true)) {
                if (empty($item['inventory_item_id'])) {
                    throw new \DomainException('A ready-stock line must reference a stock item.');
                }
                if (Database::fetchValue(
                    "SELECT id FROM inventory_items WHERE id = :id AND item_type = 'stock' AND is_active = 1",
                    ['id' => (int) $item['inventory_item_id']]
                ) === null) {
                    throw new \DomainException('A ready-stock line references an item that is not active stock.');
                }
            }
            $clean[] = [
                'item_type' => $item['item_type'] ?? 'custom',
                'inventory_item_id' => $item['inventory_item_id'] ?? null,
                'description' => $item['description'],
                'qty' => (float) $item['qty'],
                'unit' => $item['unit'] ?? null,
                'rate' => (float) $item['rate'],
                'discount' => (float) ($item['discount'] ?? 0),
                'tax_rate' => (float) ($item['tax_rate'] ?? 0),
                'metal_type' => $item['metal_type'] ?? null,
                'gross_wt' => round((float) ($item['gross_wt'] ?? 0), 3),
                'net_wt' => round((float) ($item['net_wt'] ?? 0), 3),
                'stone_wt' => round((float) ($item['stone_wt'] ?? 0), 3),
                'purity' => $item['purity'] ?? null,
                'making_charge' => round((float) ($item['making_charge'] ?? 0), 2),
                'wastage_pct' => round((float) ($item['wastage_pct'] ?? 0), 3),
                'hsn_code' => $item['hsn_code'] ?? null,
                'diamond_wt' => round((float) ($item['diamond_wt'] ?? 0), 3),
                'diamond_grade' => $item['diamond_grade'] ?? null,
            ];
        }
        if ($clean === []) {
            throw new \RuntimeException('An invoice needs at least one line item.');
        }
        return $clean;
    }

    private static function assertBankIfNeeded(string $mode, ?int $bankId): void
    {
        if ($mode === 'cash') {
            return;
        }
        $hasBanks = (int) Database::fetchValue('SELECT COUNT(*) FROM bank_accounts WHERE is_active = 1') > 0;
        if ($hasBanks && $bankId === null) {
            throw new \DomainException('Choose the bank account this payment went into.');
        }
    }

    /** Scope-aware when $user is given (mutations); unscoped for internal reads. */
    public static function findOrFail(int $id, ?AuthUser $user = null): array
    {
        $invoice = $user !== null
            ? InvoiceRepository::find($user, $id)
            : Database::fetchOne('SELECT * FROM invoices WHERE id = :id', ['id' => $id]);
        if ($invoice === null) {
            throw new \RuntimeException('Invoice not found.');
        }
        return $invoice;
    }
}
