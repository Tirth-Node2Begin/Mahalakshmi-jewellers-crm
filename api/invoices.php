<?php

declare(strict_types=1);

/**
 * Billing endpoint (plan/07).
 *
 * Drafts are free-form and touch nothing. `finalize` runs the single atomic
 * transaction that numbers the bill, moves stock and posts the ledger, so
 * several counters can bill at the same time without colliding.
 */

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Jewellery\BillingRepository;
use CRM\Jewellery\BillingService;
use CRM\Jewellery\InvoiceDraft;
use CRM\Jewellery\RateService;
use CRM\Support\Audit;
use CRM\Support\GstVisibility;
use CRM\Validation\Validator;

$user = requireApiAuth();
$gstVisibleOnly = GstVisibility::restrictedUsername($user->username);

// cost figures (and therefore margins) are only for those who can see the books
$canSeeCost = checkPermission('reports.stock') || checkPermission('accounting.read');

if (Request::method() === 'GET') {
    requirePermission('invoices.read');
    $view = (string) ($_GET['view'] ?? 'list');

    if ($view === 'detail') {
        $invoice = BillingRepository::detail((int) ($_GET['id'] ?? 0), $canSeeCost, $gstVisibleOnly);
        if ($invoice === null) {
            Response::error('NOT_FOUND', 'Bill not found.', 404);
        }
        Response::success(['invoice' => $invoice]);
    }

    if ($view === 'held') {
        Response::success(['held' => BillingRepository::heldBills($user->id, $gstVisibleOnly)]);
    }

    if ($view === 'lookup') {
        // barcode scan / tag entry at the counter
        $term = trim((string) ($_GET['term'] ?? ''));
        if ($term === '') {
            Response::error('VALIDATION_ERROR', 'Nothing to look up.', 422);
        }
        $item = BillingRepository::lookupItem($term);
        if ($item === null) {
            Response::error('NOT_FOUND', 'No item in stock matches that tag or barcode.', 404);
        }
        Response::success(['item' => $item]);
    }

    if ($view === 'search_items') {
        $categoryId = ($_GET['category_id'] ?? '') !== '' ? (int) $_GET['category_id'] : null;
        Response::success(['items' => BillingRepository::searchItems(trim((string) ($_GET['term'] ?? '')), $categoryId)]);
    }

    // default: the bill list, plus what the billing screen needs to open
    Response::success([
        'invoices' => BillingRepository::list([
            'status' => $_GET['status'] ?? null,
            'from' => $_GET['from'] ?? null,
            'to' => $_GET['to'] ?? null,
            'customer_id' => $_GET['customer_id'] ?? null,
            'search' => $_GET['search'] ?? null,
        ], gstVisibleOnly: $gstVisibleOnly),
        'rates_set_today' => RateService::ratesSetFor(),
        'purities' => RateService::purities(),
        'categories' => BillingRepository::saleCategories(),
        'bank_accounts' => Database::fetchAll(
            'SELECT id, account_name FROM bank_accounts WHERE is_active = 1 ORDER BY account_name'
        ),
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    // ---------------------------------------------------------------- drafts
    case 'draft_save':
        requirePermission('invoices.create');
        $data = Validator::validate($body, [
            'id' => 'nullable|int|min:1',
            'customer_id' => 'nullable|int|min:1',
            'walkin_name' => 'nullable|string|max:150',
            'walkin_phone' => 'nullable|string|max:20',
            'invoice_date' => 'nullable|date',
            'price_mode' => 'nullable|in:exclusive,inclusive',
            'discount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:500',
        ]);

        if (!is_array($body['items'] ?? null) || $body['items'] === []) {
            Response::error('VALIDATION_ERROR', 'Add at least one item.', 422, ['items' => 'Add at least one item.']);
        }
        // a non-taxable line or a manual rate is an override — gate it
        foreach ($body['items'] as $line) {
            $treatment = $line['tax_treatment'] ?? 'taxable';
            if ($treatment !== 'taxable' && !checkPermission('invoices.override')) {
                Response::error('FORBIDDEN', 'You cannot mark a line as non-taxable.', 403);
            }
        }

        $invoiceId = InvoiceDraft::save(
            isset($data['id']) ? (int) $data['id'] : null,
            $body + ['invoice_date' => $data['invoice_date'] ?? date('Y-m-d')],
            $user->id
        );
        Response::success([
            'id' => $invoiceId,
            'invoice' => BillingRepository::detail($invoiceId, $canSeeCost, $gstVisibleOnly),
            'message' => 'Draft saved.',
        ]);
        // no break — Response::success() exits

    case 'draft_discard':
        requirePermission('invoices.create');
        InvoiceDraft::discard((int) ($body['id'] ?? 0), $user->id);
        Response::success(['message' => 'Draft discarded.']);

        // ------------------------------------------------------------ finalise
    case 'finalize':
        requirePermission('invoices.create');
        $invoiceId = (int) ($body['id'] ?? 0);
        if ($invoiceId <= 0) {
            Response::error('VALIDATION_ERROR', 'Which bill?', 422);
        }
        $payments = is_array($body['payments'] ?? null) ? $body['payments'] : [];
        foreach ($payments as $payment) {
            if (!in_array($payment['mode'] ?? '', ['cash', 'bank', 'upi', 'cheque', 'card'], true)) {
                Response::error('VALIDATION_ERROR', 'Choose a valid payment mode.', 422);
            }
        }

        BillingService::finalize($invoiceId, ['payments' => $payments], $user->id);
        Response::success([
            'id' => $invoiceId,
            'invoice' => BillingRepository::detail($invoiceId, $canSeeCost, $gstVisibleOnly),
            'message' => 'Bill saved.',
        ]);

    case 'cancel':
        requirePermission('invoices.cancel');
        $reason = trim((string) ($body['reason'] ?? ''));
        if ($reason === '') {
            Response::error('VALIDATION_ERROR', 'Please say why this bill is being cancelled.', 422, [
                'reason' => 'A reason is required.',
            ]);
        }
        BillingService::cancel((int) ($body['id'] ?? 0), $reason, $user->id);
        Response::success(['message' => 'Bill cancelled.']);

    case 'reprint':
        // logged so a duplicate print is always attributable
        requirePermission('invoices.read');
        $invoiceId = (int) ($body['id'] ?? 0);
        Audit::log($user->id, 'invoice.reprint', 'invoices', $invoiceId);
        $invoice = BillingRepository::detail($invoiceId, $canSeeCost, $gstVisibleOnly);
        if ($invoice === null) {
            Response::error('NOT_FOUND', 'Bill not found.', 404);
        }
        Response::success(['invoice' => $invoice]);

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
