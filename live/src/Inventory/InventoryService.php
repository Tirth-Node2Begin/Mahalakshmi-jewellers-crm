<?php

declare(strict_types=1);

namespace CRM\Inventory;

use CRM\Auth\AuthUser;
use CRM\Database\Database;
use CRM\Support\NumberSequence;
use CRM\Support\Notify;
use CRM\Validation\Validator;

/**
 * Inventory ledger engine (planning/11). Ledger-first: every stock change is an
 * inventory_transactions row; current_stock + avg_cost are maintained convenience
 * columns recomputable from the ledger. Invariants:
 * - no negative stock: an `out` for more than current_stock is rejected.
 * - weighted-average cost updates on every priced `in`; `out` rows snapshot the avg.
 * - the item row is locked FOR UPDATE for the whole movement so concurrent writes
 *   can't race the stock check or the average.
 * All movements MUST run inside the caller's Database::transaction().
 */
final class InventoryService
{
    public const ITEM_TYPES = ['raw_material', 'stock'];

    /**
     * Finished stock is ALWAYS counted in pieces — grams/carats belong to raw
     * materials (gold/silver lots in g or kg, diamond lots in ct). The unit the
     * client sends for a stock item is ignored in favour of pcs.
     */
    private static function pcsUnitId(): int
    {
        $id = Database::fetchValue("SELECT id FROM units WHERE short_name = 'pcs'");
        if ($id === null) {
            throw new \RuntimeException("The 'pcs' unit is missing — reseed the units master.");
        }
        return (int) $id;
    }

    /** Whole-number guard for piece-counted items (you can't stock 1.5 necklaces). */
    private static function assertWholeForPcs(int $unitId, float $qty, string $label): void
    {
        $short = (string) Database::fetchValue('SELECT short_name FROM units WHERE id = :u', ['u' => $unitId]);
        if (in_array($short, ['pcs', 'set', 'box'], true) && abs($qty - round($qty)) > 0.0005) {
            throw new \DomainException("$label must be a whole number for piece-counted items.");
        }
    }

    // ---------------------------------------------------------------- items

    public static function createItem(array $body, AuthUser $user): int
    {
        $data = self::validateItem($body, isCreate: true);
        // finished pieces are counted, never weighed — the weight lives in the composition fields
        if ($data['item_type'] === 'stock') {
            $data['unit_id'] = self::pcsUnitId();
        } elseif ($data['unit_id'] <= 0) {
            throw new \DomainException('Choose the unit this material is measured in (g, kg or ct).');
        }
        if ($data['opening_qty'] > 0) {
            self::assertWholeForPcs($data['unit_id'], $data['opening_qty'], 'Opening quantity');
        }
        return Database::transaction(static function () use ($data, $user): int {
            $seqKey = $data['item_type'] === 'raw_material' ? 'item_rm' : 'item_st';
            $itemId = Database::insert('inventory_items', [
                'item_code' => NumberSequence::next($seqKey),
                'name' => $data['name'],
                'item_type' => $data['item_type'],
                'category_id' => $data['category_id'],
                'unit_id' => $data['unit_id'],
                'reorder_level' => $data['reorder_level'],
                'selling_price' => $data['item_type'] === 'stock' ? $data['selling_price'] : null,
                'show_on_website' => $data['item_type'] === 'stock' ? $data['show_on_website'] : 0,
                'description' => $data['description'],
                'barcode' => $data['barcode'],
                'metal_type' => $data['metal_type'],
                'gross_wt' => $data['gross_wt'],
                'net_wt' => $data['net_wt'],
                'stone_wt' => $data['stone_wt'],
                'diamond_ct' => $data['diamond_ct'],
                'diamond_pcs' => $data['diamond_pcs'],
                'purity' => $data['purity'],
                'making_charge' => $data['making_charge'],
                'wastage_pct' => $data['wastage_pct'],
                'hsn_code' => $data['hsn_code'],
                'location' => $data['location'],
                'purchase_price' => $data['purchase_price'],
                'vendor_id' => $data['vendor_id'],
                'jw_status' => $data['jw_status'],
                'created_by' => $user->id,
            ]);
            // opening stock (optional) posts an adjustment_in carrying the opening cost
            if ($data['opening_qty'] > 0) {
                self::postMovement($itemId, 'in', 'adjustment_in', $data['opening_qty'], $data['opening_cost'], [
                    'notes' => 'Opening stock',
                ], $user->id);
            }
            return $itemId;
        });
    }

