<?php

declare(strict_types=1);

/**
 * Purchases from vendors (plan/08 §2). One transaction creates the stock,
 * the items and the balanced voucher (Dr Inventory + Dr GST Input / Cr Vendor).
 */

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Jewellery\PaymentService;
use CRM\Jewellery\PurchaseService;
use CRM\Jewellery\RateService;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('purchases.read');

    if (($_GET['view'] ?? '') === 'detail') {
        $id = (int) ($_GET['id'] ?? 0);
        $purchase = Database::fetchOne(
            'SELECT p.*, s.name AS vendor_name, s.company AS vendor_company, s.gstin AS vendor_gstin,
                    u.full_name AS created_by_name, v.voucher_no
               FROM purchases p
               JOIN suppliers s ON s.id = p.supplier_id
          LEFT JOIN users u ON u.id = p.created_by
          LEFT JOIN vouchers v ON v.id = p.voucher_id
              WHERE p.id = :id',
            ['id' => $id]
        );
        if ($purchase === null) {
            Response::error('NOT_FOUND', 'Purchase not found.', 404);
        }
        $purchase['items'] = Database::fetchAll(
            'SELECT pi.*, i.item_code, i.name AS item_name, i.huid, pu.code AS purity_code
               FROM purchase_items pi
          LEFT JOIN inventory_items i ON i.id = pi.item_id
          LEFT JOIN purities pu ON pu.id = pi.purity_id
              WHERE pi.purchase_id = :id ORDER BY pi.id',
            ['id' => $id]
        );
        $purchase['payments'] = Database::fetchAll(
            "SELECT id, payment_no, payment_date, payment_mode, amount, ref_no, status
               FROM vendor_payments WHERE purchase_id = :id AND status = 'active' ORDER BY id",
            ['id' => $id]
        );
        Response::success(['purchase' => $purchase]);
    }

    $sql = "SELECT p.id, p.purchase_no, p.purchase_date, p.status, p.invoice_ref,
                   p.subtotal, p.tax_total, p.grand_total, p.paid_amount,
                   (p.grand_total - p.paid_amount) AS balance_due,
                   s.name AS vendor_name
              FROM purchases p
              JOIN suppliers s ON s.id = p.supplier_id
             WHERE 1 = 1";
    $params = [];
    if (!empty($_GET['supplier_id'])) {
        $sql .= ' AND p.supplier_id = :sid';
        $params['sid'] = (int) $_GET['supplier_id'];
    }
    if (!empty($_GET['from'])) {
        $sql .= ' AND p.purchase_date >= :from';
        $params['from'] = $_GET['from'];
    }
    if (!empty($_GET['to'])) {
        $sql .= ' AND p.purchase_date <= :to';
        $params['to'] = $_GET['to'];
    }
    if (!empty($_GET['search'])) {
        $sql .= ' AND (p.purchase_no LIKE :q OR p.invoice_ref LIKE :q2 OR s.name LIKE :q3)';
        $like = '%' . $_GET['search'] . '%';
        $params['q'] = $like;
        $params['q2'] = $like;
        $params['q3'] = $like;
    }
    $sql .= ' ORDER BY p.purchase_date DESC, p.id DESC LIMIT 200';

    Response::success([
        'purchases' => Database::fetchAll($sql, $params),
        'vendors' => Database::fetchAll(
            'SELECT id, name, company, vendor_type FROM suppliers WHERE is_active = 1 ORDER BY name'
        ),
        'purities' => RateService::purities(),
        'categories' => Database::fetchAll(
            'SELECT id, name, item_type FROM inventory_categories WHERE is_active = 1 ORDER BY name'
        ),
        'bulk_items' => Database::fetchAll(
            "SELECT id, item_code, name, metal, purity_id FROM inventory_items
              WHERE tracking = 'bulk' AND is_active = 1 ORDER BY name"
        ),
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    case 'create':
        requirePermission('purchases.create');
        Validator::validate($body, [
            'supplier_id' => 'required|int|min:1',
            'purchase_date' => 'nullable|date',
            'bill_ref' => 'nullable|string|max:60',
            'notes' => 'nullable|string|max:500',
        ]);
        if (!is_array($body['items'] ?? null) || $body['items'] === []) {
            Response::error('VALIDATION_ERROR', 'Add at least one line.', 422, ['items' => 'Add at least one line.']);
        }

        $purchaseId = PurchaseService::create($body, $user->id);

        // optional payment made at the same time
        $payment = $body['payment'] ?? null;
        if (is_array($payment) && (float) ($payment['amount'] ?? 0) > 0) {
            requirePermission('payments.vendor');
            PaymentService::payVendor(
                supplierId: (int) $body['supplier_id'],
                purchaseId: $purchaseId,
                amount: (float) $payment['amount'],
                mode: (string) ($payment['mode'] ?? 'cash'),
                bankAccountId: isset($payment['bank_account_id']) ? (int) $payment['bank_account_id'] : null,
                refNo: $payment['ref_no'] ?? null,
                date: (string) ($body['purchase_date'] ?? date('Y-m-d')),
                userId: $user->id
            );
        }

        Response::success(['id' => $purchaseId, 'message' => 'Purchase saved.'], 201);

    case 'cancel':
        requirePermission('purchases.cancel');
        $reason = trim((string) ($body['reason'] ?? ''));
        if ($reason === '') {
            Response::error('VALIDATION_ERROR', 'Please say why this purchase is being cancelled.', 422, [
                'reason' => 'A reason is required.',
            ]);
        }
        PurchaseService::cancel((int) ($body['id'] ?? 0), $reason, $user->id);
        Response::success(['message' => 'Purchase cancelled.']);

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
