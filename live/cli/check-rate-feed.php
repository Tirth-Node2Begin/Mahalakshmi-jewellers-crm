<?php

declare(strict_types=1);

/**
 * Rate feed dry run.
 *
 * Fetches the published benchmark rates and prints exactly what the morning cron
 * WOULD stage — mapping, derivations, sanity flags — without writing a single
 * row. Run it after a deploy, and any time the Rates page says the feed came
 * back empty, to tell "the source hasn't published yet" apart from "our parser
 * no longer matches their page".
 *
 * Run: php cli/check-rate-feed.php [YYYY-MM-DD]
 * Exit code 0 = usable rates parsed, 1 = nothing usable or a blocking flag.
 */

require_once dirname(__DIR__) . '/src/bootstrap.php';

use CRM\Database\Database;
use CRM\Jewellery\RateFeed\CbicSource;
use CRM\Jewellery\RateFeed\IbjaSource;
use CRM\Jewellery\RateFeed\PurityMapper;
use CRM\Jewellery\RateFeed\RateFeedService;
use CRM\Jewellery\RateFeed\SanityCheck;

$date = $argv[1] ?? date('Y-m-d');
$rupees = static fn (float $n): string => '₹' . number_format($n, 2);

echo "Rate feed dry run for $date\n";
echo str_repeat('=', 72) . "\n\n";

echo 'Feed enabled: ' . (RateFeedService::isEnabled() ? 'yes' : 'NO — switched off in Settings') . "\n\n";

// ---------------------------------------------------------------------------
echo "1. Fetch — " . IbjaSource::URL . "\n";
$result = IbjaSource::fetch();
printf("   status=%s  http=%s  %dms  session=%s  token=%s\n",
    $result->status, $result->httpStatus ?? '-', $result->ms, $result->meta['session'] ?? '-', $result->token ?? '-');
if ($result->message !== null) {
    echo '   ' . $result->message . "\n";
}
if (!$result->isUsable()) {
    echo "\nNothing usable was published. No rates would be staged.\n";
    exit(1);
}

echo "\n   Published:\n";
foreach ($result->quotes as $q) {
    printf("     %-14s %12s %-9s = %12s /g\n", $q->label, number_format($q->rawValue), $q->unitLabel(), $rupees($q->perGram()));
}

// ---------------------------------------------------------------------------
echo "\n2. Mapping onto this shop's purities\n";
$mapped = PurityMapper::map($result->quotes);
if ($mapped === []) {
    echo "   Nothing matched. Check the finenesses on the purities master.\n";
    exit(1);
}
foreach ($mapped as $purityId => $row) {
    printf("     #%-3d %-9s %-7s %12s /g   %s\n",
        $purityId, (string) $row['purity']['metal'], (string) $row['purity']['code'], $rupees((float) $row['rate']),
        $row['derived_from'] !== null ? 'derived pro-rata from ' . $row['derived_from'] : 'published directly');
}
$unmatched = PurityMapper::unmatched($mapped);
if ($unmatched !== []) {
    echo "   Still needs entering by hand: "
        . implode(', ', array_map(static fn (array $u): string => $u['metal'] . ' ' . $u['code'], $unmatched)) . "\n";
}

// ---------------------------------------------------------------------------
echo "\n3. Government cross-check (CBIC customs tariff value)\n";
$cbic = CbicSource::band();
if (!($cbic['available'] ?? false)) {
    echo '   unavailable — ' . ($cbic['reason'] ?? 'no reason given') . "\n";
} else {
    echo '   from ' . ($cbic['notification'] ?? 'notification on record')
        . ' effective ' . ($cbic['effective_from'] ?? '?') . "\n";
    foreach ($cbic['bands'] as $metal => $band) {
        printf("     %-9s fine metal should sit between %s and %s /g\n", $metal, $rupees($band['low']), $rupees($band['high']));
    }
}

// ---------------------------------------------------------------------------
echo "\n4. Sanity checks\n";
$flags = SanityCheck::run($mapped, $date, ['cbic' => $cbic, 'token_repeated' => false]);
$blocking = 0;
if ($flags === []) {
    echo "   All clean.\n";
}
foreach ($flags as $purityId => $list) {
    foreach ($list as $flag) {
        $blocking += $flag['severity'] === SanityCheck::SEVERITY_BLOCK ? 1 : 0;
        printf("   [%-5s] #%-3d %s\n", $flag['severity'], $purityId, $flag['message']);
    }
}

// ---------------------------------------------------------------------------
echo "\n5. What the cron would do\n";
$alreadySet = Database::fetchAll(
    'SELECT purity_id FROM metal_rates WHERE rate_date = :d',
    ['d' => $date]
);
$have = array_column($alreadySet, 'purity_id');
printf("   %d rate(s) would be staged for approval; %d already set for %s.\n", \count($mapped), \count($have), $date);
echo $blocking > 0
    ? "   $blocking would be held back from Apply-all until someone confirms them.\n"
    : "   None are blocked — Apply would take all of them.\n";
echo "\n   Nothing was written. Run api/cron/fetch_rates.php to stage for real.\n";

exit($blocking > 0 ? 1 : 0);