    public static function updateItem(int $id, array $body, AuthUser $user): void
    {
        $existing = self::findItemOrFail($id);
        $itemType = (string) $existing['item_type'];
        $data = self::validateItem($body, isCreate: false);
        // item_type is fixed after creation (its ledger + code prefix depend on it);
        // stock items stay piece-counted no matter what unit the client sends
        $unitId = $itemType === 'stock'
            ? self::pcsUnitId()
            : ($data['unit_id'] > 0 ? $data['unit_id'] : (int) $existing['unit_id']);
        Database::execute(
            'UPDATE inventory_items SET name = :n, category_id = :c, unit_id = :u, reorder_level = :r,
                    selling_price = :sp, show_on_website = :sow, description = :d, barcode = :bc, metal_type = :mt,
                    gross_wt = :gw, net_wt = :nw, stone_wt = :stw, diamond_ct = :dct, diamond_pcs = :dpc,
                    purity = :pur, making_charge = :mc,
                    wastage_pct = :wp, hsn_code = :hsn, location = :loc, purchase_price = :pp,
                    vendor_id = :vid, jw_status = :jws WHERE id = :id',
            [
                'n' => $data['name'], 'c' => $data['category_id'], 'u' => $unitId,
                'r' => $data['reorder_level'],
                'sp' => $itemType === 'stock' ? $data['selling_price'] : null,
                'sow' => $itemType === 'stock' ? $data['show_on_website'] : 0,
                'd' => $data['description'], 'bc' => $data['barcode'], 'mt' => $data['metal_type'],
                'gw' => $data['gross_wt'], 'nw' => $data['net_wt'], 'stw' => $data['stone_wt'],
                'dct' => $data['diamond_ct'], 'dpc' => $data['diamond_pcs'],
                'pur' => $data['purity'], 'mc' => $data['making_charge'], 'wp' => $data['wastage_pct'],
                'hsn' => $data['hsn_code'], 'loc' => $data['location'], 'pp' => $data['purchase_price'],
                'vid' => $data['vendor_id'], 'jws' => $data['jw_status'], 'id' => $id,
            ]
        );
    }

    /** Deactivate/reactivate. Items with ledger history are never hard-deleted. */
    public static function toggleItem(int $id): void
    {
        self::findItemOrFail($id);
        Database::execute('UPDATE inventory_items SET is_active = 1 - is_active WHERE id = :id', ['id' => $id]);
    }

    // ------------------------------------------------------------- movements

    /** Manual stock correction (opening balance, physical count, returns, damage). */
    public static function adjust(array $body, AuthUser $user): int
    {
        $data = Validator::validate($body, [
            'item_id' => 'required|int|min:1',
            'direction' => 'required|in:in,out',
            'qty' => 'required|numeric|min:0.001',
            'unit_cost' => 'nullable|numeric|min:0',
            'notes' => 'required|string|max:255',
        ]);
        $item = self::findItemOrFail((int) $data['item_id']);
        self::assertWholeForPcs((int) $item['unit_id'], (float) $data['qty'], 'Quantity');
        $reason = $data['direction'] === 'in' ? 'adjustment_in' : 'adjustment_out';
        return Database::transaction(static function () use ($data, $reason, $user): int {
            return self::postMovement(
                (int) $data['item_id'],
                $data['direction'],
                $reason,
                (float) $data['qty'],
                $data['direction'] === 'in' && isset($data['unit_cost']) ? (float) $data['unit_cost'] : null,
                ['notes' => $data['notes']],
                $user->id
            )['id'];
        });
    }

