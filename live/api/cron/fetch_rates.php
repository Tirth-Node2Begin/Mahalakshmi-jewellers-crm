<?php

declare(strict_types=1);

/**
 * Daily metal rate fetch — run each morning, before the shop opens:
 *   15 9 * * *  php /path/api/cron/fetch_rates.php
 *
 * Pulls the published benchmark rates (IBJA — see src/Jewellery/RateFeed/) and
 * STAGES them. Nothing here touches metal_rates: a fetched rate is a suggestion
 * until someone with rates.set opens the Rates page and presses Apply. A bill
 * stamps the rate it used, so an unattended wrong rate would be uncorrectable
 * after the fact — that is the whole reason for the staging step.
 *
 * IBJA publishes an AM and a PM rate. Running this twice (say 09:15 and 15:30)
 * is safe and useful: the afternoon run replaces a still-unapplied morning quote
 * with the settled PM figure, and leaves an already-applied one alone.
 *
 * Idempotent per day: re-running restages the same rows rather than piling up
 * duplicate cards. CLI-only; a URL trigger needs the CRON_KEY shared secret.
 */

if (PHP_SAPI !== 'cli' && ($_GET['key'] ?? '') === '') {
    http_response_code(403);
    exit("CLI only.\n");
}

require_once dirname(__DIR__, 2) . '/src/Support/api_bootstrap.php';

use CRM\Core\Env;
use CRM\Database\Database;
use CRM\Jewellery\RateFeed\RateFeedService;
use CRM\Support\Notify;

if (PHP_SAPI !== 'cli') {
    $expected = (string) (Env::get('CRON_KEY', '') ?? '');
    if ($expected === '' || !hash_equals($expected, (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        exit("Forbidden.\n");
    }
}

$log = static function (string $m): void {
    $line = '[' . date('c') . "] $m\n";
    if (PHP_SAPI === 'cli') {
        fwrite(STDOUT, $line);
    } else {
        echo $line;
    }
};

// one fetch at a time — a manual "Fetch now" during the scheduled run would
// otherwise race the same ON DUPLICATE KEY rows
if ((int) Database::fetchValue("SELECT GET_LOCK('jewellers_rate_feed', 0)") !== 1) {
    $log('Another rate fetch is in progress — exiting.');
    exit(0);
}

/** Active users holding a resource.action permission (super_admin always qualifies). */
function rateFeedUsersWith(string $permission): array
{
    [$resource, $action] = explode('.', $permission, 2) + [1 => ''];
    $rows = Database::fetchAll(
        "SELECT DISTINCT u.id
         FROM users u
         JOIN user_role_assignments ura ON ura.user_id = u.id AND ura.is_active = 1
              AND (ura.expires_at IS NULL OR ura.expires_at > NOW())
         JOIN roles r ON r.id = ura.role_id AND r.is_active = 1
         WHERE u.is_active = 1
           AND (r.name = 'super_admin' OR EXISTS (
                SELECT 1 FROM role_permission_grants g
                JOIN permissions p ON p.id = g.permission_id
                WHERE g.role_id = r.id AND p.resource = :res AND p.action = :act AND p.is_active = 1))",
        ['res' => $resource, 'act' => $action]
    );
    return array_map(static fn (array $r): int => (int) $r['id'], $rows);
}

/** One notification per user per type per day, so a twice-daily cron does not nag. */
function rateFeedNotify(array $userIds, string $type, string $title, string $body): int
{
    $sent = 0;
    foreach (array_unique(array_filter(array_map('intval', $userIds))) as $uid) {
        $already = Database::fetchValue(
            'SELECT id FROM notifications WHERE user_id = :u AND type = :t AND DATE(created_at) = CURDATE() LIMIT 1',
            ['u' => $uid, 't' => $type]
        );
        if ($already !== null) {
            continue;
        }
        Notify::send($uid, $type, $title, $body, null, null, '/rates');
        $sent++;
    }
    return $sent;
}

try {
    $date = date('Y-m-d');
    $result = RateFeedService::fetch($date, 'cron');

    if ($result['skipped'] !== null) {
        $log('Skipped: ' . $result['skipped']);
    }

    foreach ($result['sources'] as $s) {
        $log(sprintf(
            '%s: %s (%d staged, HTTP %s, %dms)%s',
            $s['source'],
            $s['status'],
            $s['staged'],
            $s['http_status'] ?? '-',
            $s['duration_ms'],
            $s['message'] !== null ? ' — ' . $s['message'] : ''
        ));
    }

    $approvers = rateFeedUsersWith('rates.set');

    if ($result['staged'] > 0) {
        // count what needs a second look, so the notification says which of the
        // two situations this is rather than a bare "rates fetched"
        $needsCheck = (int) Database::fetchValue(
            "SELECT COUNT(*) FROM rate_feed_quotes
              WHERE rate_date = :d AND status = 'staged' AND flags IS NOT NULL AND flags <> '[]'",
            ['d' => $date]
        );
        $n = (int) $result['staged'];
        $sent = rateFeedNotify(
            $approvers,
            'rate_feed_staged',
            "Today's rates are ready",
            $n . ' rate' . ($n === 1 ? '' : 's') . ' fetched from IBJA'
                . ($needsCheck > 0 ? " — $needsCheck need" . ($needsCheck === 1 ? 's' : '') . ' a check' : '')
                . '. Open Rates to apply them.'
        );
        $log("Staged $n rate(s); notified $sent user(s).");
    } else {
        // Only chase someone when the day's rates are actually still missing —
        // a failed fetch on a day the manager already entered rates by hand is
        // not worth an alert.
        $missing = (int) Database::fetchValue(
            'SELECT COUNT(*) FROM purities p
              WHERE p.is_active = 1
                AND NOT EXISTS (SELECT 1 FROM metal_rates r WHERE r.purity_id = p.id AND r.rate_date = :d)',
            ['d' => $date]
        );
        if ($missing > 0) {
            $reason = '';
            foreach ($result['sources'] as $s) {
                if ($s['status'] !== 'ok' && $s['message'] !== null && $s['source'] !== 'cbic') {
                    $reason = ' ' . $s['message'];
                    break;
                }
            }
            $sent = rateFeedNotify(
                $approvers,
                'rate_feed_failed',
                'Rates could not be fetched',
                "Today's rates are still not set." . $reason . ' Enter them by hand in Rates.'
            );
            $log("Nothing staged and $missing purity rate(s) still missing; notified $sent user(s).");
        } else {
            $log('Nothing staged; today\'s rates are already set.');
        }
    }

    $log('Done.');
} catch (\Throwable $e) {
    // no exit() here — it would skip the finally block and hold the lock
    $log('ERROR: ' . $e->getMessage());
    $exitCode = 1;
} finally {
    Database::fetchValue("SELECT RELEASE_LOCK('jewellers_rate_feed')");
}

exit($exitCode ?? 0);
