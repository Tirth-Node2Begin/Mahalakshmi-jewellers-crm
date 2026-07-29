<?php

declare(strict_types=1);

namespace CRM\Jewellery;

use CRM\Database\Database;
use CRM\Support\Audit;
use CRM\Support\NumberSequence;

/**
 * Estimates / quotations (plan/07 §3a).
 *
 * A price slip, not a bill: its own EST- number, NO stock movement, NO ledger
 * posting, no tax liability. Converting one creates a normal draft invoice
 * which then goes through the usual finalize transaction.
 */
final class EstimateService
{
    public static function save(?int $estimateId, array $input, ?int $userId): int
    {
        return Database::transaction(static function () use ($estimateId, $input, $userId): int {
            $customerId = !empty($input['customer_id']) ? (int) $input['customer_id'] : null;
            $date = (string) ($input['estimate_date'] ?? date('Y-m-d'));
            $priceMode = ($input['price_mode'] ?? 'exclusive') === 'inclusive' ? 'inclusive' : 'exclusive';

            $validityDays = (int) (Database::fetchValue(
                "SELECT svalue FROM settings WHERE skey = 'estimate_validity_days'"
            ) ?? 7);
            $validUntil = $input['valid_until'] ?? date('Y-m-d', strtotime($date . " +{$validityDays} days"));

            if ($estimateId !== null) {
                $existing = Database::fetchOne('SELECT id, status FROM estimates WHERE id = :id', ['id' => $estimateId]);
                if ($existing === null) {
                    throw new \RuntimeException('Estimate not found.');
                }
                if ($existing['status'] === 'converted') {
                    throw new \DomainException('This estimate has already been turned into a bill.');
                }
                Database::execute(
                    'UPDATE estimates SET customer_id = :c, walkin_name = :wn, walkin_phone = :wp,
                            estimate_date = :d, valid_until = :vu, price_mode = :pm,
                            discount_total = :disc, notes = :n
                      WHERE id = :id',
                    [
                        'c' => $customerId,
                        'wn' => $input['walkin_name'] ?? null,
                        'wp' => $input['walkin_phone'] ?? null,
                        'd' => $date,
                        'vu' => $validUntil,
                        'pm' => $priceMode,
                        'disc' => round((float) ($input['discount'] ?? 0), 2),
                        'n' => $input['notes'] ?? null,
                        'id' => $estimateId,
                    ]
                );
                Database::execute('DELETE FROM estimate_items WHERE estimate_id = :id', ['id' => $estimateId]);
            } else {
                $estimateId = Database::insert('estimates', [
                    'estimate_no' => NumberSequence::next('estimate'),
                    'customer_id' => $customerId,
                    'walkin_name' => $input['walkin_name'] ?? null,
                    'walkin_phone' => $input['walkin_phone'] ?? null,
                    'estimate_date' => $date,
                    'valid_until' => $validUntil,
                    'price_mode' => $priceMode,
                    'discount_total' => round((float) ($input['discount'] ?? 0), 2),
                    'notes' => $input['notes'] ?? null,
                    'status' => 'open',
                    'created_by' => $userId,
                ]);
            }

            $totals = self::writeLines($estimateId, $input['items'] ?? [], $date, $priceMode);
            $discount = round((float) ($input['discount'] ?? 0), 2);
            $grandTotal = round($totals['metal'] + $totals['making'] - $discount + $totals['tax'], 2);

            Database::execute(
                'UPDATE estimates SET metal_total = :m, making_total = :mk, tax_estimate = :t, grand_total = :g
                  WHERE id = :id',
                [
                    'm' => $totals['metal'], 'mk' => $totals['making'],
                    't' => $totals['tax'], 'g' => $grandTotal, 'id' => $estimateId,
                ]
            );

            return $estimateId;
        });
    }

