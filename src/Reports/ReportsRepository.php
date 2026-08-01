<?php

declare(strict_types=1);

namespace CRM\Reports;

use CRM\Database\Database;
use CRM\Support\GstVisibility;

/**
 * Reports aggregation. Every tab takes a [from,to] window.
 * Tabs: revenue | expenses | customers | inventory.
 *
 * Money truths: billed = finalised invoices (status='final'; draft/cancelled never count),
 * collected = invoice_payments (bounced cheques and cancelled receipts excluded),
 * spend = expenses. Reversal rows are netted in the inventory tab.
 */
final class ReportsRepository
{
    private const CLEARED = "(p.payment_mode <> 'cheque' OR p.cheque_status <> 'bounced' OR p.cheque_status IS NULL) AND p.status <> 'cancelled'";
    /** A finalised bill that is not fully settled — the only thing that can be "outstanding". */
    private const UNSETTLED = "status = 'final' AND paid_amount < grand_total";

    // ---------------------------------------------------------------- Tab 1: Revenue
    public static function revenue(string $from, string $to, bool $gstVisibleOnly = false): array
    {
        $invoiceAmountSql = GstVisibility::invoiceAmountSql('invoices', $gstVisibleOnly);
        $invoiceBalanceSql = GstVisibility::invoiceBalanceSql('invoices', $gstVisibleOnly);
        $invoiceVisibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::invoiceVisibleSql('invoices') : '';
        $paymentAmountSql = GstVisibility::paymentAmountSql('p', $gstVisibleOnly);
        $paymentVisibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::paymentVisibleSql('p') : '';
        $metalMaking = $gstVisibleOnly
            ? Database::fetchAll(
                "SELECT DATE_FORMAT(i.invoice_date,'%Y-%m') AS month,
                        COALESCE(SUM(ii.metal_value),0) AS metal,
                        COALESCE(SUM(ii.making_charge),0) AS making,
                        0 AS old_metal
                 FROM invoice_items ii
                 JOIN invoices i ON i.id = ii.invoice_id
                 WHERE i.status = 'final'
                   AND i.invoice_date BETWEEN :from AND :to
                   AND " . GstVisibility::lineVisibleSql('ii') . "
                 GROUP BY month ORDER BY month",
                ['from' => $from, 'to' => $to]
            )
            : Database::fetchAll(
                "SELECT DATE_FORMAT(invoice_date,'%Y-%m') AS month,
                        COALESCE(SUM(metal_total),0) AS metal, COALESCE(SUM(making_total),0) AS making,
                        COALESCE(SUM(old_metal_value),0) AS old_metal
                 FROM invoices WHERE status = 'final' AND invoice_date BETWEEN :from AND :to
                 GROUP BY month ORDER BY month",
                ['from' => $from, 'to' => $to]
            );

        return [
            'trend' => Database::fetchAll(
                "SELECT m, SUM(billed) billed, SUM(collected) collected FROM (
                    SELECT DATE_FORMAT(invoice_date,'%Y-%m') m, {$invoiceAmountSql} billed, 0 collected FROM invoices WHERE status = 'final' AND invoice_date BETWEEN :f1 AND :t1{$invoiceVisibilitySql}
                    UNION ALL
                    SELECT DATE_FORMAT(p.payment_date,'%Y-%m') m, 0, {$paymentAmountSql} FROM invoice_payments p WHERE " . self::CLEARED . " AND p.payment_date BETWEEN :f2 AND :t2{$paymentVisibilitySql}
                 ) x GROUP BY m ORDER BY m",
                ['f1' => $from, 't1' => $to, 'f2' => $from, 't2' => $to]
            ),
            'metal_making' => $metalMaking,
            'aging' => Database::fetchOne(
                "SELECT
                    COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, invoice_date)) <= 30 THEN {$invoiceBalanceSql} ELSE 0 END),0) AS d0_30,
                    COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, invoice_date)) BETWEEN 31 AND 60 THEN {$invoiceBalanceSql} ELSE 0 END),0) AS d31_60,
                    COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, invoice_date)) BETWEEN 61 AND 90 THEN {$invoiceBalanceSql} ELSE 0 END),0) AS d61_90,
                    COALESCE(SUM(CASE WHEN DATEDIFF(CURDATE(), COALESCE(due_date, invoice_date)) > 90 THEN {$invoiceBalanceSql} ELSE 0 END),0) AS d90p
                 FROM invoices WHERE status = 'final' AND {$invoiceBalanceSql} > 0.01{$invoiceVisibilitySql}"
            ),
            'by_mode' => Database::fetchAll(
                "SELECT p.payment_mode AS mode, SUM({$paymentAmountSql}) AS total FROM invoice_payments p
                 WHERE " . self::CLEARED . " AND p.payment_date BETWEEN :from AND :to{$paymentVisibilitySql} GROUP BY p.payment_mode HAVING total > 0 ORDER BY total DESC",
                ['from' => $from, 'to' => $to]
            ),
            'top_customers' => Database::fetchAll(
                "SELECT c.name, SUM({$paymentAmountSql}) AS revenue FROM invoice_payments p
                 LEFT JOIN invoices i ON i.id = p.invoice_id
                 JOIN customers c ON c.id = COALESCE(p.customer_id, i.customer_id)
                 WHERE " . self::CLEARED . " AND p.payment_date BETWEEN :from AND :to{$paymentVisibilitySql} GROUP BY c.id HAVING revenue > 0 ORDER BY revenue DESC LIMIT 10",
                ['from' => $from, 'to' => $to]
            ),
            'tax_summary' => Database::fetchAll(
                "SELECT ii.tax_rate,
                        SUM(ii.tax_amount) AS tax, SUM(ii.cgst) AS cgst, SUM(ii.sgst) AS sgst, SUM(ii.igst) AS igst
                 FROM invoice_items ii
                 JOIN invoices i ON i.id = ii.invoice_id WHERE i.status = 'final' AND i.invoice_date BETWEEN :from AND :to
                 AND ii.tax_rate > 0" . ($gstVisibleOnly ? ' AND ' . GstVisibility::lineVisibleSql('ii') : '') . ' GROUP BY ii.tax_rate ORDER BY ii.tax_rate',
                ['from' => $from, 'to' => $to]
            ),
        ];
    }

    // ---------------------------------------------------------------- Tab 2: Expenses / P&L
    public static function expenses(string $from, string $to, bool $gstVisibleOnly = false): array
    {
        $paymentAmountSql = GstVisibility::paymentAmountSql('p', $gstVisibleOnly);
        $paymentVisibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::paymentVisibleSql('p') : '';
        $pl = Database::fetchAll(
            "SELECT m, SUM(revenue) revenue, SUM(expense) expense FROM (
                SELECT DATE_FORMAT(p.payment_date,'%Y-%m') m, {$paymentAmountSql} revenue, 0 expense FROM invoice_payments p WHERE " . self::CLEARED . " AND p.payment_date BETWEEN :f1 AND :t1{$paymentVisibilitySql}
                UNION ALL
                SELECT DATE_FORMAT(expense_date,'%Y-%m') m, 0, amount FROM expenses WHERE expense_date BETWEEN :f2 AND :t2
             ) x GROUP BY m ORDER BY m",
            ['f1' => $from, 't1' => $to, 'f2' => $from, 't2' => $to]
        );
        return [
            'pl_trend' => $pl,
            'by_category' => Database::fetchAll(
                'SELECT c.name, SUM(e.amount) AS total FROM expenses e JOIN expense_categories c ON c.id = e.category_id
                 WHERE e.expense_date BETWEEN :from AND :to GROUP BY c.id ORDER BY total DESC LIMIT 12',
                ['from' => $from, 'to' => $to]
            ),
            'fixed_variable' => Database::fetchAll(
                "SELECT type, SUM(amount) AS total FROM expenses WHERE expense_date BETWEEN :from AND :to GROUP BY type",
                ['from' => $from, 'to' => $to]
            ),
            'totals' => Database::fetchOne(
                "SELECT
                    (SELECT COALESCE(SUM({$paymentAmountSql}),0) FROM invoice_payments p WHERE " . self::CLEARED . " AND p.payment_date BETWEEN :f AND :t{$paymentVisibilitySql}) AS revenue,
                    (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date BETWEEN :f2 AND :t2) AS expense",
                ['f' => $from, 't' => $to, 'f2' => $from, 't2' => $to]
            ),
        ];
    }

    // ---------------------------------------------------------------- Tab 3: Customers
    // $withRevenue: only true when the caller also holds invoices.read (revenue is invoice money).
    public static function customers(string $from, string $to, bool $withRevenue = false, bool $gstVisibleOnly = false): array
    {
        $invoiceVisibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::invoiceVisibleSql('i') : '';
        $paymentAmountSql = GstVisibility::paymentAmountSql('p', $gstVisibleOnly);
        $paymentVisibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::paymentVisibleSql('p') : '';
        $topCustomers = $withRevenue
            ? Database::fetchAll(
                "SELECT c.name,
                        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id AND i.status = 'final'
                                  AND i.invoice_date BETWEEN :f1 AND :t1{$invoiceVisibilitySql}),0) AS bills,
                        COALESCE((SELECT SUM({$paymentAmountSql}) FROM invoice_payments p LEFT JOIN invoices i ON i.id = p.invoice_id
                                  WHERE COALESCE(p.customer_id, i.customer_id) = c.id
                                    AND p.payment_date BETWEEN :f2 AND :t2 AND " . self::CLEARED . "{$paymentVisibilitySql}),0) AS revenue
                 FROM customers c
                 ORDER BY revenue DESC, bills DESC LIMIT 10",
                ['f1' => $from, 't1' => $to, 'f2' => $from, 't2' => $to]
            )
            : Database::fetchAll(
                "SELECT c.name,
                        COALESCE((SELECT COUNT(*) FROM invoices i WHERE i.customer_id = c.id AND i.status = 'final'
                                  AND i.invoice_date BETWEEN :f1 AND :t1{$invoiceVisibilitySql}),0) AS bills,
                        0 AS revenue
                 FROM customers c
                 ORDER BY bills DESC LIMIT 10",
                ['f1' => $from, 't1' => $to]
            );
        return [
            'new_customers' => Database::fetchAll(
                "SELECT DATE_FORMAT(created_at,'%Y-%m') AS month, COUNT(*) AS count
                 FROM customers WHERE created_at BETWEEN :from AND :to GROUP BY month ORDER BY month",
                ['from' => $from . ' 00:00:00', 'to' => $to . ' 23:59:59']
            ),
            'by_stage' => Database::fetchAll(
                'SELECT stage, COUNT(*) AS count FROM customers GROUP BY stage ORDER BY count DESC'
            ),
            'top_customers' => $topCustomers,
            'with_revenue' => $withRevenue,
        ];
    }

    // ---------------------------------------------------------------- Tab 4: Inventory
    public static function inventory(string $from, string $to, bool $gstVisibleOnly = false): array
    {
        $movementVisibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::stockMovementVisibleSql('inventory_transactions') : '';
        return [
            'valuation' => Database::fetchAll(
                "SELECT item_type, COALESCE(SUM(current_stock * avg_cost),0) AS value, COUNT(*) AS items
                 FROM inventory_items WHERE is_active = 1 GROUP BY item_type"
            ),
            'by_metal' => Database::fetchAll(
                "SELECT COALESCE(i.metal,'other') AS metal, COALESCE(pu.code,'—') AS purity,
                        ROUND(COALESCE(SUM(i.net_weight * i.current_stock),0),3) AS net_weight,
                        ROUND(COALESCE(SUM(i.current_stock * i.avg_cost),0),2) AS value
                 FROM inventory_items i LEFT JOIN purities pu ON pu.id = i.purity_id
                 WHERE i.is_active = 1 AND i.status = 'in_stock'
                 GROUP BY i.metal, pu.id ORDER BY value DESC"
            ),
            // net outs against ins so cancelled docs don't inflate movement
            'movement' => Database::fetchAll(
                "SELECT DATE_FORMAT(created_at,'%Y-%m') AS month,
                        COALESCE(SUM(CASE WHEN type='in' THEN 1 ELSE -1 END * CASE WHEN value > 0 THEN value ELSE qty*unit_cost END),0) AS net_value,
                        COALESCE(SUM(CASE WHEN type='in' THEN 1 ELSE -1 END * weight),0) AS net_weight
                 FROM inventory_transactions WHERE created_at BETWEEN :from AND :to{$movementVisibilitySql}
                 GROUP BY month ORDER BY month",
                ['from' => $from . ' 00:00:00', 'to' => $to . ' 23:59:59']
            ),
            'by_vendor' => Database::fetchAll(
                "SELECT COALESCE(v.name,'—') AS name, COUNT(*) AS items, COALESCE(SUM(i.purchase_price),0) AS spend
                 FROM inventory_items i LEFT JOIN suppliers v ON v.id = i.vendor_id
                 WHERE i.is_active = 1 GROUP BY v.id ORDER BY spend DESC LIMIT 10"
            ),
            'dead_stock' => Database::fetchAll(
                "SELECT i.item_code, i.name, i.current_stock, ROUND(i.current_stock*i.avg_cost,2) AS value
                 FROM inventory_items i
                 WHERE i.is_active = 1 AND i.current_stock > 0
                   AND NOT EXISTS (SELECT 1 FROM inventory_transactions t WHERE t.item_id = i.id AND t.created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY))
                 ORDER BY value DESC LIMIT 10"
            ),
        ];
    }
}
