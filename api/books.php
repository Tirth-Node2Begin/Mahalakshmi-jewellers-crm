<?php

declare(strict_types=1);

/**
 * The books — financial reports (plan/05 §3, plan/06 §5).
 *
 * Separate from api/reports.php (operational analytics) because everything here
 * is derived from the ledger and is permission-gated report by report.
 * Every figure comes from ACTIVE vouchers, so these can never disagree with
 * each other: sales register total = GST turnover = P&L sales.
 */

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Accounting\AccountingRepository;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Jewellery\BillingRepository;
use CRM\Jewellery\StockService;
use CRM\Support\FiscalYear;
use CRM\Support\GstVisibility;

$user = requireApiAuth();
$gstVisibleOnly = GstVisibility::restrictedUsername($user->username);
requireMethod('GET');

$report = (string) ($_GET['report'] ?? '');
$fy = FiscalYear::range();
$from = (string) ($_GET['from'] ?? $fy['start']);
$to = (string) ($_GET['to'] ?? $fy['end']);

foreach (['from' => $from, 'to' => $to] as $label => $value) {
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        Response::error('VALIDATION_ERROR', "Invalid {$label} date.", 422);
    }
}
if ($from > $to) {
    Response::error('VALIDATION_ERROR', 'The start date must come before the end date.', 422);
}

