<?php

declare(strict_types=1);

namespace CRM\Jewellery\RateFeed;

/**
 * One published benchmark rate, normalised to rupees per gram.
 *
 * Sources quote in the unit their trade uses — gold and platinum per 10 grams,
 * silver per kilo. The conversion happens here, once, so nothing downstream has
 * to remember which metal is quoted how. `rawValue`/`rawUnit` survive alongside
 * the converted number: when a manager disputes a rate we want to show them the
 * figure exactly as the source printed it.
 */
final class Quote
{
    public function __construct(
        public readonly string $metal,        // gold, silver, platinum
        public readonly float $fineness,      // 0.999, 0.916, …
        public readonly string $label,        // "Gold 999" — as the source prints it
        public readonly float $rawValue,      // 142938
        public readonly string $rawUnit,      // per_10g | per_kg | per_g
        public readonly string $session,      // AM | PM
    ) {
    }

    /** Rupees per gram, rounded the way metal_rates stores it. */
    public function perGram(): float
    {
        return round($this->rawValue / self::gramsIn($this->rawUnit), 2);
    }

    public static function gramsIn(string $unit): float
    {
        return match ($unit) {
            'per_10g' => 10.0,
            'per_kg' => 1000.0,
            'per_g' => 1.0,
            default => throw new \InvalidArgumentException("Unknown rate unit: $unit"),
        };
    }

    /** "per 10 g" — for the review card, so staff see what was published. */
    public function unitLabel(): string
    {
        return match ($this->rawUnit) {
            'per_10g' => 'per 10 g',
            'per_kg' => 'per kg',
            default => 'per g',
        };
    }
}
