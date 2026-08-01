<?php

declare(strict_types=1);

namespace CRM\Jewellery;

use CRM\Database\Database;
use CRM\Support\GstVisibility;

/** Read side of billing: lists, detail, print payload, counter lookups. */
final class BillingRepository
{
    /** @param array{status?:?string, from?:?string, to?:?string, customer_id?:?int, search?:?string} $filters */
    public static function list(array $filters = [], int $limit = 100, bool $gstVisibleOnly = false): array
    {
        $grandTotalSql = GstVisibility::invoiceAmountSql('i', $gstVisibleOnly);
        $paidAmountSql = GstVisibility::invoicePaidSql('i', $gstVisibleOnly);
        $balanceSql = GstVisibility::invoiceBalanceSql('i', $gstVisibleOnly);
        $oldMetalSql = $gstVisibleOnly ? '0' : 'i.old_metal_value';

        $sql = "SELECT i.id, i.invoice_no, i.invoice_date, i.status,
                       {$oldMetalSql} AS old_metal_value, i.customer_id, i.walkin_name, i.walkin_phone,
                       COALESCE(c.name, i.walkin_name, 'Walk-in') AS customer_name,
                       c.mobile AS customer_mobile,
                       u.full_name AS created_by_name,
                       {$grandTotalSql} AS grand_total,
                       {$paidAmountSql} AS paid_amount,
                       {$balanceSql} AS balance_due
                  FROM invoices i
             LEFT JOIN customers c ON c.id = i.customer_id
             LEFT JOIN users u ON u.id = i.created_by
                 WHERE 1 = 1";
        $params = [];

        if ($gstVisibleOnly) {
            $sql .= " AND (NOT EXISTS (SELECT 1 FROM invoice_items hidden_check WHERE hidden_check.invoice_id = i.id)
                    OR " . GstVisibility::invoiceVisibleSql('i') . ')';
        }

        if (!empty($filters['status'])) {
            $sql .= ' AND i.status = :status';
            $params['status'] = $filters['status'];
        }
        if (!empty($filters['from'])) {
            $sql .= ' AND i.invoice_date >= :from';
            $params['from'] = $filters['from'];
        }
        if (!empty($filters['to'])) {
            $sql .= ' AND i.invoice_date <= :to';
            $params['to'] = $filters['to'];
        }
        if (!empty($filters['customer_id'])) {
            $sql .= ' AND i.customer_id = :cid';
            $params['cid'] = (int) $filters['customer_id'];
        }
        if (!empty($filters['search'])) {
            $sql .= ' AND (i.invoice_no LIKE :q OR c.name LIKE :q2 OR c.mobile LIKE :q3 OR i.walkin_name LIKE :q4)';
            $like = '%' . $filters['search'] . '%';
            $params['q'] = $like;
            $params['q2'] = $like;
            $params['q3'] = $like;
            $params['q4'] = $like;
        }

        $sql .= ' ORDER BY i.invoice_date DESC, i.id DESC LIMIT ' . max(1, min(500, $limit));
        return Database::fetchAll($sql, $params);
    }

    /** Drafts belonging to one user — the "held bills" tray at the counter. */
    public static function heldBills(int $userId, bool $gstVisibleOnly = false): array
    {
        $grandTotalSql = GstVisibility::invoiceAmountSql('i', $gstVisibleOnly);
        $lineVisibility = $gstVisibleOnly ? ' AND ' . GstVisibility::lineVisibleSql('line_count') : '';
        $draftVisibility = $gstVisibleOnly
            ? " AND (NOT EXISTS (SELECT 1 FROM invoice_items hidden_check WHERE hidden_check.invoice_id = i.id)
                    OR " . GstVisibility::invoiceVisibleSql('i') . ')'
            : '';

        return Database::fetchAll(
            "SELECT i.id, i.invoice_date, {$grandTotalSql} AS grand_total,
                    COALESCE(c.name, i.walkin_name, 'Walk-in') AS customer_name,
                    (SELECT COUNT(*) FROM invoice_items line_count WHERE line_count.invoice_id = i.id{$lineVisibility}) AS line_count,
                    i.updated_at
               FROM invoices i
          LEFT JOIN customers c ON c.id = i.customer_id
              WHERE i.status = 'draft' AND i.created_by = :u{$draftVisibility}
              ORDER BY i.updated_at DESC",
            ['u' => $userId]
        );
    }

