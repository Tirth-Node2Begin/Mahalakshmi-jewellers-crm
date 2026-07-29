<?php

declare(strict_types=1);

namespace CRM\Jewellery;

use CRM\Database\Database;
use CRM\Support\Audit;

/**
 * Draft bills (plan/07 §1).
 *
 * A draft has NO invoice number and NO effect on stock or the ledger — it is
 * just a saved basket. Each counter can hold several at once ("held bills") and
 * recover them after a refresh, because the draft lives in the database rather
 * than in browser state.
 */
final class InvoiceDraft
{
    /** Create or update a draft and return its id. */
    public static function save(?int $invoiceId, array $input, ?int $userId): int
    {
        return Database::transaction(static function () use ($invoiceId, $input, $userId): int {
            $customerId = !empty($input['customer_id']) ? (int) $input['customer_id'] : null;
            $billDate = (string) ($input['invoice_date'] ?? date('Y-m-d'));
            $priceMode = ($input['price_mode'] ?? 'exclusive') === 'inclusive' ? 'inclusive' : 'exclusive';
            $interState = self::isInterState($customerId);

            if ($invoiceId !== null) {
                $existing = Database::fetchOne('SELECT id, status FROM invoices WHERE id = :id', ['id' => $invoiceId]);
                if ($existing === null) {
                    throw new \RuntimeException('Bill not found.');
                }
                if ($existing['status'] !== 'draft') {
                    throw new \DomainException('This bill is already finalised — it can no longer be edited.');
                }
                Database::execute(
                    'UPDATE invoices SET customer_id = :c, walkin_name = :wn, walkin_phone = :wp,
                            invoice_date = :d, price_mode = :pm, discount_total = :disc, notes = :n
                      WHERE id = :id',
                    [
                        'c' => $customerId,
                        'wn' => $input['walkin_name'] ?? null,
                        'wp' => $input['walkin_phone'] ?? null,
                        'd' => $billDate,
                        'pm' => $priceMode,
                        'disc' => round((float) ($input['discount'] ?? 0), 2),
                        'n' => $input['notes'] ?? null,
                        'id' => $invoiceId,
                    ]
                );
                Database::execute('DELETE FROM invoice_items WHERE invoice_id = :id', ['id' => $invoiceId]);
                Database::execute('DELETE FROM invoice_old_metal WHERE invoice_id = :id', ['id' => $invoiceId]);
            } else {
                $invoiceId = Database::insert('invoices', [
                    'invoice_no' => null,
                    'customer_id' => $customerId,
                    'walkin_name' => $input['walkin_name'] ?? null,
                    'walkin_phone' => $input['walkin_phone'] ?? null,
                    'invoice_date' => $billDate,
                    'price_mode' => $priceMode,
                    'status' => 'draft',
                    'discount_total' => round((float) ($input['discount'] ?? 0), 2),
                    'notes' => $input['notes'] ?? null,
                    'created_by' => $userId,
                ]);
            }

            $totals = self::writeLines($invoiceId, $input['items'] ?? [], $billDate, $priceMode, $interState);
            $oldMetalValue = self::writeOldMetal($invoiceId, $input['old_metal'] ?? [], $billDate);

            $discount = round((float) ($input['discount'] ?? 0), 2);
            $beforeRounding = round(
                $totals['metal'] + $totals['making'] - $discount + $totals['tax'] - $oldMetalValue,
                2
            );
            [$roundOff, $grandTotal] = Pricing::roundOff($beforeRounding);

            Database::execute(
                'UPDATE invoices SET subtotal = :sub, metal_total = :metal, making_total = :making,
                        tax_total = :tax, cgst = :cgst, sgst = :sgst, igst = :igst,
                        old_metal_value = :old, round_off = :ro, grand_total = :gt
                  WHERE id = :id',
                [
                    'sub' => round($totals['metal'] + $totals['making'], 2),
                    'metal' => $totals['metal'],
                    'making' => $totals['making'],
                    'tax' => $totals['tax'],
                    'cgst' => $totals['cgst'],
                    'sgst' => $totals['sgst'],
                    'igst' => $totals['igst'],
                    'old' => $oldMetalValue,
                    'ro' => $roundOff,
                    'gt' => $grandTotal,
                    'id' => $invoiceId,
                ]
            );

            return $invoiceId;
        });
    }

