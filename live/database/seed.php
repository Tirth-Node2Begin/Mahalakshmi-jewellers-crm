<?php

declare(strict_types=1);

/**
 * Jewellers CRM/ERP seeder — idempotent (safe to re-run).
 * Seeds: permission catalog (plan/03 §8), roles + grant matrix, owner user,
 * purities, chart of accounts + system ledgers, masters, sequences, settings.
 *
 * Run AFTER schema.sql and migrations/2026_07_28_jewellery_erp.sql:
 *   php database/seed.php
 */

if (PHP_SAPI !== 'cli') {
    exit("seed.php is CLI-only\n");
}

require_once dirname(__DIR__) . '/src/bootstrap.php';

use CRM\Database\Database;
use CRM\Support\FiscalYear;

// ---------------------------------------------------------------------------
// 1. Permission catalog (source of truth: plan/03-api-list.md §8)
// ---------------------------------------------------------------------------
// action => the plain-language label shown on the Roles page, so an owner ticking
// boxes reads "See profit & loss" rather than "pnl".
$catalog = [
    'dashboard' => ['read' => 'See the dashboard'],
    'reports' => [
        'read' => 'See general reports',
        'pnl' => 'See profit & loss',
        'accounting' => 'See trial balance, day book & ledgers',
        'gst' => 'See the GST summary',
        'outstanding' => 'See who owes money',
        'stock' => 'See stock reports and item cost',
    ],
    'customers' => [
        'read' => 'See customers',
        'create' => 'Add a customer',
        'update' => 'Edit a customer',
        'delete' => 'Remove a customer',
        'ledger' => "See a customer's account statement",
    ],
    'leads' => [
        'read' => 'See leads',
        'create' => 'Add a lead',
        'update' => 'Edit a lead',
        'delete' => 'Remove a lead',
    ],
    'hr' => [
        'read' => 'See employee directory',
    ],
    'hr.employees' => [
        'manage' => 'Add and edit employees',
    ],
    'hr.payroll' => [
        'read' => 'See payroll',
        'manage' => 'Create and finalize payroll',
        'pay' => 'Pay and reverse salaries',
    ],
    'invoices' => [
        'read' => 'See bills',
        'create' => 'Make a bill',
        'override' => 'Change rate, making or tax on a bill',
        'non_gst' => 'Make and see Non GST bills in billing only',
        'cancel' => 'Cancel a bill',
    ],
    'estimates' => [
        'read' => 'See estimates',
        'create' => 'Make an estimate',
    ],
    'payments' => [
        'read' => 'See payments',
        'create' => 'Take money from a customer',
        'vendor' => 'Pay a vendor',
        'cancel' => 'Cancel a payment',
    ],
    'purchases' => [
        'read' => 'See purchases',
        'create' => 'Record a purchase',
        'cancel' => 'Cancel a purchase',
    ],
    'expenses' => [
        'read' => 'See expenses',
        'create' => 'Add an expense',
        'update' => 'Edit an expense',
        'delete' => 'Remove an expense',
    ],
    'bank_accounts' => ['manage' => 'Manage bank accounts'],
    'inventory' => [
        'read' => 'See stock and items',
        'manage' => 'Add and edit items',
        'adjust' => 'Adjust stock',
        'issue' => 'Issue stock',
        'opening' => 'Enter opening stock',
    ],
    'rates' => [
        'read' => "See today's rates",
        'set' => "Set today's gold & silver rates",
        // separate from 'set': a shop can let someone watch the daily feed
        // without giving them the power to change what the counter bills at
        'feed' => 'See auto-fetched rates awaiting approval',
    ],
    'vendors' => [
        'read' => 'See vendors',
        'manage' => 'Add and edit vendors',
        'ledger' => "See a vendor's account statement",
    ],
    'accounting' => [
        'read' => 'Open the Accounts section',
        'manage' => 'Add and edit ledger accounts',
        'journal' => 'Pass a manual journal entry',
    ],
    'users' => [
        'read' => 'See users',
        'manage' => 'Add and edit users',
    ],
    'rbac' => ['manage' => 'Manage roles & permissions'],
    'settings' => [
        'read' => 'See settings',
        'manage' => 'Change shop settings',
    ],
    'audit' => ['read' => 'See the audit log'],
];

