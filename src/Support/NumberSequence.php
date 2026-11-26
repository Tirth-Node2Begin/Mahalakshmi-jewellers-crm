<?php

declare(strict_types=1);

namespace CRM\Support;

use CRM\Database\Database;

/**
 * Race-safe document numbering. MUST be called inside the caller's
 * Database::transaction() — the SELECT ... FOR UPDATE row lock holds until
 * that transaction commits.
 *
 * seq_keys: invoice/receipt/purchase (fiscal period, e.g. '2627'),
 *           customer/work/employee/item_rm/item_st (period '').
 */
final class NumberSequence
{
    private const FISCAL_KEYS = [
        'invoice', 'receipt', 'purchase', 'estimate', 'vendor_payment', 'voucher',
    ];

    private const DEFAULTS = [
        'invoice' => ['prefix' => 'INV-', 'padding' => 5],
        'estimate' => ['prefix' => 'EST-', 'padding' => 5],
        'receipt' => ['prefix' => 'RCPT-', 'padding' => 5],
        'purchase' => ['prefix' => 'PUR-', 'padding' => 5],
        'vendor_payment' => ['prefix' => 'PAY-', 'padding' => 5],
        'voucher' => ['prefix' => 'VCH-', 'padding' => 5],
        'customer' => ['prefix' => 'CUST-', 'padding' => 4],
        'employee' => ['prefix' => 'EMP-', 'padding' => 4],
        'vendor' => ['prefix' => 'VEN-', 'padding' => 4],
        'item_rm' => ['prefix' => 'RM-', 'padding' => 4],
        'item_st' => ['prefix' => 'ST-', 'padding' => 4],
        'adjustment' => ['prefix' => 'ADJ-', 'padding' => 4],
    ];

    public static function next(string $seqKey): string
    {
        if (!Database::pdo()->inTransaction()) {
            throw new \LogicException('NumberSequence::next() must run inside a transaction.');
        }

        $isFiscal = in_array($seqKey, self::FISCAL_KEYS, true);
        $period = $isFiscal ? FiscalYear::code() : '';

        $row = Database::fetchOne(
            'SELECT * FROM number_sequences WHERE seq_key = :k AND period = :p LIMIT 1 FOR UPDATE',
            ['k' => $seqKey, 'p' => $period]
        );

        if ($row === null) {
            // fiscal rollover (or unseeded key): create the row on first allocation
            $defaults = self::DEFAULTS[$seqKey] ?? ['prefix' => strtoupper($seqKey) . '-', 'padding' => 5];
            Database::insert('number_sequences', [
                'seq_key' => $seqKey,
                'period' => $period,
                'prefix' => $defaults['prefix'],
                'next_number' => 2,
                'padding' => $defaults['padding'],
            ]);
            $number = 1;
            $prefix = $defaults['prefix'];
            $padding = $defaults['padding'];
        } else {
            $number = (int) $row['next_number'];
            $prefix = (string) $row['prefix'];
            $padding = (int) $row['padding'];
            Database::execute('UPDATE number_sequences SET next_number = next_number + 1 WHERE id = :id', ['id' => $row['id']]);
        }

        $formatted = str_pad((string) $number, $padding, '0', STR_PAD_LEFT);
        return $isFiscal ? $prefix . $period . '-' . $formatted : $prefix . $formatted;
    }

    /** Non-allocating preview of the next number for a key. */
    public static function preview(string $seqKey): string
    {
        $isFiscal = in_array($seqKey, self::FISCAL_KEYS, true);
        $period = $isFiscal ? FiscalYear::code() : '';
        $row = Database::fetchOne(
            'SELECT * FROM number_sequences WHERE seq_key = :k AND period = :p LIMIT 1',
            ['k' => $seqKey, 'p' => $period]
        );
        $defaults = self::DEFAULTS[$seqKey] ?? ['prefix' => strtoupper($seqKey) . '-', 'padding' => 5];
        $number = $row !== null ? (int) $row['next_number'] : 1;
        $prefix = $row !== null ? (string) $row['prefix'] : $defaults['prefix'];
        $padding = $row !== null ? (int) $row['padding'] : $defaults['padding'];
        $formatted = str_pad((string) $number, $padding, '0', STR_PAD_LEFT);
        return $isFiscal ? $prefix . $period . '-' . $formatted : $prefix . $formatted;
    }
}