    /** Delete a draft outright — nothing was posted, so nothing to reverse. */
    public static function discard(int $invoiceId, ?int $userId): void
    {
        $status = Database::fetchValue('SELECT status FROM invoices WHERE id = :id', ['id' => $invoiceId]);
        if ($status === null) {
            throw new \RuntimeException('Bill not found.');
        }
        if ($status !== 'draft') {
            throw new \DomainException('Only a draft can be discarded. Cancel the bill instead.');
        }
        Database::transaction(static function () use ($invoiceId, $userId): void {
            Database::execute('DELETE FROM invoice_items WHERE invoice_id = :id', ['id' => $invoiceId]);
            Database::execute('DELETE FROM invoice_old_metal WHERE invoice_id = :id', ['id' => $invoiceId]);
            Database::execute('DELETE FROM invoices WHERE id = :id', ['id' => $invoiceId]);
            Audit::log($userId, 'invoice.draft_discard', 'invoices', $invoiceId);
        });
    }

    /**
     * Price and persist the lines. Rates come from the bill date, so a bill
     * always uses the rate of the day it was written.
     */
    private static function writeLines(
        int $invoiceId,
        array $items,
        string $billDate,
        string $priceMode,
        bool $interState
    ): array {
        $metal = 0.0;
        $making = 0.0;
        $cgst = 0.0;
        $sgst = 0.0;
        $igst = 0.0;

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

            if ($itemId !== null && $item === null) {
                throw new \RuntimeException('Item not found.');
            }

            $qty = max(0.0, (float) ($row['qty'] ?? 1));
            $grossWeight = (float) ($row['gross_weight'] ?? $item['gross_weight'] ?? 0);
            $netWeight = (float) ($row['net_weight'] ?? $item['net_weight'] ?? 0);
            if ($netWeight > $grossWeight + 0.0005 && $grossWeight > 0) {
                throw new \RuntimeException('Net weight cannot be more than gross weight.');
            }

            // rate: explicit override, else the day's rate for that purity
            $ratePerGram = isset($row['rate_per_gram']) ? (float) $row['rate_per_gram'] : 0.0;
            if ($ratePerGram <= 0 && $item !== null && $item['purity_id'] !== null) {
                $rate = RateService::rateFor((int) $item['purity_id'], $billDate);
                if ($rate === null) {
                    throw new \RuntimeException(
                        "No rate has been entered for {$item['purity_code']}. Set today's rates first."
                    );
                }
                $ratePerGram = $rate['rate'];
            }

            $priced = Pricing::line([
                'qty' => $qty,
                'net_weight' => $netWeight,
                'rate_per_gram' => $ratePerGram,
                'making_type' => $row['making_type'] ?? $item['making_type'] ?? 'per_gram',
                'making_value' => $row['making_value'] ?? $item['making_value'] ?? 0,
                'discount' => (float) ($row['discount'] ?? 0),
                'tax_rate' => (float) ($row['tax_rate'] ?? $defaultTaxRate),
                'tax_treatment' => $row['tax_treatment'] ?? 'taxable',
                'price_mode' => $priceMode,
            ], $interState);

            $treatment = $priced['tax_treatment'];
            $exemptReason = $row['exempt_reason'] ?? null;
            if ($treatment !== 'taxable' && ($exemptReason === null || trim((string) $exemptReason) === '')) {
                throw new \RuntimeException('A reason is required when a line is not taxed.');
            }

            Database::insert('invoice_items', [
                'invoice_id' => $invoiceId,
                'item_type' => $item !== null && $item['tracking'] === 'tagged' ? 'tagged' : 'bulk',
                'inventory_item_id' => $itemId,
                'description' => (string) ($row['description'] ?? $item['name'] ?? 'Item'),
                'purity_code' => $row['purity_code'] ?? $item['purity_code'] ?? null,
                'qty' => $qty,
                'gross_weight' => round($grossWeight, 3),
                'net_weight' => round($netWeight, 3),
                'rate_per_gram' => $priced['rate_per_gram'],
                'metal_value' => $priced['metal_value'],
                'making_charge' => $priced['making_charge'],
                'rate' => $priced['rate_per_gram'],
                'discount' => $priced['discount'],
                'tax_rate' => $priced['tax_rate'],
                'tax_treatment' => $treatment,
                'exempt_reason' => $treatment !== 'taxable' ? $exemptReason : null,
                'tax_amount' => $priced['tax_amount'],
                'cgst' => $priced['cgst'],
                'sgst' => $priced['sgst'],
                'igst' => $priced['igst'],
                'line_total' => $priced['line_total'],
            ]);

            $metal += $priced['metal_value'];
            $making += $priced['making_charge'];
            $cgst += $priced['cgst'];
            $sgst += $priced['sgst'];
            $igst += $priced['igst'];
        }

