<?php

declare(strict_types=1);

/**
 * Parallel billing stress test (plan/10 Phase 4 gate).
 *
 * Proves the client's headline requirement: several counters billing at the
 * same time never collide. It seeds tagged pieces and drafts — deliberately
 * pointing SOME drafts at the SAME piece — then finalises them from many OS
 * processes at once and asserts:
 *
 *   1. invoice numbers are unique and gap-free
 *   2. no piece was sold twice (the losers got a clean conflict, not a crash)
 *   3. the stock ledger matches what was actually sold
 *   4. the trial balance still nets to zero
 *   5. paid_amount matches the receipts
 *
 * Run:  php cli/stress-billing.php [workers] [items]
 *       php cli/stress-billing.php --cleanup      (remove test data)
 *
 * NOTE: writes real rows into the configured database. Point it at a test DB.
 */

if (PHP_SAPI !== 'cli') {
    exit("CLI only\n");
}

require_once dirname(__DIR__) . '/src/bootstrap.php';

use CRM\Database\Database;
use CRM\Jewellery\BillingService;
use CRM\Jewellery\InvoiceDraft;
use CRM\Jewellery\RateService;
use CRM\Jewellery\StockService;
use CRM\Support\FiscalYear;

const TEST_TAG = 'STRESS-';

// ---------------------------------------------------------------- worker mode
// Each worker is its own process → real concurrency, real row locks.
if (($argv[1] ?? '') === '--worker') {
    $invoiceId = (int) ($argv[2] ?? 0);
    try {
        BillingService::finalize($invoiceId, ['payments' => [
            ['mode' => 'cash', 'amount' => (float) Database::fetchValue(
                'SELECT grand_total FROM invoices WHERE id = :id',
                ['id' => $invoiceId]
            )],
        ]], 1);
        echo "OK {$invoiceId}\n";
        exit(0);
    } catch (DomainException $e) {
        // expected when another counter got the piece first
        echo "CONFLICT {$invoiceId} {$e->getMessage()}\n";
        exit(2);
    } catch (Throwable $e) {
        echo "ERROR {$invoiceId} " . $e->getMessage() . "\n";
        exit(1);
    }
}

// ---------------------------------------------------------------- cleanup mode
if (($argv[1] ?? '') === '--cleanup') {
    cleanup();
    echo "Test data removed.\n";
    exit(0);
}

$workers = max(2, (int) ($argv[1] ?? 20));
$itemCount = max(2, (int) ($argv[2] ?? 30));

echo "Parallel billing stress test\n============================\n";
echo "workers: {$workers}   items: {$itemCount}\n\n";

cleanup();

// ------------------------------------------------------------------ 1. set up
echo "Seeding rates, items and drafts...\n";

// today's rates must exist or billing refuses to price
$purities = RateService::purities();
if ($purities === []) {
    exit("No purities seeded. Run php database/seed.php first.\n");
}
$rates = [];
foreach ($purities as $purity) {
    $rates[(int) $purity['id']] = $purity['metal'] === 'gold' ? 7250.00 : 92.50;
}
RateService::setRates($rates, date('Y-m-d'), 1);

$goldPurity = null;
foreach ($purities as $purity) {
    if ($purity['metal'] === 'gold') {
        $goldPurity = (int) $purity['id'];
        break;
    }
}

$unitId = (int) Database::fetchValue("SELECT id FROM units WHERE short_name = 'g' LIMIT 1");
$itemIds = [];

Database::transaction(static function () use ($itemCount, $goldPurity, $unitId, &$itemIds): void {
    for ($i = 1; $i <= $itemCount; $i++) {
        $itemId = Database::insert('inventory_items', [
            'item_code' => TEST_TAG . str_pad((string) $i, 4, '0', STR_PAD_LEFT),
            'name' => 'Stress test ring ' . $i,
            'item_type' => 'stock',
            'metal' => 'gold',
            'purity_id' => $goldPurity,
            'tracking' => 'tagged',
            'unit_id' => $unitId,
            'gross_weight' => 10.000,
            'net_weight' => 10.000,
            'making_type' => 'per_gram',
            'making_value' => 500,
            'status' => 'in_stock',
            'created_by' => 1,
        ]);
        // opening stock so the piece has a cost for COGS
        StockService::record(
            itemId: $itemId,
            direction: 'in',
            reason: 'opening',
            qty: 1,
            weight: 10.000,
            value: 65000.00,
            ratePerGram: 6500.00,
            userId: 1
        );
        $itemIds[] = $itemId;
    }
});

