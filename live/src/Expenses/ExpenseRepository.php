<?php

declare(strict_types=1);

namespace CRM\Expenses;

use CRM\Database\Database;
use CRM\Support\FiscalYear;

/** Expense reads + aggregations (planning/10). All prepared statements. */
final class ExpenseRepository
{
    public static function list(array $filters): array
    {
        $fy = FiscalYear::range();
        $conditions = ['e.expense_date BETWEEN :fy_start AND :fy_end'];
        $params = ['fy_start' => $fy['start'], 'fy_end' => $fy['end']];

        if (!empty($filters['type'])) {
            $conditions[] = 'e.type = :f_type';
            $params['f_type'] = $filters['type'];
        }
        if (!empty($filters['category_id'])) {
            $conditions[] = 'e.category_id = :f_cat';
            $params['f_cat'] = (int) $filters['category_id'];
        }
        if (!empty($filters['date'])) {
            $conditions[] = 'e.expense_date = :f_date';
            $params['f_date'] = $filters['date'];
        }
        if (!empty($filters['search'])) {
            $conditions[] = '(e.paid_to LIKE :q1 OR e.description LIKE :q2 OR c.name LIKE :q3)';
            $like = '%' . $filters['search'] . '%';
            $params += ['q1' => $like, 'q2' => $like, 'q3' => $like];
        }

        $where = implode(' AND ', $conditions);
        return Database::fetchAll(
            "SELECT e.*, c.name AS category_name, c.is_system AS category_is_system,
                    fi.name AS item_name, b.account_name AS bank_name
             FROM expenses e
             JOIN expense_categories c ON c.id = e.category_id
             LEFT JOIN fixed_cost_items fi ON fi.id = e.fixed_cost_item_id
             LEFT JOIN bank_accounts b ON b.id = e.bank_account_id
             WHERE $where
             ORDER BY e.expense_date DESC, e.id DESC
             LIMIT 1000",
            $params
        );
    }

    public static function kpis(): array
    {
        $fy = FiscalYear::range();
        $row = Database::fetchOne(
            "SELECT
                COALESCE(SUM(CASE WHEN expense_date = CURDATE() THEN amount ELSE 0 END), 0) AS today,
                COALESCE(SUM(amount), 0) AS total_year,
                COALESCE(SUM(CASE WHEN type = 'fixed' THEN amount ELSE 0 END), 0) AS fixed_total,
                COALESCE(SUM(CASE WHEN type = 'variable' THEN amount ELSE 0 END), 0) AS variable_total
             FROM expenses WHERE expense_date BETWEEN :s AND :e",
            ['s' => $fy['start'], 'e' => $fy['end']]
        ) ?? [];
        return [
            'today' => (float) ($row['today'] ?? 0),
            'total_year' => (float) ($row['total_year'] ?? 0),
            'fixed_total' => (float) ($row['fixed_total'] ?? 0),
            'variable_total' => (float) ($row['variable_total'] ?? 0),
        ];
    }

    /** Category breakdown for a date range (insights). */
    public static function categoryBreakdown(string $from, string $to): array
    {
        return Database::fetchAll(
            "SELECT c.name, SUM(e.amount) AS total, COUNT(*) AS count
             FROM expenses e JOIN expense_categories c ON c.id = e.category_id
             WHERE e.expense_date BETWEEN :from AND :to
             GROUP BY c.id ORDER BY total DESC",
            ['from' => $from, 'to' => $to]
        );
    }

    public static function paymentBreakdown(string $from, string $to): array
    {
        return Database::fetchAll(
            "SELECT payment_mode AS mode, SUM(amount) AS total, COUNT(*) AS count
             FROM expenses WHERE expense_date BETWEEN :from AND :to
             GROUP BY payment_mode ORDER BY total DESC",
            ['from' => $from, 'to' => $to]
        );
    }

    /** Daily totals across a range (trend chart). */
    public static function dailyBreakdown(string $from, string $to): array
    {
        return Database::fetchAll(
            "SELECT expense_date AS date, SUM(amount) AS total
             FROM expenses WHERE expense_date BETWEEN :from AND :to
             GROUP BY expense_date ORDER BY expense_date",
            ['from' => $from, 'to' => $to]
        );
    }

    public static function periodTotal(string $from, string $to): float
    {
        return (float) Database::fetchValue(
            'SELECT COALESCE(SUM(amount),0) FROM expenses WHERE expense_date BETWEEN :from AND :to',
            ['from' => $from, 'to' => $to]
        );
    }

    public static function categories(?string $type = null): array
    {
        $sql = 'SELECT c.*,
                       (SELECT COUNT(*) FROM expenses e WHERE e.category_id = c.id) AS expense_count,
                       (SELECT COALESCE(SUM(e.amount),0) FROM expenses e WHERE e.category_id = c.id) AS total_volume
                FROM expense_categories c WHERE c.is_active = 1';
        $params = [];
        if ($type !== null) {
            $sql .= ' AND c.type = :t';
            $params['t'] = $type;
        }
        $sql .= " ORDER BY c.type = 'variable', c.name";
        $categories = Database::fetchAll($sql, $params);

        // attach fixed-cost items
        foreach ($categories as &$cat) {
            $cat['items'] = $cat['type'] === 'fixed'
                ? Database::fetchAll(
                    "SELECT fi.* FROM fixed_cost_items fi
                     WHERE fi.category_id = :c AND fi.status = 'active' ORDER BY fi.sort_order, fi.name",
                    ['c' => $cat['id']]
                )
                : [];
        }
        unset($cat);
        return $categories;
    }

    public static function subcategories(?string $type = null): array
    {
        $sql = 'SELECT fi.id, fi.name, fi.category_id, c.type
                FROM fixed_cost_items fi JOIN expense_categories c ON c.id = fi.category_id
                WHERE fi.status = \'active\'';
        $params = [];
        if ($type !== null) {
            $sql .= ' AND c.type = :t';
            $params['t'] = $type;
        }
        return Database::fetchAll($sql . ' ORDER BY fi.name', $params);
    }
}
