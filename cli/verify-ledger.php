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
 *   6. a tagged piece's status agrees with its ledger position (0 or 1)
 *   7. sales register total = GST outward turnover = P&L income
 *   8. every inventory ledger carries exactly the stock that maps to it
 *
 * Run: php cli/verify-ledger.php
 * Exit code 0 = clean, 1 = drift found.
 */

if (PHP_SAPI !== 'cli') {
    exit("CLI only\n");
}

require_once dirname(__DIR__) . '/src/bootstrap.php';

use CRM\Accounting\AccountingRepository;
use CRM\Accounting\Ledgers;
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
//
// A tagged piece is ONE item, so its ledger position is only ever 0 or 1:
//   - sold / removed      → nothing may be left on the shelf
//   - in_stock, received  → exactly one piece must be left
// An item created but not yet received has no ledger rows at all and is
// legitimately in_stock: it is waiting for its opening-stock or purchase entry,
// so it is not a mismatch.
$statusDrift = Database::fetchAll(
    "SELECT i.id, i.item_code, i.status,
            COALESCE((SELECT SUM(CASE WHEN type = 'in' THEN qty ELSE -qty END)
                        FROM inventory_transactions WHERE item_id = i.id), 0) AS net_qty,
            (SELECT COUNT(*) FROM inventory_transactions WHERE item_id = i.id) AS moves
       FROM inventory_items i
      WHERE i.tracking = 'tagged' AND i.is_active = 1
     HAVING (i.status = 'in_stock' AND moves > 0 AND net_qty <> 1)
         OR (i.status IN ('sold', 'removed') AND net_qty <> 0)"
);
report('tagged item status matches the ledger', $statusDrift === [], count($statusDrift) . ' mismatched');
foreach (array_slice($statusDrift, 0, 5) as $row) {
    echo "         {$row['item_code']}: status {$row['status']} but net qty {$row['net_qty']}\n";
}

// 7. no sale can hide: register = GST turnover = P&L income
//
// All three legs are compared on the GST taxable basis. Two discounts exist and
// they sit on opposite sides of the tax line:
//   - line discount (invoice_items.discount): pre-tax — Pricing computes
//     taxable = metal + making − discount, and gstSummary already nets it;
//   - bill discount (invoices.bill_discount): a post-tax rebate — the grand
//     total drops but GST was charged on the full value, so turnover keeps it
//     (it shows in the P&L as the "Discount Given" contra instead).
// Both land in Discount Given, which is why the P&L leg below has to put the
// line discount back: turnover has already netted it, the Sales ledgers have
// not (they are credited with the gross metal and making value).
$gst = BillingRepository::gstSummary($fy['start'], $fy['end']);
$pnl = AccountingRepository::profitAndLoss($fy['start'], $fy['end']);
$register = BillingRepository::salesRegister($fy['start'], $fy['end']);
$lineDiscounts = (float) Database::fetchValue(
    "SELECT COALESCE(SUM(ii.discount), 0)
       FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
      WHERE i.status = 'final' AND i.invoice_date BETWEEN :from AND :to",
    ['from' => $fy['start'], 'to' => $fy['end']]
);
$registerTaxable = -$lineDiscounts;
foreach ($register as $row) {
    $registerTaxable += (float) $row['metal_total'] + (float) $row['making_total'];
}
report(
    'sales register total = GST outward turnover',
    abs($registerTaxable - $gst['total_turnover']) < 1.0,
    sprintf('register %.2f vs GST %.2f', $registerTaxable, $gst['total_turnover'])
);
// round-off is other income, not turnover; the discount contra is the post-tax
// rebate turnover rightly keeps (see above) — exclude both from the comparison
$salesIncome = 0.0;
foreach ($pnl['income'] as $line) {
    if (!in_array($line['linked_type'] ?? null, ['round_off', 'discount'], true)) {
        $salesIncome += (float) $line['amount'];
    }
}
// the Sales ledgers carry the gross value, so take the pre-tax line discounts
// back off to compare like with like
$salesIncome -= $lineDiscounts;
report(
    'GST turnover = P&L sales income (no sale recorded outside the books)',
    abs($gst['total_turnover'] - $salesIncome) < 0.05,
    sprintf('GST %.2f vs P&L %.2f', $gst['total_turnover'], $salesIncome)
);

// 8. each inventory ledger carries exactly the stock that maps to it
//
// The totals balancing is not enough: stock taken IN on one inventory ledger and
// relieved from another leaves the trial balance at zero while both ledgers
// drift — which is precisely what old metal did before it got its own mapping.
// Ledgers::inventoryForItem() is the single source of that mapping, so this
// check re-derives it in SQL and compares.
$oldMetalLedger = Ledgers::system('old_metal');
$inventoryDrift = [];
foreach (Database::fetchAll(
    "SELECT id, name FROM ledger_accounts WHERE linked_type IN ('inventory', 'old_metal') ORDER BY id"
) as $ledger) {
    $balance = (float) Database::fetchValue(
        "SELECT ROUND(COALESCE(SUM(e.dr_amount - e.cr_amount), 0), 2)
           FROM voucher_entries e
           JOIN vouchers v ON v.id = e.voucher_id AND v.status = 'active'
          WHERE e.ledger_id = :l",
        ['l' => $ledger['id']]
    );
    $stockValue = (float) Database::fetchValue(
        "SELECT ROUND(COALESCE(SUM(CASE WHEN t.type = 'in' THEN t.value ELSE -t.value END), 0), 2)
           FROM inventory_transactions t
           JOIN inventory_items i ON i.id = t.item_id
          WHERE CASE
                  WHEN i.item_type = 'old_metal' THEN :om1
                  WHEN i.metal IS NULL OR i.metal = '' THEN :om2
                  ELSE (SELECT x.id FROM ledger_accounts x
                         WHERE x.linked_type = 'inventory' AND x.metal = i.metal LIMIT 1)
                END = :l",
        ['om1' => $oldMetalLedger, 'om2' => $oldMetalLedger, 'l' => $ledger['id']]
    );
    if (abs($balance - $stockValue) > 1.0) {
        $inventoryDrift[] = [
            'name' => $ledger['name'],
            'ledger' => $balance,
            'stock' => $stockValue,
        ];
    }
}
report(
    'each inventory ledger matches the stock it carries',
    $inventoryDrift === [],
    count($inventoryDrift) . ' drifted'
);
foreach ($inventoryDrift as $row) {
    printf("         %s: ledger %.2f vs stock %.2f
", $row['name'], $row['ledger'], $row['stock']);
}

// 9. every finalised bill has an active voucher
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
