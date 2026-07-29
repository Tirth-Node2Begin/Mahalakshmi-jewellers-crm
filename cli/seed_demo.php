<?php

declare(strict_types=1);

/**
 * Mahalakshmi Jewellers CRM — demo data seeder.
 * Populates every module through the real Service::create() paths so business
 * rules apply and the whole app comes alive (dashboard, lists, reports).
 *
 * Idempotent: exits if demo data already exists. Run: php cli/seed_demo.php
 */

if (PHP_SAPI !== 'cli') {
    exit("seed_demo.php is CLI-only\n");
}

require_once dirname(__DIR__) . '/src/bootstrap.php';

use CRM\Auth\AuthUser;
use CRM\Automation\AutomationService;
use CRM\Customers\CustomerService;
use CRM\Database\Database;
use CRM\Expenses\ExpenseService;
use CRM\HR\AttendanceService;
use CRM\HR\EmployeeService;
use CRM\HR\LeaveService;
use CRM\Inventory\InventoryService;
use CRM\Invoices\InvoiceService;
use CRM\Leads\LeadService;
use CRM\Orders\OrderService;
use CRM\Repairs\RepairService;
use CRM\Vendors\VendorService;

if ((int) Database::fetchValue('SELECT COUNT(*) FROM customers') > 0) {
    exit("Demo data already present (customers exist) — nothing to do.\n");
}

$adminId = (int) Database::fetchValue("SELECT id FROM users WHERE username = 'admin'");
if ($adminId === 0) {
    exit("Run database/seed.php first (no admin user found).\n");
}
$user = new AuthUser($adminId, 'admin', 'Super Admin', 'admin@mahalakshmijewellers.local', 0, ['super_admin'], false, null);

$today = date('Y-m-d');
$soon = static fn (int $days) => date('Y-m-d', strtotime("+$days days"));
$ago = static fn (int $days) => date('Y-m-d', strtotime("-$days days"));
$mdSoon = static fn (int $days) => '1990-' . date('m-d', strtotime("+$days days")); // birthday within N days

function step(string $label, callable $fn): void
{
    try {
        $n = $fn();
        echo "  OK  $label" . ($n !== null ? " ($n)" : '') . "\n";
    } catch (\Throwable $e) {
        echo "WARN  $label -> " . $e->getMessage() . "\n";
    }
}

echo "Seeding demo data…\n";

// ---------------------------------------------------------------- HR masters
step('HR departments/designations', function (): string {
    $depts = ['Sales', 'Production', 'Administration'];
    foreach ($depts as $d) {
        Database::execute('INSERT INTO departments (name) VALUES (:n) ON DUPLICATE KEY UPDATE name = name', ['n' => $d]);
    }
    $desigs = ['Sales Executive', 'Karigar', 'Store Manager', 'Cashier'];
    foreach ($desigs as $d) {
        Database::execute('INSERT INTO designations (name) VALUES (:n) ON DUPLICATE KEY UPDATE name = name', ['n' => $d]);
    }
    return count($depts) . ' depts, ' . count($desigs) . ' designations';
});

$deptSales = (int) Database::fetchValue("SELECT id FROM departments WHERE name = 'Sales'");
$deptProd = (int) Database::fetchValue("SELECT id FROM departments WHERE name = 'Production'");
$shiftId = (int) Database::fetchValue('SELECT id FROM shifts ORDER BY id LIMIT 1');
$gramUnit = (int) Database::fetchValue("SELECT id FROM units WHERE short_name = 'g' OR is_active = 1 ORDER BY (short_name='g') DESC LIMIT 1");