    /** Full bill with lines, exchange rows and receipts. */
    public static function detail(int $invoiceId, bool $includeCost = false, bool $gstVisibleOnly = false): ?array
    {
        $invoice = Database::fetchOne(
            "SELECT i.*, c.name AS customer_name, c.mobile AS customer_mobile, c.address AS customer_address,
                    c.gstin AS customer_gstin, u.full_name AS created_by_name,
                    v.voucher_no
               FROM invoices i
          LEFT JOIN customers c ON c.id = i.customer_id
          LEFT JOIN users u ON u.id = i.created_by
          LEFT JOIN vouchers v ON v.id = i.voucher_id
              WHERE i.id = :id",
            ['id' => $invoiceId]
        );
        if ($invoice === null) {
            return null;
        }
        if ($gstVisibleOnly) {
            $visibility = Database::fetchOne(
                'SELECT
                    (SELECT COUNT(*) FROM invoice_items all_line WHERE all_line.invoice_id = i.id) AS total_lines,
                    ' . GstVisibility::invoiceVisibleTotalSql('i') . ' AS visible_total
                   FROM invoices i WHERE i.id = :id',
                ['id' => $invoiceId]
            ) ?? ['total_lines' => 0, 'visible_total' => 0];
            if ((int) $visibility['total_lines'] > 0 && (float) $visibility['visible_total'] <= 0.005) {
                return null;
            }
        }

        $costColumn = $includeCost ? 'ii.cost_value,' : '';
        $itemVisibility = $gstVisibleOnly ? ' AND ' . GstVisibility::lineVisibleSql('ii') : '';
        $invoice['items'] = Database::fetchAll(
            "SELECT ii.id, ii.inventory_item_id, ii.item_type, ii.description, ii.purity_code,
                    ii.qty, ii.gross_weight, ii.net_weight, ii.rate_per_gram, ii.metal_value,
                    ii.making_charge, ii.discount, ii.tax_rate, ii.tax_treatment, ii.exempt_reason,
                    ii.tax_amount, ii.cgst, ii.sgst, ii.igst, ii.line_total, {$costColumn}
                    it.item_code, it.huid, it.hsn_code, it.metal
               FROM invoice_items ii
          LEFT JOIN inventory_items it ON it.id = ii.inventory_item_id
              WHERE ii.invoice_id = :id{$itemVisibility}
              ORDER BY ii.id",
            ['id' => $invoiceId]
        );

        if ($gstVisibleOnly) {
            self::applyGstVisibleTotals($invoice);
        }

        $invoice['old_metal'] = $gstVisibleOnly
            ? []
            : Database::fetchAll(
                'SELECT om.*, p.code AS purity_code
                   FROM invoice_old_metal om
              LEFT JOIN purities p ON p.id = om.purity_id
                  WHERE om.invoice_id = :id ORDER BY om.id',
                ['id' => $invoiceId]
            );

        $paymentAmountSql = GstVisibility::paymentAmountSql('ip', $gstVisibleOnly);
        $invoice['payments'] = Database::fetchAll(
            "SELECT ip.id, ip.receipt_no, ROUND({$paymentAmountSql}, 2) AS amount, ip.payment_date, ip.payment_mode,
                    ip.cheque_number, ip.status, b.account_name
               FROM invoice_payments ip
          LEFT JOIN bank_accounts b ON b.id = ip.bank_account_id
              WHERE ip.invoice_id = :id AND ip.status = 'active'
              ORDER BY ip.id",
            ['id' => $invoiceId]
        );

        // tax summary per rate — the block a GST invoice must print
        $taxVisibility = $gstVisibleOnly ? ' AND ' . GstVisibility::lineVisibleSql('invoice_items') : '';
        $invoice['tax_summary'] = Database::fetchAll(
            'SELECT tax_rate, tax_treatment,
                    SUM(metal_value + making_charge - discount) AS taxable_value,
                    SUM(cgst) AS cgst, SUM(sgst) AS sgst, SUM(igst) AS igst
               FROM invoice_items WHERE invoice_id = :id' . $taxVisibility . '
              GROUP BY tax_rate, tax_treatment',
            ['id' => $invoiceId]
        );

        return $invoice;
    }