$permissionIds = []; // "resource.action" => id
foreach ($catalog as $resource => $actions) {
    foreach ($actions as $action => $label) {
        Database::execute(
            'INSERT INTO permissions (resource, action, description) VALUES (:r, :a, :d)
             ON DUPLICATE KEY UPDATE description = :d2, is_active = 1',
            ['r' => $resource, 'a' => $action, 'd' => $label, 'd2' => $label]
        );
        $permissionIds["$resource.$action"] = (int) Database::fetchValue(
            'SELECT id FROM permissions WHERE resource = :r AND action = :a',
            ['r' => $resource, 'a' => $action]
        );
    }
}
echo 'Permissions: ' . count($permissionIds) . "\n";

// ---------------------------------------------------------------------------
// 2. Roles + grant matrix (plan/03 §8; super_admin bypasses in PermissionService)
// ---------------------------------------------------------------------------
$roles = [
    'super_admin' => [
        'display' => 'Owner', 'scope' => 'all', 'system' => 1,
        'grants' => [], // wildcard bypass
    ],
    'accountant' => [
        'display' => 'Accountant', 'scope' => 'all', 'system' => 0,
        'grants' => [
            'dashboard.read',
            // NOTE: 'reports.pnl' is deliberately NOT granted — profit & loss is
            // the owner's figure. Grant it from Settings → Roles if they want the
            // accountant to see it too.
            'reports.read', 'reports.accounting', 'reports.gst',
            'reports.outstanding', 'reports.stock',
            'leads.read', 'leads.create', 'leads.update',
            'customers.read', 'customers.create', 'customers.update', 'customers.ledger',
            'vendors.read', 'vendors.manage', 'vendors.ledger',
            'hr.payroll.read', 'hr.payroll.pay',
            'invoices.read', 'invoices.create', 'invoices.override', 'invoices.cancel',
            'estimates.read', 'estimates.create',
            'payments.read', 'payments.create', 'payments.vendor', 'payments.cancel',
            'purchases.read', 'purchases.create', 'purchases.cancel',
            'expenses.read', 'expenses.create', 'expenses.update', 'expenses.delete',
            'bank_accounts.manage',
            'accounting.read', 'accounting.manage', 'accounting.journal',
            'inventory.read', 'rates.read',
        ],
    ],
    'non_gst_billing' => [
        'display' => 'Non GST Billing Access', 'scope' => 'all', 'system' => 0,
        'grants' => [
            // Add-on role: assign it together with Accountant/Cashier when the
            // owner wants that login to make and see Non GST bills.
            'invoices.non_gst',
        ],
    ],
    'hr' => [
        'display' => 'HR Manager', 'scope' => 'all', 'system' => 0,
        'grants' => [
            'dashboard.read',
            'reports.read',
            'users.read',
            'hr.read', 'hr.employees.manage',
            'hr.payroll.read', 'hr.payroll.manage', 'hr.payroll.pay',
        ],
    ],
    'cashier' => [
        // counter staff: bill and take money. No P&L, no cost values, no overrides.
        'display' => 'Cashier', 'scope' => 'all', 'system' => 0,
        'grants' => [
            'dashboard.read',
            'leads.read', 'leads.create', 'leads.update',
            'customers.read', 'customers.create',
            'invoices.read', 'invoices.create',
            'estimates.read', 'estimates.create',
            'payments.read', 'payments.create',
            'inventory.read', 'rates.read',
        ],
    ],
    'inventory' => [
        'display' => 'Inventory Manager', 'scope' => 'all', 'system' => 0,
        'grants' => [
            'dashboard.read',
            'inventory.read', 'inventory.manage', 'inventory.adjust', 'inventory.issue', 'inventory.opening',
            'rates.read', 'rates.set', 'rates.feed',
            'vendors.read',
            'purchases.read', 'purchases.create',
            'reports.read', 'reports.stock',
            'customers.read',
        ],
    ],
];

foreach ($roles as $slug => $def) {
    Database::execute(
        'INSERT INTO roles (name, display_name, data_scope, is_system)
         VALUES (:n, :d, :s, :sys)
         ON DUPLICATE KEY UPDATE display_name = :d2, data_scope = :s2, is_system = :sys2, is_active = 1',
        ['n' => $slug, 'd' => $def['display'], 's' => $def['scope'], 'sys' => $def['system'],
         'd2' => $def['display'], 's2' => $def['scope'], 'sys2' => $def['system']]
    );
    $roleId = (int) Database::fetchValue('SELECT id FROM roles WHERE name = :n', ['n' => $slug]);

    Database::transaction(static function () use ($roleId, $def, $permissionIds): void {
        Database::execute('DELETE FROM role_permission_grants WHERE role_id = :r', ['r' => $roleId]);
        foreach ($def['grants'] as $perm) {
            if (!isset($permissionIds[$perm])) {
                throw new RuntimeException("Seed grant references unknown permission: $perm");
            }
            Database::insert('role_permission_grants', [
                'role_id' => $roleId,
                'permission_id' => $permissionIds[$perm],
            ]);
        }
    });
    echo "Role $slug: " . count($def['grants']) . " grants\n";
}