// ---------------------------------------------------------------- Vendors
$vendorIds = [];
step('Vendors & karigars', function () use ($user, &$vendorIds): string {
    $vendors = [
        ['name' => 'Shah Bullion House', 'vendor_type' => 'bullion', 'company' => 'Shah Bullion', 'mobile' => '9820011111', 'city' => 'Mumbai', 'gstin' => '27AABCS1234A1Z5'],
        ['name' => 'Kirti Diamonds', 'vendor_type' => 'diamond', 'company' => 'Kirti Gems', 'mobile' => '9820022222', 'city' => 'Surat'],
        ['name' => 'Ramesh Karigar', 'vendor_type' => 'karigar', 'mobile' => '9820033333', 'specialisation' => 'Kundan & meenakari', 'karigar_rate' => 1200, 'city' => 'Jaipur'],
        ['name' => 'Suresh Polish Works', 'vendor_type' => 'karigar', 'mobile' => '9820044444', 'specialisation' => 'Polishing & finishing', 'karigar_rate' => 800],
    ];
    foreach ($vendors as $v) {
        $vendorIds[] = VendorService::save($v + ['vendor_status' => 'active'], $user);
    }
    return count($vendorIds) . ' vendors';
});

// ---------------------------------------------------------------- Customers
$customerIds = [];
step('Customers (360 profiles)', function () use ($user, $mdSoon, &$customerIds): string {
    $customers = [
        ['name' => 'Meera Shah', 'mobile' => '9990010001', 'email' => 'meera@example.com', 'city' => 'Mumbai', 'state' => 'Maharashtra', 'gender' => 'female', 'dob' => $mdSoon(2), 'anniversary' => $mdSoon(5), 'occupation' => 'Doctor', 'vip' => 1, 'stage' => 'active', 'family' => [['relation' => 'spouse', 'name' => 'Raj Shah', 'dob' => $mdSoon(4)]]],
        ['name' => 'Anita Verma', 'mobile' => '9990010002', 'email' => 'anita@example.com', 'city' => 'Pune', 'gender' => 'female', 'dob' => '1985-03-14', 'occupation' => 'Architect', 'stage' => 'active'],
        ['name' => 'Rohit Mehta', 'mobile' => '9990010003', 'city' => 'Mumbai', 'gender' => 'male', 'dob' => $mdSoon(6), 'occupation' => 'Businessman', 'vip' => 1, 'stage' => 'active'],
        ['name' => 'Priya Nair', 'mobile' => '9990010004', 'email' => 'priya@example.com', 'city' => 'Thane', 'gender' => 'female', 'anniversary' => '1992-11-20', 'stage' => 'active'],
        ['name' => 'Karan Patel', 'mobile' => '9990010005', 'city' => 'Ahmedabad', 'gender' => 'male', 'occupation' => 'CA', 'stage' => 'active'],
        ['name' => 'Sunita Desai', 'mobile' => '9990010006', 'city' => 'Mumbai', 'gender' => 'female', 'dob' => '1978-06-01', 'stage' => 'onboarding'],
        ['name' => 'Vikram Singh', 'mobile' => '9990010007', 'city' => 'Delhi', 'gender' => 'male', 'stage' => 'active'],
        ['name' => 'Deepa Iyer', 'mobile' => '9990010008', 'email' => 'deepa@example.com', 'city' => 'Bengaluru', 'gender' => 'female', 'anniversary' => $mdSoon(3), 'vip' => 1, 'stage' => 'active'],
    ];
    foreach ($customers as $c) {
        $customerIds[] = CustomerService::create($c, $user);
    }
    return count($customerIds) . ' customers';
});

