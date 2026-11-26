<?php

declare(strict_types=1);

namespace CRM\Jewellery\RateFeed;

use CRM\Database\Database;

/**
 * The guard between a scraped number and a printed bill.
 *
 * The failure this exists for is not "IBJA published a wrong rate" — that
 * essentially does not happen. It is "the page changed and we are now reading
 * the wrong number off it", which produces a rate that is confidently, silently
 * wrong. Every check here is therefore aimed at catching a parser that has come
 * loose, not at second-guessing the market:
 *
 *   move        — day-over-day jump beyond the configured band
 *   ordering    — a lower fineness priced above a higher one of the same metal
 *   ratio       — gold priced below silver, or a metal ratio far off its norm
 *   envelope    — a per-gram figure outside any plausible range for that metal,
 *                 which is what a units change (per 10 g → per g) looks like
 *   stale_token — the source republished nothing since the last run
 *   cbic        — outside the government tariff-value band, when one is on record
 *
 * Nothing here rejects a rate. Flags travel with the quote to the review card so
 * the person pressing Apply sees exactly what looked odd, because a real market
 * shock and a broken parser produce the same flag and only a human can tell them
 * apart.
 */
final class SanityCheck
{
    public const SEVERITY_WARN = 'warn';
    public const SEVERITY_BLOCK = 'block';

    /** Plausible per-gram envelope per metal, in rupees. Wide on purpose — these
     *  bound "is this the right kind of number at all", not the market. */
    private const ENVELOPE = [
        'gold' => [1_000.0, 100_000.0],
        'silver' => [10.0, 2_000.0],
        'platinum' => [500.0, 50_000.0],
    ];

    /**
     * @param array<int,array{purity:array<string,mixed>, quote:Quote, rate:float, derived_from:?string}> $mapped
     * @param array<string,mixed> $context  previous_rates, cbic band, token info
     * @return array<int,array<int,array{code:string,message:string,severity:string}>> flags keyed by purity id
     */
    public static function run(array $mapped, string $rateDate, array $context = []): array
    {
        $maxMovePct = self::maxMovePct();
        $previous = self::previousRates(array_keys($mapped), $rateDate);
        $cbic = $context['cbic'] ?? null;
        $tokenRepeated = (bool) ($context['token_repeated'] ?? false);

        $flags = [];
        foreach ($mapped as $purityId => $row) {
            $found = [];
            $metal = (string) $row['purity']['metal'];
            $name = trim($metal . ' ' . (string) $row['purity']['code']);
            $rate = (float) $row['rate'];

            // 1. plausible envelope — catches a units change at the source
            [$lo, $hi] = self::ENVELOPE[$metal] ?? [0.0, 0.0];
            if ($hi > 0 && ($rate < $lo || $rate > $hi)) {
                $found[] = self::flag(
                    'envelope',
                    sprintf('₹%s/g is outside the plausible range for %s (₹%s–₹%s). The source may have changed the unit it quotes in.',
                        number_format($rate, 2), $metal, number_format($lo), number_format($hi)),
                    self::SEVERITY_BLOCK
                );
            }

            // 2. day-over-day move
            $prev = $previous[$purityId] ?? null;
            if ($prev !== null && $prev['rate'] > 0) {
                $movePct = abs($rate - $prev['rate']) / $prev['rate'] * 100;
                if ($movePct > $maxMovePct) {
                    $direction = $rate > $prev['rate'] ? 'up' : 'down';
                    $found[] = self::flag(
                        'move',
                        sprintf('%s is %s %.1f%% from ₹%s on %s — larger than the %.0f%% you allow without a check.',
                            $name, $direction, $movePct, number_format($prev['rate'], 2),
                            date('j M', (int) strtotime($prev['date'])), $maxMovePct),
                        $movePct > $maxMovePct * 3 ? self::SEVERITY_BLOCK : self::SEVERITY_WARN
                    );
                }
            }

            // 3. government cross-check, when a tariff value is on record.
            // Compared on FINE metal so 22K gold is judged against the same
            // benchmark as 24K rather than looking 8% cheap.
            if (\is_array($cbic) && ($cbic['available'] ?? false) && isset($cbic['bands'][$metal])) {
                $fineness = (float) $row['purity']['fineness'];
                $finePerGram = $fineness > 0 ? $rate / $fineness : $rate;
                $band = $cbic['bands'][$metal];
                if ($finePerGram < $band['low'] || $finePerGram > $band['high']) {
                    $found[] = self::flag(
                        'cbic',
                        sprintf('%s works out to ₹%s per gram of fine %s, outside the ₹%s–₹%s band implied by the CBIC customs tariff value%s.',
                            $name, number_format($finePerGram, 2), $metal,
                            number_format($band['low'], 2), number_format($band['high'], 2),
                            $cbic['notification'] ? ' (' . $cbic['notification'] . ')' : ''),
                        self::SEVERITY_WARN
                    );
                }
            }

            if ($found !== []) {
                $flags[$purityId] = $found;
            }
        }

        // 4. ordering within a metal — a purer grade must not be cheaper
        foreach (self::orderingProblems($mapped) as $purityId => $flag) {
            $flags[$purityId][] = $flag;
        }

        // 5. cross-metal ratio — gold should not be priced under silver
        foreach (self::ratioProblems($mapped) as $purityId => $flag) {
            $flags[$purityId][] = $flag;
        }

        // 6. nothing new published since the last run — applies to every quote
        if ($tokenRepeated) {
            $note = self::flag(
                'stale_token',
                'The source has not published a new rate since the last fetch — these may be the previous session\'s numbers.',
                self::SEVERITY_WARN
            );
            foreach (array_keys($mapped) as $purityId) {
                $flags[$purityId][] = $note;
            }
        }

        return $flags;
    }