    private static function applyGstVisibleTotals(array &$invoice): void
    {
        $metal = 0.0;
        $making = 0.0;
        $discount = 0.0;
        $tax = 0.0;
        $cgst = 0.0;
        $sgst = 0.0;
        $igst = 0.0;
        $lineTotal = 0.0;

        foreach ($invoice['items'] as $item) {
            $metal += (float) $item['metal_value'];
            $making += (float) $item['making_charge'];
            $discount += (float) $item['discount'];
            $tax += (float) $item['tax_amount'];
            $cgst += (float) $item['cgst'];
            $sgst += (float) $item['sgst'];
            $igst += (float) $item['igst'];
            $lineTotal += (float) $item['line_total'];
        }

        $rawGrand = max(0.0, (float) $invoice['grand_total']);
        $rawPaid = max(0.0, (float) $invoice['paid_amount']);
        $visibleGrand = $rawGrand > 0 ? min($lineTotal, $rawGrand) : $lineTotal;
        $visiblePaid = $rawGrand > 0 ? $rawPaid * ($visibleGrand / $rawGrand) : 0.0;

        $invoice['subtotal'] = round($metal + $making, 2);
        $invoice['metal_total'] = round($metal, 2);
        $invoice['making_total'] = round($making, 2);
        $invoice['discount_total'] = round($discount, 2);
        $invoice['tax_total'] = round($tax, 2);
        $invoice['cgst'] = round($cgst, 2);
        $invoice['sgst'] = round($sgst, 2);
        $invoice['igst'] = round($igst, 2);
        $invoice['old_metal_value'] = 0.0;
        $invoice['round_off'] = 0.0;
        $invoice['grand_total'] = round($visibleGrand, 2);
        $invoice['paid_amount'] = round($visiblePaid, 2);
    }

    /**
     * Counter lookup: find a sellable item by tag code, barcode or HUID.
     * Only ever returns pieces that are actually in stock.
     */
    public static function lookupItem(string $term): ?array
    {
        return Database::fetchOne(
            "SELECT i.id, i.item_code, i.name, i.metal, i.tracking, i.status,
                    i.gross_weight, i.net_weight, i.stone_weight, i.making_type, i.making_value,
                    i.huid, i.hsn_code, i.barcode, i.purity_id, p.code AS purity_code
               FROM inventory_items i
          LEFT JOIN purities p ON p.id = i.purity_id
              WHERE i.is_active = 1
                AND (i.item_code = :t1 OR i.barcode = :t2 OR i.huid = :t3)
                AND (i.tracking = 'bulk' OR i.status = 'in_stock')
              LIMIT 1",
            ['t1' => $term, 't2' => $term, 't3' => $term]
        );
    }

    /**
     * Type-ahead search for the billing screen.
     *
     * An empty term is valid and returns the first items by name — the search
     * box doubles as a browse list, so the counter can pick from a dropdown
     * without knowing what to type. `$categoryId` narrows to one category
     * (Ring, Chain, …) for the same reason.
     */
    public static function searchItems(string $term, ?int $categoryId = null, int $limit = 20): array
    {
        $like = '%' . $term . '%';
        $params = ['q1' => $like, 'q2' => $like, 'q3' => $like, 'q4' => $like];
        $categoryFilter = '';
        if ($categoryId !== null) {
            $categoryFilter = ' AND i.category_id = :category_id';
            $params['category_id'] = $categoryId;
        }
        return Database::fetchAll(
            "SELECT i.id, i.item_code, i.name, i.metal, i.tracking, i.status,
                    i.gross_weight, i.net_weight, i.making_type, i.making_value,
                    i.huid, i.barcode, i.purity_id, p.code AS purity_code,
                    i.category_id, c.name AS category_name
               FROM inventory_items i
          LEFT JOIN purities p ON p.id = i.purity_id
          LEFT JOIN inventory_categories c ON c.id = i.category_id
              WHERE i.is_active = 1
                AND (i.tracking = 'bulk' OR i.status = 'in_stock')
                AND (i.item_code LIKE :q1 OR i.name LIKE :q2 OR i.barcode LIKE :q3 OR i.huid LIKE :q4)
                {$categoryFilter}
              ORDER BY i.name
              LIMIT " . max(1, min(50, $limit)),
            $params
        );
    }