// ---------------------------------------------------------------- Inventory
$itemIds = [];
step('Inventory (jewellery SKUs)', function () use ($user, $gramUnit, $vendorIds, &$itemIds): string {
    $jc = static fn (string $name) => (int) Database::fetchValue("SELECT id FROM inventory_categories WHERE name = :n AND item_type = 'stock' LIMIT 1", ['n' => $name]);
    $items = [
        ['name' => '22K Gold Bangle Pair', 'category' => 'Gold', 'metal_type' => 'Gold', 'purity' => '22K', 'gross_wt' => 42.5, 'net_wt' => 41.0, 'making_charge' => 12000, 'wastage_pct' => 8, 'selling_price' => 385000, 'purchase_price' => 350000, 'opening_qty' => 2, 'reorder_level' => 1, 'hsn_code' => '7113'],
        ['name' => 'Diamond Solitaire Ring', 'category' => 'Diamond', 'metal_type' => 'Gold', 'purity' => '18K', 'gross_wt' => 5.2, 'net_wt' => 4.1, 'stone_wt' => 1.1, 'making_charge' => 18000, 'selling_price' => 145000, 'purchase_price' => 120000, 'opening_qty' => 1, 'reorder_level' => 2, 'hsn_code' => '7113'],
        ['name' => 'Bridal Necklace Set', 'category' => 'Bridal Collection', 'metal_type' => 'Gold', 'purity' => '22K', 'gross_wt' => 88.0, 'net_wt' => 82.5, 'making_charge' => 35000, 'wastage_pct' => 10, 'selling_price' => 720000, 'purchase_price' => 640000, 'opening_qty' => 1, 'reorder_level' => 1, 'hsn_code' => '7113'],
        ['name' => 'Silver Payal Pair', 'category' => 'Silver', 'metal_type' => 'Silver', 'purity' => '92.5', 'gross_wt' => 120.0, 'net_wt' => 120.0, 'making_charge' => 1500, 'selling_price' => 12500, 'purchase_price' => 9500, 'opening_qty' => 6, 'reorder_level' => 2],
        ['name' => 'Temple Jhumka Earrings', 'category' => 'Temple Jewellery', 'metal_type' => 'Gold', 'purity' => '22K', 'gross_wt' => 18.4, 'net_wt' => 17.2, 'making_charge' => 9000, 'selling_price' => 165000, 'purchase_price' => 148000, 'opening_qty' => 1, 'reorder_level' => 3],
        ['name' => 'Gold Chain 20 inch', 'category' => 'Gold', 'metal_type' => 'Gold', 'purity' => '22K', 'gross_wt' => 24.0, 'net_wt' => 24.0, 'making_charge' => 6000, 'selling_price' => 205000, 'purchase_price' => 190000, 'opening_qty' => 4, 'reorder_level' => 2],
        ['name' => "Men's Kada", 'category' => "Men's Collection", 'metal_type' => 'Gold', 'purity' => '22K', 'gross_wt' => 35.0, 'net_wt' => 34.0, 'making_charge' => 8000, 'selling_price' => 300000, 'purchase_price' => 280000, 'opening_qty' => 2, 'reorder_level' => 1],
        ['name' => 'Kids Gold Nazariya', 'category' => 'Kids Collection', 'metal_type' => 'Gold', 'purity' => '18K', 'gross_wt' => 3.1, 'net_wt' => 3.0, 'making_charge' => 1500, 'selling_price' => 24000, 'purchase_price' => 21000, 'opening_qty' => 1, 'reorder_level' => 4],
        ['name' => 'Platinum Couple Band', 'category' => 'Platinum', 'metal_type' => 'Platinum', 'gross_wt' => 9.0, 'net_wt' => 9.0, 'making_charge' => 12000, 'selling_price' => 95000, 'purchase_price' => 82000, 'opening_qty' => 2, 'reorder_level' => 1],
        ['name' => 'Gold Coin 10g', 'category' => 'Coins & Bars', 'metal_type' => 'Gold', 'purity' => '24K', 'gross_wt' => 10.0, 'net_wt' => 10.0, 'selling_price' => 78000, 'purchase_price' => 75000, 'opening_qty' => 5, 'reorder_level' => 3],
    ];
    foreach ($items as $i => $it) {
        $categoryId = $jc($it['category']);
        unset($it['category']);
        $body = $it + [
            'item_type' => 'stock',
            'unit_id' => $gramUnit,
            'category_id' => $categoryId,
            'vendor_id' => $vendorIds[$i % max(1, count($vendorIds))] ?? null,
            'opening_cost' => $it['purchase_price'] ?? 0,
        ];
        $itemIds[] = InventoryService::createItem($body, $user);
    }
    return count($itemIds) . ' SKUs';
});