    /**
     * Central ledger writer — the ONLY place stock + avg_cost change. Locks the item
     * row, enforces no-negative-stock, maintains the weighted average, writes the
     * ledger row, and fires a low-stock notification when an `out` crosses the reorder level.
     * @param array<string,mixed> $refs purchase_id|invoice_id|work_id|production_batch|notes
     * @return array{id:int,unit_cost:float,new_stock:float}
     */
    public static function postMovement(int $itemId, string $type, string $reason, float $qty, ?float $inPrice, array $refs, ?int $userId): array
    {
        if (!Database::pdo()->inTransaction()) {
            throw new \LogicException('postMovement() must run inside a transaction.');
        }
        $item = Database::fetchOne('SELECT * FROM inventory_items WHERE id = :id FOR UPDATE', ['id' => $itemId]);
        if ($item === null) {
            throw new \RuntimeException('Inventory item not found.');
        }
        $qty = round($qty, 3);
        if ($qty <= 0) {
            throw new \DomainException('Quantity must be greater than zero.');
        }
        // piece-counted items can never move fractionally — guards EVERY ledger path
        // (bill finalize, cancel reversal, opening stock, manual adjust, production)
        self::assertWholeForPcs((int) $item['unit_id'], $qty, 'Quantity');
        $oldStock = (float) $item['current_stock'];
        $oldAvg = (float) $item['avg_cost'];

        if ($type === 'out') {
            if ($qty > $oldStock + 0.0005) {
                throw new \DomainException("Not enough stock for “{$item['name']}” — only " . self::fmtQty($oldStock) . ' available.');
            }
            $unitCost = round($oldAvg, 2);       // snapshot the cost leaving
            $newStock = round($oldStock - $qty, 3);
            $newAvg = $oldAvg;                    // average is unchanged by an out
        } else {
            $unitCost = $inPrice !== null ? round($inPrice, 2) : round($oldAvg, 2);
            $newStock = round($oldStock + $qty, 3);
            // weighted average only shifts when the in carries a price
            $newAvg = ($inPrice !== null && $newStock > 0)
                ? round((($oldStock * $oldAvg) + ($qty * $unitCost)) / $newStock, 2)
                : $oldAvg;
        }

        $txId = Database::insert('inventory_transactions', [
            'item_id' => $itemId,
            'type' => $type,
            'reason' => $reason,
            'qty' => $qty,
            'unit_cost' => $unitCost,
            'purchase_id' => $refs['purchase_id'] ?? null,
            'invoice_id' => $refs['invoice_id'] ?? null,
            'work_id' => $refs['work_id'] ?? null,
            'production_batch' => $refs['production_batch'] ?? null,
            'notes' => $refs['notes'] ?? null,
            'created_by' => $userId,
        ]);
        Database::execute('UPDATE inventory_items SET current_stock = :s, avg_cost = :a WHERE id = :id', ['s' => $newStock, 'a' => $newAvg, 'id' => $itemId]);

        // low-stock alert: fire once, only on the transition across the reorder level
        $reorder = (float) $item['reorder_level'];
        if ($type === 'out' && $reorder > 0 && $newStock <= $reorder && $oldStock > $reorder) {
            self::notifyLowStock($item, $newStock);
        }
        return ['id' => $txId, 'unit_cost' => $unitCost, 'new_stock' => $newStock];
    }

    // -------------------------------------------------------------- masters

    public static function saveCategory(array $body): int
    {
        $data = Validator::validate($body, [
            'id' => 'nullable|int|min:1',
            'name' => 'required|string|min:2|max:100',
            'item_type' => 'required|in:raw_material,stock',
        ]);
        $dupe = Database::fetchValue(
            'SELECT id FROM inventory_categories WHERE name = :n AND item_type = :t AND id <> :id',
            ['n' => $data['name'], 't' => $data['item_type'], 'id' => $data['id'] ?? 0]
        );
        if ($dupe !== null) {
            throw new \DomainException('A category with that name already exists for this type.');
        }
        if (!empty($data['id'])) {
            Database::execute('UPDATE inventory_categories SET name = :n, item_type = :t WHERE id = :id', ['n' => $data['name'], 't' => $data['item_type'], 'id' => $data['id']]);
            return (int) $data['id'];
        }
        return Database::insert('inventory_categories', ['name' => $data['name'], 'item_type' => $data['item_type']]);
    }

