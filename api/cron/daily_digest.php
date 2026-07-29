<?php

declare(strict_types=1);

/**
 * Daily digest cron (planning/15 Phase 7) — run once each morning:
 *   0 8 * * *  php /path/api/cron/daily_digest.php
 * Produces in-app notifications for: overdue invoices (per creator), low-stock
 * items (inventory readers) and expense payment reminders due today
 * (expense readers).
 *
 * Idempotent per day: each digest type is skipped for a user who already got
 * that type today, so re-runs and overlapping schedules never double-notify.
 * CLI-only; a URL trigger needs the CRON_KEY shared secret (cPanel pattern).
 */

if (PHP_SAPI !== 'cli' && ($_GET['key'] ?? '') === '') {
    http_response_code(403);
    exit("CLI only.\n");
}

require_once dirname(__DIR__, 2) . '/src/Support/api_bootstrap.php';

use CRM\Core\Env;
use CRM\Database\Database;
use CRM\Support\Notify;

if (PHP_SAPI !== 'cli') {
    $expected = (string) (Env::get('CRON_KEY', '') ?? '');
    if ($expected === '' || !hash_equals($expected, (string) ($_GET['key'] ?? ''))) {
        http_response_code(403);
        exit("Forbidden.\n");
    }
}

// STDOUT only exists under CLI; web-triggered (CRON_KEY) runs echo instead
$log = static function (string $m): void {
    $line = '[' . date('c') . "] $m\n";
    if (PHP_SAPI === 'cli') {
        fwrite(STDOUT, $line);
    } else {
        echo $line;
    }
};

// one digest run at a time — a second overlapping run (double cron entry, manual
// trigger during the scheduled one) exits instead of racing the dedup SELECTs
if ((int) Database::fetchValue("SELECT GET_LOCK('leadspark_daily_digest', 0)") !== 1) {
    $log('Another digest run is in progress — exiting.');
    exit(0);
}

/** Active users holding a resource.action permission (super_admin always qualifies). */
function usersWithPermission(string $permission): array
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

/** Send once per user per digest type per day. */
function digestNotify(array $userIds, string $type, string $title, string $body, string $link): int
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
        Notify::send($uid, $type, $title, $body, null, null, $link);
        $sent++;
    }
    return $sent;
}

try {
    // 1. overdue invoices — one summary per invoice creator (own-scope safe: the
    // creator always sees their own invoices). Must be active + hold invoices.read.
    $invoiceReaders = array_flip(usersWithPermission('invoices.read'));
    $rows = Database::fetchAll(
        "SELECT i.created_by AS uid, COUNT(*) AS n, COALESCE(SUM(i.grand_total - i.paid_amount),0) AS due
         FROM invoices i
         JOIN users u ON u.id = i.created_by AND u.is_active = 1
         WHERE i.status = 'final' AND i.paid_amount < i.grand_total AND i.due_date IS NOT NULL AND i.due_date < CURDATE()
         GROUP BY i.created_by"
    );
    $sent = 0;
    foreach ($rows as $r) {
        if (!isset($invoiceReaders[(int) $r['uid']])) {
            continue;
        }
        $n = (int) $r['n'];
        $sent += digestNotify(
            [(int) $r['uid']],
            'digest_invoices',
            'Overdue invoices',
            "$n invoice" . ($n === 1 ? ' is' : 's are') . ' past due (₹' . number_format((float) $r['due'], 2) . ' outstanding).',
            '/invoices'
        );
    }
    $log("Invoice digests sent: $sent");

    // 2. low stock — one summary to everyone who can read inventory
    $low = Database::fetchAll(
        "SELECT name FROM inventory_items
         WHERE is_active = 1 AND reorder_level > 0 AND current_stock <= reorder_level
         ORDER BY current_stock / reorder_level LIMIT 6"
    );
    if ($low !== []) {
        $names = array_map(static fn (array $r): string => (string) $r['name'], $low);
        $count = (int) Database::fetchValue(
            'SELECT COUNT(*) FROM inventory_items WHERE is_active = 1 AND reorder_level > 0 AND current_stock <= reorder_level'
        );
        $sent = digestNotify(
            usersWithPermission('inventory.read'),
            'digest_low_stock',
            'Low stock alert',
            "$count item" . ($count === 1 ? '' : 's') . ' at or below reorder level: ' . implode(', ', $names) . ($count > count($names) ? '…' : ''),
            '/inventory?low=1'
        );
        $log("Low-stock digests sent: $sent");
    } else {
        $log('Low stock: nothing to report.');
    }

    // 3. expense reminders due today — to everyone who can read expenses
    $reminders = Database::fetchAll(
        "SELECT er.due_day, er.amount, er.description, ec.name AS category_name
         FROM expense_reminders er
         JOIN expense_categories ec ON ec.id = er.category_id
         WHERE er.is_active = 1 AND er.due_day = DAY(CURDATE())"
    );
    $sent = 0;
    foreach ($reminders as $r) {
        $label = $r['description'] !== null && $r['description'] !== '' ? $r['description'] : $r['category_name'];
        $sent += digestNotify(
            usersWithPermission('expenses.read'),
            'digest_reminder_' . substr(md5((string) $label), 0, 8),
            'Payment reminder',
            $label . ' — ₹' . number_format((float) $r['amount'], 2) . ' due today (' . $r['category_name'] . ').',
            '/expenses'
        );
    }
    $log('Expense reminders sent: ' . $sent . ' (' . count($reminders) . ' due today)');

    $log('Done.');
} catch (\Throwable $e) {
    // no exit() here — it would skip the finally block and hold the lock
    $log('ERROR: ' . $e->getMessage());
    $exitCode = 1;
} finally {
    Database::fetchValue("SELECT RELEASE_LOCK('leadspark_daily_digest')");
}

exit($exitCode ?? 0);
