<?php

declare(strict_types=1);

/**
 * Ledger integrity check (plan/10 standing checklist #2).
 *
 * Recomputes everything from the underlying entries and reports any drift:
 *   1. every voucher balances (ΣDr = ΣCr)
 *   2. the trial balance nets to zero
 *   3. invoices.paid_amount matches its active receipts
 *   4. purchases.paid_amount matches its active vendor payments
 *   5. inventory_items.current_stock matches the stock ledger
 *   6. no tagged piece is marked in_stock while its ledger says it is sold
 *   7. sales register total = GST outward turnover = P&L income
 *
 * Run: php cli/verify-ledger.php
 * Exit code 0 = clean, 1 = drift found.
 */

if (PHP_SAPI !== 'cli') {
    exit("CLI only\n");
}

require_once dirname(__DIR__) . '/src/bootstrap.php';

use CRM\Accounting\AccountingRepository;
use CRM\Database\Database;
use CRM\Jewellery\BillingRepository;
use CRM\Support\FiscalYear;

$failures = [];
$checks = 0;

function report(string $label, bool $ok, string $detail = ''): void
{
    global $failures, $checks;
    $checks++;
    if ($ok) {
        echo "  [ok]   {$label}\n";
        return;
    }
    $failures[] = $label . ($detail !== '' ? " — {$detail}" : '');
    echo "  [FAIL] {$label}" . ($detail !== '' ? " — {$detail}" : '') . "\n";
}

echo "Ledger integrity check\n----------------------\n";

// 1. every voucher balances
$unbalanced = Database::fetchAll(
    "SELECT v.id, v.voucher_no, ROUND(SUM(e.dr_amount), 2) dr, ROUND(SUM(e.cr_amount), 2) cr
       FROM vouchers v JOIN voucher_entries e ON e.voucher_id = v.id
      WHERE v.status = 'active'
      GROUP BY v.id, v.voucher_no
     HAVING ABS(dr - cr) > 0.01"
);
report('every voucher balances', $unbalanced === [], count($unbalanced) . ' unbalanced');
foreach (array_slice($unbalanced, 0, 5) as $row) {
    echo "         {$row['voucher_no']}: dr {$row['dr']} vs cr {$row['cr']}\n";
}

// 2. trial balance nets to zero
$fy = FiscalYear::range();
$tb = AccountingRepository::trialBalance($fy['start'], $fy['end']);
report(
    'trial balance nets to zero',
    $tb['balanced'],
    sprintf('dr %.2f vs cr %.2f', $tb['total_debit'], $tb['total_credit'])
);

// 3. invoice paid_amount vs receipts
$paidDrift = Database::fetchAll(
    "SELECT i.id, i.invoice_no, i.paid_amount,
            COALESCE((SELECT SUM(amount) FROM invoice_payments
                       WHERE invoice_id = i.id AND status = 'active'), 0) AS actual
       FROM invoices i
      WHERE i.status <> 'cancelled'
     HAVING ABS(i.paid_amount - actual) > 0.01"
);
report('invoice paid_amount matches receipts', $paidDrift === [], count($paidDrift) . ' drifted');
foreach (array_slice($paidDrift, 0, 5) as $row) {
    echo "         {$row['invoice_no']}: stored {$row['paid_amount']} vs actual {$row['actual']}\n";
}

// 4. purchase paid_amount vs vendor payments
$purchaseDrift = Database::fetchAll(
    "SELECT p.id, p.purchase_no, p.paid_amount,
            COALESCE((SELECT SUM(amount) FROM vendor_payments
                       WHERE purchase_id = p.id AND status = 'active'), 0) AS actual
       FROM purchases p
      WHERE p.status <> 'cancelled'
     HAVING ABS(p.paid_amount - actual) > 0.01"
);
report('purchase paid_amount matches payments', $purchaseDrift === [], count($purchaseDrift) . ' drifted');

// 5. cached stock vs the stock ledger
$stockDrift = Database::fetchAll(
    "SELECT i.id, i.item_code, i.current_stock,
            COALESCE((SELECT SUM(CASE WHEN type = 'in' THEN weight ELSE -weight END)
                        FROM inventory_transactions WHERE item_id = i.id), 0) AS actual
       FROM inventory_items i
     HAVING ABS(i.current_stock - actual) > 0.001"
);
report('cached stock matches the ledger', $stockDrift === [], count($stockDrift) . ' drifted');
foreach (array_slice($stockDrift, 0, 5) as $row) {
    echo "         {$row['item_code']}: cached {$row['current_stock']} vs ledger {$row['actual']}\n";
}

// 6. tagged pieces: status vs ledger position
$statusDrift = Database::fetchAll(
    "SELECT i.id, i.item_code, i.status,
            COALESCE((SELECT SUM(CASE WHEN type = 'in' THEN qty ELSE -qty END)
                        FROM inventory_transactions WHERE item_id = i.id), 0) AS net_qty
       FROM inventory_items i
      WHERE i.tracking = 'tagged' AND i.is_active = 1
     HAVING (i.status = 'in_stock' AND net_qty <= 0)
         OR (i.status = 'sold' AND net_qty > 0)"
);
report('tagged item status matches the ledger', $statusDrift === [], count($statusDrift) . ' mismatched');
foreach (array_slice($statusDrift, 0, 5) as $row) {
    echo "         {$row['item_code']}: status {$row['status']} but net qty {$row['net_qty']}\n";
}

// 7. no sale can hide: register = GST turnover = P&L income
$gst = BillingRepository::gstSummary($fy['start'], $fy['end']);
$pnl = AccountingRepository::profitAndLoss($fy['start'], $fy['end']);
$register = BillingRepository::salesRegister($fy['start'], $fy['end']);
$registerTaxable = 0.0;
foreach ($register as $row) {
    $registerTaxable += (float) $row['metal_total'] + (float) $row['making_total'] - (float) $row['discount_total'];
}
report(
    'sales register total = GST outward turnover',
    abs($registerTaxable - $gst['total_turnover']) < 1.0,
    sprintf('register %.2f vs GST %.2f', $registerTaxable, $gst['total_turnover'])
);
// round-off is other income, not turnover — exclude it from the comparison
$salesIncome = 0.0;
foreach ($pnl['income'] as $line) {
    if (($line['linked_type'] ?? null) !== 'round_off') {
        $salesIncome += (float) $line['amount'];
    }
}
report(
    'GST turnover = P&L sales income (no sale recorded outside the books)',
    abs($gst['total_turnover'] - $salesIncome) < 0.05,
    sprintf('GST %.2f vs P&L %.2f', $gst['total_turnover'], $salesIncome)
);

// 8. every finalised bill has an active voucher
$missingVoucher = (int) Database::fetchValue(
    "SELECT COUNT(*) FROM invoices i
      LEFT JOIN vouchers v ON v.id = i.voucher_id
      WHERE i.status = 'final' AND (i.voucher_id IS NULL OR v.status <> 'active')"
);
report('every finalised bill has an active voucher', $missingVoucher === 0, $missingVoucher . ' without one');

echo "\n";
if ($failures === []) {
    echo "All {$checks} checks passed. The books are consistent.\n";
    exit(0);
}
echo count($failures) . " of {$checks} checks FAILED:\n";
foreach ($failures as $failure) {
    echo "  - {$failure}\n";
}
exit(1);