    /**
     * Turn an estimate into a draft bill. Re-prices at today's rate unless the
     * estimate is still valid and the user chooses to hold the quoted rate.
     */
    public static function convert(int $estimateId, bool $holdQuotedRate, ?int $userId): int
    {
        return Database::transaction(static function () use ($estimateId, $holdQuotedRate, $userId): int {
            $estimate = Database::fetchOne('SELECT * FROM estimates WHERE id = :id FOR UPDATE', ['id' => $estimateId]);
            if ($estimate === null) {
                throw new \RuntimeException('Estimate not found.');
            }
            if ($estimate['status'] === 'converted') {
                throw new \DomainException('This estimate has already been turned into a bill.');
            }
            if ($estimate['status'] === 'cancelled') {
                throw new \DomainException('This estimate was cancelled.');
            }

            $expired = $estimate['valid_until'] !== null && $estimate['valid_until'] < date('Y-m-d');
            if ($holdQuotedRate && $expired) {
                throw new \DomainException('This estimate has expired — it must be re-priced at today\'s rate.');
            }

            $lines = Database::fetchAll(
                'SELECT * FROM estimate_items WHERE estimate_id = :id ORDER BY id',
                ['id' => $estimateId]
            );

            $items = [];
            foreach ($lines as $line) {
                $items[] = [
                    'item_id' => $line['inventory_item_id'],
                    'description' => $line['description'],
                    'purity_code' => $line['purity_code'],
                    'qty' => (float) $line['qty'],
                    'gross_weight' => (float) $line['gross_weight'],
                    'net_weight' => (float) $line['net_weight'],
                    // hold the quoted rate, or leave it at 0 so the draft re-prices
                    'rate_per_gram' => $holdQuotedRate ? (float) $line['rate_per_gram'] : 0,
                    'making_value' => (float) $line['making_charge'],
                    'making_type' => 'fixed',
                    'discount' => (float) $line['discount'],
                    'tax_rate' => (float) $line['tax_rate'],
                ];
            }

            $invoiceId = InvoiceDraft::save(null, [
                'customer_id' => $estimate['customer_id'],
                'walkin_name' => $estimate['walkin_name'],
                'walkin_phone' => $estimate['walkin_phone'],
                'invoice_date' => date('Y-m-d'),
                'price_mode' => $estimate['price_mode'],
                'discount' => (float) $estimate['discount_total'],
                'items' => $items,
            ], $userId);

            Database::execute(
                "UPDATE invoices SET estimate_id = :e WHERE id = :id",
                ['e' => $estimateId, 'id' => $invoiceId]
            );
            Database::execute(
                "UPDATE estimates SET status = 'converted', converted_invoice_id = :i WHERE id = :id",
                ['i' => $invoiceId, 'id' => $estimateId]
            );

            Audit::log($userId, 'estimate.convert', 'estimates', $estimateId, null, ['invoice_id' => $invoiceId]);

            return $invoiceId;
        });
    }

    public static function cancel(int $estimateId, ?int $userId): void
    {
        $status = Database::fetchValue('SELECT status FROM estimates WHERE id = :id', ['id' => $estimateId]);
        if ($status === null) {
            throw new \RuntimeException('Estimate not found.');
        }
        if ($status === 'converted') {
            throw new \DomainException('A converted estimate cannot be cancelled — cancel the bill instead.');
        }
        Database::execute("UPDATE estimates SET status = 'cancelled' WHERE id = :id", ['id' => $estimateId]);
        Audit::log($userId, 'estimate.cancel', 'estimates', $estimateId);
    }

    public static function list(array $filters = []): array
    {
        $sql = "SELECT e.id, e.estimate_no, e.estimate_date, e.valid_until, e.status, e.grand_total,
                       COALESCE(c.name, e.walkin_name, 'Walk-in') AS customer_name,
                       e.converted_invoice_id, i.invoice_no,
                       (e.status = 'open' AND e.valid_until < CURDATE()) AS is_expired
                  FROM estimates e
             LEFT JOIN customers c ON c.id = e.customer_id
             LEFT JOIN invoices i ON i.id = e.converted_invoice_id
                 WHERE 1 = 1";
        $params = [];

        if (!empty($filters['status'])) {
            $sql .= ' AND e.status = :s';
            $params['s'] = $filters['status'];
        }
        if (!empty($filters['search'])) {
            $sql .= ' AND (e.estimate_no LIKE :q OR c.name LIKE :q2 OR e.walkin_name LIKE :q3)';
            $like = '%' . $filters['search'] . '%';
            $params['q'] = $like;
            $params['q2'] = $like;
            $params['q3'] = $like;
        }

        $sql .= ' ORDER BY e.estimate_date DESC, e.id DESC LIMIT 200';
        return Database::fetchAll($sql, $params);
    }