// ---------------------------------------------------------------- Leads
step('Leads / enquiries', function () use ($user): string {
    $srcId = static fn (string $n) => (int) Database::fetchValue('SELECT id FROM lead_sources WHERE name = :n LIMIT 1', ['n' => $n]);
    $leads = [
        ['name' => 'Neha Kulkarni', 'mobile' => '9871000001', 'interest_type' => 'Bridal', 'budget_range' => '₹2L–5L', 'channel_type' => 'walk_in', 'source_id' => $srcId('Walk-in'), 'expected_value' => 300000, 'status' => 'New'],
        ['name' => 'Amit Joshi', 'mobile' => '9871000002', 'interest_type' => 'Diamond', 'budget_range' => '₹1L–2L', 'channel_type' => 'google', 'source_id' => $srcId('Google'), 'expected_value' => 150000, 'status' => 'Contacted'],
        ['name' => 'Sneha Rao', 'mobile' => '9871000003', 'interest_type' => 'Gold', 'budget_range' => '₹50k–1L', 'channel_type' => 'instagram', 'source_id' => $srcId('Instagram'), 'expected_value' => 80000, 'status' => 'Qualified'],
        ['name' => 'Rahul Kapoor', 'mobile' => '9871000004', 'interest_type' => 'Custom', 'channel_type' => 'referral', 'source_id' => $srcId('Referral'), 'expected_value' => 220000, 'status' => 'Meeting Scheduled'],
        ['name' => 'Pooja Shetty', 'mobile' => '9871000005', 'interest_type' => 'Silver', 'channel_type' => 'walk_in', 'source_id' => $srcId('Walk-in'), 'expected_value' => 20000, 'status' => 'New'],
        ['name' => 'Manish Gupta', 'mobile' => '9871000006', 'interest_type' => 'Gold', 'channel_type' => 'phone', 'expected_value' => 120000, 'status' => 'Negotiation'],
    ];
    $n = 0;
    foreach ($leads as $l) {
        LeadService::create($l, $user);
        $n++;
    }
    return "$n enquiries";
});

// ---------------------------------------------------------------- Orders
step('Custom orders', function () use ($user, $customerIds, $vendorIds): string {
    $orders = [
        ['title' => 'Bridal necklace set (custom)', 'category' => 'Bridal', 'production_type' => 'in_house', 'karigar' => 'In-house team', 'metal_details' => '22K gold, 85g', 'estimated_cost' => 450000, 'advance_paid' => 100000, 'quoted_price' => 620000, 'to' => 'in_production'],
        ['title' => 'Diamond pendant', 'category' => 'Diamond', 'production_type' => 'outsource', 'vendor_id' => $vendorIds[1] ?? null, 'metal_details' => '18K, 0.8ct', 'estimated_cost' => 90000, 'advance_paid' => 30000, 'quoted_price' => 140000, 'to' => 'quality_check'],
        ['title' => 'Custom kada engraving', 'category' => 'Gold', 'production_type' => 'outsource', 'vendor_id' => $vendorIds[2] ?? null, 'metal_details' => '22K, 40g', 'estimated_cost' => 260000, 'advance_paid' => 80000, 'quoted_price' => 320000, 'to' => 'customer_review'],
        ['title' => 'Temple jhumka pair', 'category' => 'Temple', 'production_type' => 'in_house', 'estimated_cost' => 140000, 'quoted_price' => 185000, 'to' => 'delivered'],
        ['title' => 'Engagement ring', 'category' => 'Diamond', 'production_type' => 'in_house', 'estimated_cost' => 70000, 'advance_paid' => 20000, 'quoted_price' => 110000, 'to' => 'pending'],
    ];
    $n = 0;
    foreach ($orders as $i => $o) {
        $to = $o['to'];
        unset($o['to']);
        $body = $o + [
            'customer_id' => $customerIds[$i % count($customerIds)],
            'order_date' => date('Y-m-d', strtotime('-' . (3 + $i) . ' days')),
            'expected_date' => date('Y-m-d', strtotime('+' . (7 + $i) . ' days')),
            'items' => [['description' => $o['title'], 'gold_wt' => 20 + $i, 'purity' => '22K', 'making_charge' => 8000, 'qty' => 1, 'line_total' => $o['quoted_price']]],
        ];
        $oid = OrderService::create($body, $user);
        // advance the pipeline to the target status
        $flow = ['pending', 'in_production', 'quality_check', 'customer_review', 'approved', 'delivered'];
        foreach ($flow as $st) {
            if ($st === 'pending') {
                continue;
            }
            OrderService::changeStatus($oid, ['status' => $st], $user);
            if ($st === $to) {
                break;
            }
        }
        $n++;
    }
    return "$n orders";
});

