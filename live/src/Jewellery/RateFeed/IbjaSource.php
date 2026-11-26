<?php

declare(strict_types=1);

namespace CRM\Jewellery\RateFeed;

/**
 * IBJA — India Bullion and Jewellers Association (ibjarates.com).
 *
 * WHY THIS SOURCE AND NOT A GOVERNMENT ONE:
 * no Government of India site publishes a daily retail metal rate. The only
 * government number for gold and silver is CBIC's fortnightly customs tariff
 * value (USD per 10 g, an import valuation — see CbicSource), and there is no
 * government platinum figure at all. IBJA is the national trade benchmark: the
 * rate the Income-Tax department's gold valuation and the RBI's Sovereign Gold
 * Bond issue price are both derived from, and the rate jewellers actually bill
 * against. It is the closest thing to official that exists daily.
 *
 * PAGE CONTRACT (verified 2026-08-04):
 *   <span id="lblGold999_AM">142938</span>   gold + platinum quoted per 10 g
 *   <span id="lblSilver999_AM">219417</span> silver quoted per kg
 *   <input id="HdnRatesAvaliable" value='[{"ID":"30994","RateTime":"12AM"}]'>
 * The PM spans are present but empty until the afternoon publication.
 *
 * The parser is deliberately strict: it matches the exact span ids and nothing
 * else. A layout change produces zero quotes and a loud `empty` run, which is
 * the safe failure. A loose regex that started matching some other number on the
 * page would be the dangerous one — it would produce a plausible wrong rate.
 */
final class IbjaSource
{
    public const NAME = 'ibja';
    public const URL = 'https://www.ibjarates.com/';

    /**
     * The purities IBJA publishes, with the unit each is quoted in.
     * @var array<string,array{metal:string,fineness:float,unit:string}>
     */
    private const PUBLISHED = [
        'Gold999' => ['metal' => 'gold', 'fineness' => 0.999, 'unit' => 'per_10g'],
        'Gold995' => ['metal' => 'gold', 'fineness' => 0.995, 'unit' => 'per_10g'],
        'Gold916' => ['metal' => 'gold', 'fineness' => 0.916, 'unit' => 'per_10g'],
        'Gold750' => ['metal' => 'gold', 'fineness' => 0.750, 'unit' => 'per_10g'],
        'Gold585' => ['metal' => 'gold', 'fineness' => 0.585, 'unit' => 'per_10g'],
        'Silver999' => ['metal' => 'silver', 'fineness' => 0.999, 'unit' => 'per_kg'],
        'Platinum999' => ['metal' => 'platinum', 'fineness' => 0.999, 'unit' => 'per_10g'],
    ];

    public static function fetch(): SourceResult
    {
        $res = HttpFetcher::get(self::URL);
        if (!$res['ok']) {
            return SourceResult::failed(self::NAME, 'Could not reach ibjarates.com — ' . ($res['error'] ?? 'unknown error'), $res['status'] ?: null, $res['ms']);
        }

        $html = $res['body'];
        $token = self::token($html);

        // Prefer the afternoon publication when it is out: PM is the settled
        // close, AM is the morning opening. Falling back the other way would let
        // a half-published page (PM spans present but blank) wipe out the AM
        // rates we already have.
        foreach (['PM', 'AM'] as $session) {
            $quotes = self::parseSession($html, $session);
            if ($quotes !== []) {
                return SourceResult::ok(self::NAME, $quotes, $token, $res['status'], $res['ms'], ['session' => $session]);
            }
        }

        // Page fetched fine but nothing parsed. Either a holiday before the
        // morning publication, or the span ids changed under us. Distinguish the
        // two by whether the table markers are still there at all.
        $recognised = str_contains($html, 'lblGold999_AM');
        return SourceResult::empty(
            self::NAME,
            $recognised
                ? 'IBJA has not published rates yet today (the table is empty).'
                : 'The IBJA page layout has changed — the rate fields were not found. The parser needs updating.',
            $res['status'],
            $res['ms'],
            $token
        );
    }

    /** @return Quote[] */
    private static function parseSession(string $html, string $session): array
    {
        $quotes = [];

        foreach (self::PUBLISHED as $key => $spec) {
            $value = self::spanValue($html, "lbl{$key}_{$session}");
            if ($value === null || $value <= 0) {
                continue;
            }

            $quotes[] = new Quote(
                metal: $spec['metal'],
                fineness: $spec['fineness'],
                label: self::prettyLabel($key),
                rawValue: $value,
                rawUnit: $spec['unit'],
                session: $session,
            );
        }

        // A partial parse is a broken parse. If IBJA published at all it
        // published the whole table, so anything less than the gold spine means
        // we are reading the page wrong — better to report nothing than to stage
        // three rates and silently drop the rest.
        $gold = \count(array_filter($quotes, static fn (Quote $q): bool => $q->metal === 'gold'));
        return $gold >= 3 ? $quotes : [];
    }

    /** The numeric content of <span id="…">…</span>, or null when absent/blank. */
    private static function spanValue(string $html, string $id): ?float
    {
        $pattern = '/<span[^>]*\bid\s*=\s*"' . preg_quote($id, '/') . '"[^>]*>([^<]*)<\/span>/i';
        if (preg_match($pattern, $html, $m) !== 1) {
            return null;
        }

        // strip thousands separators and any stray markup entities
        $raw = trim(html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $raw = str_replace([',', ' ', "\u{00a0}"], '', $raw);
        if ($raw === '' || !is_numeric($raw)) {
            return null;
        }

        return (float) $raw;
    }

    /**
     * IBJA's publication id. Two runs returning the same token means the source
     * has not published anything new — that is how a Sunday page showing
     * Saturday's numbers gets caught instead of being staged as "today's rate".
     */
    private static function token(string $html): ?string
    {
        if (preg_match('/id\s*=\s*"HdnRatesAvaliable"[^>]*value\s*=\s*"([^"]*)"/i', $html, $m) !== 1) {
            return null;
        }
        $decoded = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $parsed = json_decode($decoded, true);
        if (\is_array($parsed) && isset($parsed[0]['ID'])) {
            return (string) $parsed[0]['ID'] . '/' . (string) ($parsed[0]['RateTime'] ?? '');
        }
        return substr($decoded, 0, 80) ?: null;
    }

    private static function prettyLabel(string $key): string
    {
        return trim(preg_replace('/(?<=[a-z])(?=\d)/', ' ', $key) ?? $key);
    }
}