    public static function detail(int $estimateId): ?array
    {
        $estimate = Database::fetchOne(
            'SELECT e.*, c.name AS customer_name, c.mobile AS customer_mobile, c.address AS customer_address,
                    u.full_name AS created_by_name, i.invoice_no
               FROM estimates e
          LEFT JOIN customers c ON c.id = e.customer_id
          LEFT JOIN users u ON u.id = e.created_by
          LEFT JOIN invoices i ON i.id = e.converted_invoice_id
              WHERE e.id = :id',
            ['id' => $estimateId]
        );
        if ($estimate === null) {
            return null;
        }
        $estimate['items'] = Database::fetchAll(
            'SELECT ei.*, it.item_code FROM estimate_items ei
          LEFT JOIN inventory_items it ON it.id = ei.inventory_item_id
              WHERE ei.estimate_id = :id ORDER BY ei.id',
            ['id' => $estimateId]
        );
        return $estimate;
    }

    private static function writeLines(int $estimateId, array $items, string $date, string $priceMode): array
    {
        $metal = 0.0;
        $making = 0.0;
        $tax = 0.0;

        $defaultTaxRate = (float) (Database::fetchValue(
            "SELECT svalue FROM settings WHERE skey = 'default_tax_rate'"
        ) ?? 3);

        foreach ($items as $row) {
            $itemId = !empty($row['item_id']) ? (int) $row['item_id'] : null;
            $item = $itemId !== null
                ? Database::fetchOne(
                    'SELECT i.*, p.code AS purity_code FROM inventory_items i
                  LEFT JOIN purities p ON p.id = i.purity_id WHERE i.id = :id',
                    ['id' => $itemId]
                )
                : null;

            $netWeight = (float) ($row['net_weight'] ?? $item['net_weight'] ?? 0);
            $ratePerGram = isset($row['rate_per_gram']) ? (float) $row['rate_per_gram'] : 0.0;
            if ($ratePerGram <= 0 && $item !== null && $item['purity_id'] !== null) {
                $rate = RateService::rateFor((int) $item['purity_id'], $date);
                $ratePerGram = $rate['rate'] ?? 0.0;
            }

            $priced = Pricing::line([
                'qty' => (float) ($row['qty'] ?? 1),
                'net_weight' => $netWeight,
                'rate_per_gram' => $ratePerGram,
                'making_type' => $row['making_type'] ?? $item['making_type'] ?? 'per_gram',
                'making_value' => $row['making_value'] ?? $item['making_value'] ?? 0,
                'discount' => (float) ($row['discount'] ?? 0),
                'tax_rate' => (float) ($row['tax_rate'] ?? $defaultTaxRate),
                'price_mode' => $priceMode,
            ], false);

            Database::insert('estimate_items', [
                'estimate_id' => $estimateId,
                'inventory_item_id' => $itemId,
                'description' => (string) ($row['description'] ?? $item['name'] ?? 'Item'),
                'purity_code' => $row['purity_code'] ?? $item['purity_code'] ?? null,
                'qty' => $priced['qty'],
                'gross_weight' => round((float) ($row['gross_weight'] ?? $item['gross_weight'] ?? 0), 3),
                'net_weight' => $priced['net_weight'],
                'rate_per_gram' => $priced['rate_per_gram'],
                'metal_value' => $priced['metal_value'],
                'making_charge' => $priced['making_charge'],
                'discount' => $priced['discount'],
                'tax_rate' => $priced['tax_rate'],
                'tax_amount' => $priced['tax_amount'],
                'line_total' => $priced['line_total'],
            ]);

            $metal += $priced['metal_value'];
            $making += $priced['making_charge'];
            $tax += $priced['tax_amount'];
        }

        return ['metal' => round($metal, 2), 'making' => round($making, 2), 'tax' => round($tax, 2)];
    }
}
