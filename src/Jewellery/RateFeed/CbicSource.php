<?php

declare(strict_types=1);

namespace CRM\Jewellery\RateFeed;

use CRM\Database\Database;

/**
 * CBIC customs tariff values — the government cross-check.
 *
 * WHAT THIS IS NOT: a counter rate. CBIC (cbic.gov.in, Ministry of Finance)
 * notifies a *customs tariff value* for imported gold and silver — USD per 10 g
 * and USD per kg, revised roughly fortnightly, used to assess import duty. It is
 * the only daily-metal number the Government of India publishes at all, it does
 * not cover platinum, and it is not what a shop bills on. It is useful for
 * exactly one thing: confirming a scraped IBJA rate is in the right universe. A
 * parser that starts reading a phone number off the page fails this instantly.
 *
 * WHY IT IS MANUAL-FIRST:
 * CBIC has no machine-readable feed. taxinformation.cbic.gov.in is a JavaScript
 * application whose JSON API returns 401 without a session, and the old plain
 * HTML notification index (cbic.gov.in/htdocs-cbec/customs/…/csnt-2026.htm) now
 * 404s — both confirmed 2026-08-04. So the tariff values live in `settings`,
 * where an admin pastes the two numbers from the notification once a fortnight,
 * and this class turns them into a band. `attemptRefresh()` still tries the site
 * each morning so the day CBIC publishes a real feed, this starts working on its
 * own instead of quietly staying manual forever.
 *
 * When the values are absent the cross-check simply reports itself unavailable.
 * It never blocks a fetch — SanityCheck's day-over-day band is the guard that
 * always runs.
 */
final class CbicSource
{
    public const NAME = 'cbic';

    /** Landing page kept for attemptRefresh() and for the "where do I get this" link in the UI. */
    public const NOTIFICATION_URL = 'https://taxinformation.cbic.gov.in/content-page/explore-notification';

    /** How wide the government reference band is, either side of the converted tariff value.
     *  Deliberately loose: a tariff value is an import assessable value and lags
     *  the retail benchmark by design, plus it may be up to a fortnight stale. It
     *  is a sanity envelope, not a price check. */
    private const BAND_PCT = 35.0;

    /** Tariff values older than this are too stale to judge anything by. */
    private const MAX_AGE_DAYS = 45;

    /**
     * The government reference band in rupees per gram of FINE metal, or a
     * reason string explaining why there isn't one.
     *
     * @return array{available:bool, reason:?string, notification:?string, effective_from:?string,
     *               bands:array<string,array{low:float,high:float,reference:float}>}
     */
    public static function band(): array
    {
        $settings = self::settings();
        $usdInr = self::usdInr($settings);

        $unavailable = static fn (string $why): array => [
            'available' => false, 'reason' => $why, 'notification' => null,
            'effective_from' => null, 'bands' => [],
        ];

        $goldUsd = (float) ($settings['rate_feed_cbic_gold_usd_10g'] ?? 0);
        $silverUsd = (float) ($settings['rate_feed_cbic_silver_usd_kg'] ?? 0);
        if ($goldUsd <= 0 && $silverUsd <= 0) {
            return $unavailable('No CBIC tariff value on record. Enter the latest one in Settings to switch the government cross-check on.');
        }
        if ($usdInr <= 0) {
            return $unavailable('No USD–INR rate on record, so the CBIC tariff value (quoted in USD) cannot be compared.');
        }

        $effective = (string) ($settings['rate_feed_cbic_effective_from'] ?? '');
        if ($effective !== '') {
            $age = (int) floor((strtotime('today') - (int) strtotime($effective)) / 86400);
            if ($age > self::MAX_AGE_DAYS) {
                return $unavailable("The CBIC tariff value on record is from $effective — over " . self::MAX_AGE_DAYS . ' days old. Update it in Settings.');
            }
        }

        $bands = [];
        // tariff values are for fine metal: gold per 10 g, silver per kg
        foreach ([['gold', $goldUsd, 10.0], ['silver', $silverUsd, 1000.0]] as [$metal, $usd, $grams]) {
            if ($usd <= 0) {
                continue;
            }
            $reference = ($usd * $usdInr) / $grams;
            $bands[$metal] = [
                'reference' => round($reference, 2),
                'low' => round($reference * (1 - self::BAND_PCT / 100), 2),
                'high' => round($reference * (1 + self::BAND_PCT / 100), 2),
            ];
        }

        return [
            'available' => $bands !== [],
            'reason' => $bands === [] ? 'No usable CBIC tariff value on record.' : null,
            'notification' => ($settings['rate_feed_cbic_notification'] ?? '') ?: null,
            'effective_from' => $effective ?: null,
            'bands' => $bands,
        ];
    }

    /**
     * Best-effort probe of the CBIC site. Returns a SourceResult purely so the
     * run shows up in the feed log — CBIC never produces quotes of its own.
     */
    public static function attemptRefresh(): SourceResult
    {
        $res = HttpFetcher::get(self::NOTIFICATION_URL, 1);
        if (!$res['ok']) {
            return SourceResult::failed(self::NAME, 'CBIC unreachable — ' . ($res['error'] ?? 'unknown error'), $res['status'] ?: null, $res['ms']);
        }

        // The page is a JavaScript shell; the tariff table is loaded from an API
        // that needs a session. If a plain-HTML tariff value ever appears here we
        // want to know, so look — and say so honestly when it is not there.
        $hasTariffText = stripos($res['body'], 'tariff value') !== false;

        return SourceResult::empty(
            self::NAME,
            $hasTariffText
                ? 'CBIC page reachable and now contains tariff text — a direct parser may be possible; currently using the value entered in Settings.'
                : 'CBIC publishes no machine-readable tariff value; using the value entered in Settings.',
            $res['status'],
            $res['ms']
        );
    }

    /** @param array<string,string> $settings */
    private static function usdInr(array $settings): float
    {
        // an explicit override wins; otherwise fall back to the company setting
        // some installs already keep for import purchases
        foreach (['rate_feed_usd_inr', 'usd_inr_rate'] as $key) {
            $v = (float) ($settings[$key] ?? 0);
            if ($v > 0) {
                return $v;
            }
        }
        return 0.0;
    }

    /** @return array<string,string> */
    private static function settings(): array
    {
        $rows = Database::fetchAll(
            "SELECT skey, svalue FROM settings WHERE skey LIKE 'rate_feed_%' OR skey = 'usd_inr_rate'"
        );
        $out = [];
        foreach ($rows as $r) {
            $out[(string) $r['skey']] = (string) ($r['svalue'] ?? '');
        }
        return $out;
    }
}
