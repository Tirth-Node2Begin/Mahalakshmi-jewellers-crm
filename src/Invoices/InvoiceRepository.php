<?php

declare(strict_types=1);

namespace CRM\Invoices;

use CRM\Auth\AuthUser;
use CRM\Database\Database;
use CRM\Support\GstVisibility;
use CRM\Support\ScopeSql;

final class InvoiceRepository
{
    public static function list(AuthUser $user, array $filters): array
    {
        $gstVisibleOnly = GstVisibility::restrictedUsername($user->username);
        $grandTotalSql = GstVisibility::invoiceAmountSql('i', $gstVisibleOnly);
        $paidAmountSql = GstVisibility::invoicePaidSql('i', $gstVisibleOnly);
        $balanceSql = GstVisibility::invoiceBalanceSql('i', $gstVisibleOnly);

        // sales (scope=own) see only invoices of their own customers
        [$scopeSql, $params] = ScopeSql::ownedVia($user, 'customers c', 'i.customer_id', 'i');
        $conditions = [$scopeSql];
        if ($gstVisibleOnly) {
            $conditions[] = "(NOT EXISTS (SELECT 1 FROM invoice_items hidden_check WHERE hidden_check.invoice_id = i.id) OR " . GstVisibility::invoiceVisibleSql('i') . ')';
        }

        if (!empty($filters['status'])) {
            $conditions[] = 'i.status = :f_status';
            $params['f_status'] = $filters['status'];
        }
        if (!empty($filters['customer_id'])) {
            $conditions[] = 'i.customer_id = :f_customer';
            $params['f_customer'] = (int) $filters['customer_id'];
        }
        if (!empty($filters['start_date'])) {
            $conditions[] = 'i.invoice_date >= :f_start';
            $params['f_start'] = $filters['start_date'];
        }
        if (!empty($filters['end_date'])) {
            $conditions[] = 'i.invoice_date <= :f_end';
            $params['f_end'] = $filters['end_date'];
        }
        if (!empty($filters['search'])) {
            $conditions[] = '(i.invoice_no LIKE :q1 OR c.name LIKE :q2)';
            $like = '%' . $filters['search'] . '%';
            $params += ['q1' => $like, 'q2' => $like];
        }
        if (!empty($filters['overdue'])) {
            $conditions[] = "i.due_date < CURDATE() AND i.status = 'final' AND {$balanceSql} > 0.01";
        }

        $where = implode(' AND ', $conditions);
        return Database::fetchAll(
            "SELECT i.*, {$grandTotalSql} AS grand_total, {$paidAmountSql} AS paid_amount,
                    {$balanceSql} AS balance_due,
                    " . ($gstVisibleOnly ? '0' : 'i.old_metal_value') . " AS old_metal_value,
                    c.name AS customer_name, c.customer_code
             FROM invoices i JOIN customers c ON c.id = i.customer_id
             WHERE $where
             ORDER BY i.invoice_date DESC, i.id DESC
             LIMIT 200",
            $params
        );
    }

