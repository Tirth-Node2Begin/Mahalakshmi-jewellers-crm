<?php

declare(strict_types=1);

namespace CRM\Jewellery;

use CRM\Database\Database;

/** Read side of billing: lists, detail, print payload, counter lookups. */
final class BillingRepository
{
    /** @param array{status?:?string, from?:?string, to?:?string, customer_id?:?int, search?:?string} $filters */
    public static function list(array $filters = [], int $limit = 100): array
    {
        $sql = "SELECT i.id, i.invoice_no, i.invoice_date, i.status, i.grand_total, i.paid_amount,
                       i.old_metal_value, i.customer_id, i.walkin_name, i.walkin_phone,
                       COALESCE(c.name, i.walkin_name, 'Walk-in') AS customer_name,
                       c.mobile AS customer_mobile,
                       u.full_name AS created_by_name,
                       (i.grand_total - i.paid_amount) AS balance_due
                  FROM invoices i
             LEFT JOIN customers c ON c.id = i.customer_id
             LEFT JOIN users u ON u.id = i.created_by
                 WHERE 1 = 1";
        $params = [];

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
    public static function heldBills(int $userId): array
    {
        return Database::fetchAll(
            "SELECT i.id, i.invoice_date, i.grand_total,
                    COALESCE(c.name, i.walkin_name, 'Walk-in') AS customer_name,
                    (SELECT COUNT(*) FROM invoice_items WHERE invoice_id = i.id) AS line_count,
                    i.updated_at
               FROM invoices i
          LEFT JOIN customers c ON c.id = i.customer_id
              WHERE i.status = 'draft' AND i.created_by = :u
              ORDER BY i.updated_at DESC",
            ['u' => $userId]
        );
    }

    /** Full bill with lines, exchange rows and receipts. */
    public static function detail(int $invoiceId, bool $includeCost = false): ?array
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

        $costColumn = $includeCost ? 'ii.cost_value,' : '';
        $invoice['items'] = Database::fetchAll(
            "SELECT ii.id, ii.inventory_item_id, ii.item_type, ii.description, ii.purity_code,
                    ii.qty, ii.gross_weight, ii.net_weight, ii.rate_per_gram, ii.metal_value,
                    ii.making_charge, ii.discount, ii.tax_rate, ii.tax_treatment, ii.exempt_reason,
                    ii.tax_amount, ii.cgst, ii.sgst, ii.igst, ii.line_total, {$costColumn}
                    it.item_code, it.huid, it.hsn_code, it.metal
               FROM invoice_items ii
          LEFT JOIN inventory_items it ON it.id = ii.inventory_item_id
              WHERE ii.invoice_id = :id
              ORDER BY ii.id",
            ['id' => $invoiceId]
        );

        $invoice['old_metal'] = Database::fetchAll(
            'SELECT om.*, p.code AS purity_code
               FROM invoice_old_metal om
          LEFT JOIN purities p ON p.id = om.purity_id
              WHERE om.invoice_id = :id ORDER BY om.id',
            ['id' => $invoiceId]
        );

        $invoice['payments'] = Database::fetchAll(
            "SELECT ip.id, ip.receipt_no, ip.amount, ip.payment_date, ip.payment_mode,
                    ip.cheque_number, ip.status, b.account_name
               FROM invoice_payments ip
          LEFT JOIN bank_accounts b ON b.id = ip.bank_account_id
              WHERE ip.invoice_id = :id AND ip.status = 'active'
              ORDER BY ip.id",
            ['id' => $invoiceId]
        );

        // tax summary per rate — the block a GST invoice must print
        $invoice['tax_summary'] = Database::fetchAll(
            'SELECT tax_rate, tax_treatment,
                    SUM(metal_value + making_charge - discount) AS taxable_value,
                    SUM(cgst) AS cgst, SUM(sgst) AS sgst, SUM(igst) AS igst
               FROM invoice_items WHERE invoice_id = :id
              GROUP BY tax_rate, tax_treatment',
            ['id' => $invoiceId]
        );

        return $invoice;
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

    /** Type-ahead search for the billing screen. */
    public static function searchItems(string $term, int $limit = 20): array
    {
        $like = '%' . $term . '%';
        return Database::fetchAll(
            "SELECT i.id, i.item_code, i.name, i.metal, i.tracking, i.status,
                    i.gross_weight, i.net_weight, i.making_type, i.making_value,
                    i.huid, i.barcode, i.purity_id, p.code AS purity_code
               FROM inventory_items i
          LEFT JOIN purities p ON p.id = i.purity_id
              WHERE i.is_active = 1
                AND (i.tracking = 'bulk' OR i.status = 'in_stock')
                AND (i.item_code LIKE :q1 OR i.name LIKE :q2 OR i.barcode LIKE :q3 OR i.huid LIKE :q4)
              ORDER BY i.name
              LIMIT " . max(1, min(50, $limit)),
            ['q1' => $like, 'q2' => $like, 'q3' => $like, 'q4' => $like]
        );
    }

    /** Sales register for a period — feeds the report and the GST summary. */
    public static function salesRegister(string $from, string $to): array
    {
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

    /**
     * GST summary split by treatment — taxable turnover by rate alongside
     * exempt / nil-rated / non-GST, so the CA sees the whole picture at once.
     */
    public static function gstSummary(string $from, string $to): array
    {
        $outward = Database::fetchAll(
            "SELECT ii.tax_treatment, ii.tax_rate,
                    SUM(ii.metal_value + ii.making_charge - ii.discount) AS taxable_value,
                    SUM(ii.cgst) AS cgst, SUM(ii.sgst) AS sgst, SUM(ii.igst) AS igst,
                    COUNT(DISTINCT ii.invoice_id) AS bills
               FROM invoice_items ii
               JOIN invoices i ON i.id = ii.invoice_id
              WHERE i.status = 'final' AND i.invoice_date BETWEEN :from AND :to
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
}
