<?php

declare(strict_types=1);

namespace CRM\Support;

use CRM\Auth\AuthUser;
use CRM\Auth\PermissionService;

/**
 * Single source of truth for navigation (plan/04 §4). Filtered per user;
 * self-service routes (/profile, /notifications) are always allowed.
 */
final class NavMap
{
    private const SECTIONS = [
        ['title' => 'Overview', 'items' => [
            ['label' => 'Dashboard', 'href' => '/', 'icon' => 'layout-dashboard', 'permission' => 'dashboard.read'],
        ]],
        // Leads before Customers: an enquiry becomes a customer, so the menu
        // follows the order the shop works in.
        ['title' => 'Customers & Leads', 'items' => [
            ['label' => 'Leads', 'href' => '/leads', 'icon' => 'contact', 'permission' => 'leads.read'],
            ['label' => 'Customers', 'href' => '/customers', 'icon' => 'users', 'permission' => 'customers.read'],
        ]],
        // "New Bill" / "New Purchase" are NOT menu items — each list page carries
        // its own primary button top-right, so the menu stays one row per section.
        ['title' => 'Billing', 'items' => [
            ['label' => 'Bills', 'href' => '/invoices', 'icon' => 'receipt-indian-rupee', 'permission' => 'invoices.read'],
            ['label' => 'Estimates', 'href' => '/estimates', 'icon' => 'file-pen-line', 'permission' => 'estimates.read'],
            ['label' => 'Payment', 'href' => '/payments', 'icon' => 'wallet', 'permission' => 'payments.create'],
        ]],
        ['title' => 'Inventory', 'items' => [
            ['label' => "Today's Rates", 'href' => '/rates', 'icon' => 'trending-up', 'permission' => 'rates.read'],
            ['label' => 'Stock', 'href' => '/inventory', 'icon' => 'boxes', 'permission' => 'inventory.read'],
            ['label' => 'Items', 'href' => '/inventory/items', 'icon' => 'gem', 'permission' => 'inventory.read'],
            ['label' => 'Stock Movements', 'href' => '/inventory/movements', 'icon' => 'arrow-left-right', 'permission' => 'inventory.read'],
            ['label' => 'Stock Adjustment', 'href' => '/inventory/adjust', 'icon' => 'sliders-horizontal', 'permission' => 'inventory.adjust'],
        ]],
        ['title' => 'Purchases', 'items' => [
            ['label' => 'Purchases', 'href' => '/purchases', 'icon' => 'package', 'permission' => 'purchases.read'],
        ]],
        ['title' => 'Suppliers & Makers', 'items' => [
            ['label' => 'Suppliers', 'href' => '/vendors', 'icon' => 'truck', 'permission' => 'vendors.read'],
            ['label' => 'Jewellery Makers', 'href' => '/vendors/makers', 'icon' => 'hammer', 'permission' => 'vendors.read'],
            ['label' => 'Services & Others', 'href' => '/vendors/services', 'icon' => 'wrench', 'permission' => 'vendors.read'],
            ['label' => 'Vendor Payments', 'href' => '/vendors/payments', 'icon' => 'banknote', 'permission' => 'payments.vendor'],
        ]],
        ['title' => 'HR', 'items' => [
            ['label' => 'Employees', 'href' => '/hr/employees', 'icon' => 'id-card', 'permission' => 'hr.read'],
            ['label' => 'Payroll', 'href' => '/hr/payroll', 'icon' => 'wallet', 'permission' => 'hr.payroll.read'],
        ]],
        ['title' => 'Accounting', 'items' => [
            // the journal is a dialog on /accounting, not its own route
            ['label' => 'Accounts', 'href' => '/accounting', 'icon' => 'book-open', 'permission' => 'accounting.read'],
            ['label' => 'Expenses', 'href' => '/expenses', 'icon' => 'wallet', 'permission' => 'expenses.read'],
            ['label' => 'Fixed Costs', 'href' => '/expenses/monthly', 'icon' => 'calendar-check', 'permission' => 'expenses.read'],
            ['label' => 'Expense Categories', 'href' => '/expenses/categories', 'icon' => 'tags', 'permission' => 'expenses.read'],
        ]],
        ['title' => 'Reports', 'items' => [
            ['label' => 'Profit & Loss', 'href' => '/reports/pnl', 'icon' => 'chart-line', 'permission' => 'reports.pnl'],
            ['label' => 'All Reports', 'href' => '/reports', 'icon' => 'chart-column', 'permission' => 'reports.read'],
        ]],
        ['title' => 'Settings', 'items' => [
            ['label' => 'Users', 'href' => '/settings/users', 'icon' => 'user-cog', 'permission' => 'users.read'],
            ['label' => 'Roles', 'href' => '/settings/roles', 'icon' => 'shield', 'permission' => 'rbac.manage'],
            ['label' => 'Bank Accounts', 'href' => '/settings/bank-accounts', 'icon' => 'landmark', 'permission' => 'bank_accounts.manage'],
            ['label' => 'Company', 'href' => '/settings/company', 'icon' => 'building-2', 'permission' => 'settings.manage'],
            ['label' => 'Audit Log', 'href' => '/settings/audit', 'icon' => 'history', 'permission' => 'audit.read'],
        ]],
    ];

    /** Detail/sub routes inherit access from their parent list route. */
    public const SUB_ROUTE_PARENTS = [
        '/customers/detail' => '/customers',
        '/invoices/detail' => '/invoices',
        '/invoices/create' => '/invoices',      // reached from the button on /invoices
        '/estimates/detail' => '/estimates',
        '/estimates/create' => '/estimates',
        '/vendors/detail' => '/vendors',
        '/purchases/detail' => '/purchases',
        '/purchases/create' => '/purchases',    // reached from the button on /purchases
        '/inventory/detail' => '/inventory',
        '/accounting/ledger' => '/accounting',   // ledger statement opened from a COA row
        '/reports/trial-balance' => '/reports',
        '/reports/gst' => '/reports',
        '/reports/ledger-view' => '/reports',
        '/reports/outstanding' => '/reports',
        '/reports/stock' => '/reports',
        '/reports/daybook' => '/reports',
    ];

    /** Always reachable for any authenticated user (header avatar/bell routes). */
    public const SELF_SERVICE_ROUTES = ['/profile', '/notifications'];

    /** @return array{navigation: array, allowed_hrefs: string[]} */
    public static function forUser(AuthUser $user): array
    {
        $navigation = [];
        $allowed = self::SELF_SERVICE_ROUTES;

        foreach (self::SECTIONS as $section) {
            $items = [];
            foreach ($section['items'] as $item) {
                if ($item['permission'] === null || PermissionService::can($user, $item['permission'])) {
                    $items[] = ['label' => $item['label'], 'href' => $item['href'], 'icon' => $item['icon']];
                    $allowed[] = $item['href'];
                }
            }
            if ($items !== []) {
                $navigation[] = ['title' => $section['title'], 'items' => $items];
            }
        }

        foreach (self::SUB_ROUTE_PARENTS as $child => $parent) {
            if (in_array($parent, $allowed, true)) {
                $allowed[] = $child;
            }
        }

        return ['navigation' => $navigation, 'allowed_hrefs' => array_values(array_unique($allowed))];
    }
}
