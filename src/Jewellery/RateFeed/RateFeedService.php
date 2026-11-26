<?php

declare(strict_types=1);

namespace CRM\Jewellery\RateFeed;

use CRM\Database\Database;
use CRM\Jewellery\RateService;
use CRM\Support\Audit;

/**
 * Orchestrates the daily rate fetch: run the sources, map to purities,
 * sanity-check, stage. And separately — only ever on a human's say-so — apply.
 *
 * The split is the whole point. `fetch()` runs unattended and writes nothing a
 * bill can see; `apply()` runs behind rates.set and goes through
 * RateService::setRates(), so an auto-fetched rate lands in metal_rates by
 * exactly the same path, with the same audit trail, as one typed in by hand.
 */
final class RateFeedService
{
    /** Nothing older than this is worth staging — a bill needs today's rate. */
    private const MAX_BACKFILL_DAYS = 2;

    // -----------------------------------------------------------------------
    // FETCH
    // -----------------------------------------------------------------------

    /**
     * Fetch every enabled source and stage what comes back.
     *
     * @return array{staged:int, sources:array<int,array<string,mixed>>, date:string, skipped:?string}
     */
    public static function fetch(string $rateDate, string $trigger = 'cron', ?int $userId = null): array
    {
        if (!self::isEnabled()) {
            return ['staged' => 0, 'sources' => [], 'date' => $rateDate, 'skipped' => 'The rate feed is switched off in Settings.'];
        }

        $summaries = [];
        $staged = 0;

        // CBIC first: it produces no quotes, only the band the checks read.
        $cbicBand = CbicSource::band();
        if (self::sourceEnabled(CbicSource::NAME)) {
            $probe = CbicSource::attemptRefresh();
            self::recordRun($probe, $rateDate, $trigger, $userId, 0);
            $summaries[] = self::summarise($probe, 0) + ['band' => $cbicBand];
        }

        if (self::sourceEnabled(IbjaSource::NAME)) {
            $result = IbjaSource::fetch();
            $count = 0;

            if ($result->isUsable()) {
                $count = self::stage($result, $rateDate, $cbicBand, $trigger, $userId);
                $staged += $count;
            } else {
                self::recordRun($result, $rateDate, $trigger, $userId, 0);
            }

            $summaries[] = self::summarise($result, $count);
        }

        return ['staged' => $staged, 'sources' => $summaries, 'date' => $rateDate, 'skipped' => null];
    }

