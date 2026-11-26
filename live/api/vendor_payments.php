<?php

declare(strict_types=1);

/**
 * Vendor payments and vendor ledgers (plan/08 §3, §4).
 * Dr Vendor / Cr Cash-Bank, with the purchase's paid_amount recomputed.
 */

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Accounting\AccountingRepository;
use CRM\Accounting\Ledgers;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Jewellery\PaymentService;
use CRM\Support\FiscalYear;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('vendors.read');
    $view = (string) ($_GET['view'] ?? 'list');

    if ($view === 'ledger') {
        requirePermission('vendors.ledger');
        $supplierId = (int) ($_GET['supplier_id'] ?? 0);
        if ($supplierId <= 0) {
            Response::error('VALIDATION_ERROR', 'Choose a vendor.', 422);
        }
        $fy = FiscalYear::range();
        Response::success([
            'statement' => AccountingRepository::ledgerStatement(
                Ledgers::vendor($supplierId),
                (string) ($_GET['from'] ?? $fy['start']),
                (string) ($_GET['to'] ?? $fy['end'])
            ),
        ]);
    }

    if ($view === 'due') {
        // what a vendor still owes us against, for the payment screen
        $supplierId = (int) ($_GET['supplier_id'] ?? 0);
        Response::success([
            'purchases' => Database::fetchAll(
                "SELECT id, purchase_no, purchase_date, grand_total, paid_amount,
                        (grand_total - paid_amount) AS balance_due
                   FROM purchases
                  WHERE supplier_id = :s AND status <> 'cancelled' AND grand_total - paid_amount > 0.01
                  ORDER BY purchase_date",
                ['s' => $supplierId]
            ),
        ]);
    }

    // purchase_id / supplier_id let the list row link straight to the bill it paid
    $sql = "SELECT vp.id, vp.payment_no, vp.payment_date, vp.payment_mode, vp.amount, vp.ref_no,
                   vp.status, vp.supplier_id, vp.purchase_id,
                   s.name AS vendor_name, p.purchase_no, b.account_name, u.full_name AS created_by_name
              FROM vendor_payments vp
              JOIN suppliers s ON s.id = vp.supplier_id
         LEFT JOIN purchases p ON p.id = vp.purchase_id
         LEFT JOIN bank_accounts b ON b.id = vp.bank_account_id
         LEFT JOIN users u ON u.id = vp.created_by
             WHERE 1 = 1";
    $params = [];
    if (!empty($_GET['supplier_id'])) {
        $sql .= ' AND vp.supplier_id = :s';
        $params['s'] = (int) $_GET['supplier_id'];
    }
    if (!empty($_GET['from'])) {
        $sql .= ' AND vp.payment_date >= :from';
        $params['from'] = $_GET['from'];
    }
    if (!empty($_GET['to'])) {
        $sql .= ' AND vp.payment_date <= :to';
        $params['to'] = $_GET['to'];
    }
    $sql .= ' ORDER BY vp.payment_date DESC, vp.id DESC LIMIT 200';

    Response::success([
        'payments' => Database::fetchAll($sql, $params),
        'vendors' => Database::fetchAll(
            'SELECT id, name, company FROM suppliers WHERE is_active = 1 ORDER BY name'
        ),
        'bank_accounts' => Database::fetchAll(
            'SELECT id, account_name FROM bank_accounts WHERE is_active = 1 ORDER BY account_name'
        ),
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? 'create');

switch ($action) {
    case 'create':
        requirePermission('payments.vendor');
        $data = Validator::validate($body, [
            'supplier_id' => 'required|int|min:1',
            'purchase_id' => 'nullable|int|min:1',
            'amount' => 'required|numeric|min:0.01',
            'payment_mode' => 'required|in:cash,bank,upi,cheque,card',
            'bank_account_id' => 'nullable|int|min:1',
            'ref_no' => 'nullable|string|max:60',
            'payment_date' => 'nullable|date',
            'notes' => 'nullable|string|max:255',
        ]);

        $id = PaymentService::payVendor(
            supplierId: (int) $data['supplier_id'],
            purchaseId: $data['purchase_id'] !== null ? (int) $data['purchase_id'] : null,
            amount: (float) $data['amount'],
            mode: (string) $data['payment_mode'],
            bankAccountId: $data['bank_account_id'] !== null ? (int) $data['bank_account_id'] : null,
            refNo: $data['ref_no'],
            date: (string) ($data['payment_date'] ?? date('Y-m-d')),
            userId: $user->id,
            notes: $data['notes']
        );
        Response::success(['id' => $id, 'message' => 'Payment recorded.'], 201);

    case 'cancel':
        requirePermission('payments.cancel');
        $reason = trim((string) ($body['reason'] ?? ''));
        if ($reason === '') {
            Response::error('VALIDATION_ERROR', 'Please say why.', 422, ['reason' => 'A reason is required.']);
        }
        PaymentService::cancel('vendor', (int) ($body['id'] ?? 0), $reason, $user->id);
        Response::success(['message' => 'Payment cancelled.']);

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
