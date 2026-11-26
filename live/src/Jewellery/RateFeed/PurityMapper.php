<?php

declare(strict_types=1);

namespace CRM\Jewellery\RateFeed;

use CRM\Database\Database;

/**
 * Matches published benchmark quotes to this shop's `purities` rows.
 *
 * MATCHING IS BY FINENESS, NOT BY CODE. The shop's codes are its own — one
 * install calls fine gold "24K", another "999", a third "24KT" — but 0.9990 is
 * 0.9990 everywhere. Fineness is also what Pricing already multiplies by, so
 * matching on it keeps the rate consistent with how the bill is computed.
 *
 * A purity the source does not publish (sterling 925, platinum 950) is DERIVED
 * pro-rata from the finest published quote of the same metal:
 *   925 silver = (999 silver ÷ 0.999) × 0.925
 * That is the same arithmetic the trade uses, and the derivation is recorded on
 * the quote so the review card can label it rather than passing it off as a
 * published figure.
 */
final class PurityMapper
{
    /** Two purities are the same when their fineness agrees to this much. */
    private const FINENESS_TOLERANCE = 0.0005;

    /**
     * @param Quote[] $quotes
     * @return array<int,array{purity:array<string,mixed>, quote:Quote, rate:float, derived_from:?string}>
     *         keyed by purity id
     */
    public static function map(array $quotes): array
    {
        if ($quotes === []) {
            return [];
        }

        $purities = Database::fetchAll(
            'SELECT id, metal, code, label, fineness FROM purities WHERE is_active = 1 ORDER BY metal, sort_order, code'
        );

        // the finest published quote per metal, used for the pro-rata fallback
        $finest = [];
        foreach ($quotes as $q) {
            if (!isset($finest[$q->metal]) || $q->fineness > $finest[$q->metal]->fineness) {
                $finest[$q->metal] = $q;
            }
        }

        $mapped = [];
        foreach ($purities as $purity) {
            $metal = (string) $purity['metal'];
            $fineness = (float) $purity['fineness'];
            if ($fineness <= 0) {
                continue;               // malformed master row — never guess a rate for it
            }

            $exact = self::exactMatch($quotes, $metal, $fineness);
            if ($exact !== null) {
                $mapped[(int) $purity['id']] = [
                    'purity' => $purity,
                    'quote' => $exact,
                    'rate' => $exact->perGram(),
                    'derived_from' => null,
                ];
                continue;
            }

            $base = $finest[$metal] ?? null;
            if ($base === null) {
                continue;               // metal not published at all (nothing to derive from)
            }
            // never derive UP: inferring 999 from a published 750 would multiply
            // the source's own rounding error by a third
            if ($fineness > $base->fineness + self::FINENESS_TOLERANCE) {
                continue;
            }

            $perGramFine = $base->perGram() / $base->fineness;
            $mapped[(int) $purity['id']] = [
                'purity' => $purity,
                'quote' => $base,
                'rate' => round($perGramFine * $fineness, 2),
                'derived_from' => $base->label,
            ];
        }

        return $mapped;
    }

    /** @param Quote[] $quotes */
    private static function exactMatch(array $quotes, string $metal, float $fineness): ?Quote
    {
        foreach ($quotes as $q) {
            if ($q->metal === $metal && abs($q->fineness - $fineness) <= self::FINENESS_TOLERANCE) {
                return $q;
            }
        }
        return null;
    }

    /**
     * Active purities the source could not cover at all — surfaced so the review
     * card can say "platinum still needs entering by hand" instead of letting a
     * partially-filled day look complete.
     *
     * @param array<int,mixed> $mapped keyed by purity id
     * @return array<int,array<string,mixed>>
     */
    public static function unmatched(array $mapped): array
    {
        $rows = Database::fetchAll(
            'SELECT id, metal, code, label FROM purities WHERE is_active = 1 ORDER BY metal, sort_order, code'
        );
        return array_values(array_filter($rows, static fn (array $r): bool => !isset($mapped[(int) $r['id']])));
    }
}