    /**
     * Categories that actually hold something sellable right now — feeds the
     * filter chips on the billing item search. A category whose pieces are all
     * sold would only be a dead button, so it is left out.
     */
    public static function saleCategories(): array
    {
        return Database::fetchAll(
            "SELECT DISTINCT c.id, c.name
               FROM inventory_categories c
               JOIN inventory_items i ON i.category_id = c.id
              WHERE i.is_active = 1
                AND (i.tracking = 'bulk' OR i.status = 'in_stock')
              ORDER BY c.name"
        );
    }

    /** Sales register for a period — feeds the report and the GST summary. */
    public static function salesRegister(string $from, string $to, bool $gstVisibleOnly = false): array
    {
        if ($gstVisibleOnly) {
            return Database::fetchAll(
                "SELECT i.id, i.invoice_no, i.invoice_date,
                        COALESCE(c.name, i.walkin_name, 'Walk-in') AS customer_name,
                        c.gstin AS customer_gstin,
                        SUM(ii.metal_value) AS metal_total,
                        SUM(ii.making_charge) AS making_total,
                        SUM(ii.discount) AS discount_total,
                        SUM(ii.cgst) AS cgst,
                        SUM(ii.sgst) AS sgst,
                        SUM(ii.igst) AS igst,
                        SUM(ii.tax_amount) AS tax_total,
                        0 AS old_metal_value,
                        LEAST(SUM(ii.line_total), i.grand_total) AS grand_total
                   FROM invoice_items ii
                   JOIN invoices i ON i.id = ii.invoice_id
              LEFT JOIN customers c ON c.id = i.customer_id
                  WHERE i.status = 'final'
                    AND i.invoice_date BETWEEN :from AND :to
                    AND " . GstVisibility::lineVisibleSql('ii') . "
                  GROUP BY i.id, i.invoice_no, i.invoice_date, customer_name, c.gstin, i.grand_total
                  ORDER BY i.invoice_date, i.id",
                ['from' => $from, 'to' => $to]
            );
        }

        return Database::fetchAll(
            "SELECT i.id, i.invoice_no, i.invoice_date,
                    COALESCE(c.name, i.walkin_name, 'Walk-in') AS customer_name,
                    c.gstin AS customer_gstin,
                    i.metal_total, i.making_total, i.discount_total,
                    i.cgst, i.sgst, i.igst, i.tax_total, i.old_metal_value, i.grand_total
               FROM invoices i
          LEFT JOIN customers c ON c.id = i.customer_id
              WHERE i.status = 'final' AND i.invoice_date BETWEEN :from AND :to
              ORDER BY i.invoice_date, i.id",
            ['from' => $from, 'to' => $to]
        );
    }

