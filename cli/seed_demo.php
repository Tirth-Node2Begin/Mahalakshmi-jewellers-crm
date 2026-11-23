<?php

declare(strict_types=1);

/**
 * Mahalakshmi Jewellers ERP — demo data seeder.
 *
 * Everything is written through the real services (PurchaseService,
 * InvoiceDraft + BillingService, EstimateService, PaymentService,
 * ExpenseService) so every business rule applies: stock moves, vouchers
 * balance, numbers come from NumberSequence, and the books stay true.
 * Nothing here writes a ledger or stock row by hand.
 *
 * It is a TOP-UP seeder — safe to run against a database that already has
 * data. It restocks inventory, then adds estimates, held drafts, bills,
 * receipts, vendor payments and expenses on top of whatever is there.
 *
 * Usage:
 *   php cli/seed_demo.php              # top up once (skips if already run)
 *   php cli/seed_demo.php --force      # run again anyway
 *   php cli/seed_demo.php --no-sales   # everything EXCEPT bills, receipts and
 *                                      # held drafts — rates, vendors, customers,
 *                                      # stock, purchases, expenses, estimates —
 *                                      # for a shop that will do its own billing
 *
 * Always finish with `php cli/verify-ledger.php`.
 */

if (PHP_SAPI !== 'cli') {
    exit("seed_demo.php is CLI-only\n");
}

require_once dirname(__DIR__) . '/src/bootstrap.php';

use CRM\Auth\AuthUser;
use CRM\Customers\CustomerService;
use CRM\Database\Database;
use CRM\Expenses\ExpenseService;
use CRM\Jewellery\BillingService;
use CRM\Jewellery\EstimateService;
use CRM\Jewellery\InvoiceDraft;
use CRM\Jewellery\PaymentService;
use CRM\Jewellery\PurchaseService;
use CRM\Jewellery\RateService;
use CRM\Jewellery\StockService;
use CRM\Support\Audit;
use CRM\Support\NumberSequence;
use CRM\Vendors\VendorService;

$force = in_array('--force', $argv, true);
$noSales = in_array('--no-sales', $argv, true);

// ------------------------------------------------------------------ preflight
$adminId = (int) Database::fetchValue("SELECT id FROM users WHERE username = 'admin'");
if ($adminId === 0) {
    exit("Run database/seed.php first (no admin user found).\n");
}
$user = new AuthUser($adminId, 'admin', 'Super Admin', 'admin@mahalakshmijewellers.local', 0, ['super_admin'], false, null);

$marker = Database::fetchValue("SELECT svalue FROM settings WHERE skey = 'demo_seeded_at'");
if ($marker !== null && !$force) {
    exit("Demo data was already seeded on {$marker}. Re-run with --force to add another round.\n");
}

$today = date('Y-m-d');
$ago = static fn (int $d): string => date('Y-m-d', strtotime("-$d days"));

/** @var array<string,int> */
$counts = [];
function step(string $label, callable $fn): void
{
    try {
        $n = $fn();
        echo '  OK   ' . str_pad($label, 34) . ($n !== null ? " $n" : '') . "\n";
    } catch (\Throwable $e) {
        echo '  WARN ' . str_pad($label, 34) . ' -> ' . $e->getMessage() . "\n";
    }
}

echo "Seeding jewellery demo data…\n";

// ------------------------------------------------------------------ rates
// Billing refuses to price a line without a rate for the bill date, so make
// sure every date we are about to write a document on has one.
step('Daily rates (last 30 days)', function () use ($user): string {
    $base = ['24K' => 7340.0, '22K' => 6957.0, '18K' => 5579.0, '999' => 99.40, '925' => 92.50, 'PT950' => 3345.0];
    $purityIds = [];
    foreach (Database::fetchAll('SELECT id, code FROM purities') as $p) {
        $purityIds[$p['code']] = (int) $p['id'];
    }
    $written = 0;
    for ($d = 30; $d >= 0; $d--) {
        $date = date('Y-m-d', strtotime("-$d days"));
        if (RateService::ratesSetFor($date)) {
            continue;
        }
        // a gentle sine drift so the rate-history chart is not a flat line
        $drift = 1 + (sin($d / 4.5) * 0.012);
        $rates = [];
        foreach ($base as $code => $rate) {
            if (!isset($purityIds[$code])) {
                continue;
            }
            $rates[$purityIds[$code]] = round($rate * $drift, 2);
        }
        RateService::setRates($rates, $date, $user->id);
        $written++;
    }
    return $written . ' day(s) added';
});

// ------------------------------------------------------------------ customers
$customerIds = array_map('intval', array_column(
    Database::fetchAll('SELECT id FROM customers WHERE is_active = 1 ORDER BY id'),
    'id'
));

