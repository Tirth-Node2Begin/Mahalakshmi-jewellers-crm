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
 *
 * Every receipt/payment carries its own voucher, so the cash book and the party
 * ledger always agree with the documents.
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
                    ['ledger_id' => Ledgers::forPaymentMode($mode, $bankAccountId), 'cr' => $amount],
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
