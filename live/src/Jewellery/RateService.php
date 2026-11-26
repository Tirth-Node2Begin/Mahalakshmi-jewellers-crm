<?php

declare(strict_types=1);

namespace CRM\Jewellery;

use CRM\Database\Database;
use CRM\Support\Audit;

/**
 * Daily gold/silver rates (plan/06 §3).
 *
 * Rates are per gram, per purity, per day. A bill STAMPS the rate it used onto
 * its lines, so changing today's rate never rewrites yesterday's bills.
 */
final class RateService
{
    /** Active purities, gold first, with today's rate attached where set. */
    public static function purities(?string $date = null): array
    {
        $date ??= date('Y-m-d');
        return Database::fetchAll(
            "SELECT p.id, p.metal, p.code, p.label, p.fineness, r.rate_per_gram, r.rate_date
               FROM purities p
          LEFT JOIN metal_rates r ON r.purity_id = p.id AND r.rate_date = :d
              WHERE p.is_active = 1
              ORDER BY p.metal DESC, p.sort_order, p.code",
            ['d' => $date]
        );
    }

    /** Rate for a purity on a date; falls back to the most recent earlier rate. */
    public static function rateFor(int $purityId, ?string $date = null): ?array
    {
        $date ??= date('Y-m-d');

        $exact = Database::fetchOne(
            'SELECT rate_per_gram, rate_date FROM metal_rates WHERE purity_id = :p AND rate_date = :d',
            ['p' => $purityId, 'd' => $date]
        );
        if ($exact !== null) {
            return ['rate' => (float) $exact['rate_per_gram'], 'rate_date' => $exact['rate_date'], 'is_stale' => false];
        }

        $prior = Database::fetchOne(
            'SELECT rate_per_gram, rate_date FROM metal_rates
              WHERE purity_id = :p AND rate_date < :d ORDER BY rate_date DESC LIMIT 1',
            ['p' => $purityId, 'd' => $date]
        );
        if ($prior === null) {
            return null;
        }
        return ['rate' => (float) $prior['rate_per_gram'], 'rate_date' => $prior['rate_date'], 'is_stale' => true];
    }

    /** True when every active purity has a rate entered for the date. */
    public static function ratesSetFor(?string $date = null): bool
    {
        $date ??= date('Y-m-d');
        $missing = (int) Database::fetchValue(
            'SELECT COUNT(*) FROM purities p
              WHERE p.is_active = 1
                AND NOT EXISTS (SELECT 1 FROM metal_rates r WHERE r.purity_id = p.id AND r.rate_date = :d)',
            ['d' => $date]
        );
        return $missing === 0;
    }

    /**
     * Save the rates for a date. Re-entering the same day overwrites and audits.
     * @param array<int,float> $rates purity_id => rate per gram
     */
    public static function setRates(array $rates, string $date, ?int $userId): void
    {
        if ($rates === []) {
            throw new \RuntimeException('No rates supplied.');
        }

        Database::transaction(static function () use ($rates, $date, $userId): void {
            foreach ($rates as $purityId => $rate) {
                $purityId = (int) $purityId;
                $rate = round((float) $rate, 2);
                if ($rate <= 0) {
                    throw new \RuntimeException('A rate must be greater than zero.');
                }

                $existing = Database::fetchOne(
                    'SELECT id, rate_per_gram FROM metal_rates WHERE purity_id = :p AND rate_date = :d',
                    ['p' => $purityId, 'd' => $date]
                );

                if ($existing === null) {
                    Database::insert('metal_rates', [
                        'rate_date' => $date,
                        'purity_id' => $purityId,
                        'rate_per_gram' => $rate,
                        'created_by' => $userId,
                    ]);
                    Audit::log($userId, 'rates.set', 'metal_rates', $purityId, null, ['date' => $date, 'rate' => $rate]);
                } elseif (abs((float) $existing['rate_per_gram'] - $rate) > 0.001) {
                    Database::execute(
                        'UPDATE metal_rates SET rate_per_gram = :r, created_by = :u WHERE id = :id',
                        ['r' => $rate, 'u' => $userId, 'id' => $existing['id']]
                    );
                    Audit::log(
                        $userId,
                        'rates.update',
                        'metal_rates',
                        (int) $existing['id'],
                        ['rate' => (float) $existing['rate_per_gram']],
                        ['date' => $date, 'rate' => $rate]
                    );
                }
            }
        });
    }

    /** Recent rate history for the trend view. */
    public static function history(int $days = 30): array
    {
        return Database::fetchAll(
            "SELECT r.rate_date, p.metal, p.code, r.rate_per_gram
               FROM metal_rates r JOIN purities p ON p.id = r.purity_id
              WHERE r.rate_date >= DATE_SUB(CURDATE(), INTERVAL :d DAY)
              ORDER BY r.rate_date DESC, p.metal DESC, p.sort_order",
            ['d' => $days]
        );
    }
}
