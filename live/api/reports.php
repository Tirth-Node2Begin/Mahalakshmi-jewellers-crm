<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Response;
use CRM\Reports\ReportsRepository;
use CRM\Support\FiscalYear;
use CRM\Support\GstVisibility;

$user = requireApiAuth();
$gstVisibleOnly = GstVisibility::restrictedUsername($user->username);
requireMethod('GET');
requirePermission('reports.read');

// each tab is gated by the underlying module's read permission (client + server).
$TABS = [
    'revenue' => ['invoices.read'],
    'expenses' => ['expenses.read'],
    'customers' => ['customers.read'],
    'inventory' => ['inventory.read'],
];

$tabAllowed = static function (string $t) use ($TABS): bool {
    foreach ($TABS[$t] as $perm) {
        if (checkPermission($perm)) {
            return true;
        }
    }
    return false;
};
$allowed = array_values(array_filter(array_keys($TABS), $tabAllowed));

// nav helper: which tabs can this user see?
if (isset($_GET['tabs'])) {
    Response::success(['tabs' => $allowed]);
}

$tab = (string) ($_GET['tab'] ?? 'revenue');
if (!isset($TABS[$tab])) {
    Response::error('BAD_REQUEST', 'Unknown report tab.', 400);
}
if (!$tabAllowed($tab)) {
    Response::error('FORBIDDEN', 'You do not have access to this report.', 403);
}

$fy = FiscalYear::range();
// canonicalize to Y-m-d — strtotime accepts loose inputs ("now"), which must not
// reach SQL comparisons or the export filename verbatim
$fromTs = isset($_GET['from']) ? strtotime((string) $_GET['from']) : false;
$toTs = isset($_GET['to']) ? strtotime((string) $_GET['to']) : false;
$from = $fromTs !== false ? date('Y-m-d', $fromTs) : $fy['start'];
$to = $toTs !== false ? date('Y-m-d', $toTs) : $fy['end'];

$data = match ($tab) {
    'revenue' => ReportsRepository::revenue($from, $to, $gstVisibleOnly),
    'expenses' => ReportsRepository::expenses($from, $to, $gstVisibleOnly),
    // revenue on the customers tab is invoice money — only include it if the user can read invoices
    'customers' => ReportsRepository::customers($from, $to, checkPermission('invoices.read'), $gstVisibleOnly),
    'inventory' => ReportsRepository::inventory($from, $to, $gstVisibleOnly),
};

// CSV export (planning/14 §3): same query, streamed as text/csv. Sections become
// titled blocks — list sections get a header row, scalar maps become key/value rows.
if (($_GET['export'] ?? '') === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="report-' . $tab . '-' . $from . '-to-' . $to . '.csv"');
    header('Cache-Control: no-store');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // UTF-8 BOM so Excel renders ₹ and names correctly

    // neutralise spreadsheet formula injection: user-entered text (customer names, item
    // names…) starting with = + - @ would otherwise execute as a formula in Excel
    $cell = static function (mixed $v): mixed {
        if (!is_scalar($v) && $v !== null) {
            $v = json_encode($v);
        }
        if (is_string($v) && $v !== '' && strpbrk($v[0], '=+-@') !== false) {
            return "'" . $v;
        }
        return $v;
    };

    $writeSection = static function (string $title, array $rows) use ($out, $cell): void {
        fputcsv($out, [strtoupper(str_replace('_', ' ', $title))]);
        if ($rows === []) {
            fputcsv($out, ['(no data)']);
            fputcsv($out, []);
            return;
        }
        if (array_is_list($rows) && is_array($rows[0] ?? null)) {
            fputcsv($out, array_map($cell, array_keys($rows[0])));
            foreach ($rows as $row) {
                fputcsv($out, array_map($cell, array_values($row)));
            }
        } else {
            foreach ($rows as $key => $value) {
                fputcsv($out, [$cell($key), $cell($value)]);
            }
        }
        fputcsv($out, []);
    };

    fputcsv($out, ['Report', $tab, 'From', $from, 'To', $to]);
    fputcsv($out, []);
    foreach ($data as $section => $rows) {
        if (!is_array($rows)) {
            fputcsv($out, [$cell($section), $cell($rows)]);
            fputcsv($out, []);
            continue;
        }
        $writeSection((string) $section, $rows);
    }
    fclose($out);
    exit;
}

Response::success(['tab' => $tab, 'range' => ['from' => $from, 'to' => $to], 'data' => $data]);