// ---------------------------------------------------------------- Repairs
step('Repairs', function () use ($user, $customerIds, $vendorIds): string {
    $repairs = [
        ['item_description' => 'Gold chain — broken clasp', 'category' => 'Gold', 'issue' => 'Clasp broken, needs resolder', 'estimated_cost' => 800, 'to' => 'in_progress'],
        ['item_description' => 'Diamond ring — loose stone', 'category' => 'Diamond', 'issue' => 'Stone loose in setting', 'estimated_cost' => 1500, 'to' => 'ready'],
        ['item_description' => 'Bangle — resize', 'category' => 'Gold', 'issue' => 'Resize to smaller', 'estimated_cost' => 1200, 'vendor_id' => $vendorIds[3] ?? null, 'to' => 'received'],
        ['item_description' => 'Necklace — polish', 'category' => 'Gold', 'issue' => 'Full polish & rhodium', 'estimated_cost' => 600, 'to' => 'delivered'],
        ['item_description' => 'Earrings — hook repair', 'category' => 'Silver', 'issue' => 'Broken hook', 'estimated_cost' => 300, 'to' => 'quality_check'],
    ];
    $n = 0;
    foreach ($repairs as $i => $r) {
        $to = $r['to'];
        unset($r['to']);
        $body = $r + [
            'customer_id' => $customerIds[$i % count($customerIds)],
            'received_date' => date('Y-m-d', strtotime('-' . (1 + $i) . ' days')),
            'expected_date' => date('Y-m-d', strtotime('+' . (3 + $i) . ' days')),
            'technician' => 'In-house',
        ];
        $rid = RepairService::create($body, $user);
        $flow = ['received', 'diagnosed', 'in_progress', 'quality_check', 'ready', 'delivered'];
        foreach ($flow as $st) {
            if ($st === 'received') {
                continue;
            }
            RepairService::changeStatus($rid, ['status' => $st], $user);
            if ($st === $to) {
                break;
            }
        }
        $n++;
    }
    return "$n repairs";
});

// ---------------------------------------------------------------- Invoices
step('Invoices + payments', function () use ($user, $customerIds, $today, $ago): string {
    $invoices = [
        ['ci' => 0, 'desc' => '22K Gold Bangle Pair', 'rate' => 385000, 'gross' => 42.5, 'purity' => '22K', 'making' => 12000, 'old_gold' => 25000, 'pay' => 'full', 'date' => $today],
        ['ci' => 2, 'desc' => 'Gold Chain 20 inch', 'rate' => 205000, 'gross' => 24, 'purity' => '22K', 'making' => 6000, 'old_gold' => 0, 'pay' => 'full', 'date' => $ago(2)],
        ['ci' => 7, 'desc' => 'Diamond Solitaire Ring', 'rate' => 145000, 'gross' => 5.2, 'purity' => '18K', 'making' => 18000, 'old_gold' => 0, 'pay' => 'partial', 'date' => $ago(5)],
        ['ci' => 1, 'desc' => 'Silver Payal Pair', 'rate' => 12500, 'gross' => 120, 'purity' => '92.5', 'making' => 1500, 'old_gold' => 0, 'pay' => 'full', 'date' => $ago(8)],
        ['ci' => 3, 'desc' => 'Temple Jhumka Earrings', 'rate' => 165000, 'gross' => 18.4, 'purity' => '22K', 'making' => 9000, 'old_gold' => 10000, 'pay' => 'none', 'date' => $ago(1)],
        ['ci' => 6, 'desc' => 'Gold Coin 10g', 'rate' => 78000, 'gross' => 10, 'purity' => '24K', 'making' => 0, 'old_gold' => 0, 'pay' => 'full', 'date' => $ago(12)],
    ];
    $n = 0;
    foreach ($invoices as $inv) {
        $id = InvoiceService::create([
            'customer_id' => $customerIds[$inv['ci']],
            'invoice_date' => $inv['date'],
            'sale_type' => 'ready',
            'old_gold_adjustment' => $inv['old_gold'],
            'items' => [[
                'item_type' => 'stock', 'description' => $inv['desc'], 'qty' => 1, 'rate' => $inv['rate'],
                'tax_rate' => 3, 'metal_type' => 'Gold', 'gross_wt' => $inv['gross'], 'purity' => $inv['purity'],
                'making_charge' => $inv['making'], 'hsn_code' => '7113',
            ]],
        ], $user);
        InvoiceService::finalize($id, $user);
        $grand = (float) Database::fetchValue('SELECT grand_total FROM invoices WHERE id = :id', ['id' => $id]);
        if ($inv['pay'] === 'full') {
            InvoiceService::addPayment($id, ['amount' => $grand, 'payment_date' => $inv['date'], 'payment_mode' => 'upi'], $user);
        } elseif ($inv['pay'] === 'partial') {
            InvoiceService::addPayment($id, ['amount' => round($grand * 0.4, 2), 'payment_date' => $inv['date'], 'payment_mode' => 'cash'], $user);
        }
        $n++;
    }
    return "$n invoices";
});

