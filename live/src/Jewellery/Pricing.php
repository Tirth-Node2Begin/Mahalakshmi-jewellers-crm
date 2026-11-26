<?php

declare(strict_types=1);

namespace CRM\Jewellery;

/**
 * Jewellery line pricing (plan/07 §1, §3b).
 *
 *   metal value = net weight × rate per gram          (the rate is already purity-specific)
 *   making      = per gram | fixed | percent of metal value
 *   taxable     = metal + making − discount
 *
 * Tax-exclusive: GST is added on top of the taxable amount.
 * Tax-inclusive: the quoted figure already contains GST, so it is stripped out
 *                (tax = amount × rate ÷ (100 + rate)). The customer's agreed
 *                number stands and the shop's income drops accordingly.
 */
final class Pricing
{
    /**
     * @param array{net_weight:float, rate_per_gram:float, making_type?:string,
     *              making_value?:float, qty?:float, discount?:float,
     *              tax_rate?:float, tax_treatment?:string, price_mode?:string} $line
     * @param bool $interState IGST instead of CGST+SGST
     */
    public static function line(array $line, bool $interState = false): array
    {
        $qty = max(0.0, (float) ($line['qty'] ?? 1));
        $netWeight = max(0.0, (float) ($line['net_weight'] ?? 0));
        $ratePerGram = max(0.0, (float) ($line['rate_per_gram'] ?? 0));
        $discount = max(0.0, (float) ($line['discount'] ?? 0));
        $taxRate = max(0.0, (float) ($line['tax_rate'] ?? 0));
        $treatment = (string) ($line['tax_treatment'] ?? 'taxable');
        $priceMode = (string) ($line['price_mode'] ?? 'exclusive');

        $metalValue = round($netWeight * $ratePerGram * $qty, 2);
        $making = round(self::makingCharge(
            (string) ($line['making_type'] ?? 'per_gram'),
            (float) ($line['making_value'] ?? 0),
            $netWeight,
            $metalValue,
            $qty
        ), 2);

        $taxable = round($metalValue + $making - $discount, 2);
        if ($taxable < 0) {
            $taxable = 0.0;
        }

        // only 'taxable' lines carry output GST; the rest are still full sales
        $effectiveRate = $treatment === 'taxable' ? $taxRate : 0.0;

        if ($priceMode === 'inclusive' && $effectiveRate > 0) {
            // the agreed figure already contains the tax — back it out
            $tax = round($taxable * $effectiveRate / (100 + $effectiveRate), 2);
            $net = round($taxable - $tax, 2);
            $lineTotal = $taxable;
            // metal/making are shown net of the tax they carried
            $scale = $taxable > 0 ? $net / $taxable : 1.0;
            $metalValue = round($metalValue * $scale, 2);
            $making = round($net - $metalValue, 2);
        } else {
            $tax = round($taxable * $effectiveRate / 100, 2);
            $lineTotal = round($taxable + $tax, 2);
        }

        [$cgst, $sgst, $igst] = self::splitTax($tax, $interState);

        return [
            'qty' => $qty,
            'net_weight' => round($netWeight, 3),
            'rate_per_gram' => round($ratePerGram, 2),
            'metal_value' => $metalValue,
            'making_charge' => $making,
            'discount' => round($discount, 2),
            'taxable_value' => round($metalValue + $making - $discount, 2),
            'tax_rate' => $taxRate,
            'tax_treatment' => $treatment,
            'tax_amount' => $tax,
            'cgst' => $cgst,
            'sgst' => $sgst,
            'igst' => $igst,
            'line_total' => $lineTotal,
        ];
    }

    /** Making charge by scheme. `percent` is a percentage of the metal value. */
    public static function makingCharge(
        string $type,
        float $value,
        float $netWeight,
        float $metalValue,
        float $qty = 1.0
    ): float {
        return match ($type) {
            'fixed' => $value * $qty,
            'percent' => $metalValue * $value / 100,
            default => $value * $netWeight * $qty,   // per_gram
        };
    }

    /** @return array{0:float,1:float,2:float} cgst, sgst, igst */
    public static function splitTax(float $tax, bool $interState): array
    {
        if ($tax <= 0) {
            return [0.0, 0.0, 0.0];
        }
        if ($interState) {
            return [0.0, 0.0, round($tax, 2)];
        }
        $half = round($tax / 2, 2);
        // put any rounding remainder on SGST so the halves always sum to the tax
        return [$half, round($tax - $half, 2), 0.0];
    }

    /** Value of old metal taken in exchange, after the melting deduction. */
    public static function oldMetal(float $grossWeight, float $deductionPct, float $ratePerGram): array
    {
        $grossWeight = max(0.0, $grossWeight);
        $deductionPct = min(100.0, max(0.0, $deductionPct));
        $netWeight = round($grossWeight * (1 - $deductionPct / 100), 3);
        return [
            'gross_weight' => round($grossWeight, 3),
            'deduction_pct' => round($deductionPct, 2),
            'net_weight' => $netWeight,
            'rate_per_gram' => round($ratePerGram, 2),
            'value' => round($netWeight * $ratePerGram, 2),
        ];
    }

    /** Round the bill to the nearest rupee; returns [round_off, grand_total]. */
    public static function roundOff(float $amount): array
    {
        $rounded = round($amount);
        return [round($rounded - $amount, 2), $rounded];
    }
}