    public static function stats(AuthUser $user): array
    {
        $gstVisibleOnly = GstVisibility::restrictedUsername($user->username);
        $grandTotalSql = GstVisibility::invoiceAmountSql('i', $gstVisibleOnly);
        $paidAmountSql = GstVisibility::invoicePaidSql('i', $gstVisibleOnly);
        $balanceSql = GstVisibility::invoiceBalanceSql('i', $gstVisibleOnly);
        $visibilitySql = $gstVisibleOnly
            ? ' AND (NOT EXISTS (SELECT 1 FROM invoice_items hidden_check WHERE hidden_check.invoice_id = i.id) OR ' . GstVisibility::invoiceVisibleSql('i') . ')'
            : '';
        [$scopeSql, $params] = ScopeSql::ownedVia($user, 'customers c', 'i.customer_id', 'i');
        $row = Database::fetchOne(
            "SELECT
                COALESCE(SUM(CASE WHEN i.status = 'final' THEN {$grandTotalSql} ELSE 0 END), 0) AS total_billed,
                COALESCE(SUM({$paidAmountSql}), 0) AS total_paid,
                COALESCE(SUM(CASE WHEN i.status = 'final' THEN {$balanceSql} ELSE 0 END), 0) AS outstanding,
                SUM(i.due_date < CURDATE() AND i.status = 'final' AND {$balanceSql} > 0.01) AS overdue_count,
                SUM(i.status = 'draft') AS draft_count,
                COALESCE(SUM(CASE WHEN DATE_FORMAT(i.invoice_date,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m') AND i.status = 'final' THEN {$grandTotalSql} ELSE 0 END), 0) AS this_month_billed
             FROM invoices i JOIN customers c ON c.id = i.customer_id
             WHERE $scopeSql{$visibilitySql}",
            $params
        ) ?? [];

        return [
            'total_billed' => round((float) ($row['total_billed'] ?? 0), 2),
            'total_paid' => round((float) ($row['total_paid'] ?? 0), 2),
            'outstanding' => round((float) ($row['outstanding'] ?? 0), 2),
            'overdue_count' => (int) ($row['overdue_count'] ?? 0),
            'draft_count' => (int) ($row['draft_count'] ?? 0),
            'this_month_billed' => round((float) ($row['this_month_billed'] ?? 0), 2),
        ];
    }

    public static function find(AuthUser $user, int $id): ?array
    {
        $gstVisibleOnly = GstVisibility::restrictedUsername($user->username);
        $grandTotalSql = GstVisibility::invoiceAmountSql('i', $gstVisibleOnly);
        $paidAmountSql = GstVisibility::invoicePaidSql('i', $gstVisibleOnly);
        $visibilitySql = $gstVisibleOnly
            ? ' AND (NOT EXISTS (SELECT 1 FROM invoice_items hidden_check WHERE hidden_check.invoice_id = i.id) OR ' . GstVisibility::invoiceVisibleSql('i') . ')'
            : '';
        [$scopeSql, $params] = ScopeSql::ownedVia($user, 'customers c', 'i.customer_id', 'i');
        return Database::fetchOne(
            "SELECT i.*, {$grandTotalSql} AS grand_total, {$paidAmountSql} AS paid_amount,
                    " . ($gstVisibleOnly ? '0' : 'i.old_metal_value') . " AS old_metal_value,
                    c.name AS customer_name, c.customer_code, c.company AS customer_company,
                    c.address AS customer_address, c.city AS customer_city, c.state AS customer_state,
                    c.gstin AS customer_gstin, c.mobile AS customer_mobile, c.email AS customer_email
             FROM invoices i JOIN customers c ON c.id = i.customer_id
             WHERE i.id = :id AND $scopeSql{$visibilitySql}",
            ['id' => $id] + $params
        );
    }

    public static function items(int $invoiceId): array
    {
        return Database::fetchAll('SELECT * FROM invoice_items WHERE invoice_id = :id ORDER BY sort_order, id', ['id' => $invoiceId]);
    }

    public static function payments(int $invoiceId): array
    {
        return Database::fetchAll(
            'SELECT p.*, b.account_name AS bank_name FROM invoice_payments p
             LEFT JOIN bank_accounts b ON b.id = p.bank_account_id
             WHERE p.invoice_id = :id ORDER BY p.payment_date, p.id',
            ['id' => $invoiceId]
        );
    }

    // -------------------------------------------------------- payments module

    /** Every payment across all bills, newest first (Payments module list). Scoped via the parent invoice's customer. */
    public static function allPayments(AuthUser $user, array $filters): array
    {
        $gstVisibleOnly = GstVisibility::restrictedUsername($user->username);
        [$scopeSql, $params] = ScopeSql::ownedVia($user, 'customers c', 'i.customer_id', 'i');
        // a cancelled receipt is money that never arrived
        $conditions = [$scopeSql, "p.status = 'active'"];
        if ($gstVisibleOnly) {
            $conditions[] = GstVisibility::paymentVisibleSql('p');
        }

        if (!empty($filters['payment_mode'])) {
            $conditions[] = 'p.payment_mode = :f_mode';
            $params['f_mode'] = $filters['payment_mode'];
        }
        if (!empty($filters['start_date'])) {
            $conditions[] = 'p.payment_date >= :f_start';
            $params['f_start'] = $filters['start_date'];
        }
        if (!empty($filters['end_date'])) {
            $conditions[] = 'p.payment_date <= :f_end';
            $params['f_end'] = $filters['end_date'];
        }
        if (!empty($filters['search'])) {
            $conditions[] = '(p.receipt_no LIKE :q1 OR i.invoice_no LIKE :q2 OR c.name LIKE :q3 OR pc.name LIKE :q4 OR i.walkin_name LIKE :q5)';
            $like = '%' . $filters['search'] . '%';
            $params += ['q1' => $like, 'q2' => $like, 'q3' => $like, 'q4' => $like, 'q5' => $like];
        }

        // LEFT JOINs throughout: a bill may be walk-in (no customer) and a
        // receipt may be on-account (no bill) — inner joins would hide both.
        $where = implode(' AND ', $conditions);
        $amountSql = GstVisibility::paymentAmountSql('p', $gstVisibleOnly);
        return Database::fetchAll(
            "SELECT p.id, p.receipt_no, ROUND({$amountSql}, 2) AS amount, p.payment_date, p.payment_mode, b.account_name AS bank_name,
                    p.cheque_number, p.cheque_status, p.cheque_cleared_at, p.bank_account_id, p.notes,
                    i.id AS invoice_id, i.invoice_no, i.status AS invoice_status,
                    COALESCE(c.name, pc.name, i.walkin_name, 'Walk-in') AS customer_name
             FROM invoice_payments p
             LEFT JOIN invoices i ON i.id = p.invoice_id
             LEFT JOIN customers c ON c.id = i.customer_id
             LEFT JOIN customers pc ON pc.id = p.customer_id
             LEFT JOIN bank_accounts b ON b.id = p.bank_account_id
             WHERE $where
             ORDER BY p.payment_date DESC, p.id DESC
             LIMIT 300",
            $params
        );
    }

    /** KPI tiles for the Payments module. Scoped the same way as allPayments()/list(). */
    public static function paymentStats(AuthUser $user): array
    {
        $gstVisibleOnly = GstVisibility::restrictedUsername($user->username);
        [$scopeSql, $params] = ScopeSql::ownedVia($user, 'customers c', 'i.customer_id', 'i');
        $amountSql = GstVisibility::paymentAmountSql('p', $gstVisibleOnly);
        $visibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::paymentVisibleSql('p') : '';
        $row = Database::fetchOne(
            "SELECT
                COALESCE(SUM(CASE WHEN p.payment_mode <> 'cheque' OR p.cheque_status <> 'bounced' OR p.cheque_status IS NULL THEN {$amountSql} ELSE 0 END), 0) AS total_collected,
                COALESCE(SUM(CASE WHEN DATE_FORMAT(p.payment_date, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')
                                   AND (p.payment_mode <> 'cheque' OR p.cheque_status <> 'bounced' OR p.cheque_status IS NULL)
                              THEN {$amountSql} ELSE 0 END), 0) AS collected_this_month,
                SUM(p.payment_mode <> 'cheque' OR p.cheque_status <> 'bounced' OR p.cheque_status IS NULL) AS payment_count,
                SUM(p.payment_mode = 'cheque' AND p.cheque_status IN ('pending', 'deposited')) AS cheque_pending_count
             FROM invoice_payments p
             LEFT JOIN invoices i ON i.id = p.invoice_id
             LEFT JOIN customers c ON c.id = i.customer_id
             WHERE $scopeSql AND p.status = 'active'{$visibilitySql}",
            $params
        ) ?? [];

        return [
            'total_collected' => round((float) ($row['total_collected'] ?? 0), 2),
            'collected_this_month' => round((float) ($row['collected_this_month'] ?? 0), 2),
            'payment_count' => (int) ($row['payment_count'] ?? 0),
            'cheque_pending_count' => (int) ($row['cheque_pending_count'] ?? 0),
            // reuse the already-scoped invoice stats — outstanding is defined identically there
            'total_outstanding' => self::stats($user)['outstanding'],
        ];
    }

    /** Bills with a balance still owed — the "record payment" bill picker. */
    public static function openInvoices(AuthUser $user): array
    {
        $gstVisibleOnly = GstVisibility::restrictedUsername($user->username);
        [$scopeSql, $params] = ScopeSql::ownedVia($user, 'customers c', 'i.customer_id', 'i');
        $grandTotalSql = GstVisibility::invoiceAmountSql('i', $gstVisibleOnly);
        $paidAmountSql = GstVisibility::invoicePaidSql('i', $gstVisibleOnly);
        $balanceSql = GstVisibility::invoiceBalanceSql('i', $gstVisibleOnly);
        $visibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::invoiceVisibleSql('i') : '';
        return Database::fetchAll(
            "SELECT i.id, i.invoice_no, c.name AS customer_name,
                    {$grandTotalSql} AS grand_total,
                    {$paidAmountSql} AS paid_amount,
                    {$balanceSql} AS balance
             FROM invoices i JOIN customers c ON c.id = i.customer_id
             WHERE $scopeSql AND i.status = 'final' AND {$balanceSql} > 0.01{$visibilitySql}
             ORDER BY i.invoice_date DESC, i.id DESC
             LIMIT 200",
            $params
        );
    }
}