// ---------------------------------------------------------------- Automation log
step('Automation messages', function () use ($user): string {
    $tpl = static fn (string $n) => Database::fetchValue('SELECT id FROM message_templates WHERE name = :n', ['n' => $n]);
    $msgs = [
        ['channel' => 'whatsapp', 'template_id' => $tpl('Lead follow-up reminder'), 'recipient_name' => 'Amit Joshi', 'recipient_contact' => '9871000002', 'body' => 'Hi Amit, following up on your diamond enquiry.', 'event' => 'lead_followup', 'status' => 'delivered'],
        ['channel' => 'email', 'template_id' => $tpl('Invoice receipt'), 'recipient_name' => 'Meera Shah', 'recipient_contact' => 'meera@example.com', 'subject' => 'Your invoice', 'body' => 'Thank you for your purchase.', 'event' => 'invoice_receipt', 'status' => 'sent'],
        ['channel' => 'whatsapp', 'template_id' => $tpl('Repair ready'), 'recipient_name' => 'Priya Nair', 'recipient_contact' => '9990010004', 'body' => 'Your repair is ready for pickup.', 'event' => 'repair_status', 'status' => 'delivered'],
        ['channel' => 'whatsapp', 'template_id' => $tpl('Birthday wish'), 'recipient_name' => 'Rohit Mehta', 'recipient_contact' => '9990010003', 'body' => 'Happy Birthday Rohit!', 'event' => 'birthday', 'status' => 'queued'],
    ];
    $n = 0;
    foreach ($msgs as $m) {
        $status = $m['status'];
        unset($m['status']);
        $mid = AutomationService::queue($m, $user);
        if ($status !== 'queued') {
            AutomationService::logStatus(['id' => $mid, 'status' => $status], );
        }
        $n++;
    }
    return "$n messages";
});

// ---------------------------------------------------------------- Employees + attendance
$employeeIds = [];
step('Employees', function () use ($user, $deptSales, $deptProd, $shiftId, &$employeeIds): string {
    $emps = [
        ['first_name' => 'Rajesh', 'last_name' => 'Kumar', 'phone' => '9000000001', 'department_id' => $deptSales, 'employee_type' => 'full_time', 'basic_salary' => 35000, 'date_of_joining' => '2022-04-01'],
        ['first_name' => 'Sneha', 'last_name' => 'Pawar', 'phone' => '9000000002', 'department_id' => $deptSales, 'employee_type' => 'full_time', 'basic_salary' => 30000, 'date_of_joining' => '2023-01-15'],
        ['first_name' => 'Imran', 'last_name' => 'Shaikh', 'phone' => '9000000003', 'department_id' => $deptProd, 'employee_type' => 'full_time', 'basic_salary' => 40000, 'date_of_joining' => '2021-08-10'],
        ['first_name' => 'Kavita', 'last_name' => 'Rane', 'phone' => '9000000004', 'department_id' => $deptProd, 'employee_type' => 'part_time', 'basic_salary' => 22000, 'date_of_joining' => '2023-06-05'],
        ['first_name' => 'Farhan', 'last_name' => 'Ali', 'phone' => '9000000005', 'department_id' => $deptSales, 'employee_type' => 'contract', 'basic_salary' => 28000, 'date_of_joining' => '2024-02-20'],
    ];
    foreach ($emps as $e) {
        $employeeIds[] = EmployeeService::save($e + ['shift_id' => $shiftId ?: null, 'status' => 'active'], $user);
    }
    return count($employeeIds) . ' employees';
});