// ---------------------------------------------------------------------------
// 3. Owner users (admin / admin123 and Admin / admin@123)
//
// Two SEPARATE super-admin accounts on the same database, telling exactly one
// thing apart: the username's casing. `users.username` is utf8mb4_bin, so the
// lookup below and the unique index both distinguish `admin` from `Admin`.
// Identical roles, identical permissions, identical data — see plan/09.
// ---------------------------------------------------------------------------
$superRoleId = (int) Database::fetchValue("SELECT id FROM roles WHERE name = 'super_admin'");
$owners = [
    ['admin', 'admin123', 'Owner', 'admin@jewellers.local', '#B8860B'],
    ['Admin', 'admin@123', 'Administrator', 'administrator@jewellers.local', '#6C63FF'],
];
foreach ($owners as [$ownerName, $ownerPassword, $fullName, $ownerEmail, $color]) {
    $ownerId = Database::fetchValue(
        'SELECT id FROM users WHERE username COLLATE utf8mb4_bin = :u',
        ['u' => $ownerName]
    );
    if ($ownerId === null) {
        $ownerId = Database::insert('users', [
            'username' => $ownerName,
            'password_hash' => password_hash($ownerPassword, PASSWORD_DEFAULT),
            'full_name' => $fullName,
            'email' => $ownerEmail,
            'avatar_color' => $color,
            'must_change_password' => 0,
        ]);
        echo "Owner user created ({$ownerName} / {$ownerPassword})\n";
    }
    Database::execute(
        'INSERT INTO user_role_assignments (user_id, role_id) VALUES (:u, :r)
         ON DUPLICATE KEY UPDATE is_active = 1',
        ['u' => (int) $ownerId, 'r' => $superRoleId]
    );
}

// ---------------------------------------------------------------------------
// 4. Metals — the master behind every `metal` column. The shop can add to this
//    from the app (Metals::create), so only the three we ship are seeded here.
// ---------------------------------------------------------------------------
try {
    foreach ([['gold', 'Gold', 1], ['silver', 'Silver', 2], ['platinum', 'Platinum', 3]] as [$code, $name, $sort]) {
        Database::execute(
            'INSERT INTO metals (code, name, sort_order) VALUES (:c, :n, :s)
             ON DUPLICATE KEY UPDATE name = :n2, sort_order = :s2, is_active = 1',
            ['c' => $code, 'n' => $name, 's' => $sort, 'n2' => $name, 's2' => $sort]
        );
    }
    echo "Metals: 3\n";
} catch (Throwable) {
    echo "Metals: skipped — run database/migrations/2026_07_30_metals_master.sql first.\n";
}

// ---------------------------------------------------------------------------
// 4b. Purities — the daily rate is entered per purity, so pricing uses it directly
// ---------------------------------------------------------------------------
$purities = [
    ['gold', '24K', '24 Karat (999)', 0.9990, 1],
    ['gold', '22K', '22 Karat (916)', 0.9160, 2],
    ['gold', '18K', '18 Karat (750)', 0.7500, 3],
    ['silver', '999', 'Fine Silver (999)', 0.9990, 4],
    ['silver', '925', 'Sterling Silver (925)', 0.9250, 5],
    // platinum needs migrations/2026_07_30_platinum.sql to have widened the enum
    ['platinum', 'PT950', 'Platinum 950', 0.9500, 6],
];
foreach ($purities as [$metal, $code, $label, $fineness, $sort]) {
    Database::execute(
        'INSERT INTO purities (metal, code, label, fineness, sort_order) VALUES (:m, :c, :l, :f, :s)
         ON DUPLICATE KEY UPDATE label = :l2, fineness = :f2, sort_order = :s2, is_active = 1',
        ['m' => $metal, 'c' => $code, 'l' => $label, 'f' => $fineness, 's' => $sort,
         'l2' => $label, 'f2' => $fineness, 's2' => $sort]
    );
}
echo 'Purities: ' . count($purities) . "\n";

// ---------------------------------------------------------------------------
// 5. Chart of accounts + system ledgers (plan/05 §1)
// ---------------------------------------------------------------------------
$group = static function (string $name, string $nature, ?int $parentId = null, int $sort = 0): int {
    $existing = Database::fetchValue(
        'SELECT id FROM account_groups WHERE name = :n AND (parent_id <=> :p)',
        ['n' => $name, 'p' => $parentId]
    );
    if ($existing !== null) {
        return (int) $existing;
    }
    return Database::insert('account_groups', [
        'name' => $name, 'nature' => $nature, 'parent_id' => $parentId,
        'is_system' => 1, 'sort_order' => $sort,
    ]);
};

