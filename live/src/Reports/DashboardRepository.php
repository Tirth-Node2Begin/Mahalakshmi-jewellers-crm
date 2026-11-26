<?php

declare(strict_types=1);

namespace CRM\Reports;

use CRM\Auth\AuthUser;
use CRM\Auth\PermissionService;
use CRM\Database\Database;
use CRM\Support\GstVisibility;

/**
 * Role-routed dashboard widget payload. One round trip per role.
 * Money truths: sales = finalised invoices, cash in = invoice_payments (bounced/cancelled
 * excluded), spend = expenses. Read-only GROUP BY aggregation — no cron pre-aggregation.
 *
 * Three hand-designed variants map to Mahalakshmi Jewellers' fixed roles (database/seed.php §2):
 *   - executive  → super_admin, admin (comprehensive, permission-gated so it never leaks)
 *   - sales      → billing_officer (billing & collections)
 *   - inventory  → inventory (stock value, low stock, movements)
 * RBAC: every variant queries ONLY data its role is granted; executive gates each section
 * with PermissionService::can() so any lesser/custom role that resolves here self-trims.
 *
 * Invoice vocabulary (jewellery ERP): status is draft | final | cancelled.
 * A bill counts as revenue only when status='final'; "outstanding" is a final bill whose
 * paid_amount is still short of grand_total.
 */
final class DashboardRepository
{
    /** Payments that really represent cash in (bounced cheques / cancelled receipts don't). */
    private const CLEARED = "(payment_mode <> 'cheque' OR cheque_status <> 'bounced' OR cheque_status IS NULL) AND status <> 'cancelled'";
    /** Same predicate, for queries that alias invoice_payments as p. */
    private const CLEARED_P = "(p.payment_mode <> 'cheque' OR p.cheque_status <> 'bounced' OR p.cheque_status IS NULL) AND p.status <> 'cancelled'";
    /** A finalised bill that is not fully settled. */
    private const UNSETTLED = "status = 'final' AND paid_amount < grand_total";

    // ===================================================================== dispatch

    /** Resolve the caller's variant and return its payload. */
    public static function payload(AuthUser $user, int $months): array
    {
        $gstVisibleOnly = GstVisibility::restrictedUsername($user->username);

        return match (self::resolveVariant($user)) {
            'inventory' => self::inventoryPayload($months),
            'sales'     => self::salesPayload($months, $user, $gstVisibleOnly),
            default     => self::executivePayload($months, $user, $gstVisibleOnly),
        };
    }

    /** Highest-priority role → dashboard variant. Fixed 4-role model (seed §2). */
    public static function resolveVariant(AuthUser $user): string
    {
        if ($user->isSuperAdmin() || $user->hasRole('admin')) {
            return 'executive';
        }
        if ($user->hasRole('inventory')) {
            return 'inventory';
        }
        if ($user->hasRole('billing_officer')) {
            return 'sales';
        }
        // Unknown/custom role: fall back to the comprehensive executive view, whose sections
        // are each permission-gated so a lower-privileged role only sees permitted resources.
        return 'executive';
    }

    // ==================================================================== executive

    /** super_admin / admin — the full business picture, each block gated by permission. */
    public static function executivePayload(int $months, AuthUser $user, bool $gstVisibleOnly = false): array
    {
        $can   = static fn (string $p): bool => PermissionService::can($user, $p);
        $inv   = $can('invoices.read');
        $exp   = $can('expenses.read');
        $stock = $can('inventory.read');
        $cust  = $can('customers.read');

        return [
            'variant' => 'executive',
            'alerts' => [
                'overdue_invoices' => $inv ? self::countOverdueInvoices($gstVisibleOnly) : 0,
                'low_stock'        => $stock ? self::countLowStock() : 0,
            ],
            'kpis'               => self::executiveKpis($inv, $exp, $gstVisibleOnly),
            'cashflow'           => self::cashflow($months, $inv, $exp, $gstVisibleOnly),
            'upcoming_occasions' => $cust ? self::upcomingOccasions() : [],
            'recent_payments'    => $inv ? self::recentPayments($gstVisibleOnly) : [],
            'recent_expenses'    => $exp ? self::recentExpenses() : [],
            'low_stock'          => $stock ? self::lowStock() : [],
        ];
    }

