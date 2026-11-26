<?php

declare(strict_types=1);

namespace CRM\Customers;

use CRM\Auth\AuthUser;
use CRM\Database\Database;
use CRM\Support\GstVisibility;
use CRM\Support\ScopeSql;

final class CustomerRepository
{
    public static function list(AuthUser $user, array $filters): array
    {
        $gstVisibleOnly = GstVisibility::restrictedUsername($user->username);
        $balanceSql = GstVisibility::invoiceBalanceSql('i', $gstVisibleOnly);
        $invoiceVisibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::invoiceVisibleSql('i') : '';
        [$scopeSql, $params] = ScopeSql::owned($user, 'c');
        $conditions = [$scopeSql, 'c.is_active = 1'];

        if (!empty($filters['stage'])) {
            $conditions[] = 'c.stage = :f_stage';
            $params['f_stage'] = $filters['stage'];
        }
        if (!empty($filters['assigned_to'])) {
            $conditions[] = 'c.assigned_to = :f_assigned';
            $params['f_assigned'] = (int) $filters['assigned_to'];
        }
        if (!empty($filters['search'])) {
            $conditions[] = '(c.name LIKE :q1 OR c.mobile LIKE :q2 OR c.email LIKE :q3 OR c.company LIKE :q4 OR c.customer_code LIKE :q5)';
            $like = '%' . $filters['search'] . '%';
            $params += ['q1' => $like, 'q2' => $like, 'q3' => $like, 'q4' => $like, 'q5' => $like];
        }

        $where = implode(' AND ', $conditions);
        return Database::fetchAll(
            "SELECT c.*, au.full_name AS assigned_to_name,
                    (SELECT COALESCE(SUM({$balanceSql}), 0) FROM invoices i
                        WHERE i.customer_id = c.id AND i.status = 'final'{$invoiceVisibilitySql}) AS outstanding
             FROM customers c
             LEFT JOIN users au ON au.id = c.assigned_to
             WHERE $where
             ORDER BY c.created_at DESC
             LIMIT 200",
            $params
        );
    }

    /** Active customers visible under the user's data scope — for pickers/helpers (Codex #8/#9). */
    public static function pickList(AuthUser $user): array
    {
        [$scopeSql, $params] = ScopeSql::owned($user, 'c');
        return Database::fetchAll(
            "SELECT c.id, c.name, c.customer_code FROM customers c
             WHERE c.is_active = 1 AND $scopeSql ORDER BY c.name",
            $params
        );
    }

    public static function stats(AuthUser $user): array
    {
        $gstVisibleOnly = GstVisibility::restrictedUsername($user->username);
        $balanceSql = GstVisibility::invoiceBalanceSql('i', $gstVisibleOnly);
        $invoiceVisibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::invoiceVisibleSql('i') : '';
        [$scopeSql, $params] = ScopeSql::owned($user, 'c');
        $row = Database::fetchOne(
            "SELECT COUNT(*) AS total,
                    SUM(c.stage = 'onboarding') AS onboarding,
                    SUM(c.stage = 'active') AS active,
                    SUM(c.stage IN ('inactive','churned')) AS dormant,
                    SUM(DATE_FORMAT(c.created_at,'%Y-%m') = DATE_FORMAT(CURDATE(),'%Y-%m')) AS new_this_month
             FROM customers c WHERE c.is_active = 1 AND $scopeSql",
            $params
        ) ?? [];

        $outstanding = Database::fetchValue(
            "SELECT COALESCE(SUM({$balanceSql}), 0)
             FROM invoices i JOIN customers c ON c.id = i.customer_id
             WHERE i.status = 'final' AND c.is_active = 1 AND $scopeSql{$invoiceVisibilitySql}",
            $params
        );

        return [
            'total' => (int) ($row['total'] ?? 0),
            'onboarding' => (int) ($row['onboarding'] ?? 0),
            'active' => (int) ($row['active'] ?? 0),
            'dormant' => (int) ($row['dormant'] ?? 0),
            'new_this_month' => (int) ($row['new_this_month'] ?? 0),
            'outstanding' => (float) ($outstanding ?? 0),
        ];
    }

    public static function find(AuthUser $user, int $id): ?array
    {
        [$scopeSql, $params] = ScopeSql::owned($user, 'c');
        return Database::fetchOne(
            "SELECT c.*, au.full_name AS assigned_to_name, cb.full_name AS created_by_name
             FROM customers c
             LEFT JOIN users au ON au.id = c.assigned_to
             LEFT JOIN users cb ON cb.id = c.created_by
             WHERE c.id = :id AND $scopeSql",
            ['id' => $id] + $params
        );
    }

    public static function invoices(int $customerId, bool $gstVisibleOnly = false): array
    {
        $grandTotalSql = GstVisibility::invoiceAmountSql('i', $gstVisibleOnly);
        $paidAmountSql = GstVisibility::invoicePaidSql('i', $gstVisibleOnly);
        $visibilitySql = $gstVisibleOnly
            ? ' AND (NOT EXISTS (SELECT 1 FROM invoice_items hidden_check WHERE hidden_check.invoice_id = i.id) OR ' . GstVisibility::invoiceVisibleSql('i') . ')'
            : '';
        return Database::fetchAll(
            "SELECT i.id, i.invoice_no, i.invoice_date, i.due_date, i.status,
                    {$grandTotalSql} AS grand_total,
                    {$paidAmountSql} AS paid_amount
             FROM invoices i WHERE i.customer_id = :id{$visibilitySql} ORDER BY i.invoice_date DESC, i.id DESC LIMIT 50",
            ['id' => $customerId]
        );
    }

    public static function family(int $customerId): array
    {
        return Database::fetchAll(
            'SELECT id, relation, name, dob, anniversary FROM family_members WHERE customer_id = :id ORDER BY id',
            ['id' => $customerId]
        );
    }

    public static function events(int $customerId): array
    {
        return Database::fetchAll(
            'SELECT e.*, u.full_name AS created_by_name
             FROM customer_events e LEFT JOIN users u ON u.id = e.created_by
             WHERE e.customer_id = :id ORDER BY e.id DESC LIMIT 50',
            ['id' => $customerId]
        );
    }

    public static function totals(int $customerId, bool $gstVisibleOnly = false): array
    {
        $grandTotalSql = GstVisibility::invoiceAmountSql('i', $gstVisibleOnly);
        $paidAmountSql = GstVisibility::invoicePaidSql('i', $gstVisibleOnly);
        $visibilitySql = $gstVisibleOnly ? ' AND ' . GstVisibility::invoiceVisibleSql('i') : '';
        $row = Database::fetchOne(
            "SELECT COALESCE(SUM({$grandTotalSql}),0) AS billed,
                    COALESCE(SUM({$paidAmountSql}),0) AS paid
             FROM invoices i WHERE i.customer_id = :id AND i.status = 'final'{$visibilitySql}",
            ['id' => $customerId]
        ) ?? [];
        $billed = (float) ($row['billed'] ?? 0);
        $paid = (float) ($row['paid'] ?? 0);
        return [
            'billed' => $billed,
            'paid' => $paid,
            'outstanding' => $billed - $paid,
        ];
    }
}