step('Customers', function () use ($user, &$customerIds): string {
    $new = [
        ['name' => 'Meera Shah', 'mobile' => '9820140001', 'email' => 'meera.shah@example.com', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'gender' => 'female', 'dob' => '1988-03-12', 'anniversary' => '2012-11-24', 'occupation' => 'Doctor', 'vip' => 1, 'gstin' => '27AAJPS1234C1ZQ'],
        ['name' => 'Rohit Mehta', 'mobile' => '9820140002', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'gender' => 'male', 'occupation' => 'Businessman', 'vip' => 1],
        ['name' => 'Anita Verma', 'mobile' => '9820140003', 'email' => 'anita.verma@example.com', 'city' => 'Pune', 'state' => 'Maharashtra', 'gender' => 'female', 'dob' => '1985-06-30'],
        ['name' => 'Priya Nair', 'mobile' => '9820140004', 'city' => 'Thane', 'state' => 'Maharashtra', 'gender' => 'female', 'anniversary' => '2016-01-18'],
        ['name' => 'Karan Patel', 'mobile' => '9820140005', 'city' => 'Ahmedabad', 'state' => 'Gujarat', 'gender' => 'male', 'occupation' => 'Chartered Accountant', 'gstin' => '24ABCPP7788L1Z3'],
        ['name' => 'Sunita Desai', 'mobile' => '9820140006', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'gender' => 'female', 'opening_balance' => 45000, 'opening_type' => 'debit'],
        ['name' => 'Vikram Singh', 'mobile' => '9820140007', 'city' => 'Delhi', 'state' => 'Delhi', 'gender' => 'male', 'gstin' => '07AACPS9911M1Z8'],
        ['name' => 'Deepa Iyer', 'mobile' => '9820140008', 'email' => 'deepa.iyer@example.com', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'gender' => 'female', 'vip' => 1],
    ];
    $added = 0;
    foreach ($new as $c) {
        $exists = Database::fetchValue('SELECT id FROM customers WHERE mobile = :m', ['m' => $c['mobile']]);
        if ($exists !== null) {
            $customerIds[] = (int) $exists;
            continue;
        }
        $customerIds[] = CustomerService::create($c, $user);
        $added++;
    }
    $customerIds = array_values(array_unique($customerIds));
    return $added . ' added (' . count($customerIds) . ' total)';
});

// ------------------------------------------------------------------ vendors
// The purchases below buy from bullion vendors and the job-work bill needs a
// karigar, so make sure the vendor book has real names in it.
step('Vendors', function () use ($user): string {
    // a shop-added type (vendor_types master), so the "+ Add a new type…" flow
    // has visible demo data — angadia is the trade's traditional secure courier
    if (Database::fetchValue("SELECT id FROM vendor_types WHERE slug = 'angadia_courier'") === null) {
        VendorService::addType(['label' => 'Angadia / Courier', 'category' => 'service'], $user);
    }
    // a shop-added MAKER type too, so the per-page add flow has demo data on more
    // than one partner page (and shows up in the outsourcing picklist)
    if (Database::fetchValue("SELECT id FROM vendor_types WHERE slug = 'casting_unit'") === null) {
        VendorService::addType(['label' => 'Casting Unit', 'category' => 'maker'], $user);
    }
    $vendors = [
        ['name' => 'Vora Gold Refiners', 'vendor_type' => 'bullion', 'company' => 'Vora Gold Refiners Pvt Ltd', 'contact_person' => 'Jayesh Vora', 'mobile' => '9821330011', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'gstin' => '27AABCV2233K1Z5', 'payment_terms' => '15 days credit'],
        ['name' => 'Shree Balaji Metals', 'vendor_type' => 'bullion', 'contact_person' => 'Mahesh Agarwal', 'mobile' => '9821330022', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'gstin' => '27AAGCS8899P1Z2', 'payment_terms' => '7 days credit'],
        ['name' => 'Sai Karigar Works', 'vendor_type' => 'karigar', 'contact_person' => 'Ramu Sonar', 'mobile' => '9821330033', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'specialisation' => 'Temple & antique jewellery', 'karigar_rate' => 550],
        ['name' => 'Shree Jewel Craft', 'vendor_type' => 'karigar', 'contact_person' => 'Dinesh Soni', 'mobile' => '9821330044', 'city' => 'Thane', 'state' => 'Maharashtra', 'specialisation' => 'Stone setting & polish', 'karigar_rate' => 480],
        ['name' => 'Ratna Gems', 'vendor_type' => 'stone', 'contact_person' => 'Paresh Jhaveri', 'mobile' => '9821330055', 'city' => 'Surat', 'state' => 'Gujarat', 'payment_terms' => '30 days credit'],
        ['name' => 'Patel Angadia Services', 'vendor_type' => 'angadia_courier', 'contact_person' => 'Bharat Patel', 'mobile' => '9821330066', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'payment_terms' => 'On delivery', 'notes' => 'Weekly Mumbai–Surat–Rajkot run for stones and job-work pieces.'],
    ];
    $added = 0;
    foreach ($vendors as $v) {
        if (Database::fetchValue('SELECT id FROM suppliers WHERE name = :n', ['n' => $v['name']]) !== null) {
            continue;
        }
        VendorService::save($v, $user);
        $added++;
    }
    return $added . ' added';
});