    /** GST summary split by treatment; GST-only users do not see Non GST lines. */
    public static function gstSummary(string $from, string $to, bool $gstVisibleOnly = false): array
    {
        $outwardVisibility = $gstVisibleOnly ? ' AND ' . GstVisibility::lineVisibleSql('ii') : '';
        $outward = Database::fetchAll(
            "SELECT ii.tax_treatment, ii.tax_rate,
                    SUM(ii.metal_value + ii.making_charge - ii.discount) AS taxable_value,
                    SUM(ii.cgst) AS cgst, SUM(ii.sgst) AS sgst, SUM(ii.igst) AS igst,
                    COUNT(DISTINCT ii.invoice_id) AS bills
               FROM invoice_items ii
               JOIN invoices i ON i.id = ii.invoice_id
              WHERE i.status = 'final' AND i.invoice_date BETWEEN :from AND :to{$outwardVisibility}
              GROUP BY ii.tax_treatment, ii.tax_rate
              ORDER BY ii.tax_treatment, ii.tax_rate",
            ['from' => $from, 'to' => $to]
        );

        $inward = Database::fetchAll(
            "SELECT p.purchase_date, SUM(p.subtotal) AS taxable_value,
                    SUM(p.cgst) AS cgst, SUM(p.sgst) AS sgst, SUM(p.igst) AS igst
               FROM purchases p
              WHERE p.status <> 'cancelled' AND p.purchase_date BETWEEN :from AND :to
              GROUP BY p.purchase_date",
            ['from' => $from, 'to' => $to]
        );

        $outputTax = 0.0;
        $turnover = 0.0;
        foreach ($outward as $row) {
            $outputTax += (float) $row['cgst'] + (float) $row['sgst'] + (float) $row['igst'];
            $turnover += (float) $row['taxable_value'];
        }
        $inputTax = 0.0;
        foreach ($inward as $row) {
            $inputTax += (float) $row['cgst'] + (float) $row['sgst'] + (float) $row['igst'];
        }

        return [
            'outward' => $outward,
            'inward' => $inward,
            'total_turnover' => round($turnover, 2),
            'output_tax' => round($outputTax, 2),
            'input_tax' => round($inputTax, 2),
            'net_payable' => round($outputTax - $inputTax, 2),
        ];
    }

    /**
     * Role-aware ledger projection for the reporting UI.
     *
     * full: every sale and purchase line.
     * gst: GST-facing rows only; hidden sale movement is applied as a purchase-side
     *      stock balance adjustment without mutating the source ledger.
     */
    public static function ledgerView(string $from, string $to, string $view): array
    {
        $gstOnly = $view === 'gst';
        $purchases = self::ledgerPurchases($from, $to, $gstOnly);
        if ($gstOnly) {
            $purchases = self::applyGstPurchaseProjectionAdjustment($purchases, $from, $to);
        }

        return [
            'view' => $gstOnly ? 'gst' : 'full',
            'sales' => self::ledgerSales($from, $to, $gstOnly),
            'purchases' => $purchases,
            'stock' => self::ledgerStock($from, $to, $gstOnly),
        ];
    }

    private static function ledgerSales(string $from, string $to, bool $gstOnly): array
    {
        $visibility = $gstOnly ? ' AND ' . GstVisibility::lineVisibleSql('ii') : '';

        return Database::fetchAll(
            "SELECT i.id, i.invoice_no, i.invoice_date,
                    COALESCE(c.name, i.walkin_name, 'Walk-in') AS party_name,
                    GROUP_CONCAT(DISTINCT ii.tax_treatment ORDER BY ii.tax_treatment SEPARATOR ', ') AS tax_treatments,
                    SUM(ii.qty) AS qty,
                    SUM(ii.net_weight) AS weight,
                    SUM(ii.metal_value + ii.making_charge - ii.discount) AS taxable_value,
                    SUM(ii.cgst) AS cgst,
                    SUM(ii.sgst) AS sgst,
                    SUM(ii.igst) AS igst,
                    SUM(ii.tax_amount) AS tax_total,
                    SUM(ii.line_total) AS total
               FROM invoice_items ii
               JOIN invoices i ON i.id = ii.invoice_id
          LEFT JOIN customers c ON c.id = i.customer_id
              WHERE i.status = 'final'
                AND i.invoice_date BETWEEN :from AND :to{$visibility}
              GROUP BY i.id, i.invoice_no, i.invoice_date, party_name
              ORDER BY i.invoice_date, i.id",
            ['from' => $from, 'to' => $to]
        );
    }

