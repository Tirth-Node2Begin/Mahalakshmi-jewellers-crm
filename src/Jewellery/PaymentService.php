<?php

declare(strict_types=1);

namespace CRM\Jewellery;

use CRM\Accounting\Ledgers;
use CRM\Accounting\VoucherService;
use CRM\Database\Database;
use CRM\Support\Audit;
use CRM\Support\NumberSequence;

/**
 * Money in from customers and money out to vendors (plan/05 §2 V2/V4).
 *
 * Customer receipt : Dr Cash/Bank        Cr Customer
 * Vendor payment   : Dr Vendor           Cr Cash/Bank
 * Cheque cleared   : Dr Bank             Cr Cheques in Hand
 *
 * Every receipt/payment carries its own voucher, so the cash book and the party
 * ledger always agree with the documents.
 *
 * "Bank" means the ledger of the specific bank account the money went through
 * (see Ledgers::forPaymentMode) — upi, card and transfers are reconcilable per
 * account, and a cheque received waits in Cheques in Hand until it clears.
 */
final class PaymentService
{
    private const MODES = ['cash', 'bank', 'upi', 'cheque', 'card'];

    /** Money taken against a specific bill (used by the billing counter). */
    public static function receiveForInvoice(
        int $invoiceId,
        ?int $customerId,
        float $amount,
        string $mode,
        ?int $bankAccountId,
        ?string $refNo,
        string $date,
        ?int $userId
    ): int {
        return self::receive(
            invoiceId: $invoiceId,
            customerId: $customerId,
            amount: $amount,
            mode: $mode,
            bankAccountId: $bankAccountId,
            refNo: $refNo,
            date: $date,
            userId: $userId
        );
    }

    /** Money taken from a customer, with or without a bill attached. */
    public static function receive(
        ?int $invoiceId,
        ?int $customerId,
        float $amount,
        string $mode,
        ?int $bankAccountId,
        ?string $refNo,
        string $date,
        ?int $userId,
        ?string $notes = null
    ): int {
        $amount = round($amount, 2);
        if ($amount <= 0) {
            throw new \RuntimeException('Amount must be more than zero.');
        }
        self::assertMode($mode);
        if ($invoiceId === null && $customerId === null) {
            throw new \RuntimeException('A receipt needs either a bill or a customer.');
        }

        return Database::transaction(static function () use (
            $invoiceId, $customerId, $amount, $mode, $bankAccountId, $refNo, $date, $userId, $notes
        ): int {
            // A receipt can never exceed what the bill still owes. The bill row is
            // locked first, so two counters taking money against the same bill at
            // the same moment queue up instead of both seeing the old balance and
            // between them collecting more than the bill is worth. (Taking an
            // advance with no bill behind it is unbounded by design.)
            if ($invoiceId !== null) {
                $invoice = Database::fetchOne(
                    'SELECT grand_total, paid_amount, status FROM invoices WHERE id = :id FOR UPDATE',
                    ['id' => $invoiceId]
                );
                if ($invoice === null) {
                    throw new \RuntimeException('Bill not found.');
                }
                if ($invoice['status'] === 'cancelled') {
                    throw new \DomainException('That bill was cancelled.');
                }
                $balance = round((float) $invoice['grand_total'] - (float) $invoice['paid_amount'], 2);
                if ($amount > $balance + 0.01) {
                    throw new \DomainException(sprintf(
                        'This bill only has ₹%s left to pay.',
                        number_format(max(0, $balance), 2)
                    ));
                }
            }

            // walk-in bills settle against the walk-in control ledger
            $creditLedger = $customerId !== null
                ? Ledgers::customer($customerId)
                : Ledgers::system('customer');

            $receiptNo = NumberSequence::next('receipt');

            $voucherId = VoucherService::post(
                vtype: 'receipt',
                vdate: $date,
                entries: [
                    ['ledger_id' => Ledgers::forPaymentMode($mode, $bankAccountId), 'dr' => $amount],
                    ['ledger_id' => $creditLedger, 'cr' => $amount],
                ],
                narration: 'Receipt ' . $receiptNo,
                refType: 'receipt',
                refId: null,
                userId: $userId
            );

            $paymentId = Database::insert('invoice_payments', [
                'invoice_id' => $invoiceId,
                'customer_id' => $customerId,
                'receipt_no' => $receiptNo,
                'amount' => $amount,
                'payment_date' => $date,
                'payment_mode' => $mode,
                'bank_account_id' => $bankAccountId,
                'cheque_number' => $mode === 'cheque' ? $refNo : null,
                // a cheque is money in transit until someone confirms it cleared
                'cheque_status' => $mode === 'cheque' ? 'pending' : null,
                'notes' => $notes,
                'voucher_id' => $voucherId,
                'status' => 'active',
                'created_by' => $userId,
            ]);

            Database::execute(
                'UPDATE vouchers SET ref_id = :r WHERE id = :v',
                ['r' => $paymentId, 'v' => $voucherId]
            );

            if ($invoiceId !== null) {
                BillingService::recomputePaid($invoiceId);
            }

            Audit::log($userId, 'payment.receive', 'invoice_payments', $paymentId, null, [
                'receipt_no' => $receiptNo,
                'amount' => $amount,
                'mode' => $mode,
            ]);

            return $paymentId;
        });
    }