// ------------------------------------------------------------------ bank accounts
// Nothing in the app auto-creates these, and bank/card money needs somewhere to
// land — expenses, vendor payments and receipts all pick from this list.
step('Bank accounts', function (): string {
    if ((int) Database::fetchValue('SELECT COUNT(*) FROM bank_accounts') > 0) {
        return 'already present';
    }
    Database::insert('bank_accounts', [
        'account_name' => 'Mahalakshmi Jewellers — Current A/c',
        'bank_name' => 'HDFC Bank',
        'account_number' => '50200045214521',
        'ifsc_code' => 'HDFC0000241',
        'upi_id' => 'mahalakshmijewellers@hdfcbank',
    ]);
    Database::insert('bank_accounts', [
        'account_name' => 'Savings A/c — Owner',
        'bank_name' => 'Bank of Maharashtra',
        'account_number' => '60123400778899',
        'ifsc_code' => 'MAHB0000123',
    ]);
    return '2 added';
});

// ------------------------------------------------------------------ purchases
// Buying stock is what puts sellable pieces on the shelf AND creates the
// vendor payables that the outstanding report needs.
$purityByCode = [];
foreach (Database::fetchAll('SELECT id, code FROM purities') as $p) {
    $purityByCode[$p['code']] = (int) $p['id'];
}
$categoryByName = [];
foreach (Database::fetchAll('SELECT id, name FROM inventory_categories') as $c) {
    $categoryByName[$c['name']] = (int) $c['id'];
}
$bullionVendors = array_map('intval', array_column(
    Database::fetchAll("SELECT id FROM suppliers WHERE vendor_type = 'bullion' AND is_active = 1 ORDER BY id"),
    'id'
));
$karigarVendors = array_map('intval', array_column(
    Database::fetchAll("SELECT id FROM suppliers WHERE vendor_type = 'karigar' AND is_active = 1 ORDER BY id"),
    'id'
));