    /** @param array<int,array<string,mixed>> $mapped @return array<int,array{code:string,message:string,severity:string}> */
    private static function orderingProblems(array $mapped): array
    {
        $byMetal = [];
        foreach ($mapped as $purityId => $row) {
            $byMetal[(string) $row['purity']['metal']][$purityId] = $row;
        }

        $out = [];
        foreach ($byMetal as $metal => $rows) {
            uasort($rows, static fn (array $a, array $b): int => (float) $b['purity']['fineness'] <=> (float) $a['purity']['fineness']);
            $previousRate = null;
            $previousName = '';
            foreach ($rows as $purityId => $row) {
                $rate = (float) $row['rate'];
                if ($previousRate !== null && $rate > $previousRate + 0.01) {
                    $out[$purityId] = self::flag(
                        'ordering',
                        sprintf('%s %s (₹%s/g) is priced above the purer %s — the rates look mismatched.',
                            $metal, (string) $row['purity']['code'], number_format($rate, 2), $previousName),
                        self::SEVERITY_BLOCK
                    );
                }
                $previousRate = $rate;
                $previousName = $metal . ' ' . (string) $row['purity']['code'];
            }
        }
        return $out;
    }

    /** @param array<int,array<string,mixed>> $mapped @return array<int,array{code:string,message:string,severity:string}> */
    private static function ratioProblems(array $mapped): array
    {
        $finest = [];
        foreach ($mapped as $purityId => $row) {
            $metal = (string) $row['purity']['metal'];
            $fineness = (float) $row['purity']['fineness'];
            if ($fineness <= 0) {
                continue;
            }
            $fine = (float) $row['rate'] / $fineness;
            if (!isset($finest[$metal]) || $fine > $finest[$metal]['fine']) {
                $finest[$metal] = ['fine' => $fine, 'purity_id' => $purityId];
            }
        }

        if (!isset($finest['gold'], $finest['silver'])) {
            return [];
        }

        $ratio = $finest['silver']['fine'] > 0 ? $finest['gold']['fine'] / $finest['silver']['fine'] : 0.0;
        // the gold:silver ratio has stayed inside roughly 15–150 for a century;
        // outside that, one of the two numbers is being read wrong
        if ($ratio >= 15 && $ratio <= 150) {
            return [];
        }

        // an inverted ratio (<1) is the units-swapped case and reads as "0×" at
        // whole-number precision, so describe it the way round it actually is
        $description = $ratio >= 1
            ? sprintf('Gold works out to %s× silver per gram', $ratio >= 10 ? number_format($ratio) : number_format($ratio, 1))
            : sprintf('Silver works out to %s× gold per gram', $ratio > 0 ? number_format(1 / $ratio, 1) : '∞');

        return [$finest['gold']['purity_id'] => self::flag(
            'ratio',
            $description . ' — well outside the usual range. One of the two rates is likely misread.',
            self::SEVERITY_BLOCK
        )];
    }

    /** Last rate strictly before this date, per purity. @param int[] $purityIds @return array<int,array{rate:float,date:string}> */
    private static function previousRates(array $purityIds, string $rateDate): array
    {
        if ($purityIds === []) {
            return [];
        }
        $ids = implode(',', array_map('intval', $purityIds));
        $rows = Database::fetchAll(
            "SELECT r.purity_id, r.rate_per_gram, r.rate_date
               FROM metal_rates r
               JOIN (SELECT purity_id, MAX(rate_date) AS d FROM metal_rates
                      WHERE purity_id IN ($ids) AND rate_date < :d GROUP BY purity_id) latest
                 ON latest.purity_id = r.purity_id AND latest.d = r.rate_date",
            ['d' => $rateDate]
        );

        $out = [];
        foreach ($rows as $r) {
            $out[(int) $r['purity_id']] = ['rate' => (float) $r['rate_per_gram'], 'date' => (string) $r['rate_date']];
        }
        return $out;
    }

    private static function maxMovePct(): float
    {
        $v = (float) (Database::fetchValue("SELECT svalue FROM settings WHERE skey = 'rate_feed_max_move_pct'") ?? 0);
        return $v > 0 ? $v : 8.0;
    }

    /** @return array{code:string,message:string,severity:string} */
    private static function flag(string $code, string $message, string $severity): array
    {
        return ['code' => $code, 'message' => $message, 'severity' => $severity];
    }
}