// Drafts: the first half get their own piece; the rest deliberately CONTEND for
// pieces already claimed, so the test exercises the conflict path too.
$draftIds = [];
$expectedContended = 0;
for ($w = 0; $w < $workers; $w++) {
    $itemId = $w < count($itemIds) ? $itemIds[$w] : $itemIds[$w % max(1, intdiv(count($itemIds), 2))];
    if ($w >= count($itemIds)) {
        $expectedContended++;
    }
    $draftIds[] = InvoiceDraft::save(null, [
        'walkin_name' => 'Stress counter ' . $w,
        'invoice_date' => date('Y-m-d'),
        'items' => [[
            'item_id' => $itemId,
            'qty' => 1,
            'net_weight' => 10.000,
            'gross_weight' => 10.000,
        ]],
    ], 1);
}
echo '  ' . count($itemIds) . ' items, ' . count($draftIds) . " drafts ({$expectedContended} deliberately contending)\n\n";

// -------------------------------------------------------------- 2. fire them
echo "Finalising {$workers} bills in parallel...\n";
$php = PHP_BINARY;
$script = __FILE__;
$procs = [];
$started = microtime(true);

foreach ($draftIds as $draftId) {
    $cmd = escapeshellarg($php) . ' ' . escapeshellarg($script) . ' --worker ' . (int) $draftId;
    $proc = proc_open($cmd, [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    if (is_resource($proc)) {
        $procs[] = ['proc' => $proc, 'pipes' => $pipes, 'draft' => $draftId];
    }
}

$ok = 0;
$conflict = 0;
$errors = [];
foreach ($procs as $entry) {
    $out = stream_get_contents($entry['pipes'][1]) . stream_get_contents($entry['pipes'][2]);
    fclose($entry['pipes'][1]);
    fclose($entry['pipes'][2]);
    $code = proc_close($entry['proc']);
    if ($code === 0) {
        $ok++;
    } elseif ($code === 2) {
        $conflict++;
    } else {
        $errors[] = trim($out);
    }
}
$elapsed = round(microtime(true) - $started, 2);
echo "  finalised: {$ok}   clean conflicts: {$conflict}   hard errors: " . count($errors) . "   ({$elapsed}s)\n\n";

// ------------------------------------------------------------------ 3. assert
echo "Checks\n------\n";
$failures = [];

$assert = static function (string $label, bool $ok, string $detail = '') use (&$failures): void {
    echo ($ok ? '  [ok]   ' : '  [FAIL] ') . $label . ($detail !== '' ? " — {$detail}" : '') . "\n";
    if (!$ok) {
        $failures[] = $label;
    }
};

$assert('no hard errors (conflicts must be clean, not crashes)', $errors === [], implode(' | ', array_slice($errors, 0, 3)));

// unique + gap-free numbers
$numbers = Database::fetchAll(
    "SELECT invoice_no FROM invoices
      WHERE status = 'final' AND walkin_name LIKE 'Stress counter %'
      ORDER BY invoice_no"
);
$list = array_column($numbers, 'invoice_no');
$assert('invoice numbers are unique', count($list) === count(array_unique($list)),
    count($list) . ' issued, ' . count(array_unique($list)) . ' unique');
$assert('every finalised bill got a number', !in_array(null, $list, true) && count($list) === $ok,
    count($list) . " numbered vs {$ok} finalised");

$seq = array_map(static fn (string $n): int => (int) substr($n, strrpos($n, '-') + 1), $list);
sort($seq);
$gapFree = $seq === [] || ($seq[count($seq) - 1] - $seq[0] + 1) === count($seq);
$assert('invoice numbers are gap-free', $gapFree,
    $seq === [] ? '' : "range {$seq[0]}..{$seq[count($seq) - 1]} for " . count($seq) . ' bills');

// no piece sold twice
$doubleSold = Database::fetchAll(
    "SELECT i.item_code, COUNT(*) AS times
       FROM inventory_transactions t
       JOIN inventory_items i ON i.id = t.item_id
      WHERE i.item_code LIKE '" . TEST_TAG . "%' AND t.type = 'out' AND t.reason = 'sale'
      GROUP BY i.item_code HAVING times > 1"
);
$assert('no piece was sold twice', $doubleSold === [], count($doubleSold) . ' double-sold');
foreach (array_slice($doubleSold, 0, 5) as $row) {
    echo "         {$row['item_code']} sold {$row['times']} times\n";
}

// stock ledger agrees with what sold
$soldCount = (int) Database::fetchValue(
    "SELECT COUNT(*) FROM inventory_items WHERE item_code LIKE '" . TEST_TAG . "%' AND status = 'sold'"
);
$assert('sold-piece count equals finalised bills', $soldCount === $ok, "{$soldCount} sold vs {$ok} bills");

// books still balance
$fy = FiscalYear::range();
$tb = CRM\Accounting\AccountingRepository::trialBalance($fy['start'], $fy['end']);
$assert('trial balance nets to zero', $tb['balanced'],
    sprintf('dr %.2f vs cr %.2f', $tb['total_debit'], $tb['total_credit']));

// receipts match
$paidDrift = Database::fetchAll(
    "SELECT i.invoice_no FROM invoices i
      WHERE i.walkin_name LIKE 'Stress counter %' AND i.status = 'final'
        AND ABS(i.paid_amount - COALESCE((SELECT SUM(amount) FROM invoice_payments
              WHERE invoice_id = i.id AND status = 'active'), 0)) > 0.01"
);
$assert('paid_amount matches receipts', $paidDrift === [], count($paidDrift) . ' drifted');

echo "\n";
if ($failures === []) {
    echo "PASSED — concurrent billing is safe.\n";
    echo "Run 'php cli/stress-billing.php --cleanup' to remove the test data.\n";
    exit(0);
}
echo 'FAILED: ' . implode('; ', $failures) . "\n";
exit(1);

// ---------------------------------------------------------------------------
function cleanup(): void
{
    Database::transaction(static function (): void {
        $invoiceIds = array_column(Database::fetchAll(
            "SELECT id FROM invoices WHERE walkin_name LIKE 'Stress counter %'"
        ), 'id');
        foreach ($invoiceIds as $id) {
            $voucherIds = array_column(Database::fetchAll(
                "SELECT id FROM vouchers WHERE ref_type = 'invoice' AND ref_id = :i",
                ['i' => $id]
            ), 'id');
            Database::execute('DELETE FROM invoice_payments WHERE invoice_id = :i', ['i' => $id]);
            Database::execute('DELETE FROM invoice_items WHERE invoice_id = :i', ['i' => $id]);
            Database::execute('DELETE FROM invoice_old_metal WHERE invoice_id = :i', ['i' => $id]);
            Database::execute('DELETE FROM inventory_transactions WHERE invoice_id = :i', ['i' => $id]);
            Database::execute('UPDATE invoices SET voucher_id = NULL WHERE id = :i', ['i' => $id]);
            foreach ($voucherIds as $vid) {
                Database::execute('DELETE FROM voucher_entries WHERE voucher_id = :v', ['v' => $vid]);
                Database::execute('DELETE FROM vouchers WHERE id = :v', ['v' => $vid]);
            }
            Database::execute('DELETE FROM invoices WHERE id = :i', ['i' => $id]);
        }
        // receipt vouchers raised by the workers
        Database::execute(
            "DELETE ve FROM voucher_entries ve JOIN vouchers v ON v.id = ve.voucher_id
              WHERE v.ref_type = 'receipt' AND v.narration LIKE 'Receipt %'
                AND NOT EXISTS (SELECT 1 FROM invoice_payments p WHERE p.voucher_id = v.id)"
        );
        Database::execute(
            "DELETE FROM vouchers WHERE ref_type = 'receipt'
               AND NOT EXISTS (SELECT 1 FROM invoice_payments p WHERE p.voucher_id = vouchers.id)"
        );
        Database::execute(
            "DELETE t FROM inventory_transactions t JOIN inventory_items i ON i.id = t.item_id
              WHERE i.item_code LIKE '" . TEST_TAG . "%'"
        );
        Database::execute("DELETE FROM inventory_items WHERE item_code LIKE '" . TEST_TAG . "%'");
    });
}