$purchaseIds = [];
step('Purchases (restocks the shelf)', function () use (
    $user, $ago, $purityByCode, $categoryByName, $bullionVendors, $karigarVendors, &$purchaseIds
): string {
    if ($bullionVendors === []) {
        throw new RuntimeException('No bullion vendor found — run database/seed.php.');
    }

    // catalogue of pieces to buy in: [name, category, metal, purity, gross, net, making_type, making_value, cost/g]
    $catalogue = [
        ['Gold Bangle Pair — antique finish', 'Bangle', 'gold', '22K', 42.500, 41.200, 'per_gram', 620, 6510],
        ['Gold Kada — plain', 'Bangle', 'gold', '22K', 35.100, 35.100, 'per_gram', 480, 6510],
        ['Gold Chain 20" — rope', 'Chain', 'gold', '22K', 24.360, 24.360, 'per_gram', 420, 6510],
        ['Gold Chain 24" — box', 'Chain', 'gold', '22K', 31.180, 31.180, 'per_gram', 420, 6510],
        ['Bridal Necklace Set — temple', 'Necklace', 'gold', '22K', 88.420, 82.640, 'per_gram', 780, 6510],
        ['Gold Necklace — kundan', 'Necklace', 'gold', '22K', 54.900, 49.300, 'fixed', 42000, 6510],
        ['Jhumka Earrings — temple design', 'Earring', 'gold', '22K', 18.460, 17.240, 'per_gram', 560, 6510],
        ['Stud Earrings — daily wear', 'Earring', 'gold', '18K', 6.220, 6.220, 'per_gram', 640, 5240],
        ['Diamond Solitaire Ring', 'Ring', 'gold', '18K', 5.240, 4.100, 'fixed', 18500, 5240],
        ['Gents Ring — signet', 'Ring', 'gold', '22K', 9.860, 9.860, 'per_gram', 520, 6510],
        ['Ladies Ring — floral', 'Ring', 'gold', '18K', 4.180, 3.960, 'percent', 12, 5240],
        ['Pendant — Ganesh', 'Pendant', 'gold', '22K', 7.640, 7.640, 'per_gram', 540, 6510],
        ['Pendant Set with chain', 'Pendant', 'gold', '18K', 12.320, 11.480, 'fixed', 9500, 5240],
        ['Gold Bracelet — cuban link', 'Bracelet', 'gold', '22K', 22.740, 22.740, 'per_gram', 500, 6510],
        ['Gold Coin 10 g — 999', 'Coin & Bar', 'gold', '24K', 10.000, 10.000, 'fixed', 350, 6960],
        ['Gold Coin 5 g — 999', 'Coin & Bar', 'gold', '24K', 5.000, 5.000, 'fixed', 250, 6960],
        ['Gold Bar 20 g — 999', 'Coin & Bar', 'gold', '24K', 20.000, 20.000, 'fixed', 600, 6960],
        ['Silver Payal Pair — ghungroo', 'Bangle', 'silver', '925', 124.600, 124.600, 'per_gram', 11, 86],
        ['Silver Bracelet — oxidised', 'Bracelet', 'silver', '925', 46.200, 46.200, 'per_gram', 14, 86],
        ['Silver Chain — 18"', 'Chain', 'silver', '925', 28.400, 28.400, 'per_gram', 12, 86],
        ['Silver Pooja Coin 20 g', 'Coin & Bar', 'silver', '999', 20.000, 20.000, 'fixed', 180, 93],
        ['Silver Toe Ring Set', 'Ring', 'silver', '925', 12.800, 12.800, 'per_gram', 15, 86],
        ['Gold Mangalsutra — short', 'Necklace', 'gold', '22K', 16.940, 16.240, 'per_gram', 600, 6510],
        ['Gold Nose Pin', 'Pendant', 'gold', '18K', 1.240, 1.180, 'fixed', 1200, 5240],
        ['Gold Bangle — single, machine cut', 'Bangle', 'gold', '22K', 19.780, 19.780, 'per_gram', 540, 6510],
        ['Gold Bangle Set of 4 — thin', 'Bangle', 'gold', '22K', 28.640, 28.640, 'per_gram', 560, 6510],
        ['Gold Chain 18" — figaro', 'Chain', 'gold', '22K', 18.920, 18.920, 'per_gram', 420, 6510],
        ['Gold Haar — long rani', 'Necklace', 'gold', '22K', 96.280, 91.400, 'per_gram', 820, 6510],
        ['Choker Necklace — polki', 'Necklace', 'gold', '18K', 44.600, 38.200, 'fixed', 65000, 5240],
        ['Chandbali Earrings — 22K', 'Earring', 'gold', '22K', 21.340, 20.180, 'per_gram', 580, 6510],
        ['Hoop Earrings — 18K', 'Earring', 'gold', '18K', 4.860, 4.860, 'per_gram', 620, 5240],
        ['Cocktail Ring — CZ', 'Ring', 'gold', '18K', 6.480, 5.940, 'fixed', 14500, 5240],
        ['Engagement Ring — solitaire 0.5ct', 'Ring', 'gold', '18K', 4.920, 3.680, 'fixed', 26000, 5240],
        ['Baby Bangle Pair — 22K', 'Bangle', 'gold', '22K', 11.260, 11.260, 'per_gram', 520, 6510],
        ['Gold Coin 2 g — 999', 'Coin & Bar', 'gold', '24K', 2.000, 2.000, 'fixed', 180, 6960],
        ['Silver Dinner Set — 6 pc', 'Coin & Bar', 'silver', '925', 860.000, 860.000, 'per_gram', 9, 86],
        ['Silver Kumkum Box', 'Coin & Bar', 'silver', '925', 96.400, 96.400, 'per_gram', 13, 86],
        ['Silver Anklet — kids', 'Bangle', 'silver', '925', 34.200, 34.200, 'per_gram', 15, 86],
    ];

    // three receipts spread over the last fortnight, plus loose bulk metal
    $batches = [
        ['days' => 14, 'vendor' => $bullionVendors[0], 'slice' => [0, 9], 'bulk' => ['metal' => 'gold', 'purity' => '24K', 'weight' => 250.000, 'rate' => 6960],  'ref' => 'VGR/26-27/0412'],
        ['days' => 7,  'vendor' => $bullionVendors[1] ?? $bullionVendors[0], 'slice' => [9, 8], 'bulk' => ['metal' => 'silver', 'purity' => '999', 'weight' => 3200.000, 'rate' => 93], 'ref' => 'SBM/26-27/1188'],
        ['days' => 2,  'vendor' => $bullionVendors[0], 'slice' => [17, 7], 'bulk' => null, 'ref' => 'VGR/26-27/0455'],
        ['days' => 1,  'vendor' => $bullionVendors[1] ?? $bullionVendors[0], 'slice' => [24, 16], 'bulk' => ['metal' => 'gold', 'purity' => '22K', 'weight' => 180.000, 'rate' => 6510], 'ref' => 'SBM/26-27/1204'],
    ];

    $pieces = 0;
    foreach ($batches as $i => $batch) {
        $lines = [];
        foreach (array_slice($catalogue, $batch['slice'][0], $batch['slice'][1]) as $p) {
            [$name, $cat, $metal, $purity, $gross, $net, $mkType, $mkValue, $costPerGram] = $p;
            $lines[] = [
                'kind' => 'tagged',
                'description' => $name,
                'category_id' => $categoryByName[$cat] ?? null,
                'metal' => $metal,
                'purity_id' => $purityByCode[$purity] ?? null,
                'qty' => 1,
                'gross_weight' => $gross,
                'net_weight' => $net,
                'weight' => $net,
                'rate_per_gram' => $costPerGram,
                'making_charge' => 0,
                'making_type' => $mkType,
                'making_value' => $mkValue,
                'hsn_code' => '7113',
                // salted per run — a --force re-run must not collide with the
                // HUIDs the previous round stamped on its pieces
                'huid' => strtoupper(substr(md5(uniqid($name . $i, true)), 0, 6)),
                'tax_rate' => 3,
            ];
            $pieces++;
        }

        if ($batch['bulk'] !== null) {
            $b = $batch['bulk'];
            $lines[] = [
                'kind' => 'bulk',
                'description' => ucfirst($b['metal']) . ' ' . $b['purity'] . ' bullion',
                'metal' => $b['metal'],
                'purity_id' => $purityByCode[$b['purity']] ?? null,
                'qty' => 1,
                'weight' => $b['weight'],
                'rate_per_gram' => $b['rate'],
                'tax_rate' => 3,
            ];
        }

        $purchaseIds[] = PurchaseService::create([
            'supplier_id' => $batch['vendor'],
            'purchase_date' => $ago($batch['days']),
            'bill_ref' => $batch['ref'],
            'items' => $lines,
            'notes' => 'Stock replenishment',
        ], $user->id);
    }

    // a karigar job-work bill — service only, no stock
    if ($karigarVendors !== []) {
        $purchaseIds[] = PurchaseService::create([
            'supplier_id' => $karigarVendors[0],
            'purchase_date' => $ago(5),
            'bill_ref' => 'JOB/2026/318',
            'items' => [
                ['kind' => 'service', 'description' => 'Making charges — bridal set', 'amount' => 48500, 'tax_rate' => 5],
                ['kind' => 'service', 'description' => 'Polishing & finishing — 14 pieces', 'amount' => 9800, 'tax_rate' => 5],
            ],
            'notes' => 'Karigar job work for the month',
        ], $user->id);
    }

    return count($purchaseIds) . ' purchases, ' . $pieces . ' new pieces';
});