step("Attendance (today + last 5 days)", function () use ($user, $employeeIds, $ago, $today): string {
    $statuses = ['present', 'present', 'present', 'late', 'present'];
    $rows = [];
    for ($d = 0; $d < 6; $d++) {
        $date = $d === 0 ? $today : $ago($d);
        foreach ($employeeIds as $i => $eid) {
            $st = $d === 0 && $i === 3 ? 'on_leave' : ($d === 2 && $i === 1 ? 'half_day' : $statuses[$i % count($statuses)]);
            $rows[] = ['employee_id' => $eid, 'attendance_date' => $date, 'status' => $st, 'check_in' => $st === 'late' ? '10:20' : '10:00', 'check_out' => '19:00'];
        }
    }
    $n = AttendanceService::mark(['rows' => $rows], $user);
    return "$n rows";
});

step('Leave request (pending)', function () use ($user, $employeeIds): string {
    $lt = (int) Database::fetchValue("SELECT id FROM leave_types WHERE code = 'CL' LIMIT 1");
    if ($lt === 0 || empty($employeeIds)) {
        return 'skipped';
    }
    LeaveService::apply([
        'employee_id' => $employeeIds[0], 'leave_type_id' => $lt,
        'start_date' => date('Y-m-d', strtotime('+3 days')), 'end_date' => date('Y-m-d', strtotime('+4 days')),
        'reason' => 'Family function',
    ], $user, true);
    return '1 pending';
});

// ---------------------------------------------------------------- Expenses
step('Expenses', function () use ($user, $ago, $today): string {
    $catId = (int) Database::fetchValue("SELECT id FROM expense_categories WHERE is_system = 0 AND name = 'Rent' LIMIT 1");
    $marketing = (int) Database::fetchValue("SELECT id FROM expense_categories WHERE is_system = 0 AND name = 'Marketing' LIMIT 1");
    $utils = (int) Database::fetchValue("SELECT id FROM expense_categories WHERE is_system = 0 AND name = 'Utilities' LIMIT 1");
    $expenses = [
        ['category_id' => $catId, 'amount' => 60000, 'description' => 'Showroom rent', 'paid_to' => 'Landlord', 'payment_mode' => 'bank', 'expense_date' => $today, 'type' => 'fixed'],
        ['category_id' => $utils, 'amount' => 8500, 'description' => 'Electricity bill', 'payment_mode' => 'upi', 'expense_date' => $ago(3)],
        ['category_id' => $marketing, 'amount' => 15000, 'description' => 'Instagram ads', 'payment_mode' => 'card', 'expense_date' => $ago(6)],
        ['category_id' => $utils, 'amount' => 2200, 'description' => 'Internet & phone', 'payment_mode' => 'upi', 'expense_date' => $ago(10)],
        ['category_id' => $marketing, 'amount' => 9000, 'description' => 'Festival banners', 'payment_mode' => 'cash', 'expense_date' => $ago(14)],
    ];
    $n = 0;
    foreach ($expenses as $e) {
        if ((int) $e['category_id'] === 0) {
            continue;
        }
        ExpenseService::create($e, $user);
        $n++;
    }
    return "$n expenses";
});

echo "\nDemo data seeded. Log in as admin / admin123 to explore.\n";