        return [
            'metal' => round($metal, 2),
            'making' => round($making, 2),
            'cgst' => round($cgst, 2),
            'sgst' => round($sgst, 2),
            'igst' => round($igst, 2),
            'tax' => round($cgst + $sgst + $igst, 2),
        ];
    }

    /** Old gold/silver taken in exchange — value credited against the bill. */
    private static function writeOldMetal(int $invoiceId, array $rows, string $billDate): float
    {
        $total = 0.0;

        foreach ($rows as $row) {
            $metal = ($row['metal'] ?? 'gold') === 'silver' ? 'silver' : 'gold';
            $purityId = !empty($row['purity_id']) ? (int) $row['purity_id'] : null;

            $ratePerGram = isset($row['rate_per_gram']) ? (float) $row['rate_per_gram'] : 0.0;
            if ($ratePerGram <= 0 && $purityId !== null) {
                $rate = RateService::rateFor($purityId, $billDate);
                $ratePerGram = $rate['rate'] ?? 0.0;
            }
            if ($ratePerGram <= 0) {
                throw new \RuntimeException('Enter a rate for the old metal being exchanged.');
            }

            $valued = Pricing::oldMetal(
                (float) ($row['gross_weight'] ?? 0),
                (float) ($row['deduction_pct'] ?? 0),
                $ratePerGram
            );
            if ($valued['net_weight'] <= 0) {
                continue;
            }

            Database::insert('invoice_old_metal', [
                'invoice_id' => $invoiceId,
                'metal' => $metal,
                'purity_id' => $purityId,
                'description' => $row['description'] ?? null,
                'gross_weight' => $valued['gross_weight'],
                'deduction_pct' => $valued['deduction_pct'],
                'net_weight' => $valued['net_weight'],
                'rate_per_gram' => $valued['rate_per_gram'],
                'value' => $valued['value'],
            ]);

            $total += $valued['value'];
        }

        return round($total, 2);
    }

    /** Customer in another state → IGST instead of CGST+SGST. */
    private static function isInterState(?int $customerId): bool
    {
        if ($customerId === null) {
            return false;   // walk-in is always local
        }
        $customerGstin = (string) Database::fetchValue(
            'SELECT gstin FROM customers WHERE id = :id',
            ['id' => $customerId]
        );
        $ownGstin = (string) Database::fetchValue(
            "SELECT svalue FROM settings WHERE skey = 'company_gstin'"
        );
        if (strlen($customerGstin) < 2 || strlen($ownGstin) < 2) {
            return false;
        }
        return substr($customerGstin, 0, 2) !== substr($ownGstin, 0, 2);
    }
}
