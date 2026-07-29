<?php

declare(strict_types=1);

namespace CRM\Inventory;

use CRM\Database\Database;

/** Inventory reads + aggregations (planning/11). All prepared statements. */
final class InventoryRepository
{
    /** @return array<string,mixed> */
    public static function list(array $filters): array
    {
        $conditions = ['1 = 1'];
        $params = [];
        if (!empty($filters['item_type'])) {
            $conditions[] = 'i.item_type = :t';
            $params['t'] = $filters['item_type'];
        }
        if (!empty($filters['category_id'])) {
            $conditions[] = 'i.category_id = :c';
            $params['c'] = (int) $filters['category_id'];
        }
        if (($filters['status'] ?? 'active') === 'active') {
            $conditions[] = 'i.is_active = 1';
        } elseif (($filters['status'] ?? '') === 'inactive') {
            $conditions[] = 'i.is_active = 0';
        }
        if (!empty($filters['low_stock'])) {
            $conditions[] = 'i.reorder_level > 0 AND i.current_stock <= i.reorder_level';
        }
        if (!empty($filters['search'])) {
            $conditions[] = '(i.name LIKE :q1 OR i.item_code LIKE :q2)';
            $like = '%' . $filters['search'] . '%';
            $params += ['q1' => $like, 'q2' => $like];
        }
        $where = implode(' AND ', $conditions);

        $items = Database::fetchAll(
            "SELECT i.*, c.name AS category_name, u.short_name AS unit, v.name AS vendor_name,
                    ROUND(i.current_stock * i.avg_cost, 2) AS stock_value,
                    CASE WHEN i.current_stock <= 0 THEN 'out'
                         WHEN i.reorder_level > 0 AND i.current_stock <= i.reorder_level THEN 'low'
                         ELSE 'ok' END AS stock_state
             FROM inventory_items i
             LEFT JOIN inventory_categories c ON c.id = i.category_id
             LEFT JOIN suppliers v ON v.id = i.vendor_id
             JOIN units u ON u.id = i.unit_id
             WHERE $where
             ORDER BY i.item_type, i.name
             LIMIT 1000",
            $params
        );

        return [
            'items' => $items,
            'categories' => self::categories(),
            'units' => self::units(),
            'stats' => self::stats(),
        ];
    }

    /** @return array<string,mixed> */
    public static function stats(): array
    {
        $row = Database::fetchOne(
            "SELECT
                SUM(item_type = 'raw_material') AS raw_count,
                SUM(item_type = 'stock') AS stock_count,
                COALESCE(SUM(CASE WHEN item_type = 'raw_material' THEN current_stock * avg_cost END), 0) AS raw_value,
                COALESCE(SUM(CASE WHEN item_type = 'stock' THEN current_stock * avg_cost END), 0) AS stock_value,
                SUM(reorder_level > 0 AND current_stock <= reorder_level AND current_stock > 0) AS low_stock_count,
                SUM(current_stock <= 0) AS out_of_stock
             FROM inventory_items WHERE is_active = 1"
        ) ?? [];
        return [
            'raw_count' => (int) ($row['raw_count'] ?? 0),
            'stock_count' => (int) ($row['stock_count'] ?? 0),
            'raw_value' => round((float) ($row['raw_value'] ?? 0), 2),
            'stock_value' => round((float) ($row['stock_value'] ?? 0), 2),
            'low_stock_count' => (int) ($row['low_stock_count'] ?? 0),
            'out_of_stock' => (int) ($row['out_of_stock'] ?? 0),
        ];
    }

    /** Item detail: header + recent ledger + 12-month in/out series. */
    public static function detail(int $id): ?array
    {
        $item = Database::fetchOne(
            "SELECT i.*, c.name AS category_name, u.short_name AS unit, u.name AS unit_name, v.name AS vendor_name,
                    ROUND(i.current_stock * i.avg_cost, 2) AS stock_value,
                    CASE WHEN i.current_stock <= 0 THEN 'out'
                         WHEN i.reorder_level > 0 AND i.current_stock <= i.reorder_level THEN 'low'
                         ELSE 'ok' END AS stock_state
             FROM inventory_items i
             LEFT JOIN inventory_categories c ON c.id = i.category_id
             LEFT JOIN suppliers v ON v.id = i.vendor_id
             JOIN units u ON u.id = i.unit_id
             WHERE i.id = :id",
            ['id' => $id]
        );
        if ($item === null) {
            return null;
        }
        $transactions = Database::fetchAll(
            "SELECT t.*, ROUND(t.qty * t.unit_cost, 2) AS value,
                    inv.invoice_no, us.full_name AS by_name
             FROM inventory_transactions t
             LEFT JOIN invoices inv ON inv.id = t.invoice_id
             LEFT JOIN users us ON us.id = t.created_by
             WHERE t.item_id = :id
             ORDER BY t.id DESC LIMIT 50",
            ['id' => $id]
        );
        $movement = Database::fetchAll(
            "SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
                    COALESCE(SUM(CASE WHEN type = 'in' THEN qty END), 0) AS in_qty,
                    COALESCE(SUM(CASE WHEN type = 'out' THEN qty END), 0) AS out_qty
             FROM inventory_transactions
             WHERE item_id = :id AND created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
             GROUP BY month ORDER BY month",
            ['id' => $id]
        );
        return ['item' => $item, 'transactions' => $transactions, 'monthly_movement' => $movement];
    }

    public static function categories(): array
    {
        return Database::fetchAll(
            "SELECT c.*, (SELECT COUNT(*) FROM inventory_items i WHERE i.category_id = c.id) AS item_count
             FROM inventory_categories c ORDER BY c.item_type, c.name"
        );
    }

    public static function units(): array
    {
        return Database::fetchAll('SELECT id, name, short_name FROM units WHERE is_active = 1 ORDER BY name');
    }

    /** Scoped-down picker for invoice stock lines / production output (stock items with stock or price). */
    public static function pickList(?string $itemType = null): array
    {
        $sql = "SELECT i.id, i.item_code, i.name, i.item_type, i.current_stock, i.avg_cost,
                       i.selling_price, u.short_name AS unit
                FROM inventory_items i JOIN units u ON u.id = i.unit_id
                WHERE i.is_active = 1";
        $params = [];
        if ($itemType !== null) {
            $sql .= ' AND i.item_type = :t';
            $params['t'] = $itemType;
        }
        return Database::fetchAll($sql . ' ORDER BY i.name', $params);
    }
}