    public static function toggleCategory(int $id): void
    {
        if (Database::fetchValue('SELECT id FROM inventory_categories WHERE id = :id', ['id' => $id]) === null) {
            throw new \RuntimeException('Category not found.');
        }
        Database::execute('UPDATE inventory_categories SET is_active = 1 - is_active WHERE id = :id', ['id' => $id]);
    }

    public static function saveUnit(array $body): int
    {
        $data = Validator::validate($body, [
            'id' => 'nullable|int|min:1',
            'name' => 'required|string|min:1|max:30',
            'short_name' => 'required|string|min:1|max:10',
        ]);
        $dupe = Database::fetchValue(
            'SELECT id FROM units WHERE (name = :n OR short_name = :s) AND id <> :id',
            ['n' => $data['name'], 's' => $data['short_name'], 'id' => $data['id'] ?? 0]
        );
        if ($dupe !== null) {
            throw new \DomainException('A unit with that name or symbol already exists.');
        }
        // pcs/g/kg/ct symbols are load-bearing (stock=pcs rule, raw-unit picker) — protect them
        if (!empty($data['id'])) {
            $existingShort = (string) Database::fetchValue('SELECT short_name FROM units WHERE id = :id', ['id' => $data['id']]);
            if (in_array($existingShort, ['pcs', 'g', 'kg', 'ct'], true) && $data['short_name'] !== $existingShort) {
                throw new \DomainException("“{$existingShort}” is a core unit the system depends on — its symbol can't be changed.");
            }
        }
        if (!empty($data['id'])) {
            Database::execute('UPDATE units SET name = :n, short_name = :s WHERE id = :id', ['n' => $data['name'], 's' => $data['short_name'], 'id' => $data['id']]);
            return (int) $data['id'];
        }
        return Database::insert('units', ['name' => $data['name'], 'short_name' => $data['short_name']]);
    }

    // -------------------------------------------------------------- helpers

    /** @return array<string,mixed> */
    private static function findItemOrFail(int $id): array
    {
        $item = Database::fetchOne('SELECT * FROM inventory_items WHERE id = :id', ['id' => $id]);
        if ($item === null) {
            throw new \RuntimeException('Inventory item not found.');
        }
        return $item;
    }