    private static function executiveKpis(bool $inv, bool $exp, bool $gstVisibleOnly = false): array
    {
        $monthStart = date('Y-m-01');
        $monthEnd   = date('Y-m-t');
        $revenue = $inv ? self::collectionsBetween($monthStart, $monthEnd, $gstVisibleOnly) : 0.0;
        $expenses = $exp ? (float) Database::fetchValue(
            'SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date BETWEEN :s AND :e',
            ['s' => $monthStart, 'e' => $monthEnd]
        ) : 0.0;

        return [
            'month_revenue'      => round($revenue, 2),
            'month_expenses'     => round($expenses, 2),
            'month_net'          => round($revenue - $expenses, 2),
            'month_sales'        => $inv ? self::salesBetween($monthStart, $monthEnd, $gstVisibleOnly) : 0.0,
            'today_sales'        => $inv ? self::todaysSales($gstVisibleOnly) : 0.0,
            'today_collections'  => $inv ? self::todaysCollections($gstVisibleOnly) : 0.0,
            'outstanding'        => $inv ? self::outstanding($gstVisibleOnly) : 0.0,
        ];
    }

    // ======================================================================== sales

    /** billing_officer — billing & collections. */
    public static function salesPayload(int $months, AuthUser $user, bool $gstVisibleOnly = false): array
    {
        return [
            'variant' => 'sales',
            'alerts' => [
                'overdue_invoices' => self::countOverdueInvoices($gstVisibleOnly),
                'low_stock'        => self::countLowStock(),
            ],
            'kpis'               => self::salesKpis($gstVisibleOnly),
            'collections'        => self::collectionsSeries($months, $gstVisibleOnly),
            'upcoming_occasions' => self::upcomingOccasions(),
            'recent_payments'    => self::recentPayments($gstVisibleOnly),
        ];
    }

    private static function salesKpis(bool $gstVisibleOnly = false): array
    {
        $monthStart = date('Y-m-01');
        $monthEnd   = date('Y-m-t');
        $collections = self::collectionsBetween($monthStart, $monthEnd, $gstVisibleOnly);
        return [
            'month_collections' => round($collections, 2),
            'month_sales'       => self::salesBetween($monthStart, $monthEnd, $gstVisibleOnly),
            'today_sales'       => self::todaysSales($gstVisibleOnly),
            'today_collections' => self::todaysCollections($gstVisibleOnly),
            'outstanding'       => self::outstanding($gstVisibleOnly),
            'draft_invoices'    => self::draftInvoices($gstVisibleOnly),
        ];
    }

    /** 12-month collected (payments in) series — no expense visibility for this role. */
    private static function collectionsSeries(int $months, bool $gstVisibleOnly = false): array
    {
        $months = max(1, min(24, $months));
        $amountSql = self::paymentAmountSql('invoice_payments', $gstVisibleOnly);
        $income = self::monthlySeries(
            "SELECT DATE_FORMAT(payment_date,'%Y-%m') m, SUM({$amountSql}) v FROM invoice_payments WHERE payment_date >= :start AND " . self::CLEARED . ' GROUP BY m',
            $months
        );
        $out = [];
        foreach (self::monthKeys($months) as $key) {
            $out[] = ['month' => $key, 'collected' => round((float) ($income[$key] ?? 0), 2)];
        }
        return $out;
    }

    // ==================================================================== inventory

    /** inventory — capital tied in metal, low stock, movements. */
    public static function inventoryPayload(int $months): array
    {
        return [
            'variant' => 'inventory',
            'alerts' => [
                'low_stock'  => self::countLowStock(),
                'dead_stock' => self::countDeadStock(),
            ],
            'kpis'              => self::inventoryKpis(),
            'stock_by_category' => self::stockByCategory(),
            'stock_by_metal'    => self::stockByMetal(),
            'low_stock'         => self::lowStock(),
            'recent_movements'  => self::recentMovements(),
        ];
    }

