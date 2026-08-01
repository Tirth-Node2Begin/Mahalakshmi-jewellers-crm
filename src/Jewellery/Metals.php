<?php

declare(strict_types=1);

namespace CRM\Jewellery;

use CRM\Database\Database;
use CRM\Support\Audit;

/**
 * The metals the shop deals in.
 *
 * Gold and silver were the only two until platinum was added on 2026-07-30, and
 * `metal` was a MySQL ENUM in five tables — so every new metal was a migration.
 * migrations/2026_07_30_metals_master.sql turned that list into the `metals`
 * table, and this class is the only thing that reads or writes it.
 *
 * A metal is not usable on its own. It needs its own `inventory` + `sales` ledger
 * — Ledgers::system() looks a sale up by (linked_type, metal) and throws at
 * finalize if the row is missing — and at least one purity, or nothing can be
 * priced in it. create() does all three in one transaction; do not INSERT into
 * `metals` from anywhere else.
 */
final class Metals
{
    public const GOLD = 'gold';
    public const SILVER = 'silver';
    public const PLATINUM = 'platinum';

    /**
     * What ships with the system. Only used when the `metals` table has not been
     * created yet (migration not run), so an install mid-upgrade still bills.
     * @var list<array{code:string,name:string}>
     */
    private const BUILT_IN = [
        ['code' => self::GOLD, 'name' => 'Gold'],
        ['code' => self::SILVER, 'name' => 'Silver'],
        ['code' => self::PLATINUM, 'name' => 'Platinum'],
    ];

    /** @var list<array{id:int,code:string,name:string,sort_order:int}>|null request-scoped cache */
    private static ?array $cache = null;

    /**
     * Every active metal, in display order.
     * @return list<array{id:int,code:string,name:string,sort_order:int}>
     */
    public static function all(): array
    {
        if (self::$cache !== null) {
            return self::$cache;
        }

        try {
            $rows = Database::fetchAll(
                'SELECT id, code, name, sort_order FROM metals WHERE is_active = 1 ORDER BY sort_order, name'
            );
        } catch (\Throwable) {
            $rows = [];   // table missing — fall through to the built-ins
        }

        if ($rows === []) {
            $rows = [];
            foreach (self::BUILT_IN as $i => $metal) {
                $rows[] = ['id' => 0, 'code' => $metal['code'], 'name' => $metal['name'], 'sort_order' => $i + 1];
            }
            return self::$cache = $rows;
        }

        return self::$cache = array_map(static fn (array $r): array => [
            'id' => (int) $r['id'],
            'code' => (string) $r['code'],
            'name' => (string) $r['name'],
            'sort_order' => (int) $r['sort_order'],
        ], $rows);
    }

    /** @return list<string> */
    public static function codes(): array
    {
        return array_column(self::all(), 'code');
    }

    /** Validation rule for `Validator` — `in:gold,silver,…`, built from the master. */
    public static function rule(): string
    {
        return 'in:' . implode(',', self::codes());
    }

    /**
     * Coerce whatever arrived to a metal we can post. Unknown values fall back to
     * gold, which is what the old inline ternaries did — but now only a genuinely
     * unrecognised string lands there, not every metal past the second.
     */
    public static function normalise(mixed $metal): string
    {
        $value = is_string($metal) ? strtolower(trim($metal)) : '';
        return in_array($value, self::codes(), true) ? $value : self::GOLD;
    }

    /** Display name for a stored code — falls back to the code for a metal since removed. */
    public static function label(string $code): string
    {
        foreach (self::all() as $metal) {
            if ($metal['code'] === $code) {
                return $metal['name'];
            }
        }
        return ucfirst($code);
    }