$gAssets      = $group('Assets', 'asset', null, 1);
$gLiabilities = $group('Liabilities', 'liability', null, 2);
$gIncome      = $group('Income', 'income', null, 3);
$gExpenses    = $group('Expenses', 'expense', null, 4);

$gCashBank   = $group('Cash & Bank', 'asset', $gAssets, 1);
$gInventory  = $group('Inventory', 'asset', $gAssets, 2);
$gReceivable = $group('Accounts Receivable', 'asset', $gAssets, 3);
$gTaxAssets  = $group('Tax Assets', 'asset', $gAssets, 4);
$gPayable    = $group('Accounts Payable', 'liability', $gLiabilities, 1);
$gTaxLiab    = $group('Tax Liabilities', 'liability', $gLiabilities, 2);
$gEquity     = $group('Opening Balances', 'liability', $gLiabilities, 3);
$gSales      = $group('Sales', 'income', $gIncome, 1);
$gOtherInc   = $group('Other Income', 'income', $gIncome, 2);
$gCogs       = $group('Cost of Goods Sold', 'expense', $gExpenses, 1);
$gOpex       = $group('Operating Expenses', 'expense', $gExpenses, 2);

/** Seed a system ledger, identified by linked_type (+ metal). */
$ledger = static function (
    int $groupId,
    string $name,
    ?string $linkedType,
    ?string $metal = null,
    string $openingType = 'dr'
): void {
    $existing = Database::fetchValue(
        'SELECT id FROM ledger_accounts
          WHERE (linked_type <=> :t) AND linked_id IS NULL AND (metal <=> :m)',
        ['t' => $linkedType, 'm' => $metal]
    );
    if ($existing !== null) {
        return;
    }
    Database::insert('ledger_accounts', [
        'group_id' => $groupId,
        'name' => $name,
        'linked_type' => $linkedType,
        'metal' => $metal,
        'opening_type' => $openingType,
        'is_system' => 1,
    ]);
};

$ledger($gCashBank,   'Cash in Hand',            'cash');
$ledger($gCashBank,   'Bank Account',            'bank');
$ledger($gInventory,  'Inventory — Gold',        'inventory', 'gold');
$ledger($gInventory,  'Inventory — Silver',      'inventory', 'silver');
$ledger($gInventory,  'Inventory — Platinum',    'inventory', 'platinum');
$ledger($gInventory,  'Inventory — Old Metal',   'old_metal');
$ledger($gReceivable, 'Walk-in Customers',       'customer');        // control ledger for walk-in bills
$ledger($gTaxAssets,  'GST Input (Purchases)',   'gst_input');
$ledger($gPayable,    'Sundry Creditors',        'vendor', null, 'cr');
$ledger($gTaxLiab,    'GST Payable',             'gst_output', null, 'cr');
$ledger($gEquity,     'Opening Balances Equity', 'opening_equity', null, 'cr');
$ledger($gSales,      'Gold Sales',              'sales', 'gold', 'cr');
$ledger($gSales,      'Silver Sales',            'sales', 'silver', 'cr');
$ledger($gSales,      'Platinum Sales',          'sales', 'platinum', 'cr');
$ledger($gSales,      'Making Charges Income',   'making', null, 'cr');
$ledger($gOtherInc,   'Round Off',               'round_off', null, 'cr');
$ledger($gOtherInc,   'Discount Given',          'discount');        // contra-income, debit side
$ledger($gCogs,       'Cost of Goods Sold',      'cogs');
$ledger($gOpex,       'Wages & Karigar Charges', 'expense');
$ledger($gOpex,       'Stock Adjustment Loss',   'stock_adjust');
echo "Chart of accounts seeded\n";

// ---------------------------------------------------------------------------
// 6. Masters
// ---------------------------------------------------------------------------
foreach ([['Pieces', 'pcs'], ['Gram', 'g'], ['Kilogram', 'kg'], ['Carat', 'ct'], ['Set', 'set']] as [$name, $short]) {
    Database::execute(
        'INSERT INTO units (name, short_name) VALUES (:n, :s) ON DUPLICATE KEY UPDATE is_active = 1',
        ['n' => $name, 's' => $short]
    );
}

