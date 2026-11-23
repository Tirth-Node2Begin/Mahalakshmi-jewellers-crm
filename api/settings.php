<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Auth\PermissionService;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Support\Audit;

/** Keys every authenticated user may read (invoice print header, branding). */
const PUBLIC_SETTINGS = [
    'company_name', 'company_logo_path', 'currency', 'default_tax_rate',
];

/** Editable catalog — save requests may only touch these. */
const EDITABLE_SETTINGS = [
    'company_name', 'company_address', 'company_phone', 'company_email',
    'company_gstin', 'company_logo_path', 'default_tax_rate',
    'invoice_terms', 'invoice_footer_note', 'currency',
    // days a bill may stay unpaid before the dashboard calls it overdue
    'invoice_credit_days',
    // daily metal rate feed (api/cron/fetch_rates.php). The CBIC keys hold the
    // government customs tariff value, typed in each fortnight because CBIC
    // publishes no machine-readable feed — see src/Jewellery/RateFeed/CbicSource.
    'rate_feed_enabled', 'rate_feed_sources', 'rate_feed_max_move_pct',
    'rate_feed_cbic_gold_usd_10g', 'rate_feed_cbic_silver_usd_kg',
    'rate_feed_cbic_notification', 'rate_feed_cbic_effective_from',
    'rate_feed_usd_inr',
];

/** Max characters for a stored image value (base64 data URI ~1.33x the file). ~8MB of base64 ≈ 6MB image. */
const MAX_IMAGE_LEN = 8_000_000;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    $rows = Database::fetchAll('SELECT skey, svalue FROM settings');
    $all = array_column($rows, 'svalue', 'skey');

    if (PermissionService::can($user, 'settings.read')) {
        Response::success(['settings' => $all]);
    }
    Response::success(['settings' => array_intersect_key($all, array_flip(PUBLIC_SETTINGS))]);
}

requireMethod('POST');
requirePermission('settings.manage');

$body = Request::json();
if (($body['action'] ?? 'save') !== 'save' || !is_array($body['settings'] ?? null)) {
    Response::error('BAD_REQUEST', 'Expected {action:"save", settings:{...}}.', 400);
}

$old = array_column(Database::fetchAll('SELECT skey, svalue FROM settings'), 'svalue', 'skey');
$changed = [];
foreach ($body['settings'] as $key => $value) {
    if (!in_array($key, EDITABLE_SETTINGS, true) || !is_scalar($value)) {
        continue;
    }
    // company_logo_path may hold a base64 data URI, which needs far more room than plain text settings.
    $value = trim((string) $value);
    if ($key === 'company_logo_path') {
        if (strlen($value) > MAX_IMAGE_LEN) {
            Response::error('BAD_REQUEST', 'Logo image is too large — please use an image under ~5 MB.', 400);
        }
    } else {
        $value = substr($value, 0, 2000);
    }
    Database::execute(
        'INSERT INTO settings (skey, svalue, updated_by) VALUES (:k, :v, :u)
         ON DUPLICATE KEY UPDATE svalue = :v2, updated_by = :u2',
        ['k' => $key, 'v' => $value, 'u' => $user->id, 'v2' => $value, 'u2' => $user->id]
    );
    $changed[$key] = $value;
}

Audit::log($user->id, 'settings.save', 'settings', null,
    array_intersect_key($old, $changed), $changed);

Response::success(['message' => 'Settings saved.', 'updated' => array_keys($changed)]);
