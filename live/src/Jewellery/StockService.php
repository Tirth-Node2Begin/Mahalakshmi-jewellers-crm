<?php

declare(strict_types=1);

namespace CRM\Jewellery;

use CRM\Database\Database;

/**
 * Weight-aware stock ledger (plan/06).
 *
 * Stock is ALWAYS derived from inventory_transactions; the `current_stock` /
 * `avg_cost` columns on inventory_items are a cache that this service
 * recomputes from the ledger after every movement — never blind increments.
 *
 * Tagged pieces are unique items with a status lifecycle. Bulk SKUs are pools
 * whose quantity/weight live only in the ledger.
 */
final class StockService
{
    /**
     * Lock a tagged piece for sale and assert it is still available.
     * MUST be inside the billing transaction — the lock holds until commit,
     * so a second counter scanning the same tag waits and then gets a 409.
     *
     * @throws \DomainException when already sold/removed (→ HTTP 409)
     */
    public static function lockTaggedForSale(int $itemId): array
    {
        self::assertInTransaction();

        $item = Database::fetchOne(
            'SELECT id, item_code, name, status, tracking, metal, purity_id,
                    gross_weight, net_weight, avg_cost, current_stock
               FROM inventory_items WHERE id = :id FOR UPDATE',
            ['id' => $itemId]
        );
        if ($item === null) {
            throw new \RuntimeException('Item not found.');
        }
        if ($item['tracking'] !== 'tagged') {
            throw new \RuntimeException('That item is bulk stock, not a tagged piece.');
        }
        if ($item['status'] !== 'in_stock') {
            throw new \DomainException(sprintf(
                'Item %s was just billed on another counter.',
                $item['item_code']
            ));
        }
        return $item;
    }

    /**
     * Lock a bulk SKU and return how much is available right now.
     * @throws \DomainException when the requested weight/qty exceeds stock
     */
    public static function lockBulkForSale(int $itemId, float $qty, float $weight): array
    {
        self::assertInTransaction();

        $item = Database::fetchOne(
            'SELECT id, item_code, name, status, tracking, metal, purity_id, avg_cost
               FROM inventory_items WHERE id = :id FOR UPDATE',
            ['id' => $itemId]
        );
        if ($item === null) {
            throw new \RuntimeException('Item not found.');
        }
        if ($item['tracking'] !== 'bulk') {
            throw new \RuntimeException('That item is a tagged piece, not bulk stock.');
        }

        $available = self::availability($itemId);
        if ($qty > $available['qty'] + 0.0005 || $weight > $available['weight'] + 0.0005) {
            throw new \DomainException(sprintf(
                'Not enough stock for %s — available %.3f g (%.2f qty).',
                $item['item_code'],
                $available['weight'],
                $available['qty']
            ));
        }
        return $item + $available;
    }

    /** Live quantity/weight/value of an item, straight from the ledger. */
    public static function availability(int $itemId): array
    {
        $row = Database::fetchOne(
            "SELECT
                COALESCE(SUM(CASE WHEN type = 'in' THEN qty ELSE -qty END), 0) AS qty,
                COALESCE(SUM(CASE WHEN type = 'in' THEN weight ELSE -weight END), 0) AS weight,
                COALESCE(SUM(CASE WHEN type = 'in' THEN value ELSE -value END), 0) AS value
               FROM inventory_transactions WHERE item_id = :id",
            ['id' => $itemId]
        ) ?? [];

        return [
            'qty' => round((float) ($row['qty'] ?? 0), 3),
            'weight' => round((float) ($row['weight'] ?? 0), 3),
            'value' => round((float) ($row['value'] ?? 0), 2),
        ];
    }

    /**
     * Weighted-average cost per gram for an item, from its ledger inflows.
     * Used to value COGS on sale and stock write-offs.
     */
    public static function avgCostPerGram(int $itemId): float
    {
        $row = Database::fetchOne(
            "SELECT COALESCE(SUM(value), 0) AS value, COALESCE(SUM(weight), 0) AS weight
               FROM inventory_transactions WHERE item_id = :id AND type = 'in'",
            ['id' => $itemId]
        ) ?? [];

        $weight = (float) ($row['weight'] ?? 0);
        return $weight > 0.0005 ? round((float) $row['value'] / $weight, 2) : 0.0;
    }