    private static function inventoryKpis(): array
    {
        $byType = [];
        foreach (Database::fetchAll(
            'SELECT item_type, COALESCE(SUM(current_stock * avg_cost),0) v FROM inventory_items WHERE is_active = 1 GROUP BY item_type'
        ) as $r) {
            $byType[(string) $r['item_type']] = (float) $r['v'];
        }
        $raw = $byType['raw_material'] ?? 0.0;
        $fin = $byType['stock'] ?? 0.0;
        $old = $byType['old_metal'] ?? 0.0;

        $monthStart = date('Y-m-01');
        // Half-open upper bound so timestamps on the last day are included.
        $nextMonthStart = date('Y-m-01', strtotime('first day of next month'));
        return [
            'stock_value'      => round($raw + $fin + $old, 2),
            'raw_value'        => round($raw, 2),
            'finished_value'   => round($fin, 2),
            'old_metal_value'  => round($old, 2),
            'net_weight'       => round((float) Database::fetchValue(
                "SELECT COALESCE(SUM(net_weight * current_stock),0) FROM inventory_items WHERE is_active = 1 AND status = 'in_stock'"
            ), 3),
            'low_stock_count'  => self::countLowStock(),
            'dead_stock_count' => self::countDeadStock(),
            // Value of stock RECEIVED this month, from the inventory ledger the role owns
            // (inventory.read) — NOT the purchases finance table (no purchase grant exists).
            'stock_added_value' => round((float) Database::fetchValue(
                "SELECT COALESCE(SUM(CASE WHEN value > 0 THEN value ELSE qty * unit_cost END),0) FROM inventory_transactions
                 WHERE type = 'in' AND created_at >= :s AND created_at < :e",
                ['s' => $monthStart, 'e' => $nextMonthStart]
            ), 2),
        ];
    }

    /** Stock value tied up per category (metal is capital) — top 8. */
    private static function stockByCategory(): array
    {
        return Database::fetchAll(
            "SELECT COALESCE(c.name,'Uncategorised') AS category,
                    ROUND(SUM(i.current_stock * i.avg_cost), 2) AS value
             FROM inventory_items i LEFT JOIN inventory_categories c ON c.id = i.category_id
             WHERE i.is_active = 1
             GROUP BY c.id
             HAVING value > 0
             ORDER BY value DESC LIMIT 8"
        );
    }

    /** Weight + value held per metal/purity — the jewellery view of stock. */
    private static function stockByMetal(): array
    {
        return Database::fetchAll(
            "SELECT COALESCE(i.metal,'other') AS metal,
                    COALESCE(pu.code,'—') AS purity,
                    ROUND(COALESCE(SUM(i.net_weight * i.current_stock),0), 3) AS net_weight,
                    ROUND(COALESCE(SUM(i.current_stock * i.avg_cost),0), 2) AS value
             FROM inventory_items i LEFT JOIN purities pu ON pu.id = i.purity_id
             WHERE i.is_active = 1 AND i.status = 'in_stock'
             GROUP BY i.metal, pu.id
             ORDER BY value DESC LIMIT 8"
        );
    }

    private static function recentMovements(): array
    {
        return Database::fetchAll(
            "SELECT t.id, t.type, t.reason, t.qty, t.weight, t.unit_cost, t.value, t.created_at,
                    i.name AS item_name, i.item_code
             FROM inventory_transactions t JOIN inventory_items i ON i.id = t.item_id
             ORDER BY t.id DESC LIMIT 8"
        );
    }

    // =================================================================== shared bits

    /** 12-month income (payments) vs expense series. Either side can be suppressed by RBAC. */
    public static function cashflow(int $months, bool $income = true, bool $expense = true, bool $gstVisibleOnly = false): array
    {
        $months = max(1, min(24, $months));
        $amountSql = self::paymentAmountSql('invoice_payments', $gstVisibleOnly);
        $inc = $income ? self::monthlySeries("SELECT DATE_FORMAT(payment_date,'%Y-%m') m, SUM({$amountSql}) v FROM invoice_payments WHERE payment_date >= :start AND " . self::CLEARED . ' GROUP BY m', $months) : [];
        $exp = $expense ? self::monthlySeries("SELECT DATE_FORMAT(expense_date,'%Y-%m') m, SUM(amount) v FROM expenses WHERE expense_date >= :start GROUP BY m", $months) : [];
        $out = [];
        foreach (self::monthKeys($months) as $key) {
            $out[] = ['month' => $key, 'income' => round((float) ($inc[$key] ?? 0), 2), 'expense' => round((float) ($exp[$key] ?? 0), 2)];
        }
        return $out;
    }