switch ($report) {
    case 'pnl':
        // the client's headline report
        requirePermission('reports.pnl');
        Response::success(['pnl' => AccountingRepository::profitAndLoss($from, $to, $gstVisibleOnly)]);

    case 'trial_balance':
        requirePermission('reports.accounting');
        Response::success(['trial_balance' => AccountingRepository::trialBalance($from, $to, $gstVisibleOnly)]);

    case 'daybook':
        requirePermission('reports.accounting');
        $date = (string) ($_GET['date'] ?? date('Y-m-d'));
        Response::success(['date' => $date, 'vouchers' => AccountingRepository::dayBook($date, $gstVisibleOnly)]);

    case 'ledger':
        requirePermission('reports.accounting');
        $ledgerId = (int) ($_GET['ledger_id'] ?? 0);
        if ($ledgerId <= 0) {
            Response::error('VALIDATION_ERROR', 'Choose a ledger.', 422);
        }
        Response::success([
            'statement' => AccountingRepository::ledgerStatement(
                $ledgerId,
                $from,
                $to,
                $gstVisibleOnly
            ),
        ]);

    case 'cash_bank_book':
        requirePermission('reports.accounting');
        $ledgers = Database::fetchAll(
            "SELECT id, name, linked_type FROM ledger_accounts
              WHERE linked_type IN ('cash','bank') AND is_active = 1 ORDER BY linked_type, name"
        );
        $books = [];
        foreach ($ledgers as $ledger) {
            $books[] = [
                'ledger' => $ledger,
                'statement' => AccountingRepository::ledgerStatement(
                    (int) $ledger['id'],
                    $from,
                    $to,
                    $gstVisibleOnly
                ),
            ];
        }
        Response::success(['books' => $books]);

    case 'customer_outstanding':
        requirePermission('reports.outstanding');
        Response::success(['outstanding' => AccountingRepository::outstanding('customer', $to, $gstVisibleOnly)]);

    case 'vendor_outstanding':
        requirePermission('reports.outstanding');
        Response::success(['outstanding' => AccountingRepository::outstanding('vendor', $to)]);

    case 'gst_summary':
        requirePermission('reports.gst');
        $gst = BillingRepository::gstSummary($from, $to, $gstVisibleOnly);
        // Reconciliation: outward turnover must equal the P&L's SALES income.
        // Round-off is booked as other income, so it is excluded here — otherwise
        // every bill's paise adjustment shows up as a phantom mismatch.
        $salesIncome = $gstVisibleOnly ? (float) $gst['total_turnover'] : 0.0;
        if (!$gstVisibleOnly) {
            $pnl = AccountingRepository::profitAndLoss($from, $to);
            foreach ($pnl['income'] as $line) {
                if (($line['linked_type'] ?? null) !== 'round_off') {
                    $salesIncome += (float) $line['amount'];
                }
            }
        }
        $salesIncome = round($salesIncome, 2);
        $gst['reconciliation'] = [
            'gst_turnover' => $gst['total_turnover'],
            'pnl_income' => $salesIncome,
            'difference' => round($gst['total_turnover'] - $salesIncome, 2),
        ];
        Response::success(['gst' => $gst]);

    case 'ledger_view':
        $view = strtolower((string) ($_GET['view'] ?? ''));
        if ($view === '') {
            $view = checkPermission('reports.accounting') ? 'full' : 'gst';
        }
        if ($gstVisibleOnly) {
            $view = 'gst';
        }
        if (!in_array($view, ['full', 'gst'], true)) {
            Response::error('VALIDATION_ERROR', 'Choose a valid ledger view.', 422);
        }
        if ($view === 'full') {
            requirePermission('reports.accounting');
        } else {
            requirePermission('reports.gst');
        }
        Response::success(['ledger' => BillingRepository::ledgerView($from, $to, $view)]);

    case 'sales_register':
        requirePermission('reports.read');
        Response::success(['rows' => BillingRepository::salesRegister($from, $to, $gstVisibleOnly)]);

    case 'purchase_register':
        requirePermission('reports.read');
        if ($gstVisibleOnly) {
            Response::success([
                'rows' => Database::fetchAll(
                    "SELECT p.id, p.purchase_no, p.purchase_date, p.invoice_ref, s.name AS vendor_name,
                            s.gstin AS vendor_gstin,
                            SUM(pi.line_total - pi.tax_amount) AS subtotal,
                            SUM(pi.tax_amount * COALESCE(p.cgst / NULLIF(p.tax_total, 0), 0)) AS cgst,
                            SUM(pi.tax_amount * COALESCE(p.sgst / NULLIF(p.tax_total, 0), 0)) AS sgst,
                            SUM(pi.tax_amount * COALESCE(p.igst / NULLIF(p.tax_total, 0), 0)) AS igst,
                            SUM(pi.tax_amount) AS tax_total,
                            SUM(pi.line_total) AS grand_total,
                            CASE
                                WHEN p.grand_total > 0 THEN p.paid_amount * (LEAST(SUM(pi.line_total), p.grand_total) / p.grand_total)
                                ELSE 0
                            END AS paid_amount
                       FROM purchase_items pi
                       JOIN purchases p ON p.id = pi.purchase_id
                       JOIN suppliers s ON s.id = p.supplier_id
                      WHERE p.status <> 'cancelled'
                        AND p.purchase_date BETWEEN :from AND :to
                        AND (pi.tax_rate > 0 OR pi.tax_amount > 0)
                      GROUP BY p.id, p.purchase_no, p.purchase_date, p.invoice_ref, s.name, s.gstin, p.paid_amount
                      ORDER BY p.purchase_date, p.id",
                    ['from' => $from, 'to' => $to]
                ),
            ]);
        }
        Response::success([
            'rows' => Database::fetchAll(
                "SELECT p.id, p.purchase_no, p.purchase_date, p.invoice_ref, s.name AS vendor_name,
                        s.gstin AS vendor_gstin, p.subtotal, p.cgst, p.sgst, p.igst,
                        p.tax_total, p.grand_total, p.paid_amount
                   FROM purchases p JOIN suppliers s ON s.id = p.supplier_id
                  WHERE p.status <> 'cancelled' AND p.purchase_date BETWEEN :from AND :to
                  ORDER BY p.purchase_date, p.id",
                ['from' => $from, 'to' => $to]
            ),
        ]);

    case 'stock_summary':
        requirePermission('reports.stock');
        Response::success(['summary' => StockService::summary()]);

    case 'stock_movement':
        requirePermission('reports.stock');
        $params = ['from' => $from, 'to' => $to];
        $sql = "SELECT t.id, t.item_id, t.created_at, t.type, t.reason, t.qty, t.weight, t.rate_per_gram, t.value,
                       t.adjustment_reason, i.item_code, i.name AS item_name, i.metal,
                       p.code AS purity_code, inv.invoice_no, pur.purchase_no, u.full_name AS user_name
                  FROM inventory_transactions t
                  JOIN inventory_items i ON i.id = t.item_id
             LEFT JOIN purities p ON p.id = i.purity_id
             LEFT JOIN invoices inv ON inv.id = t.invoice_id
             LEFT JOIN purchases pur ON pur.id = t.purchase_id
             LEFT JOIN users u ON u.id = t.created_by
                 WHERE DATE(t.created_at) BETWEEN :from AND :to";
        if ($gstVisibleOnly) {
            $sql .= ' AND ' . GstVisibility::stockMovementVisibleSql('t');
        }
        if (!empty($_GET['item_id'])) {
            $sql .= ' AND t.item_id = :item';
            $params['item'] = (int) $_GET['item_id'];
        }
        $sql .= ' ORDER BY t.created_at DESC, t.id DESC LIMIT 500';
        $movements = Database::fetchAll($sql, $params);
        if ($gstVisibleOnly) {
            $movements = GstVisibility::projectHiddenSaleStockOut(
                $movements,
                $from,
                $to,
                !empty($_GET['item_id']) ? (int) $_GET['item_id'] : null
            );
        }
        Response::success(['movements' => $movements]);

    case 'dead_stock':
        requirePermission('reports.stock');
        $days = (int) ($_GET['days'] ?? Database::fetchValue(
            "SELECT svalue FROM settings WHERE skey = 'dead_stock_days'"
        ) ?? 180);
        Response::success(['days' => $days, 'items' => StockService::deadStock($days)]);

    default:
        Response::error('BAD_REQUEST', 'Unknown report.', 400);
}