    private static function ledgerPurchases(string $from, string $to, bool $gstOnly): array
    {
        $visibility = $gstOnly ? ' AND (pi.tax_rate > 0 OR pi.tax_amount > 0)' : '';

        return Database::fetchAll(
            "SELECT p.id, p.purchase_no, p.purchase_date, s.name AS party_name,
                    GROUP_CONCAT(
                        DISTINCT CASE WHEN pi.tax_rate > 0 OR pi.tax_amount > 0 THEN 'GST' ELSE 'No GST' END
                        ORDER BY pi.tax_rate DESC SEPARATOR ', '
                    ) AS tax_treatments,
                    SUM(pi.qty) AS qty,
                    SUM(pi.weight) AS weight,
                    SUM(pi.line_total - pi.tax_amount) AS taxable_value,
                    SUM(pi.tax_amount) AS tax_total,
                    SUM(pi.line_total) AS total
               FROM purchase_items pi
               JOIN purchases p ON p.id = pi.purchase_id
               JOIN suppliers s ON s.id = p.supplier_id
              WHERE p.status <> 'cancelled'
                AND p.purchase_date BETWEEN :from AND :to{$visibility}
              GROUP BY p.id, p.purchase_no, p.purchase_date, s.name
              ORDER BY p.purchase_date, p.id",
            ['from' => $from, 'to' => $to]
        );
    }

    private static function applyGstPurchaseProjectionAdjustment(array $rows, string $from, string $to): array
    {
        $hiddenSales = self::saleStockBucket($from, $to, 'non_gst');
        if (
            abs((float) $hiddenSales['qty']) < 0.0005
            && abs((float) $hiddenSales['weight']) < 0.0005
            && abs((float) $hiddenSales['value']) < 0.005
        ) {
            return $rows;
        }

        $rows[] = [
            'id' => -1,
            'purchase_no' => 'STOCK-ADJ',
            'purchase_date' => $to,
            'party_name' => 'Stock balance adjustment',
            'tax_treatments' => 'GST view',
            'qty' => -1 * (float) $hiddenSales['qty'],
            'weight' => -1 * (float) $hiddenSales['weight'],
            'taxable_value' => -1 * (float) $hiddenSales['value'],
            'tax_total' => 0.0,
            'total' => -1 * (float) $hiddenSales['value'],
            'is_adjustment' => true,
        ];

        return $rows;
    }

    private static function ledgerStock(string $from, string $to, bool $gstOnly): array
    {
        $visiblePurchases = self::purchaseStockBucket($from, $to, $gstOnly ? 'gst' : 'all');
        $visibleSales = self::saleStockBucket($from, $to, $gstOnly ? 'gst' : 'all');
        $excludedPurchases = $gstOnly ? self::purchaseStockBucket($from, $to, 'non_gst') : self::emptyBucket();
        $excludedSales = $gstOnly ? self::saleStockBucket($from, $to, 'non_gst') : self::emptyBucket();
        $other = self::otherStockBucket($from, $to);

        if ($gstOnly) {
            $visiblePurchases = self::addBuckets(
                self::addBuckets($visiblePurchases, $excludedPurchases),
                self::negateBucket($excludedSales)
            );
            $excludedPurchases = self::emptyBucket();
            $excludedSales = self::emptyBucket();
        }

        $periodNet = self::addBuckets(
            $visiblePurchases,
            self::negateBucket($visibleSales),
            $excludedPurchases,
            self::negateBucket($excludedSales),
            $other
        );

        $liveBalance = self::bucket(Database::fetchOne(
            "SELECT
                    COALESCE(SUM(CASE WHEN type = 'in' THEN qty ELSE -qty END), 0) AS qty,
                    COALESCE(SUM(CASE WHEN type = 'in' THEN weight ELSE -weight END), 0) AS weight,
                    COALESCE(SUM(CASE WHEN type = 'in' THEN value ELSE -value END), 0) AS value
               FROM inventory_transactions
              WHERE DATE(created_at) <= :to",
            ['to' => $to]
        ));

        return [
            'visible_purchases' => $visiblePurchases,
            'visible_sales' => $visibleSales,
            'excluded_purchases' => $excludedPurchases,
            'excluded_sales' => $excludedSales,
            'other_movements' => $other,
            'period_net' => $periodNet,
            'live_balance' => $liveBalance,
        ];
    }