    /**
     * Customers + family members with a birthday or anniversary in the next 7 days.
     * The window is computed on each date's NEXT occurrence, so it stays correct across
     * the year-end boundary (e.g. today 28 Dec → 3 Jan) where a raw MM-DD BETWEEN fails.
     */
    private static function upcomingOccasions(): array
    {
        // Next occurrence of a stored date's MM-DD, rolled to next year if already passed.
        $next = static fn (string $col): string =>
            "STR_TO_DATE(CONCAT(YEAR(CURDATE()) + (DATE_FORMAT($col,'%m-%d') < DATE_FORMAT(CURDATE(),'%m-%d')), DATE_FORMAT($col,'-%m-%d')),'%Y-%m-%d')";
        $inWindow = static fn (string $col): string =>
            "{$next($col)} BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)";

        return Database::fetchAll(
            "SELECT name, occasion, on_date FROM (
                SELECT name, 'Birthday' AS occasion, dob AS on_date, {$next('dob')} AS next_date
                FROM customers WHERE is_active = 1 AND dob IS NOT NULL AND {$inWindow('dob')}
                UNION ALL
                SELECT name, 'Anniversary' AS occasion, anniversary AS on_date, {$next('anniversary')} AS next_date
                FROM customers WHERE is_active = 1 AND anniversary IS NOT NULL AND {$inWindow('anniversary')}
                UNION ALL
                SELECT CONCAT(name, ' (family)') AS name, 'Birthday' AS occasion, dob AS on_date, {$next('dob')} AS next_date
                FROM family_members WHERE dob IS NOT NULL AND {$inWindow('dob')}
                UNION ALL
                SELECT CONCAT(name, ' (family)') AS name, 'Anniversary' AS occasion, anniversary AS on_date, {$next('anniversary')} AS next_date
                FROM family_members WHERE anniversary IS NOT NULL AND {$inWindow('anniversary')}
             ) o ORDER BY next_date LIMIT 10"
        );
    }

    /** Walk-in bills have no customer row, so both joins are LEFT and the name falls back. */
    private static function recentPayments(bool $gstVisibleOnly = false): array
    {
        $amountSql = self::paymentAmountSql('p', $gstVisibleOnly);
        $visibilitySql = $gstVisibleOnly ? ' AND ' . self::paymentVisibleSql('p') : '';

        return Database::fetchAll(
            "SELECT p.id, ROUND({$amountSql}, 2) AS amount, p.payment_date, p.payment_mode, i.invoice_no,
                    COALESCE(c.name, ic.name, i.walkin_name, 'Walk-in') AS customer_name
             FROM invoice_payments p
             LEFT JOIN invoices i ON i.id = p.invoice_id
             LEFT JOIN customers c ON c.id = p.customer_id
             LEFT JOIN customers ic ON ic.id = i.customer_id
             WHERE " . self::CLEARED_P . "{$visibilitySql} ORDER BY p.id DESC LIMIT 6"
        );
    }

    private static function recentExpenses(): array
    {
        return Database::fetchAll(
            'SELECT e.id, e.amount, e.expense_date, e.paid_to, c.name AS category_name
             FROM expenses e JOIN expense_categories c ON c.id = e.category_id
             ORDER BY e.id DESC LIMIT 6'
        );
    }

    private static function lowStock(): array
    {
        return Database::fetchAll(
            "SELECT id, item_code, name, item_type, metal, current_stock, reorder_level, avg_cost,
                    (SELECT short_name FROM units u WHERE u.id = i.unit_id) AS unit
             FROM inventory_items i WHERE " . self::LOW_STOCK . ' ORDER BY current_stock LIMIT 8'
        );
    }

    // -------------------------------------------------------------- money helpers

    /** Billed value of finalised invoices in a window (drafts/cancelled excluded). */
    private static function salesBetween(string $from, string $to, bool $gstVisibleOnly = false): float
    {
        $amountSql = self::invoiceAmountSql('invoices', $gstVisibleOnly);

        return round((float) Database::fetchValue(
            "SELECT COALESCE(SUM({$amountSql}),0) FROM invoices WHERE status = 'final' AND invoice_date BETWEEN :s AND :e",
            ['s' => $from, 'e' => $to]
        ), 2);
    }

    private static function todaysSales(bool $gstVisibleOnly = false): float
    {
        return round((float) Database::fetchValue(
            "SELECT COALESCE(SUM(" . self::invoiceAmountSql('invoices', $gstVisibleOnly) . "),0) FROM invoices WHERE status = 'final' AND invoice_date = CURDATE()"
        ), 2);
    }

    private static function todaysCollections(bool $gstVisibleOnly = false): float
    {
        return round((float) Database::fetchValue(
            'SELECT COALESCE(SUM(' . self::paymentAmountSql('invoice_payments', $gstVisibleOnly) . '),0) FROM invoice_payments WHERE payment_date = CURDATE() AND ' . self::CLEARED
        ), 2);
    }

    private static function collectionsBetween(string $from, string $to, bool $gstVisibleOnly = false): float
    {
        return round((float) Database::fetchValue(
            'SELECT COALESCE(SUM(' . self::paymentAmountSql('invoice_payments', $gstVisibleOnly) . '),0) FROM invoice_payments WHERE payment_date BETWEEN :s AND :e AND ' . self::CLEARED,
            ['s' => $from, 'e' => $to]
        ), 2);
    }

    private static function outstanding(bool $gstVisibleOnly = false): float
    {
        if (!$gstVisibleOnly) {
            return round((float) Database::fetchValue(
                'SELECT COALESCE(SUM(grand_total - paid_amount),0) FROM invoices WHERE ' . self::UNSETTLED
            ), 2);
        }

        $outstandingSql = self::invoiceOutstandingSql('invoices');
        return round((float) Database::fetchValue(
            "SELECT COALESCE(SUM({$outstandingSql}),0) FROM invoices WHERE status = 'final' AND {$outstandingSql} > 0.01"
        ), 2);
    }

    // -------------------------------------------------------------- count helpers

    /**
     * How long a bill may stay unpaid before the dashboard calls it overdue.
     * Counter sales are settled on the spot; credit given at the counter has no
     * formal due date, so the shop sets the grace period it works to.
     */
    private static function creditDays(): int
    {
        $days = (int) (Database::fetchValue("SELECT svalue FROM settings WHERE skey = 'invoice_credit_days'") ?? 7);
        return max(0, $days);
    }

    /**
     * Unpaid finalised bills that are past their date.
     *
     * A bill carries a due_date only if one was entered, and the jewellery
     * billing flow never asks for one — keying off it alone made this count
     * permanently zero however much money was outstanding. The bill's own age
     * is the fallback, so credit given at the counter still surfaces here.
     */
    private static function countOverdueInvoices(bool $gstVisibleOnly = false): int
    {
        $late = 'COALESCE(due_date, DATE_ADD(invoice_date, INTERVAL :days DAY)) < CURDATE()';
        $params = ['days' => self::creditDays()];

        if ($gstVisibleOnly) {
            $outstandingSql = self::invoiceOutstandingSql('invoices');
            return (int) Database::fetchValue(
                "SELECT COUNT(*) FROM invoices WHERE status = 'final' AND {$late} AND {$outstandingSql} > 0.01",
                $params
            );
        }

        return (int) Database::fetchValue(
            'SELECT COUNT(*) FROM invoices WHERE ' . self::UNSETTLED . ' AND ' . $late,
            $params
        );
    }

    private static function draftInvoices(bool $gstVisibleOnly = false): int
    {
        $visibilitySql = $gstVisibleOnly
            ? ' AND (NOT EXISTS (SELECT 1 FROM invoice_items hidden_check WHERE hidden_check.invoice_id = invoices.id)
                    OR ' . self::invoiceVisibleTotalSql('invoices') . ' > 0)'
            : '';

        return (int) Database::fetchValue("SELECT COUNT(*) FROM invoices WHERE status = 'draft'{$visibilitySql}");
    }

    /**
     * Running low means a metal POOL is nearly empty and needs buying in. A
     * tagged piece is one of a kind — it is either on the shelf or sold, never
     * "low" — so counting those made this alert meaningless.
     */
    private const LOW_STOCK = "is_active = 1 AND tracking = 'bulk' AND reorder_level > 0 AND current_stock <= reorder_level";

    private static function countLowStock(): int
    {
        return (int) Database::fetchValue('SELECT COUNT(*) FROM inventory_items WHERE ' . self::LOW_STOCK);
    }

    /** Active items holding stock with no movement in the last 90 days (frozen capital). */
    private static function countDeadStock(): int
    {
        return (int) Database::fetchValue(
            "SELECT COUNT(*) FROM inventory_items i
             WHERE i.is_active = 1 AND i.current_stock > 0
               AND NOT EXISTS (SELECT 1 FROM inventory_transactions t
                               WHERE t.item_id = i.id AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY))"
        );
    }

    // --------------------------------------------------------------------- helpers

    /** @return array<string,float> month(YYYY-MM) → value */
    private static function monthlySeries(string $sql, int $months): array
    {
        $start = date('Y-m-01', strtotime('-' . ($months - 1) . ' months'));
        $map = [];
        foreach (Database::fetchAll($sql, ['start' => $start]) as $r) {
            $map[$r['m']] = (float) $r['v'];
        }
        return $map;
    }

    /** @return string[] last N month keys oldest→newest */
    private static function monthKeys(int $months): array
    {
        $keys = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $keys[] = date('Y-m', strtotime("-$i months"));
        }
        return $keys;
    }

    private static function invoiceVisibleTotalSql(string $invoiceAlias): string
    {
        return "COALESCE((
            SELECT SUM(visible_line.line_total)
             FROM invoice_items visible_line
             WHERE visible_line.invoice_id = {$invoiceAlias}.id
               AND visible_line.tax_treatment = 'taxable'
        ), 0)";
    }

    private static function invoiceAmountSql(string $invoiceAlias, bool $gstVisibleOnly): string
    {
        return $gstVisibleOnly
            ? "LEAST(" . self::invoiceVisibleTotalSql($invoiceAlias) . ", {$invoiceAlias}.grand_total)"
            : "{$invoiceAlias}.grand_total";
    }

    private static function invoiceOutstandingSql(string $invoiceAlias): string
    {
        $visibleTotal = "LEAST(" . self::invoiceVisibleTotalSql($invoiceAlias) . ", {$invoiceAlias}.grand_total)";
        return "GREATEST(
            CASE
                WHEN {$invoiceAlias}.grand_total > 0
                THEN ({$invoiceAlias}.grand_total - {$invoiceAlias}.paid_amount) * ({$visibleTotal} / {$invoiceAlias}.grand_total)
                ELSE 0
            END,
            0
        )";
    }

    private static function paymentAmountSql(string $paymentAlias, bool $gstVisibleOnly): string
    {
        if (!$gstVisibleOnly) {
            return "{$paymentAlias}.amount";
        }

        return "CASE
            WHEN {$paymentAlias}.invoice_id IS NULL THEN {$paymentAlias}.amount
            ELSE {$paymentAlias}.amount * COALESCE(LEAST((
                SELECT SUM(visible_line.line_total)
                 FROM invoice_items visible_line
                 WHERE visible_line.invoice_id = {$paymentAlias}.invoice_id
                   AND visible_line.tax_treatment = 'taxable'
            ) / NULLIF((
                SELECT paid_invoice.grand_total
                  FROM invoices paid_invoice
                 WHERE paid_invoice.id = {$paymentAlias}.invoice_id
            ), 0), 1), 0)
        END";
    }

    private static function paymentVisibleSql(string $paymentAlias): string
    {
        return "(
            {$paymentAlias}.invoice_id IS NULL
            OR COALESCE((
                SELECT SUM(visible_line.line_total)
                 FROM invoice_items visible_line
                 WHERE visible_line.invoice_id = {$paymentAlias}.invoice_id
                   AND visible_line.tax_treatment = 'taxable'
            ), 0) > 0
        )";
    }
}