    /**
     * Add a metal, its two ledgers and its first purity — all or nothing.
     *
     * @param array{name:string,code?:?string,purity_code:string,purity_label?:?string,fineness:float|string} $data
     * @return array{id:int,code:string,name:string,sort_order:int}
     */
    public static function create(array $data, ?int $userId): array
    {
        $name = trim((string) $data['name']);
        if ($name === '') {
            throw new \DomainException('Give the metal a name.');
        }

        $code = self::slug((string) ($data['code'] ?? '') !== '' ? (string) $data['code'] : $name);
        if ($code === '') {
            throw new \DomainException('The short code must contain at least one letter or number.');
        }
        if (strlen($code) > 30) {
            throw new \DomainException('The short code is too long — keep it under 30 characters.');
        }

        $purityCode = strtoupper(trim((string) $data['purity_code']));
        if ($purityCode === '') {
            throw new \DomainException('Give the first purity a code, such as PT950.');
        }
        $purityLabel = trim((string) ($data['purity_label'] ?? '')) ?: ($name . ' ' . $purityCode);
        $fineness = round((float) $data['fineness'], 4);
        if ($fineness <= 0 || $fineness > 1) {
            throw new \DomainException('Purity must be between 0 and 1 — 22K gold is 0.9160.');
        }

        $id = Database::transaction(static function () use (
            $code, $name, $purityCode, $purityLabel, $fineness, $userId
        ): int {
            $existing = Database::fetchOne('SELECT id, name, is_active FROM metals WHERE code = :c', ['c' => $code]);
            if ($existing !== null && (int) $existing['is_active'] === 1) {
                throw new \DomainException(sprintf('“%s” is already in your metal list.', $existing['name']));
            }

            if ($existing !== null) {
                // it was turned off before — bring it back rather than orphan its history
                $id = (int) $existing['id'];
                Database::execute(
                    'UPDATE metals SET name = :n, is_active = 1 WHERE id = :id',
                    ['n' => $name, 'id' => $id]
                );
            } else {
                $sort = (int) (Database::fetchValue('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM metals') ?? 1);
                $id = Database::insert('metals', [
                    'code' => $code,
                    'name' => $name,
                    'sort_order' => $sort,
                    'created_by' => $userId,
                ]);
            }

            // Without these two, the first bill in this metal dies at finalize.
            self::ensureLedger('inventory', $code, 'Inventory — ' . $name, 'Inventory', 'asset', 'dr');
            self::ensureLedger('sales', $code, $name . ' Sales', 'Sales', 'income', 'cr');

            $puritySort = (int) (Database::fetchValue('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM purities') ?? 1);
            Database::execute(
                'INSERT INTO purities (metal, code, label, fineness, sort_order)
                      VALUES (:m, :c, :l, :f, :s)
                 ON DUPLICATE KEY UPDATE label = :l2, fineness = :f2, is_active = 1',
                ['m' => $code, 'c' => $purityCode, 'l' => $purityLabel, 'f' => $fineness, 's' => $puritySort,
                 'l2' => $purityLabel, 'f2' => $fineness]
            );

            return $id;
        });

        self::$cache = null;

        Audit::log($userId, 'metal.create', 'metals', $id, null, [
            'code' => $code,
            'name' => $name,
            'purity' => $purityCode,
            'fineness' => $fineness,
        ]);

        foreach (self::all() as $metal) {
            if ($metal['code'] === $code) {
                return $metal;
            }
        }
        return ['id' => $id, 'code' => $code, 'name' => $name, 'sort_order' => 0];
    }

    /** Clears the cache (used by tests/CLI that add a metal mid-run). */
    public static function flush(): void
    {
        self::$cache = null;
    }

    /** Create a system ledger for this metal if it is not already there. */
    private static function ensureLedger(
        string $linkedType,
        string $metal,
        string $name,
        string $groupName,
        string $groupNature,
        string $openingType
    ): void {
        $existing = Database::fetchValue(
            'SELECT id FROM ledger_accounts WHERE linked_type = :t AND linked_id IS NULL AND metal = :m LIMIT 1',
            ['t' => $linkedType, 'm' => $metal]
        );
        if ($existing !== null) {
            return;
        }

        $groupId = Database::fetchValue(
            'SELECT id FROM account_groups WHERE name = :n AND nature = :na ORDER BY id LIMIT 1',
            ['n' => $groupName, 'na' => $groupNature]
        );
        if ($groupId === null) {
            throw new \RuntimeException("Account group \"{$groupName}\" is missing. Run database/seed.php.");
        }

        Database::insert('ledger_accounts', [
            'group_id' => (int) $groupId,
            'name' => $name,
            'linked_type' => $linkedType,
            'metal' => $metal,
            'opening_type' => $openingType,
            'is_system' => 1,
        ]);
    }

    /** "White Gold" → "white_gold". The code is what every row stores. */
    private static function slug(string $value): string
    {
        $slug = strtolower(trim($value));
        $slug = preg_replace('/[^a-z0-9]+/', '_', $slug) ?? '';
        return trim($slug, '_');
    }
}