    /** @return array<string,mixed> */
    private static function validateItem(array $body, bool $isCreate): array
    {
        $data = Validator::validate($body, [
            'name' => 'required|string|min:2|max:150',
            'item_type' => ($isCreate ? 'required' : 'nullable') . '|in:raw_material,stock',
            'category_id' => 'nullable|int|min:1',
            'unit_id' => 'nullable|int|min:1', // stock items ignore it (forced to pcs); raw materials must send it
            'reorder_level' => 'nullable|numeric|min:0',
            'selling_price' => 'nullable|numeric|min:0',
            'description' => 'nullable|string|max:255',
            'opening_qty' => 'nullable|numeric|min:0',
            'opening_cost' => 'nullable|numeric|min:0',
            'barcode' => 'nullable|string|max:64',
            'metal_type' => 'nullable|string|max:30',
            'gross_wt' => 'nullable|numeric|min:0',
            'net_wt' => 'nullable|numeric|min:0',
            'stone_wt' => 'nullable|numeric|min:0',
            'diamond_ct' => 'nullable|numeric|min:0',
            'diamond_pcs' => 'nullable|int|min:0',
            'purity' => 'nullable|string|max:10',
            'making_charge' => 'nullable|numeric|min:0',
            'wastage_pct' => 'nullable|numeric|min:0',
            'hsn_code' => 'nullable|string|max:12',
            'location' => 'nullable|string|max:100',
            'purchase_price' => 'nullable|numeric|min:0',
            'vendor_id' => 'nullable|int|min:1',
            'jw_status' => 'nullable|in:in_stock,reserved,sold,under_repair,melting',
            'show_on_website' => 'nullable|int|min:0',
        ]);
        if (isset($data['unit_id']) && Database::fetchValue('SELECT id FROM units WHERE id = :u AND is_active = 1', ['u' => $data['unit_id']]) === null) {
            throw new \DomainException('Choose a valid unit.');
        }
        if (!empty($data['category_id']) && Database::fetchValue('SELECT id FROM inventory_categories WHERE id = :c', ['c' => $data['category_id']]) === null) {
            throw new \DomainException('Choose a valid category.');
        }
        if (!empty($data['vendor_id']) && Database::fetchValue('SELECT id FROM suppliers WHERE id = :v', ['v' => $data['vendor_id']]) === null) {
            throw new \DomainException('Choose a valid vendor.');
        }
        return [
            'name' => $data['name'],
            'item_type' => $data['item_type'] ?? 'stock',
            'category_id' => $data['category_id'] ?? null,
            'unit_id' => isset($data['unit_id']) ? (int) $data['unit_id'] : 0,
            'reorder_level' => round((float) ($data['reorder_level'] ?? 0), 3),
            'selling_price' => isset($data['selling_price']) ? round((float) $data['selling_price'], 2) : null,
            'description' => $data['description'] ?? null,
            'opening_qty' => round((float) ($data['opening_qty'] ?? 0), 3),
            'opening_cost' => isset($data['opening_cost']) ? round((float) $data['opening_cost'], 2) : null,
            'barcode' => $data['barcode'] ?? null,
            'metal_type' => $data['metal_type'] ?? null,
            'gross_wt' => round((float) ($data['gross_wt'] ?? 0), 3),
            'net_wt' => round((float) ($data['net_wt'] ?? 0), 3),
            'stone_wt' => round((float) ($data['stone_wt'] ?? 0), 3),
            'diamond_ct' => round((float) ($data['diamond_ct'] ?? 0), 3),
            'diamond_pcs' => (int) ($data['diamond_pcs'] ?? 0),
            'purity' => $data['purity'] ?? null,
            'making_charge' => round((float) ($data['making_charge'] ?? 0), 2),
            'wastage_pct' => round((float) ($data['wastage_pct'] ?? 0), 3),
            'hsn_code' => $data['hsn_code'] ?? null,
            'location' => $data['location'] ?? null,
            'purchase_price' => round((float) ($data['purchase_price'] ?? 0), 2),
            'vendor_id' => isset($data['vendor_id']) ? (int) $data['vendor_id'] : null,
            'jw_status' => $data['jw_status'] ?? 'in_stock',
            'show_on_website' => isset($data['show_on_website']) ? ((int) $data['show_on_website'] === 0 ? 0 : 1) : 1,
        ];
    }

    private static function notifyLowStock(array $item, float $newStock): void
    {
        // best-effort ONLY — this runs inside the movement transaction, so a failure here must
        // never bubble up and roll back the stock change.
        try {
            // super_admins hold every permission implicitly (['*']), so match them by role name;
            // everyone else needs an explicit inventory.manage grant.
            $rows = Database::fetchAll(
                "SELECT DISTINCT u.id FROM users u
                 JOIN user_role_assignments ura ON ura.user_id = u.id AND ura.is_active = 1
                 JOIN roles r ON r.id = ura.role_id AND r.is_active = 1
                 WHERE u.is_active = 1 AND (
                     r.name = 'super_admin'
                     OR EXISTS (
                        SELECT 1 FROM role_permission_grants g
                        JOIN permissions p ON p.id = g.permission_id
                        WHERE g.role_id = r.id AND p.resource = 'inventory' AND p.action = 'manage'
                     )
                 )"
            );
            Notify::sendMany(
                array_column($rows, 'id'),
                'low_stock',
                "Low stock: {$item['name']}",
                $item['item_code'] . ' is down to ' . self::fmtQty($newStock) . ' (reorder at ' . self::fmtQty((float) $item['reorder_level']) . ').',
                'inventory',
                (int) $item['id'],
                '/inventory/detail?id=' . $item['id']
            );
        } catch (\Throwable) {
            // swallow — a notification must not break a stock movement
        }
    }

    private static function fmtQty(float $qty): string
    {
        return rtrim(rtrim(number_format($qty, 3, '.', ''), '0'), '.');
    }
}
