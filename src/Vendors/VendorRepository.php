<?php

declare(strict_types=1);

namespace CRM\Vendors;

use CRM\Database\Database;

/**
 * Vendor / Karigar reads (info.md §5.11). Vendors live in the `suppliers` table
 * (repurposed) with jewellery-supply fields (type, specialisation, karigar rate,
 * bank/compliance details).
 */
final class VendorRepository
{
    /** @return list<array<string,mixed>> */
    public static function list(array $filters): array
    {
        $conditions = ['1 = 1'];
        $params = [];
        if (!empty($filters['vendor_type'])) {
            $conditions[] = 'v.vendor_type = :vt';
            $params['vt'] = $filters['vendor_type'];
        }
        if (!empty($filters['status'])) {
            $conditions[] = 'v.vendor_status = :vs';
            $params['vs'] = $filters['status'];
        }
        if (!empty($filters['search'])) {
            $conditions[] = '(v.name LIKE :q1 OR v.company LIKE :q2 OR v.mobile LIKE :q3 OR v.specialisation LIKE :q4)';
            $like = '%' . $filters['search'] . '%';
            $params += ['q1' => $like, 'q2' => $like, 'q3' => $like, 'q4' => $like];
        }
        $where = implode(' AND ', $conditions);
        return Database::fetchAll(
            "SELECT v.*,
                    (SELECT COUNT(*) FROM inventory_items i WHERE i.vendor_id = v.id) AS item_count
             FROM suppliers v
             WHERE $where
             ORDER BY v.vendor_status = 'active' DESC, v.name
             LIMIT 500",
            $params
        );
    }

    public static function detail(int $id): ?array
    {
        $vendor = Database::fetchOne('SELECT * FROM suppliers WHERE id = :id', ['id' => $id]);
        if ($vendor === null) {
            return null;
        }
        $items = Database::fetchAll(
            "SELECT id, item_code, name, jw_status, current_stock FROM inventory_items WHERE vendor_id = :id ORDER BY id DESC LIMIT 50",
            ['id' => $id]
        );
        // Purchase history + spend summary — "how much have we bought from this partner".
        $purchases = Database::fetchAll(
            "SELECT id, purchase_no, purchase_date, status, grand_total, payment_status
             FROM purchases WHERE supplier_id = :id ORDER BY purchase_date DESC, id DESC LIMIT 50",
            ['id' => $id]
        );
        $spend = Database::fetchOne(
            "SELECT COUNT(*) AS purchase_count,
                    COALESCE(SUM(CASE WHEN status = 'received' THEN grand_total ELSE 0 END), 0) AS total_purchased,
                    COALESCE(SUM(CASE WHEN status = 'received' AND payment_status = 'unpaid' THEN grand_total ELSE 0 END), 0) AS unpaid_amount
             FROM purchases WHERE supplier_id = :id",
            ['id' => $id]
        ) ?? [];
        $summary = [
            'total_purchased' => (float) ($spend['total_purchased'] ?? 0),
            'unpaid_amount' => (float) ($spend['unpaid_amount'] ?? 0),
            'purchase_count' => (int) ($spend['purchase_count'] ?? 0),
            // real total — the items list above is capped at 50 rows for display
            'item_count' => (int) Database::fetchValue('SELECT COUNT(*) FROM inventory_items WHERE vendor_id = :id', ['id' => $id]),
        ];
        return ['vendor' => $vendor, 'items' => $items, 'purchases' => $purchases, 'summary' => $summary];
    }

    /** @return list<array<string,mixed>> */
    public static function pickList(bool $makersOnly = false): array
    {
        if ($makersOnly) {
            $types = implode(',', array_map(static fn (string $t): string => "'$t'", \CRM\Vendors\VendorService::MAKER_TYPES));
            return Database::fetchAll(
                "SELECT id, name, vendor_type FROM suppliers WHERE vendor_status = 'active' AND vendor_type IN ($types) ORDER BY name"
            );
        }
        return Database::fetchAll(
            "SELECT id, name, vendor_type FROM suppliers WHERE vendor_status = 'active' ORDER BY name"
        );
    }

    /** @return array<string,mixed> */
    public static function stats(): array
    {
        $rows = Database::fetchAll('SELECT vendor_status, COUNT(*) AS c FROM suppliers GROUP BY vendor_status');
        $byStatus = ['active' => 0, 'inactive' => 0, 'blacklisted' => 0];
        foreach ($rows as $r) {
            $byStatus[(string) $r['vendor_status']] = (int) $r['c'];
        }
        $karigars = (int) Database::fetchValue("SELECT COUNT(*) FROM suppliers WHERE vendor_type = 'karigar'");
        return [
            'total' => array_sum($byStatus),
            'active' => $byStatus['active'],
            'karigars' => $karigars,
            'blacklisted' => $byStatus['blacklisted'],
        ];
    }
}
