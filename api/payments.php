<?php

declare(strict_types=1);

/**
 * Money received from customers (plan/07 §4).
 *
 * Every receipt goes through PaymentService, which posts its own voucher
 * (Dr Cash/Bank, Cr Customer) in the same transaction as the row — so the cash
 * book, the customer ledger and the bill's paid_amount can never disagree.
 *
 * A receipt may be tied to a bill, or taken on account against the customer.
 */

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Accounting\AccountingRepository;
use CRM\Accounting\Ledgers;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Invoices\InvoiceRepository;
use CRM\Jewellery\PaymentService;
use CRM\Support\FiscalYear;
use CRM\Support\GstVisibility;
use CRM\Validation\Validator;

$user = requireApiAuth();
$gstVisibleOnly = GstVisibility::restrictedUsername($user->username);

if (Request::method() === 'GET') {
    requirePermission('payments.read');

    if (isset($_GET['helpers'])) {
        Response::success([
            'open_invoices' => InvoiceRepository::openInvoices($user),
            'bank_accounts' => Database::fetchAll(
                'SELECT id, account_name FROM bank_accounts WHERE is_active = 1 ORDER BY account_name'
            ),
        ]);
    }

    // bills a specific customer still owes on — the "record payment" picker
    if (($_GET['view'] ?? '') === 'due') {
        $customerId = (int) ($_GET['customer_id'] ?? 0);
        $grandTotalSql = GstVisibility::invoiceAmountSql('invoices', $gstVisibleOnly);
        $paidAmountSql = GstVisibility::invoicePaidSql('invoices', $gstVisibleOnly);
        $balanceSql = GstVisibility::invoiceBalanceSql('invoices', $gstVisibleOnly);
        $visibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::invoiceVisibleSql('invoices') : '';
        Response::success([
            'invoices' => Database::fetchAll(
                "SELECT id, invoice_no, invoice_date,
                        {$grandTotalSql} AS grand_total,
                        {$paidAmountSql} AS paid_amount,
                        {$balanceSql} AS balance_due
                   FROM invoices
                  WHERE customer_id = :c AND status = 'final' AND {$balanceSql} > 0.01{$visibilitySql}
                  ORDER BY invoice_date",
                ['c' => $customerId]
            ),
        ]);
    }

    if (($_GET['view'] ?? '') === 'ledger') {
        requirePermission('customers.ledger');
        $customerId = (int) ($_GET['customer_id'] ?? 0);
        if ($customerId <= 0) {
            Response::error('VALIDATION_ERROR', 'Choose a customer.', 422);
        }
        $fy = FiscalYear::range();
        Response::success([
            'statement' => AccountingRepository::ledgerStatement(
                Ledgers::customer($customerId),
                (string) ($_GET['from'] ?? $fy['start']),
                (string) ($_GET['to'] ?? $fy['end']),
                $gstVisibleOnly
            ),
        ]);
    }

    Response::success([
        'payments' => InvoiceRepository::allPayments($user, [
            'search' => $_GET['search'] ?? null,
            'payment_mode' => $_GET['payment_mode'] ?? null,
            'start_date' => $_GET['start_date'] ?? null,
            'end_date' => $_GET['end_date'] ?? null,
        ]),
        'stats' => InvoiceRepository::paymentStats($user),
        'bank_accounts' => Database::fetchAll(
            'SELECT id, account_name FROM bank_accounts WHERE is_active = 1 ORDER BY account_name'
        ),
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? 'receive');

switch ($action) {
    case 'receive':
        requirePermission('payments.create');
        $data = Validator::validate($body, [
            'invoice_id' => 'nullable|int|min:1',
            'customer_id' => 'nullable|int|min:1',
            'amount' => 'required|numeric|min:0.01',
            'payment_mode' => 'required|in:cash,bank,upi,cheque,card',
            'bank_account_id' => 'nullable|int|min:1',
            'ref_no' => 'nullable|string|max:60',
            'payment_date' => 'nullable|date',
            'notes' => 'nullable|string|max:255',
        ]);

        $invoiceId = $data['invoice_id'] !== null ? (int) $data['invoice_id'] : null;
        $customerId = $data['customer_id'] !== null ? (int) $data['customer_id'] : null;

        if ($invoiceId === null && $customerId === null) {
            Response::error('VALIDATION_ERROR', 'Choose a bill or a customer.', 422);
        }

        if ($invoiceId !== null) {
            $grandTotalSql = GstVisibility::invoiceAmountSql('i', $gstVisibleOnly);
            $paidAmountSql = GstVisibility::invoicePaidSql('i', $gstVisibleOnly);
            $visibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::invoiceVisibleSql('i') : '';
            $invoice = Database::fetchOne(
                "SELECT i.id, i.customer_id, i.status,
                        {$grandTotalSql} AS grand_total,
                        {$paidAmountSql} AS paid_amount
                   FROM invoices i
                  WHERE i.id = :id{$visibilitySql}",
                ['id' => $invoiceId]
            );
            if ($invoice === null) {
                Response::error('NOT_FOUND', 'Bill not found.', 404);
            }
            if ($invoice['status'] !== 'final') {
                Response::error('CONFLICT', 'Only a finalised bill can take a payment.', 409);
            }
            $balance = round((float) $invoice['grand_total'] - (float) $invoice['paid_amount'], 2);
            if ((float) $data['amount'] > $balance + 0.001) {
                Response::error(
                    'CONFLICT',
                    'That is more than the balance due (₹' . number_format($balance, 2) . ').',
                    409
                );
            }
            // the bill's own customer always wins over anything the client sent
            $customerId = $invoice['customer_id'] !== null ? (int) $invoice['customer_id'] : null;
        }

        $paymentId = PaymentService::receive(
            invoiceId: $invoiceId,
            customerId: $customerId,
            amount: (float) $data['amount'],
            mode: (string) $data['payment_mode'],
            bankAccountId: $data['bank_account_id'] !== null ? (int) $data['bank_account_id'] : null,
            refNo: $data['ref_no'],
            date: (string) ($data['payment_date'] ?? date('Y-m-d')),
            userId: $user->id,
            notes: $data['notes']
        );

        Response::success(['id' => $paymentId, 'message' => 'Payment received.'], 201);

    case 'clear_cheque':
        // the cheque reached the bank: Dr that bank account, Cr Cheques in Hand
        requirePermission('payments.create');
        $data = Validator::validate($body, [
            'id' => 'required|int|min:1',
            'bank_account_id' => 'nullable|int|min:1',
            'cleared_on' => 'nullable|date',
        ]);
        $paymentId = (int) $data['id'];
        if ($gstVisibleOnly && Database::fetchValue(
            'SELECT 1 FROM invoice_payments p WHERE p.id = :id AND ' . GstVisibility::paymentVisibleSql('p') . ' LIMIT 1',
            ['id' => $paymentId]
        ) === null) {
            Response::error('NOT_FOUND', 'Payment not found.', 404);
        }
        PaymentService::clearCheque(
            paymentId: $paymentId,
            bankAccountId: $data['bank_account_id'] !== null ? (int) $data['bank_account_id'] : null,
            date: (string) ($data['cleared_on'] ?? date('Y-m-d')),
            userId: $user->id
        );
        Response::success(['message' => 'Cheque marked cleared.']);

    case 'bounce_cheque':
        // the cheque came back: the receipt is cancelled and the bill is due again
        requirePermission('payments.cancel');
        $paymentId = (int) ($body['id'] ?? 0);
        if ($gstVisibleOnly && Database::fetchValue(
            'SELECT 1 FROM invoice_payments p WHERE p.id = :id AND ' . GstVisibility::paymentVisibleSql('p') . ' LIMIT 1',
            ['id' => $paymentId]
        ) === null) {
            Response::error('NOT_FOUND', 'Payment not found.', 404);
        }
        $reason = trim((string) ($body['reason'] ?? ''));
        if ($reason === '') {
            Response::error('VALIDATION_ERROR', 'Please say what the bank said.', 422, [
                'reason' => 'A reason is required.',
            ]);
        }
        PaymentService::bounceCheque($paymentId, $reason, $user->id);
        Response::success(['message' => 'Cheque marked bounced — the bill is due again.']);

    case 'cancel':
        requirePermission('payments.cancel');
        $paymentId = (int) ($body['id'] ?? 0);
        if ($gstVisibleOnly && Database::fetchValue(
            'SELECT 1 FROM invoice_payments p WHERE p.id = :id AND ' . GstVisibility::paymentVisibleSql('p') . ' LIMIT 1',
            ['id' => $paymentId]
        ) === null) {
            Response::error('NOT_FOUND', 'Payment not found.', 404);
        }
        $reason = trim((string) ($body['reason'] ?? ''));
        if ($reason === '') {
            Response::error('VALIDATION_ERROR', 'Please say why.', 422, ['reason' => 'A reason is required.']);
        }
        PaymentService::cancel('customer', $paymentId, $reason, $user->id);
        Response::success(['message' => 'Payment cancelled.']);

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