    /**
     * Map → check → write staged quotes. Returns how many rows were staged.
     * @param array<string,mixed> $cbicBand
     */
    private static function stage(SourceResult $result, string $rateDate, array $cbicBand, string $trigger, ?int $userId): int
    {
        $mapped = PurityMapper::map($result->quotes);
        if ($mapped === []) {
            self::recordRun(
                SourceResult::empty($result->source, 'Rates were published but none matched this shop\'s purities. Check the purity finenesses in Settings.', $result->httpStatus, $result->ms, $result->token),
                $rateDate,
                $trigger,
                $userId,
                0
            );
            return 0;
        }

        $flags = SanityCheck::run($mapped, $rateDate, [
            'cbic' => $cbicBand,
            'token_repeated' => self::tokenRepeated($result->source, $result->token, $rateDate),
        ]);

        return (int) Database::transaction(static function () use ($result, $rateDate, $mapped, $flags, $trigger, $userId): int {
            $runId = self::recordRun($result, $rateDate, $trigger, $userId, \count($mapped));

            $count = 0;
            foreach ($mapped as $purityId => $row) {
                /** @var Quote $quote */
                $quote = $row['quote'];

                Database::execute(
                    'INSERT INTO rate_feed_quotes
                        (run_id, source, rate_date, purity_id, rate_per_gram, raw_label, raw_value, raw_unit,
                         session, derived_from, status, flags, fetched_at)
                     VALUES (:run, :src, :d, :p, :rate, :label, :raw, :unit, :sess, :derived, \'staged\', :flags, NOW())
                     ON DUPLICATE KEY UPDATE
                        run_id = VALUES(run_id), rate_per_gram = VALUES(rate_per_gram),
                        raw_label = VALUES(raw_label), raw_value = VALUES(raw_value), raw_unit = VALUES(raw_unit),
                        session = VALUES(session), derived_from = VALUES(derived_from), flags = VALUES(flags),
                        fetched_at = NOW(),
                        -- A re-fetch revives a dismissed quote but must NOT undo an
                        -- applied one: that rate is already stamped on the day\'s bills.
                        -- ORDER MATTERS — ON DUPLICATE KEY UPDATE assigns left to
                        -- right, so decided_by/decided_at must be settled while
                        -- `status` still holds the OLD value. Assigning status
                        -- first would make the two lines below read the new one.
                        decided_by = IF(status = \'applied\', decided_by, NULL),
                        decided_at = IF(status = \'applied\', decided_at, NULL),
                        status = IF(status = \'applied\', \'applied\', \'staged\')',
                    [
                        'run' => $runId,
                        'src' => $result->source,
                        'd' => $rateDate,
                        'p' => $purityId,
                        'rate' => $row['rate'],
                        'label' => $quote->label,
                        'raw' => $quote->rawValue,
                        'unit' => $quote->rawUnit,
                        'sess' => $quote->session,
                        'derived' => $row['derived_from'],
                        'flags' => json_encode(array_values($flags[$purityId] ?? []), JSON_UNESCAPED_UNICODE),
                    ]
                );
                $count++;
            }

            return $count;
        });
    }

    // -----------------------------------------------------------------------
    // APPLY / DISMISS — the human half
    // -----------------------------------------------------------------------

    /**
     * Write staged quotes into metal_rates.
     *
     * @param int[]|null $purityIds null = every staged quote that is not blocked
     * @return array{applied:int, skipped:array<int,string>}
     */
    public static function apply(string $rateDate, ?array $purityIds, int $userId): array
    {
        $staged = self::stagedQuotes($rateDate);
        if ($staged === []) {
            throw new \RuntimeException('There are no fetched rates waiting for ' . $rateDate . '.');
        }

        $wanted = $purityIds === null ? null : array_flip(array_map('intval', $purityIds));
        $rates = [];
        $skipped = [];

        foreach ($staged as $q) {
            $purityId = (int) $q['purity_id'];
            if ($wanted !== null && !isset($wanted[$purityId])) {
                continue;
            }

            // Apply-all deliberately steps over a blocked quote: the whole reason
            // it is blocked is that the number looks misread. Picking it out by
            // hand still works — that is a person taking responsibility for it.
            if ($wanted === null && self::isBlocked($q)) {
                $skipped[$purityId] = self::firstBlockingMessage($q);
                continue;
            }

            $rates[$purityId] = (float) $q['rate_per_gram'];
        }

        if ($rates === []) {
            throw new \RuntimeException(
                $skipped === []
                    ? 'None of the fetched rates matched what you asked to apply.'
                    : 'Every fetched rate needs checking before it can be applied. ' . reset($skipped)
            );
        }

        Database::transaction(static function () use ($rates, $rateDate, $userId): void {
            RateService::setRates($rates, $rateDate, $userId);

            $ids = implode(',', array_map('intval', array_keys($rates)));
            Database::execute(
                "UPDATE rate_feed_quotes
                    SET status = 'applied', decided_by = :u, decided_at = NOW()
                  WHERE rate_date = :d AND purity_id IN ($ids) AND status = 'staged'",
                ['u' => $userId, 'd' => $rateDate]
            );
        });

        Audit::log($userId, 'rates.feed_apply', 'metal_rates', null, null, [
            'date' => $rateDate,
            'applied' => $rates,
            'skipped' => array_keys($skipped),
        ]);

        return ['applied' => \count($rates), 'skipped' => $skipped];
    }

    /**
     * Close off the day's staged quotes once the rates have been saved by hand.
     *
     * The feed fills the boxes on the Rates page; the ordinary Save button is
     * what commits them. Afterwards the quotes must stop being "waiting", or the
     * notice would sit there forever and re-fill boxes the user has already
     * dealt with. A quote saved at the figure it suggested is `applied`; one the
     * user edited first is `superseded`, so the log still shows the feed was
     * read but not taken literally.
     *
     * @param array<int,float> $saved purity_id => rate that was actually written
     */
    public static function settleAfterSave(string $rateDate, array $saved, int $userId): void
    {
        $staged = Database::fetchAll(
            "SELECT purity_id, rate_per_gram FROM rate_feed_quotes
              WHERE rate_date = :d AND status = 'staged'",
            ['d' => $rateDate]
        );
        if ($staged === []) {
            return;
        }

        foreach ($staged as $q) {
            $purityId = (int) $q['purity_id'];
            if (!isset($saved[$purityId])) {
                continue;                    // not part of this save — leave it waiting
            }
            $matched = abs((float) $q['rate_per_gram'] - (float) $saved[$purityId]) < 0.005;
            Database::execute(
                'UPDATE rate_feed_quotes SET status = :s, decided_by = :u, decided_at = NOW()
                  WHERE rate_date = :d AND purity_id = :p AND status = \'staged\'',
                [
                    's' => $matched ? 'applied' : 'superseded',
                    'u' => $userId,
                    'd' => $rateDate,
                    'p' => $purityId,
                ]
            );
        }
    }

    /** Send the staged quotes away without applying them. */
    public static function dismiss(string $rateDate, int $userId): int
    {
        $n = Database::execute(
            "UPDATE rate_feed_quotes SET status = 'rejected', decided_by = :u, decided_at = NOW()
              WHERE rate_date = :d AND status = 'staged'",
            ['u' => $userId, 'd' => $rateDate]
        );
        if ($n > 0) {
            Audit::log($userId, 'rates.feed_dismiss', 'rate_feed_quotes', null, null, ['date' => $rateDate, 'count' => $n]);
        }
        return $n;
    }

    // -----------------------------------------------------------------------
    // STATUS — what the Rates page renders
    // -----------------------------------------------------------------------

    /** @return array<string,mixed> */
    public static function status(string $rateDate): array
    {
        $quotes = Database::fetchAll(
            "SELECT q.id, q.purity_id, q.source, q.rate_per_gram, q.raw_label, q.raw_value, q.raw_unit,
                    q.session, q.derived_from, q.status, q.flags, q.fetched_at,
                    p.metal, p.code, p.label, p.fineness,
                    r.rate_per_gram AS current_rate
               FROM rate_feed_quotes q
               JOIN purities p ON p.id = q.purity_id
          LEFT JOIN metal_rates r ON r.purity_id = q.purity_id AND r.rate_date = q.rate_date
              WHERE q.rate_date = :d
              ORDER BY p.metal, p.sort_order, p.code",
            ['d' => $rateDate]
        );

        $pending = 0;
        foreach ($quotes as &$q) {
            $q['flags'] = json_decode((string) ($q['flags'] ?? '[]'), true) ?: [];
            $q['is_blocked'] = self::isBlocked($q);
            $q['change_pct'] = null;
            if ($q['current_rate'] !== null && (float) $q['current_rate'] > 0) {
                $q['change_pct'] = round(
                    ((float) $q['rate_per_gram'] - (float) $q['current_rate']) / (float) $q['current_rate'] * 100,
                    2
                );
            }
            if ($q['status'] === 'staged') {
                $pending++;
            }
        }
        unset($q);

        $lastRun = Database::fetchOne(
            'SELECT source, status, message, quote_count, created_at, trigger_type
               FROM rate_feed_runs WHERE source = :s ORDER BY id DESC LIMIT 1',
            ['s' => IbjaSource::NAME]
        );

        return [
            'enabled' => self::isEnabled(),
            'date' => $rateDate,
            'pending' => $pending,
            'quotes' => $quotes,
            'last_run' => $lastRun,
            'cbic' => CbicSource::band(),
            'source_url' => IbjaSource::URL,
        ];
    }

    // -----------------------------------------------------------------------

    /** @return array<int,array<string,mixed>> */
    private static function stagedQuotes(string $rateDate): array
    {
        $rows = Database::fetchAll(
            "SELECT purity_id, rate_per_gram, flags FROM rate_feed_quotes
              WHERE rate_date = :d AND status = 'staged'",
            ['d' => $rateDate]
        );
        foreach ($rows as &$r) {
            $r['flags'] = json_decode((string) ($r['flags'] ?? '[]'), true) ?: [];
        }
        return $rows;
    }

    /** @param array<string,mixed> $quote */
    private static function isBlocked(array $quote): bool
    {
        foreach ((array) ($quote['flags'] ?? []) as $f) {
            if (($f['severity'] ?? '') === SanityCheck::SEVERITY_BLOCK) {
                return true;
            }
        }
        return false;
    }

    /** @param array<string,mixed> $quote */
    private static function firstBlockingMessage(array $quote): string
    {
        foreach ((array) ($quote['flags'] ?? []) as $f) {
            if (($f['severity'] ?? '') === SanityCheck::SEVERITY_BLOCK) {
                return (string) ($f['message'] ?? 'Needs checking.');
            }
        }
        return 'Needs checking.';
    }

    private static function recordRun(SourceResult $result, string $rateDate, string $trigger, ?int $userId, int $quoteCount): int
    {
        return Database::insert('rate_feed_runs', [
            'source' => $result->source,
            'run_date' => $rateDate,
            'trigger_type' => $trigger === 'manual' ? 'manual' : 'cron',
            'status' => $result->status,
            'http_status' => $result->httpStatus,
            'quote_count' => $quoteCount,
            'source_token' => $result->token,
            'message' => $result->message !== null ? mb_substr($result->message, 0, 500) : null,
            'duration_ms' => $result->ms,
            'triggered_by' => $userId,
        ]);
    }

    /**
     * True when the source's publication id matches the one seen on an EARLIER
     * day — i.e. it has not published since. A repeat within the same day is
     * just a second fetch of the same morning and means nothing.
     */
    private static function tokenRepeated(string $source, ?string $token, string $rateDate): bool
    {
        if ($token === null || $token === '') {
            return false;
        }
        return Database::fetchValue(
            'SELECT id FROM rate_feed_runs
              WHERE source = :s AND source_token = :t AND run_date < :d
              ORDER BY id DESC LIMIT 1',
            ['s' => $source, 't' => $token, 'd' => $rateDate]
        ) !== null;
    }

    /** @return array<string,mixed> */
    private static function summarise(SourceResult $result, int $staged): array
    {
        return [
            'source' => $result->source,
            'status' => $result->status,
            'message' => $result->message,
            'staged' => $staged,
            'http_status' => $result->httpStatus,
            'duration_ms' => $result->ms,
            'session' => $result->meta['session'] ?? null,
        ];
    }

    public static function isEnabled(): bool
    {
        $v = Database::fetchValue("SELECT svalue FROM settings WHERE skey = 'rate_feed_enabled'");
        return $v === null || (string) $v === '1';   // absent = on
    }

    private static function sourceEnabled(string $source): bool
    {
        $raw = (string) (Database::fetchValue("SELECT svalue FROM settings WHERE skey = 'rate_feed_sources'") ?? 'ibja');
        $list = array_filter(array_map('trim', explode(',', $raw)));
        // ibja is the only source that produces rates; cbic runs whenever a
        // tariff value is on record, whether or not it is listed
        if ($source === CbicSource::NAME) {
            return \in_array($source, $list, true) || (CbicSource::band()['available'] ?? false);
        }
        return $list === [] || \in_array($source, $list, true);
    }

    /** Guards a backfill request: a rate for last month helps nobody and rewrites history. */
    public static function assertFetchableDate(string $rateDate): void
    {
        $days = (int) floor((strtotime('today') - (int) strtotime($rateDate)) / 86400);
        if ($days < 0) {
            throw new \RuntimeException('Rates cannot be fetched for a future date.');
        }
        if ($days > self::MAX_BACKFILL_DAYS) {
            throw new \RuntimeException('Published rates are only fetched for today and the last ' . self::MAX_BACKFILL_DAYS . ' days.');
        }
    }
}