$expenseCategories = [
    ['Salaries', 'fixed', 1, 'SALARY'],
    ['Inventory Purchase', 'variable', 1, 'INVENTORY_PURCHASE'],
    ['Rent', 'fixed', 0, null],
    ['Utilities', 'fixed', 0, null],
    ['Karigar Charges', 'variable', 0, null],
    ['Marketing', 'variable', 0, null],
    ['Office Supplies', 'variable', 0, null],
];
foreach ($expenseCategories as [$name, $type, $system, $key]) {
    Database::execute(
        'INSERT INTO expense_categories (name, type, is_system, system_key) VALUES (:n, :t, :s, :k)
         ON DUPLICATE KEY UPDATE type = :t2, is_system = :s2, is_active = 1',
        ['n' => $name, 't' => $type, 's' => $system, 'k' => $key, 't2' => $type, 's2' => $system]
    );
}

// item categories — 'Raw Metal' and 'Old Metal' names are referenced by code
$itemCategories = [
    ['Ring', 'stock'], ['Chain', 'stock'], ['Necklace', 'stock'], ['Bangle', 'stock'],
    ['Bracelet', 'stock'], ['Earring', 'stock'], ['Pendant', 'stock'], ['Coin & Bar', 'stock'],
    ['Raw Metal', 'raw_material'], ['Old Metal', 'raw_material'],
];
foreach ($itemCategories as [$name, $type]) {
    Database::execute(
        'INSERT INTO inventory_categories (name, item_type) VALUES (:n, :t)
         ON DUPLICATE KEY UPDATE item_type = :t2, is_active = 1',
        ['n' => $name, 't' => $type, 't2' => $type]
    );
}

// ---------------------------------------------------------------------------
// 7. Number sequences
// ---------------------------------------------------------------------------
$fyCode = FiscalYear::code();
$sequences = [
    ['invoice', $fyCode, 'INV-', 5],
    ['estimate', $fyCode, 'EST-', 5],
    ['receipt', $fyCode, 'RCPT-', 5],
    ['purchase', $fyCode, 'PUR-', 5],
    ['vendor_payment', $fyCode, 'PAY-', 5],
    ['voucher', $fyCode, 'VCH-', 5],
    ['customer', '', 'CUST-', 4],
    ['vendor', '', 'VEN-', 4],
    ['item_rm', '', 'RM-', 4],
    ['item_st', '', 'ST-', 4],
    ['adjustment', '', 'ADJ-', 4],
];
foreach ($sequences as [$key, $period, $prefix, $padding]) {
    Database::execute(
        'INSERT INTO number_sequences (seq_key, period, prefix, next_number, padding)
         VALUES (:k, :p, :pre, 1, :pad)
         ON DUPLICATE KEY UPDATE prefix = :pre2, padding = :pad2',
        ['k' => $key, 'p' => $period, 'pre' => $prefix, 'pad' => $padding, 'pre2' => $prefix, 'pad2' => $padding]
    );
}

// ---------------------------------------------------------------------------
// 8. Default settings
// ---------------------------------------------------------------------------
$settings = [
    'company_name' => 'Mahalakshmi Jewellers',
    'company_address' => '',
    'company_phone' => '',
    'company_email' => '',
    'company_gstin' => '',
    'default_tax_rate' => '3',        // jewellery, HSN 7113
    'making_tax_rate' => '5',         // confirm with the client's CA before go-live
    'dead_stock_days' => '180',
    'backdate_limit_days' => '3',
    'estimate_validity_days' => '7',
    'invoice_terms' => 'Goods once sold will not be taken back or exchanged.',
    'invoice_footer_note' => 'Thank you for your visit!',
    'currency' => 'INR',

    // Daily rate feed (api/cron/fetch_rates.php). Fetched rates are STAGED for
    // approval, never written straight into metal_rates — see the migration
    // 2026_08_04_rate_feed.sql for why.
    'rate_feed_enabled' => '1',
    'rate_feed_sources' => 'ibja',
    'rate_feed_max_move_pct' => '8',   // a bigger day-over-day jump gets flagged
    // CBIC's fortnightly customs tariff value — the government cross-check.
    // Optional: paste the two USD figures from the latest notification and the
    // day it takes effect, and the check switches itself on.
    'rate_feed_cbic_gold_usd_10g' => '',
    'rate_feed_cbic_silver_usd_kg' => '',
    'rate_feed_cbic_notification' => '',
    'rate_feed_cbic_effective_from' => '',
    'rate_feed_usd_inr' => '',
];
foreach ($settings as $key => $value) {
    Database::execute(
        'INSERT INTO settings (skey, svalue) VALUES (:k, :v)
         ON DUPLICATE KEY UPDATE skey = skey', // never overwrite user-edited values
        ['k' => $key, 'v' => $value]
    );
}

echo "Seed complete.\n";
