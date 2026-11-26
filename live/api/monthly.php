<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Support\FiscalYear;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('expenses.read');
    $year = isset($_GET['year']) ? (int) $_GET['year'] : (int) substr(FiscalYear::range()['start'], 0, 4);

    // fixed categories + active items
    $categories = Database::fetchAll(
        "SELECT c.id, c.name, c.is_system, c.system_key
         FROM expense_categories c WHERE c.type = 'fixed' AND c.is_active = 1 ORDER BY c.name"
    );
    // One query for every category's items, then group in PHP — this used to run
    // a SELECT per category, so the page cost a round trip for each one.
    $itemsByCategory = [];
    foreach (Database::fetchAll(
        "SELECT id, name, amount, category_id FROM fixed_cost_items
          WHERE status = 'active' ORDER BY sort_order, name"
    ) as $item) {
        $categoryId = (int) $item['category_id'];
        unset($item['category_id']);          // keep the response shape unchanged
        $itemsByCategory[$categoryId][] = $item;
    }
    foreach ($categories as &$cat) {
        $cat['items'] = $itemsByCategory[(int) $cat['id']] ?? [];
    }
    unset($cat);

    // tracker[itemId][month] = paid row (this year + next Jan-Mar so an FY spans the boundary)
    $rows = Database::fetchAll(
        "SELECT fixed_cost_item_id, month, year, paid_amount, payment_status, payment_date
         FROM fixed_cost_monthly_payments WHERE year IN (:y, :y2)",
        ['y' => $year, 'y2' => $year + 1]
    );
    $tracker = [];
    foreach ($rows as $r) {
        $tracker[(int) $r['fixed_cost_item_id']][(int) $r['year']][(int) $r['month']] = $r;
    }

    Response::success([
        'year' => $year,
        'categories' => $categories,
        'tracker' => $tracker,
        'bank_accounts' => Database::fetchAll('SELECT id, account_name FROM bank_accounts WHERE is_active = 1 ORDER BY account_name'),
    ]);
}

requireMethod('POST');
// permission is per-action: marking paid writes an expense (create), unpay deletes one (delete)
$body = Request::json();
$action = (string) ($body['action'] ?? '');

/** Pay one fixed-cost item for a month: writes an expense + upserts the tracker. */
function payItem(int $itemId, int $month, int $year, array $meta, int $userId): void
{
    // serialize concurrent pays for this item so a re-pay / double-submit can't orphan expenses
    Database::fetchValue('SELECT id FROM fixed_cost_items WHERE id = :i FOR UPDATE', ['i' => $itemId]);

    $item = Database::fetchOne(
        'SELECT fi.*, fi.category_id, c.system_key FROM fixed_cost_items fi
         JOIN expense_categories c ON c.id = fi.category_id WHERE fi.id = :i',
        ['i' => $itemId]
    );
    if ($item === null) {
        return; // vanished between the list and the submit — nothing to pay
    }
    if ((string) ($item['system_key'] ?? '') === 'SALARY') {
        throw new \DomainException('Salary fixed costs are paid from HR Payroll.');
    }
    $amount = round((float) ($meta['amount'] ?? $item['amount']), 2);
    if ($amount <= 0) {
        throw new \DomainException("Set an amount for “{$item['name']}” before paying it.");
    }
    $date = $meta['payment_date'];

    // if this month was already paid, drop the previously-linked expense first — otherwise the
    // tracker upsert re-points expense_id to the new row and leaves the old one orphaned/double-counted.
    $priorExpenseId = Database::fetchValue(
        'SELECT expense_id FROM fixed_cost_monthly_payments WHERE fixed_cost_item_id = :i AND month = :m AND year = :y',
        ['i' => $itemId, 'm' => $month, 'y' => $year]
    );
    if ($priorExpenseId !== null) {
        Database::execute('DELETE FROM expenses WHERE id = :e', ['e' => $priorExpenseId]);
    }

    $expenseId = Database::insert('expenses', [
        'expense_date' => $date,
        'category_id' => (int) $item['category_id'],
        'fixed_cost_item_id' => $itemId,
        'type' => 'fixed',
        'amount' => $amount,
        'description' => $meta['description'] ?? $item['name'],
        'paid_to' => $meta['paid_to'] ?? null,
        'payment_mode' => $meta['payment_mode'] ?? 'cash',
        'bank_account_id' => $meta['bank_account_id'] ?? null,
        'created_by' => $userId,
    ]);
    Database::execute(
        "INSERT INTO fixed_cost_monthly_payments (fixed_cost_item_id, month, year, paid_amount, payment_status, payment_date, expense_id)
         VALUES (:i, :m, :y, :a, 'paid', :d, :e)
         ON DUPLICATE KEY UPDATE paid_amount = :a2, payment_status = 'paid', payment_date = :d2, expense_id = :e2",
        ['i' => $itemId, 'm' => $month, 'y' => $year, 'a' => $amount, 'd' => $date, 'e' => $expenseId,
         'a2' => $amount, 'd2' => $date, 'e2' => $expenseId]
    );
}