    /** Money paid out to a vendor, against a purchase or on account. */
    public static function payVendor(
        int $supplierId,
        ?int $purchaseId,
        float $amount,
        string $mode,
        ?int $bankAccountId,
        ?string $refNo,
        string $date,
        ?int $userId,
        ?string $notes = null
    ): int {
        $amount = round($amount, 2);
        if ($amount <= 0) {
            throw new \RuntimeException('Amount must be more than zero.');
        }
        self::assertMode($mode);

        return Database::transaction(static function () use (
            $supplierId, $purchaseId, $amount, $mode, $bankAccountId, $refNo, $date, $userId, $notes
        ): int {
            $paymentNo = NumberSequence::next('vendor_payment');

            $voucherId = VoucherService::post(
                vtype: 'payment',
                vdate: $date,
                entries: [
                    ['ledger_id' => Ledgers::vendor($supplierId), 'dr' => $amount],
                    ['ledger_id' => Ledgers::forPaymentMode($mode, $bankAccountId, 'out'), 'cr' => $amount],
                ],
                narration: 'Vendor payment ' . $paymentNo,
                refType: 'vendor_payment',
                refId: null,
                userId: $userId
            );

            $paymentId = Database::insert('vendor_payments', [
                'payment_no' => $paymentNo,
                'supplier_id' => $supplierId,
                'purchase_id' => $purchaseId,
                'payment_date' => $date,
                'payment_mode' => $mode,
                'bank_account_id' => $bankAccountId,
                'amount' => $amount,
                'ref_no' => $refNo,
                'notes' => $notes,
                'voucher_id' => $voucherId,
                'status' => 'active',
                'created_by' => $userId,
            ]);

            Database::execute(
                'UPDATE vouchers SET ref_id = :r WHERE id = :v',
                ['r' => $paymentId, 'v' => $voucherId]
            );

            if ($purchaseId !== null) {
                self::recomputePurchasePaid($purchaseId);
            }

            Audit::log($userId, 'payment.vendor', 'vendor_payments', $paymentId, null, [
                'payment_no' => $paymentNo,
                'amount' => $amount,
                'mode' => $mode,
            ]);

            return $paymentId;
        });
    }

    /**
     * A received cheque has cleared: move it out of Cheques in Hand and into the
     * bank account it was banked into (Dr Bank, Cr Cheques in Hand).
     *
     * Until a cheque is cleared it is NOT in the bank, so the bank ledger keeps
     * agreeing with the bank statement. The receipt itself is untouched — the
     * customer was credited when the cheque was handed over.
     */
    public static function clearCheque(int $paymentId, ?int $bankAccountId, string $date, ?int $userId): void
    {
        Database::transaction(static function () use ($paymentId, $bankAccountId, $date, $userId): void {
            $payment = Database::fetchOne(
                'SELECT * FROM invoice_payments WHERE id = :id FOR UPDATE',
                ['id' => $paymentId]
            );
            if ($payment === null) {
                throw new \RuntimeException('Payment not found.');
            }
            if ($payment['payment_mode'] !== 'cheque') {
                throw new \DomainException('Only a cheque can be marked cleared.');
            }
            if ($payment['status'] !== 'active') {
                throw new \DomainException('That receipt was cancelled.');
            }
            if ($payment['cheque_status'] === 'cleared') {
                throw new \DomainException('That cheque is already marked cleared.');
            }
            if ($payment['cheque_status'] === 'bounced') {
                throw new \DomainException('That cheque bounced — it cannot be cleared.');
            }

            $bankAccountId ??= ($payment['bank_account_id'] !== null ? (int) $payment['bank_account_id'] : null);
            $amount = round((float) $payment['amount'], 2);

            $voucherId = VoucherService::post(
                vtype: 'receipt',
                vdate: $date,
                entries: [
                    ['ledger_id' => Ledgers::forPaymentMode('bank', $bankAccountId), 'dr' => $amount],
                    ['ledger_id' => Ledgers::system('cheques_in_hand'), 'cr' => $amount],
                ],
                narration: 'Cheque cleared — ' . $payment['receipt_no']
                    . ($payment['cheque_number'] !== null ? ' (' . $payment['cheque_number'] . ')' : ''),
                refType: 'cheque_clearing',
                refId: $paymentId,
                userId: $userId
            );

            Database::execute(
                "UPDATE invoice_payments
                    SET cheque_status = 'cleared', cheque_cleared_at = NOW(), bank_account_id = :b
                  WHERE id = :id",
                ['b' => $bankAccountId, 'id' => $paymentId]
            );

            Audit::log($userId, 'payment.cheque_cleared', 'invoice_payments', $paymentId, [
                'cheque_status' => $payment['cheque_status'],
            ], [
                'cheque_status' => 'cleared',
                'bank_account_id' => $bankAccountId,
                'voucher_id' => $voucherId,
            ]);
        });
    }