    /** Write a stock movement and refresh the item's cached totals. */
    public static function record(
        int $itemId,
        string $direction,          // 'in' | 'out'
        string $reason,             // purchase | sale | adjustment | opening | old_metal_in | return
        float $qty,
        float $weight,
        float $value,
        ?float $ratePerGram = null,
        ?int $invoiceId = null,
        ?int $purchaseId = null,
        ?int $voucherId = null,
        ?string $notes = null,
        ?string $adjustmentReason = null,
        ?int $userId = null
    ): int {
        self::assertInTransaction();

        if ($qty < 0 || $weight < 0) {
            throw new \LogicException('Stock movements carry positive amounts; direction sets the sign.');
        }

        $id = Database::insert('inventory_transactions', [
            'item_id' => $itemId,
            'type' => $direction,
            'reason' => $reason,
            'qty' => round($qty, 3),
            'weight' => round($weight, 3),
            'rate_per_gram' => $ratePerGram !== null ? round($ratePerGram, 2) : null,
            'value' => round($value, 2),
            'unit_cost' => $weight > 0.0005 ? round($value / $weight, 2) : 0,
            'invoice_id' => $invoiceId,
            'purchase_id' => $purchaseId,
            'voucher_id' => $voucherId,
            'notes' => $notes !== null ? mb_substr($notes, 0, 255) : null,
            'adjustment_reason' => $adjustmentReason !== null ? mb_substr($adjustmentReason, 0, 255) : null,
            'created_by' => $userId,
        ]);

        self::refreshCache($itemId);
        return $id;
    }

    /** Flip a tagged piece's status (in_stock ⇄ sold, or removed). */
    public static function setTaggedStatus(int $itemId, string $status): void
    {
        self::assertInTransaction();
        if (!in_array($status, ['in_stock', 'sold', 'removed'], true)) {
            throw new \LogicException('Unknown item status: ' . $status);
        }
        Database::execute(
            "UPDATE inventory_items SET status = :s WHERE id = :id AND tracking = 'tagged'",
            ['s' => $status, 'id' => $itemId]
        );
    }

    /** Recompute the cached current_stock / avg_cost columns from the ledger. */
    public static function refreshCache(int $itemId): void
    {
        $available = self::availability($itemId);
        Database::execute(
            'UPDATE inventory_items SET current_stock = :s, avg_cost = :c WHERE id = :id',
            [
                's' => $available['weight'],
                'c' => self::avgCostPerGram($itemId),
                'id' => $itemId,
            ]
        );
    }

    /** Stock summary grouped by metal and purity — the /inventory screen. */
    public static function summary(): array
    {
        return Database::fetchAll(
            "SELECT i.metal, p.code AS purity, i.tracking,
                    COUNT(*) AS items,
                    COALESCE(SUM(CASE
                        WHEN i.tracking = 'tagged' AND i.current_stock > 0.0005 THEN 1
                        ELSE 0
                    END), 0) AS qty,
                    COALESCE(SUM(GREATEST(i.current_stock, 0)), 0) AS weight,
                    COALESCE(SUM(GREATEST(i.current_stock, 0) * i.avg_cost), 0) AS value
               FROM inventory_items i
          LEFT JOIN purities p ON p.id = i.purity_id
              WHERE i.is_active = 1 AND i.status <> 'removed'
              GROUP BY i.metal, p.code, i.tracking
              ORDER BY i.metal DESC, p.code"
        );
    }

    /** Tagged pieces sitting in stock longer than $days — dead stock. */
    public static function deadStock(int $days = 180): array
    {
        return Database::fetchAll(
            "SELECT i.id, i.item_code, i.name, i.metal, p.code AS purity, i.net_weight,
                    i.avg_cost, MIN(t.created_at) AS in_since,
                    DATEDIFF(CURDATE(), MIN(t.created_at)) AS days_in_stock
               FROM inventory_items i
               JOIN inventory_transactions t ON t.item_id = i.id AND t.type = 'in'
          LEFT JOIN purities p ON p.id = i.purity_id
              WHERE i.tracking = 'tagged' AND i.status = 'in_stock' AND i.is_active = 1
              GROUP BY i.id, i.item_code, i.name, i.metal, p.code, i.net_weight, i.avg_cost
             HAVING days_in_stock >= :d
              ORDER BY days_in_stock DESC",
            ['d' => $days]
        );
    }

    private static function assertInTransaction(): void
    {
        if (!Database::pdo()->inTransaction()) {
            throw new \LogicException('Stock movements must run inside a transaction.');
        }
    }
}
