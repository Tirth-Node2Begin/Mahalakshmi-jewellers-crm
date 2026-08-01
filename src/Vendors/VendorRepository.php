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

    /**
     * Everything the vendor profile page shows: the party record, what we bought,
     * what we paid, what they supplied, and the net position.
     */
    public static function detail(int $id): ?array
    {
        $vendor = Database::fetchOne('SELECT * FROM suppliers WHERE id = :id', ['id' => $id]);
        if ($vendor === null) {
            return null;
        }
        $items = Database::fetchAll(
            // `status` was called `jw_status` before the jewellery migration renamed it
            "SELECT id, item_code, name, status, current_stock FROM inventory_items WHERE vendor_id = :id ORDER BY id DESC LIMIT 50",
            ['id' => $id]
        );
        // Purchase history — carries paid / balance so the profile never has to
        // re-derive "still to pay" from payment_status (which ignores part payments).
        $purchases = Database::fetchAll(
            "SELECT id, purchase_no, purchase_date, status, invoice_ref, grand_total, paid_amount,
                    GREATEST(grand_total - paid_amount, 0) AS balance_due, payment_status
             FROM purchases WHERE supplier_id = :id ORDER BY purchase_date DESC, id DESC LIMIT 50",
            ['id' => $id]
        );
        $payments = Database::fetchAll(
            "SELECT vp.id, vp.payment_no, vp.payment_date, vp.payment_mode, vp.amount, vp.ref_no, vp.status,
                    p.purchase_no, ba.account_name
             FROM vendor_payments vp
             LEFT JOIN purchases p ON p.id = vp.purchase_id
             LEFT JOIN bank_accounts ba ON ba.id = vp.bank_account_id
             WHERE vp.supplier_id = :id
             ORDER BY vp.payment_date DESC, vp.id DESC LIMIT 50",
            ['id' => $id]
        );

        // Spend summary — cancelled bills and cancelled payments are excluded, so
        // these tie back to the vendor ledger rather than to the purchases table alone.
        $spend = Database::fetchOne(
            "SELECT COUNT(*) AS purchase_count,
                    COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN grand_total ELSE 0 END), 0) AS total_purchased,
                    COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN GREATEST(grand_total - paid_amount, 0) ELSE 0 END), 0) AS unpaid_amount,
                    MAX(CASE WHEN status <> 'cancelled' THEN purchase_date END) AS last_purchase_date
             FROM purchases WHERE supplier_id = :id",
            ['id' => $id]
        ) ?? [];
        $paid = Database::fetchOne(
            "SELECT COUNT(*) AS payment_count,
                    COALESCE(SUM(amount), 0) AS total_paid,
                    MAX(payment_date) AS last_payment_date
             FROM vendor_payments WHERE supplier_id = :id AND status = 'active'",
            ['id' => $id]
        ) ?? [];

        $openingCr = ((string) ($vendor['opening_type'] ?? 'cr')) === 'cr'
            ? (float) ($vendor['opening_balance'] ?? 0)
            : -(float) ($vendor['opening_balance'] ?? 0);
        $totalPurchased = (float) ($spend['total_purchased'] ?? 0);
        $totalPaid = (float) ($paid['total_paid'] ?? 0);

        $summary = [
            'total_purchased' => $totalPurchased,
            'total_paid' => $totalPaid,
            // What we still owe overall: opening + billed − paid. Negative = advance with them.
            'balance_due' => round($openingCr + $totalPurchased - $totalPaid, 2),
            // Bill-wise arrears (ignores on-account advances) — what the "due bills" picker offers.
            'unpaid_amount' => (float) ($spend['unpaid_amount'] ?? 0),
            'opening_balance' => $openingCr,
            'purchase_count' => (int) ($spend['purchase_count'] ?? 0),
            'payment_count' => (int) ($paid['payment_count'] ?? 0),
            // real total — the items list above is capped at 50 rows for display
            'item_count' => (int) Database::fetchValue('SELECT COUNT(*) FROM inventory_items WHERE vendor_id = :id', ['id' => $id]),
            'last_purchase_date' => $spend['last_purchase_date'] ?? null,
            'last_payment_date' => $paid['last_payment_date'] ?? null,
        ];

        return [
            'vendor' => $vendor,
            'items' => $items,
            'purchases' => $purchases,
            'payments' => $payments,
            'summary' => $summary,
        ];
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