// ------------------------------------------------------------------ vendor payments
step('Vendor payments (part-settled)', function () use ($user, $ago, $purchaseIds): string {
    $bank = (int) (Database::fetchValue('SELECT id FROM bank_accounts ORDER BY id LIMIT 1') ?? 0);
    $paid = 0;
    foreach ($purchaseIds as $i => $pid) {
        $purchase = Database::fetchOne(
            'SELECT supplier_id, grand_total, paid_amount FROM purchases WHERE id = :id',
            ['id' => $pid]
        );
        if ($purchase === null) {
            continue;
        }
        $due = (float) $purchase['grand_total'] - (float) $purchase['paid_amount'];
        if ($due <= 1) {
            continue;
        }
        // leave the newest bill fully outstanding so the payables report has teeth
        $share = [1.0, 0.6, 0.0, 1.0][$i] ?? 0.5;
        if ($share <= 0) {
            continue;
        }
        PaymentService::payVendor(
            supplierId: (int) $purchase['supplier_id'],
            purchaseId: $pid,
            amount: round($due * $share, 2),
            mode: $share >= 1.0 ? 'bank' : 'upi',
            bankAccountId: $share >= 1.0 && $bank > 0 ? $bank : null,
            refNo: 'NEFT' . (830041 + $i),
            date: $ago(1),
            userId: $user->id,
            notes: $share >= 1.0 ? 'Bill settled in full' : 'Part payment'
        );
        $paid++;
    }
    return $paid . ' payments';
});

// ------------------------------------------------------------------ sales
/** Grab tagged pieces that are actually on the shelf right now. */
$takeStock = static function (int $n) use (&$soldGuard): array {
    return Database::fetchAll(
        "SELECT i.id, i.name, i.net_weight, i.gross_weight, i.metal, i.purity_id
           FROM inventory_items i
          WHERE i.tracking = 'tagged' AND i.status = 'in_stock' AND i.is_active = 1
            AND i.net_weight > 0 AND i.purity_id IS NOT NULL
          ORDER BY i.id LIMIT $n"
    );
};

