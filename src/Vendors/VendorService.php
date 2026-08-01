<?php

declare(strict_types=1);

namespace CRM\Vendors;

use CRM\Auth\AuthUser;
use CRM\Database\Database;
use CRM\Validation\Validator;

/** Vendor / Karigar CRUD (info.md §5.11) on the repurposed `suppliers` table. */
final class VendorService
{
    public const TYPES = [
        'bullion', 'diamond', 'stone', 'packaging',
        'karigar', 'manufacturer',
        'hallmark', 'cad', 'service', 'other',
    ];
    /** Types that actually make jewellery — shown when an order is outsourced. */
    public const MAKER_TYPES = ['karigar', 'manufacturer'];
    public const STATUSES = ['active', 'inactive', 'blacklisted'];

    /**
     * Shop-added types from the vendor_types master (2026_08_01 migration) —
     * the built-ins above stay in code because the category tabs and the maker
     * picklist depend on them.
     *
     * @return list<array{id:int,slug:string,label:string}>
     */
    public static function customTypes(): array
    {
        return array_map(
            static fn (array $r): array => ['id' => (int) $r['id'], 'slug' => (string) $r['slug'], 'label' => (string) $r['label']],
            Database::fetchAll('SELECT id, slug, label FROM vendor_types ORDER BY label')
        );
    }

    /**
     * Adds a custom vendor type. The slug (what suppliers.vendor_type stores) is
     * derived from the label the same way Metals::create() derives a code.
     *
     * @return array{id:int,slug:string,label:string}
     */
    public static function addType(array $body, AuthUser $user): array
    {
        $data = Validator::validate($body, ['label' => 'required|string|min:2|max:60']);
        $label = (string) $data['label'];
        $slug = substr(trim(preg_replace('/[^a-z0-9]+/', '_', strtolower($label)) ?? '', '_'), 0, 30);
        if ($slug === '') {
            throw new \DomainException('The type name needs at least one letter or number.');
        }
        $exists = in_array($slug, self::TYPES, true)
            || Database::fetchOne('SELECT id FROM vendor_types WHERE slug = :s OR label = :l', ['s' => $slug, 'l' => $label]) !== null;
        if ($exists) {
            throw new \DomainException('That type already exists — pick it from the list.');
        }
        $id = Database::insert('vendor_types', ['slug' => $slug, 'label' => $label, 'created_by' => $user->id]);
        return ['id' => $id, 'slug' => $slug, 'label' => $label];
    }

    public static function save(array $body, AuthUser $user): int
    {
        // built-in + shop-added types; slugs are a-z0-9_ only, so safe in an in: rule
        $types = array_merge(self::TYPES, array_column(self::customTypes(), 'slug'));
        $data = Validator::validate($body, [
            'id' => 'nullable|int|min:1',
            'name' => 'required|string|min:2|max:150',
            'vendor_type' => 'required|in:' . implode(',', $types),
            'company' => 'nullable|string|max:150',
            'contact_person' => 'nullable|string|max:120',
            'gstin' => 'nullable|string|max:20',
            'pan_no' => 'nullable|string|max:15',
            'mobile' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:150',
            'address' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:100',
            'state' => 'nullable|string|max:100',
            'pincode' => 'nullable|string|max:12',
            'bank_name' => 'nullable|string|max:120',
            'account_no' => 'nullable|string|max:40',
            'ifsc' => 'nullable|string|max:20',
            'upi' => 'nullable|string|max:80',
            'payment_terms' => 'nullable|string|max:120',
            'specialisation' => 'nullable|string|max:120',
            'karigar_rate' => 'nullable|numeric|min:0',
            'vendor_status' => 'nullable|in:' . implode(',', self::STATUSES),
            'notes' => 'nullable|string|max:2000',
        ]);
        $status = $data['vendor_status'] ?? 'active';
        $fields = [
            'name' => $data['name'],
            'vendor_type' => $data['vendor_type'],
            'company' => $data['company'] ?? null,
            'contact_person' => $data['contact_person'] ?? null,
            'gstin' => $data['gstin'] ?? null,
            'pan_no' => $data['pan_no'] ?? null,
            'mobile' => $data['mobile'] ?? null,
            'email' => $data['email'] ?? null,
            'address' => $data['address'] ?? null,
            'city' => $data['city'] ?? null,
            'state' => $data['state'] ?? null,
            'pincode' => $data['pincode'] ?? null,
            'bank_name' => $data['bank_name'] ?? null,
            'account_no' => $data['account_no'] ?? null,
            'ifsc' => $data['ifsc'] ?? null,
            'upi' => $data['upi'] ?? null,
            'payment_terms' => $data['payment_terms'] ?? null,
            'specialisation' => $data['specialisation'] ?? null,
            'karigar_rate' => isset($data['karigar_rate']) ? round((float) $data['karigar_rate'], 2) : null,
            'vendor_status' => $status,
            'is_active' => $status === 'active' ? 1 : 0,
            'notes' => $data['notes'] ?? null,
        ];
        if (!empty($data['id'])) {
            self::findOrFail((int) $data['id']);
            $set = implode(', ', array_map(static fn (string $c): string => "`$c` = :$c", array_keys($fields)));
            Database::execute("UPDATE suppliers SET $set WHERE id = :pk", $fields + ['pk' => $data['id']]);
            return (int) $data['id'];
        }
        return Database::insert('suppliers', $fields + ['created_by' => $user->id]);
    }

    public static function toggle(int $id): void
    {
        $vendor = self::findOrFail($id);
        $newStatus = ((string) $vendor['vendor_status']) === 'active' ? 'inactive' : 'active';
        Database::execute(
            'UPDATE suppliers SET vendor_status = :s, is_active = :a WHERE id = :id',
            ['s' => $newStatus, 'a' => $newStatus === 'active' ? 1 : 0, 'id' => $id]
        );
    }

    public static function delete(int $id): void
    {
        self::findOrFail($id);
        $refs = (int) Database::fetchValue('SELECT COUNT(*) FROM inventory_items WHERE vendor_id = :id', ['id' => $id])
            + (int) Database::fetchValue('SELECT COUNT(*) FROM purchases WHERE supplier_id = :id', ['id' => $id])
            + (int) Database::fetchValue('SELECT COUNT(*) FROM vendor_payments WHERE supplier_id = :id', ['id' => $id]);
        if ($refs > 0) {
            throw new \DomainException('This vendor is linked to stock, purchases or payments — deactivate it instead of deleting.');
        }
        Database::execute('DELETE FROM suppliers WHERE id = :id', ['id' => $id]);
    }

    /** @return array<string,mixed> */
    private static function findOrFail(int $id): array
    {
        $vendor = Database::fetchOne('SELECT * FROM suppliers WHERE id = :id', ['id' => $id]);
        if ($vendor === null) {
            throw new \RuntimeException('Vendor not found.');
        }
        return $vendor;
    }
}