function isSalaryFixedItem(int $itemId): bool
{
    return (int) Database::fetchValue(
        "SELECT COUNT(*)
           FROM fixed_cost_items fi
           JOIN expense_categories c ON c.id = fi.category_id
          WHERE fi.id = :id AND c.system_key = 'SALARY'",
        ['id' => $itemId]
    ) > 0;
}

switch ($action) {
    case 'mark_paid': {
        requirePermission('expenses.create'); // writes an expense row
        $data = Validator::validate($body, [
            'fixed_cost_item_id' => 'required|int|min:1',
            'month' => 'required|int|min:1|max:12',
            'year' => 'required|int|min:2020|max:2100',
            'amount' => 'required|numeric|min:0.01',
            'payment_date' => 'required|date',
            'payment_mode' => 'nullable|in:cash,bank,upi,cheque,card',
            'bank_account_id' => 'nullable|int|min:1',
            'description' => 'nullable|string|max:255',
            'paid_to' => 'nullable|string|max:150',
        ]);
        Database::transaction(static function () use ($data, $body, $user): void {
            payItem((int) $data['fixed_cost_item_id'], (int) $data['month'], (int) $data['year'], [
                'amount' => $data['amount'], 'payment_date' => $data['payment_date'],
                'payment_mode' => $data['payment_mode'] ?? 'cash', 'bank_account_id' => $data['bank_account_id'] ?? null,
                'description' => $data['description'] ?? null, 'paid_to' => $data['paid_to'] ?? null,
            ], $user->id);
        });
        Response::success(['message' => 'Marked paid.']);
    }

    case 'mark_bulk': {
        requirePermission('expenses.create'); // writes expense rows
        $data = Validator::validate($body, [
            'item_ids' => 'required|array|min:1',
            'month' => 'required|int|min:1|max:12',
            'year' => 'required|int|min:2020|max:2100',
            'payment_date' => 'required|date',
            'payment_mode' => 'nullable|in:cash,bank,upi,cheque,card',
            'bank_account_id' => 'nullable|int|min:1',
        ]);
        $skippedSalary = 0;
        Database::transaction(static function () use ($data, $body, $user, &$skippedSalary): void {
            foreach (array_unique(array_map('intval', (array) $body['item_ids'])) as $itemId) {
                if (isSalaryFixedItem($itemId)) {
                    $skippedSalary++;
                    continue;
                }
                // skip if already paid this month
                if ((int) Database::fetchValue('SELECT COUNT(*) FROM fixed_cost_monthly_payments WHERE fixed_cost_item_id = :i AND month = :m AND year = :y AND payment_status = \'paid\'', ['i' => $itemId, 'm' => $data['month'], 'y' => $data['year']]) > 0) {
                    continue;
                }
                payItem($itemId, (int) $data['month'], (int) $data['year'], [
                    'payment_date' => $data['payment_date'],
                    'payment_mode' => $data['payment_mode'] ?? 'cash', 'bank_account_id' => $data['bank_account_id'] ?? null,
                ], $user->id);
            }
        });
        Response::success(['message' => 'Bulk payment recorded.', 'skipped_salary' => $skippedSalary]);
    }

    case 'unpay': {
        requirePermission('expenses.delete'); // deletes the linked expense row
        $data = Validator::validate($body, [
            'fixed_cost_item_id' => 'required|int|min:1',
            'month' => 'required|int|min:1|max:12',
            'year' => 'required|int|min:2020|max:2100',
        ]);
        if (isSalaryFixedItem((int) $data['fixed_cost_item_id'])) {
            throw new \DomainException('Reverse salary payments from HR Payroll.');
        }
        Database::transaction(static function () use ($data): void {
            $row = Database::fetchOne(
                'SELECT id, expense_id FROM fixed_cost_monthly_payments WHERE fixed_cost_item_id = :i AND month = :m AND year = :y',
                ['i' => $data['fixed_cost_item_id'], 'm' => $data['month'], 'y' => $data['year']]
            );
            if ($row === null) {
                return;
            }
            if ($row['expense_id'] !== null) {
                Database::execute('DELETE FROM expenses WHERE id = :e', ['e' => $row['expense_id']]);
            }
            Database::execute(
                "UPDATE fixed_cost_monthly_payments SET payment_status = 'pending', paid_amount = 0, payment_date = NULL, expense_id = NULL WHERE id = :id",
                ['id' => $row['id']]
            );
        });
        Response::success(['message' => 'Payment reversed.']);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