step('Finalised bills + receipts', function () use ($noSales, $user, $ago, $today, $customerIds, $takeStock, $purityByCode): string {
    if ($noSales) {
        return 'skipped (--no-sales)';
    }
    $bank = (int) (Database::fetchValue('SELECT id FROM bank_accounts ORDER BY id LIMIT 1') ?? 0);

    // [days ago, customer index or null for walk-in, pieces, settlement, old metal?]
    $plan = [
        ['days' => 12, 'ci' => 0,    'pieces' => 2, 'settle' => 'full',    'mode' => 'upi',   'old' => false],
        ['days' => 10, 'ci' => null, 'pieces' => 1, 'settle' => 'full',    'mode' => 'cash',  'old' => false],
        ['days' => 8,  'ci' => 1,    'pieces' => 2, 'settle' => 'partial', 'mode' => 'cash',  'old' => true],
        ['days' => 6,  'ci' => 2,    'pieces' => 1, 'settle' => 'full',    'mode' => 'card',  'old' => false],
        ['days' => 4,  'ci' => 3,    'pieces' => 1, 'settle' => 'credit',  'mode' => 'cash',  'old' => false],
        ['days' => 3,  'ci' => 4,    'pieces' => 2, 'settle' => 'partial', 'mode' => 'bank',  'old' => false],
        ['days' => 1,  'ci' => 5,    'pieces' => 1, 'settle' => 'full',    'mode' => 'upi',   'old' => true],
        ['days' => 0,  'ci' => 6,    'pieces' => 2, 'settle' => 'full',    'mode' => 'cash',  'old' => false],
        ['days' => 0,  'ci' => null, 'pieces' => 1, 'settle' => 'full',    'mode' => 'upi',   'old' => false],
        ['days' => 0,  'ci' => 7,    'pieces' => 1, 'settle' => 'credit',  'mode' => 'cash',  'old' => false],
    ];

    $walkins = [['Ramesh Joshi', '9867001122'], ['Kavita Rane', '9867003344']];
    $made = 0;

    foreach ($plan as $i => $p) {
        $stock = $takeStock($p['pieces']);
        if (count($stock) < $p['pieces']) {
            break;   // shelf is empty — stop rather than write a bogus bill
        }

        $walkIn = $p['ci'] === null;
        $customerId = $walkIn ? null : ($customerIds[$p['ci']] ?? $customerIds[0]);
        $billDate = $ago($p['days']);

        $draft = [
            'customer_id' => $customerId,
            'invoice_date' => $billDate,
            'price_mode' => $i % 4 === 3 ? 'inclusive' : 'exclusive',
            'discount' => $i % 3 === 0 ? 1500 : 0,
            'items' => array_map(static fn (array $s): array => ['item_id' => (int) $s['id'], 'qty' => 1], $stock),
            'notes' => $walkIn ? 'Counter sale' : null,
        ];
        if ($walkIn) {
            [$draft['walkin_name'], $draft['walkin_phone']] = $walkins[$i % count($walkins)];
        }
        $invoiceId = InvoiceDraft::save(null, $draft, $user->id);
        $grand = (float) Database::fetchValue('SELECT grand_total FROM invoices WHERE id = :id', ['id' => $invoiceId]);

        // Old metal is a credit against the bill, so it has to be sized against
        // the bill's own value — a big exchange on a small silver piece would
        // drive the total negative and the voucher would (rightly) be refused.
        if ($p['old'] && isset($purityByCode['22K']) && $grand > 50000) {
            $rate = RateService::rateFor($purityByCode['22K'], $billDate)['rate'] ?? 0.0;
            $deduction = 8.0;
            if ($rate > 0) {
                $targetValue = $grand * 0.15;
                $draft['old_metal'] = [[
                    'metal' => 'gold',
                    'purity_id' => $purityByCode['22K'],
                    'description' => 'Old gold bangle taken in exchange',
                    'gross_weight' => round($targetValue / ($rate * (1 - $deduction / 100)), 3),
                    'deduction_pct' => $deduction,
                ]];
                InvoiceDraft::save($invoiceId, $draft, $user->id);
                $grand = (float) Database::fetchValue('SELECT grand_total FROM invoices WHERE id = :id', ['id' => $invoiceId]);
            }
        }

        $payments = [];
        // a walk-in must leave nothing outstanding — BillingService enforces it
        $share = $walkIn ? 1.0 : match ($p['settle']) {
            'full' => 1.0,
            'partial' => 0.45,
            default => 0.0,
        };
        if ($share > 0) {
            $payments[] = [
                'amount' => round($grand * $share, 2),
                'mode' => $p['mode'],
                'bank_account_id' => in_array($p['mode'], ['bank', 'card'], true) && $bank > 0 ? $bank : null,
                'ref_no' => $p['mode'] === 'upi' ? 'UPI' . (7710004 + $i) : null,
            ];
        }

        BillingService::finalize($invoiceId, ['payments' => $payments], $user->id);

        // one part-paid bill gets a follow-up receipt a couple of days later
        if ($p['settle'] === 'partial' && $i === 2 && $customerId !== null) {
            PaymentService::receive(
                invoiceId: $invoiceId,
                customerId: $customerId,
                amount: round($grand * 0.30, 2),
                mode: 'upi',
                bankAccountId: null,
                refNo: 'UPI7710990',
                date: $ago(max(0, $p['days'] - 3)),
                userId: $user->id,
                notes: 'Balance instalment'
            );
        }
        $made++;
    }

    return $made . ' bills';
});

// a cancelled bill so the cancel/reversal path is visible in the UI
step('Cancelled bill (reversal path)', function () use ($noSales, $user, $takeStock): string {
    if ($noSales) {
        return 'skipped (--no-sales)';
    }
    $stock = $takeStock(1);
    if ($stock === []) {
        return 'skipped — no stock';
    }
    $invoiceId = InvoiceDraft::save(null, [
        'customer_id' => null,
        'walkin_name' => 'Nikhil Bhatt',
        'walkin_phone' => '9867009900',
        'invoice_date' => date('Y-m-d'),
        'items' => [['item_id' => (int) $stock[0]['id'], 'qty' => 1]],
    ], $user->id);
    $grand = (float) Database::fetchValue('SELECT grand_total FROM invoices WHERE id = :id', ['id' => $invoiceId]);
    BillingService::finalize($invoiceId, [
        'payments' => [['amount' => $grand, 'mode' => 'cash']],
    ], $user->id);
    BillingService::cancel($invoiceId, 'Customer changed their mind — piece returned to stock.', $user->id);
    return '1 cancelled';
});

// ------------------------------------------------------------------ held drafts
step('Held bills (drafts at the counter)', function () use ($noSales, $user, $customerIds, $takeStock): string {
    if ($noSales) {
        return 'skipped (--no-sales)';
    }
    $stock = $takeStock(6);
    if ($stock === []) {
        return 'skipped — no stock';
    }
    $chunks = array_chunk($stock, 2);
    $n = 0;
    foreach ($chunks as $i => $chunk) {
        InvoiceDraft::save(null, [
            'customer_id' => $customerIds[$i] ?? null,
            'walkin_name' => isset($customerIds[$i]) ? null : 'Counter ' . ($i + 1),
            'invoice_date' => date('Y-m-d'),
            'items' => array_map(static fn (array $s): array => ['item_id' => (int) $s['id'], 'qty' => 1], $chunk),
            'notes' => 'Held at the counter — customer is still deciding.',
        ], $user->id);
        $n++;
    }
    return $n . ' drafts';
});

