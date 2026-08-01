<?php

declare(strict_types=1);

/**
 * Estimates / quotations (plan/07 §3a).
 * A price slip — never a bill. No stock movement, no ledger posting.
 */

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Jewellery\BillingRepository;
use CRM\Jewellery\EstimateService;
use CRM\Jewellery\RateService;
use CRM\Support\GstVisibility;
use CRM\Validation\Validator;

$user = requireApiAuth();
$gstVisibleOnly = GstVisibility::restrictedUsername($user->username);

if (Request::method() === 'GET') {
    requirePermission('estimates.read');

    if (($_GET['view'] ?? '') === 'detail') {
        $estimate = EstimateService::detail((int) ($_GET['id'] ?? 0), $gstVisibleOnly);
        if ($estimate === null) {
            Response::error('NOT_FOUND', 'Estimate not found.', 404);
        }
        Response::success(['estimate' => $estimate]);
    }

    Response::success([
        'estimates' => EstimateService::list([
            'status' => $_GET['status'] ?? null,
            'search' => $_GET['search'] ?? null,
        ], $gstVisibleOnly),
        'purities' => RateService::purities(),
        'categories' => BillingRepository::saleCategories(),
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    case 'save':
        requirePermission('estimates.create');
        Validator::validate($body, [
            'id' => 'nullable|int|min:1',
            'customer_id' => 'nullable|int|min:1',
            'walkin_name' => 'nullable|string|max:150',
            'walkin_phone' => 'nullable|string|max:20',
            'estimate_date' => 'nullable|date',
            'valid_until' => 'nullable|date',
            'price_mode' => 'nullable|in:exclusive,inclusive',
            'discount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:500',
        ]);
        if (!is_array($body['items'] ?? null) || $body['items'] === []) {
            Response::error('VALIDATION_ERROR', 'Add at least one item.', 422, ['items' => 'Add at least one item.']);
        }

        $id = EstimateService::save(
            isset($body['id']) ? (int) $body['id'] : null,
            $body,
            $user->id
        );
        Response::success([
            'id' => $id,
            'estimate' => EstimateService::detail($id, $gstVisibleOnly),
            'message' => 'Estimate saved.',
        ]);

    case 'convert':
        // becomes a DRAFT bill; the counter still has to finalise it
        requirePermission('invoices.create');
        $invoiceId = EstimateService::convert(
            (int) ($body['id'] ?? 0),
            (bool) ($body['hold_quoted_rate'] ?? false),
            $user->id
        );
        Response::success([
            'invoice_id' => $invoiceId,
            'message' => 'Draft bill created from the estimate.',
        ]);

    case 'cancel':
        requirePermission('estimates.create');
        EstimateService::cancel((int) ($body['id'] ?? 0), $user->id);
        Response::success(['message' => 'Estimate cancelled.']);

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