    /**
     * A received cheque bounced: the receipt is cancelled (so the bill goes back
     * to unpaid and the customer owes it again) and the cheque is flagged.
     */
    public static function bounceCheque(int $paymentId, string $reason, ?int $userId): void
    {
        if (trim($reason) === '') {
            throw new \RuntimeException('A reason is required when a cheque bounces.');
        }

        Database::transaction(static function () use ($paymentId, $reason, $userId): void {
            $payment = Database::fetchOne(
                'SELECT id, payment_mode, status, cheque_status FROM invoice_payments WHERE id = :id FOR UPDATE',
                ['id' => $paymentId]
            );
            if ($payment === null) {
                throw new \RuntimeException('Payment not found.');
            }
            if ($payment['payment_mode'] !== 'cheque') {
                throw new \DomainException('Only a cheque can bounce.');
            }
            if ($payment['cheque_status'] === 'cleared') {
                throw new \DomainException('That cheque already cleared — cancel the receipt instead.');
            }

            self::cancel('customer', $paymentId, 'Cheque bounced — ' . $reason, $userId);
            Database::execute(
                "UPDATE invoice_payments SET cheque_status = 'bounced' WHERE id = :id",
                ['id' => $paymentId]
            );

            Audit::log($userId, 'payment.cheque_bounced', 'invoice_payments', $paymentId, [
                'cheque_status' => $payment['cheque_status'],
            ], ['cheque_status' => 'bounced', 'reason' => $reason]);
        });
    }

    /** Cancel a receipt or vendor payment: voucher reversed, totals recomputed. */
    public static function cancel(string $kind, int $paymentId, string $reason, ?int $userId): void
    {
        if (trim($reason) === '') {
            throw new \RuntimeException('A reason is required to cancel a payment.');
        }
        $table = $kind === 'vendor' ? 'vendor_payments' : 'invoice_payments';

        Database::transaction(static function () use ($table, $kind, $paymentId, $reason, $userId): void {
            $payment = Database::fetchOne("SELECT * FROM {$table} WHERE id = :id FOR UPDATE", ['id' => $paymentId]);
            if ($payment === null) {
                throw new \RuntimeException('Payment not found.');
            }
            if (($payment['status'] ?? 'active') === 'cancelled') {
                throw new \DomainException('That payment is already cancelled.');
            }

            if ($payment['voucher_id'] !== null) {
                VoucherService::cancel((int) $payment['voucher_id'], $reason, $userId);
            }
            // a cheque that had already cleared also moved money into the bank —
            // that leg has to come back out, or the bank ledger keeps the money
            if ($kind !== 'vendor') {
                $clearingVouchers = Database::fetchAll(
                    "SELECT id FROM vouchers
                      WHERE ref_type = 'cheque_clearing' AND ref_id = :id AND status = 'active'",
                    ['id' => $paymentId]
                );
                foreach ($clearingVouchers as $clearing) {
                    VoucherService::cancel((int) $clearing['id'], $reason, $userId);
                }
            }
            Database::execute("UPDATE {$table} SET status = 'cancelled' WHERE id = :id", ['id' => $paymentId]);

            if ($kind === 'vendor') {
                if ($payment['purchase_id'] !== null) {
                    self::recomputePurchasePaid((int) $payment['purchase_id']);
                }
            } elseif ($payment['invoice_id'] !== null) {
                BillingService::recomputePaid((int) $payment['invoice_id']);
            }

            Audit::log($userId, 'payment.cancel', $table, $paymentId, ['status' => 'active'], [
                'status' => 'cancelled',
                'reason' => $reason,
            ]);
        });
    }

    public static function recomputePurchasePaid(int $purchaseId): void
    {
        Database::execute(
            "UPDATE purchases SET paid_amount = (
                 SELECT COALESCE(SUM(amount), 0) FROM vendor_payments
                  WHERE purchase_id = :id1 AND status = 'active'
             ) WHERE id = :id2",
            ['id1' => $purchaseId, 'id2' => $purchaseId]
        );
    }

    private static function assertMode(string $mode): void
    {
        if (!in_array($mode, self::MODES, true)) {
            throw new \RuntimeException('Unknown payment mode: ' . $mode);
        }
    }
}