// ------------------------------------------------------------------ estimates
step('Estimates / quotations', function () use ($user, $ago, $today, $customerIds, $purityByCode): string {
    $rate22 = RateService::rateFor($purityByCode['22K'] ?? 0, $today)['rate'] ?? 6957.0;
    $rate18 = RateService::rateFor($purityByCode['18K'] ?? 0, $today)['rate'] ?? 5579.0;

    $quotes = [
        ['days' => 1, 'ci' => 0, 'walkin' => null, 'action' => 'open', 'items' => [
            ['description' => 'Bridal necklace set — custom, 22K', 'purity_code' => '22K', 'net_weight' => 78.500, 'rate_per_gram' => $rate22, 'making_type' => 'per_gram', 'making_value' => 780],
            ['description' => 'Matching jhumka pair — 22K', 'purity_code' => '22K', 'net_weight' => 18.200, 'rate_per_gram' => $rate22, 'making_type' => 'per_gram', 'making_value' => 620],
        ]],
        ['days' => 2, 'ci' => 2, 'walkin' => null, 'action' => 'open', 'items' => [
            ['description' => 'Diamond pendant — 18K, 0.75 ct', 'purity_code' => '18K', 'net_weight' => 6.400, 'rate_per_gram' => $rate18, 'making_type' => 'fixed', 'making_value' => 42000],
        ]],
        ['days' => 3, 'ci' => null, 'walkin' => ['Sanjay Kulkarni', '9867221100'], 'action' => 'open', 'items' => [
            ['description' => 'Gents kada — 22K plain', 'purity_code' => '22K', 'net_weight' => 38.000, 'rate_per_gram' => $rate22, 'making_type' => 'per_gram', 'making_value' => 480],
        ]],
        ['days' => 12, 'ci' => 3, 'walkin' => null, 'action' => 'open', 'items' => [   // past its validity → shows as expired
            ['description' => 'Mangalsutra — long chain, 22K', 'purity_code' => '22K', 'net_weight' => 26.300, 'rate_per_gram' => $rate22, 'making_type' => 'per_gram', 'making_value' => 600],
        ]],
        ['days' => 4, 'ci' => 1, 'walkin' => null, 'action' => 'cancel', 'items' => [
            ['description' => 'Gold bar 50 g — 999', 'purity_code' => '24K', 'net_weight' => 50.000, 'rate_per_gram' => 7340, 'making_type' => 'fixed', 'making_value' => 1200],
        ]],
        ['days' => 2, 'ci' => 4, 'walkin' => null, 'action' => 'convert', 'items' => [
            ['description' => 'Gold chain 22" — 22K rope', 'purity_code' => '22K', 'net_weight' => 22.400, 'rate_per_gram' => $rate22, 'making_type' => 'per_gram', 'making_value' => 420],
        ]],
    ];

    $made = 0;
    $converted = 0;
    foreach ($quotes as $q) {
        $body = [
            'customer_id' => $q['ci'] !== null ? ($customerIds[$q['ci']] ?? null) : null,
            'estimate_date' => $ago($q['days']),
            'price_mode' => 'exclusive',
            'discount' => 0,
            'items' => $q['items'],
            'notes' => 'Quotation — rate valid till the date shown.',
        ];
        if ($q['walkin'] !== null) {
            [$body['walkin_name'], $body['walkin_phone']] = $q['walkin'];
        }
        $id = EstimateService::save(null, $body, $user->id);
        $made++;

        if ($q['action'] === 'cancel') {
            EstimateService::cancel($id, $user->id);
        } elseif ($q['action'] === 'convert') {
            // becomes a draft bill, then a real one — a quote the customer accepted
            $invoiceId = EstimateService::convert($id, true, $user->id);
            $grand = (float) Database::fetchValue('SELECT grand_total FROM invoices WHERE id = :id', ['id' => $invoiceId]);
            BillingService::finalize($invoiceId, [
                'payments' => [['amount' => $grand, 'mode' => 'upi', 'ref_no' => 'UPI7712345']],
            ], $user->id);
            $converted++;
        }
    }

    return $made . ' estimates (' . $converted . ' converted to a bill)';
});

// ------------------------------------------------------------------ on-account receipt
step('On-account receipt (advance)', function () use ($user, $customerIds): string {
    if ($customerIds === []) {
        return 'skipped';
    }
    PaymentService::receive(
        invoiceId: null,
        customerId: $customerIds[0],
        amount: 50000,
        mode: 'bank',
        bankAccountId: (int) (Database::fetchValue('SELECT id FROM bank_accounts ORDER BY id LIMIT 1') ?: 0) ?: null,
        refNo: 'ADV/2026/018',
        date: date('Y-m-d'),
        userId: $user->id,
        notes: 'Advance towards the bridal order'
    );
    return '1 advance';
});