    private static function purchaseStockBucket(string $from, string $to, string $filter): array
    {
        $visibility = match ($filter) {
            'gst' => ' AND (pi.tax_rate > 0 OR pi.tax_amount > 0)',
            'non_gst' => ' AND NOT (pi.tax_rate > 0 OR pi.tax_amount > 0)',
            default => '',
        };

        return self::bucket(Database::fetchOne(
            "SELECT
                    COALESCE(SUM(pi.qty), 0) AS qty,
                    COALESCE(SUM(pi.weight), 0) AS weight,
                    COALESCE(SUM(pi.line_total - pi.tax_amount), 0) AS value
               FROM purchase_items pi
               JOIN purchases p ON p.id = pi.purchase_id
              WHERE p.status <> 'cancelled'
                AND pi.item_id IS NOT NULL
                AND p.purchase_date BETWEEN :from AND :to{$visibility}",
            ['from' => $from, 'to' => $to]
        ));
    }

    private static function saleStockBucket(string $from, string $to, string $filter): array
    {
        $visibility = match ($filter) {
            'gst' => ' AND ' . GstVisibility::lineVisibleSql('ii'),
            'non_gst' => ' AND ' . GstVisibility::lineHiddenSql('ii'),
            default => '',
        };

        return self::bucket(Database::fetchOne(
            "SELECT
                    COALESCE(SUM(ii.qty), 0) AS qty,
                    COALESCE(SUM(ii.net_weight), 0) AS weight,
                    COALESCE(SUM(ii.cost_value), 0) AS value
               FROM invoice_items ii
               JOIN invoices i ON i.id = ii.invoice_id
              WHERE i.status = 'final'
                AND ii.inventory_item_id IS NOT NULL
                AND i.invoice_date BETWEEN :from AND :to{$visibility}",
            ['from' => $from, 'to' => $to]
        ));
    }

    private static function otherStockBucket(string $from, string $to): array
    {
        return self::bucket(Database::fetchOne(
            "SELECT
                    COALESCE(SUM(CASE WHEN type = 'in' THEN qty ELSE -qty END), 0) AS qty,
                    COALESCE(SUM(CASE WHEN type = 'in' THEN weight ELSE -weight END), 0) AS weight,
                    COALESCE(SUM(CASE WHEN type = 'in' THEN value ELSE -value END), 0) AS value
               FROM inventory_transactions
              WHERE reason NOT IN ('purchase', 'sale')
                AND DATE(created_at) BETWEEN :from AND :to",
            ['from' => $from, 'to' => $to]
        ));
    }

    private static function bucket(?array $row): array
    {
        return [
            'qty' => round((float) ($row['qty'] ?? 0), 3),
            'weight' => round((float) ($row['weight'] ?? 0), 3),
            'value' => round((float) ($row['value'] ?? 0), 2),
        ];
    }

    private static function emptyBucket(): array
    {
        return ['qty' => 0.0, 'weight' => 0.0, 'value' => 0.0];
    }

    private static function negateBucket(array $bucket): array
    {
        return [
            'qty' => -1 * (float) ($bucket['qty'] ?? 0),
            'weight' => -1 * (float) ($bucket['weight'] ?? 0),
            'value' => -1 * (float) ($bucket['value'] ?? 0),
        ];
    }

    private static function addBuckets(array ...$buckets): array
    {
        $total = self::emptyBucket();
        foreach ($buckets as $bucket) {
            $total['qty'] += (float) ($bucket['qty'] ?? 0);
            $total['weight'] += (float) ($bucket['weight'] ?? 0);
            $total['value'] += (float) ($bucket['value'] ?? 0);
        }
        return [
            'qty' => round($total['qty'], 3),
            'weight' => round($total['weight'], 3),
            'value' => round($total['value'], 2),
        ];
    }
}