// ------------------------------------------------------------------ expenses
step('Expenses', function () use ($user, $ago): string {
    $cat = static fn (string $n): int => (int) (Database::fetchValue(
        'SELECT id FROM expense_categories WHERE name = :n AND is_system = 0 LIMIT 1',
        ['n' => $n]
    ) ?? 0);

    $rows = [
        ['Rent', 85000, 'Showroom rent — Zaveri Bazaar', 'Kalbadevi Estates', 'bank', 0, 'fixed'],
        ['Rent', 85000, 'Showroom rent — previous month', 'Kalbadevi Estates', 'bank', 31, 'fixed'],
        ['Utilities', 14200, 'Electricity bill', 'BEST', 'upi', 4, 'variable'],
        ['Utilities', 3100, 'Internet & telephone', 'Airtel', 'upi', 9, 'variable'],
        ['Utilities', 6800, 'Water & maintenance', 'Society', 'cash', 18, 'variable'],
        ['Karigar Charges', 24500, 'Setting charges — 9 pieces', 'Shree Jewel Craft', 'cash', 6, 'variable'],
        ['Karigar Charges', 11800, 'Rhodium & polish work', 'Sai Karigar Works', 'upi', 13, 'variable'],
        ['Marketing', 32000, 'Festival campaign — Instagram & Meta ads', 'Digital agency', 'card', 8, 'variable'],
        ['Marketing', 9500, 'Newspaper insert — local edition', 'Sakal Media', 'bank', 21, 'variable'],
        ['Office Supplies', 4300, 'Boxes, pouches & billing stationery', 'Amrut Pack & Print', 'cash', 3, 'variable'],
        ['Office Supplies', 2650, 'Hallmarking pouches', 'Amrut Pack & Print', 'cash', 16, 'variable'],
        ['Utilities', 1900, 'Diesel — generator', 'HP Petrol Pump', 'cash', 1, 'variable'],
    ];

    $bank = (int) (Database::fetchValue('SELECT id FROM bank_accounts ORDER BY id LIMIT 1') ?? 0);
    $n = 0;
    foreach ($rows as [$catName, $amount, $desc, $paidTo, $mode, $days, $type]) {
        $categoryId = $cat($catName);
        if ($categoryId === 0) {
            continue;
        }
        ExpenseService::create([
            'category_id' => $categoryId,
            'amount' => $amount,
            'description' => $desc,
            'paid_to' => $paidTo,
            'payment_mode' => $mode,
            // anything other than cash must name the account it was paid from
            'bank_account_id' => $mode !== 'cash' && $bank > 0 ? $bank : null,
            'expense_date' => $ago($days),
            'type' => $type,
        ], $user);
        $n++;
    }
    return $n . ' expenses';
});

// ------------------------------------------------------------------ stock adjustment
step('Stock adjustment (shortage)', function () use ($user): string {
    $item = Database::fetchOne(
        "SELECT id, item_type, metal FROM inventory_items
          WHERE tracking = 'bulk' AND current_stock > 5 AND metal = 'silver' ORDER BY id DESC LIMIT 1"
    );
    if ($item === null) {
        return 'skipped — no bulk stock';
    }
    $itemId = (int) $item['id'];

    Database::transaction(static function () use ($itemId, $item, $user): void {
        $weight = 3.500;
        $costPerGram = StockService::avgCostPerGram($itemId);
        $value = round($costPerGram * $weight, 2);

        $voucherId = null;
        if ($value > 0.005) {
            $voucherId = \CRM\Accounting\VoucherService::post(
                vtype: 'adjustment',
                vdate: date('Y-m-d'),
                entries: [
                    ['ledger_id' => \CRM\Accounting\Ledgers::system('stock_adjust'), 'dr' => $value],
                    ['ledger_id' => \CRM\Accounting\Ledgers::inventoryForItem($item['item_type'] ?? null, $item['metal'] ?? null), 'cr' => $value],
                ],
                narration: 'Stock adjustment — physical count shortage',
                refType: 'stock_adjustment',
                refId: $itemId,
                userId: $user->id
            );
        }

        StockService::record(
            itemId: $itemId,
            direction: 'out',
            reason: 'adjustment',
            qty: 1,
            weight: $weight,
            value: $value,
            voucherId: $voucherId,
            notes: 'Adjustment ' . NumberSequence::next('adjustment'),
            adjustmentReason: 'Physical count shortage — dust loss at the polishing bench.',
            userId: $user->id
        );

        Audit::log($user->id, 'stock.adjust', 'inventory_items', $itemId, null, [
            'direction' => 'out',
            'weight' => $weight,
            'reason' => 'Physical count shortage',
        ]);
    });

    return '1 adjustment';
});

// ------------------------------------------------------------------ done
Database::execute(
    "INSERT INTO settings (skey, svalue) VALUES ('demo_seeded_at', :v)
     ON DUPLICATE KEY UPDATE svalue = :v2",
    ['v' => date('Y-m-d H:i:s'), 'v2' => date('Y-m-d H:i:s')]
);

echo "\nSummary\n";
foreach ([
    'customers' => 'Customers',
    'inventory_items' => 'Items',
    'purchases' => 'Purchases',
    'invoices' => 'Bills',
    'estimates' => 'Estimates',
    'invoice_payments' => 'Receipts',
    'vendor_payments' => 'Vendor payments',
    'expenses' => 'Expenses',
    'vouchers' => 'Vouchers',
] as $table => $label) {
    echo '  ' . str_pad($label, 18) . Database::fetchValue("SELECT COUNT(*) FROM `$table`") . "\n";
}
echo '  ' . str_pad('Pieces in stock', 18)
    . Database::fetchValue("SELECT COUNT(*) FROM inventory_items WHERE tracking = 'tagged' AND status = 'in_stock'") . "\n";

echo "\nDemo data seeded. Log in as admin / admin123.\n";
echo "Now run: php cli/verify-ledger.php\n";
