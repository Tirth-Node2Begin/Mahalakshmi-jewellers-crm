<?php

declare(strict_types=1);

namespace CRM\Expenses;

use CRM\Accounting\Ledgers;
use CRM\Accounting\VoucherService;
use CRM\Auth\AuthUser;
use CRM\Database\Database;
use CRM\Support\FiscalYear;
use CRM\Validation\Validator;

/**
 * Expense business rules (planning/10):
 * - system categories (SALARY, INVENTORY_PURCHASE) are write-locked in this module:
 *   manual create/update/delete under them is blocked; only internal writers
 *   (PurchaseService, the Fixed Costs tracker in api/monthly.php) post rows there.
 * - multi fixed_cost_item split divides amount evenly, one row per item.
 * - a Fixed expense upserts the monthly tracker.
 */
final class ExpenseService
{
    public const TYPES = ['fixed', 'variable'];
    public const PAYMENT_MODES = ['cash', 'bank', 'upi', 'cheque', 'card'];

    public static function create(array $body, AuthUser $user): array
    {
        $data = self::extractFields($body);
        self::assertBankIfNeeded($data['payment_mode'], $data['bank_account_id']);

        // A fixed-cost payment references one or more fixed_cost_items (the expense's category is
        // derived from the item, NOT the caller-supplied category_id — otherwise a caller could pass
        // a harmless category_id but a SALARY item id and pay salary here). A plain expense references
        // a category directly.
        $splitItems = array_values(array_filter(array_map('intval', (array) ($body['fixed_cost_item_ids'] ?? []))));
        if ($splitItems === [] && $data['fixed_cost_item_id'] !== null) {
            $splitItems = [$data['fixed_cost_item_id']];
        }

        if ($splitItems === []) {
            self::assertCategoryNotSystem((int) $data['category_id']);
        } else {
            foreach ($splitItems as $itemId) {
                self::assertFixedItemPayable((int) $itemId); // rejects salary/system + inactive items
            }
            if (count($splitItems) > 1 && round((float) $data['amount'], 2) < 0.01 * count($splitItems)) {
                throw new \DomainException('Amount is too small to split across ' . count($splitItems) . ' items.');
            }
        }

        return Database::transaction(static function () use ($data, $splitItems, $user): array {
            $ids = [];
            if (count($splitItems) > 1) {
                // even split, but the sum must equal the total exactly — the rounding
                // remainder (a few paise) lands on the first row so nothing is lost.
                $total = round((float) $data['amount'], 2);
                $n = count($splitItems);
                $each = floor($total / $n * 100) / 100;
                $remainder = round($total - $each * $n, 2);
                foreach ($splitItems as $i => $itemId) {
                    $amount = round($each + ($i === 0 ? $remainder : 0.0), 2);
                    $ids[] = self::insertOne($data, $amount, (int) $itemId, $user);
                }
            } else {
                $ids[] = self::insertOne($data, (float) $data['amount'], $splitItems[0] ?? null, $user);
            }
            return $ids;
        });
    }

    private static function insertOne(array $data, float $amount, ?int $itemId, AuthUser $user): int
    {
        $categoryId = (int) $data['category_id'];
        $type = $data['type'];
        if ($itemId !== null) {
            // fixed-cost payment: belongs to the item's own category (validated non-system in create)
            $item = self::assertFixedItemPayable($itemId);
            $categoryId = (int) $item['category_id'];
            $type = 'fixed';
        }
        $expenseId = Database::insert('expenses', [
            'expense_date' => $data['expense_date'],
            'category_id' => $categoryId,
            'fixed_cost_item_id' => $itemId,
            'type' => $type,
            'amount' => $amount,
            'description' => $data['description'],
            'paid_to' => $data['paid_to'],
            'notes' => $data['notes'],
            'payment_mode' => $data['payment_mode'],
            'bank_account_id' => $data['bank_account_id'],
            'created_by' => $user->id,
        ]);
        if ($itemId !== null) {
            self::syncMonthlyTracker($itemId, $amount, $data['expense_date'], $expenseId);
        }
        self::postVoucher($expenseId, $categoryId, $amount, $data, $user);
        return $expenseId;
    }

    /**
     * Every expense posts Dr <its category ledger> / Cr Cash-Bank, so spending
     * reaches the P&L. Without this the expense row would exist but the books
     * would show no cost against the sales.
     */
    private static function postVoucher(int $expenseId, int $categoryId, float $amount, array $data, AuthUser $user): void
    {
        if ($amount <= 0) {
            return;
        }
        $voucherId = VoucherService::post(
            vtype: 'expense',
            vdate: (string) $data['expense_date'],
            entries: [
                ['ledger_id' => Ledgers::expenseCategory($categoryId), 'dr' => $amount],
                ['ledger_id' => Ledgers::forPaymentMode(
                    (string) $data['payment_mode'],
                    $data['bank_account_id'] !== null ? (int) $data['bank_account_id'] : null
                ), 'cr' => $amount],
            ],
            narration: (string) ($data['description'] ?? 'Expense'),
            refType: 'expense',
            refId: $expenseId,
            userId: $user->id
        );
        Database::execute(
            'UPDATE expenses SET voucher_id = :v, ledger_id = :l WHERE id = :id',
            ['v' => $voucherId, 'l' => Ledgers::expenseCategory($categoryId), 'id' => $expenseId]
        );
    }

    public static function update(int $id, array $body, AuthUser $user): void
    {
        $expense = self::findOrFail($id);
        self::assertNotSystemManaged($expense);
        // a fixed-cost payment's amount/date live in the tracker too — editing here would desync it;
        // reverse it in the tracker and re-record instead.
        if ($expense['fixed_cost_item_id'] !== null) {
            throw new \DomainException('This fixed-cost payment is managed from the tracker — reverse it there, then re-record.');
        }
        $data = self::extractFields($body);
        self::assertCategoryNotSystem((int) $data['category_id']);
        self::assertBankIfNeeded($data['payment_mode'], $data['bank_account_id']);

        Database::transaction(static function () use ($id, $expense, $data, $user): void {
            Database::execute(
                'UPDATE expenses SET expense_date = :d, category_id = :c, type = :t, amount = :a,
                        description = :desc, paid_to = :p, notes = :n, payment_mode = :pm, bank_account_id = :b
                 WHERE id = :id',
                [
                    'd' => $data['expense_date'], 'c' => $data['category_id'], 't' => $data['type'],
                    'a' => $data['amount'], 'desc' => $data['description'], 'p' => $data['paid_to'],
                    'n' => $data['notes'], 'pm' => $data['payment_mode'], 'b' => $data['bank_account_id'], 'id' => $id,
                ]
            );
            // the amount, category or payment mode may all have moved — reverse
            // the old posting and write a fresh one rather than patching entries
            if ($expense['voucher_id'] !== null) {
                VoucherService::cancel((int) $expense['voucher_id'], 'Expense edited', $user->id);
            }
            self::postVoucher($id, (int) $data['category_id'], round((float) $data['amount'], 2), $data, $user);
        });
    }

    public static function delete(int $id, AuthUser $user): void
    {
        $expense = self::findOrFail($id);
        self::assertNotSystemManaged($expense);
        Database::transaction(static function () use ($expense, $user): void {
            // reset the linked monthly tracker row if this was a fixed expense
            if ($expense['fixed_cost_item_id'] !== null) {
                Database::execute(
                    "UPDATE fixed_cost_monthly_payments
                     SET payment_status = 'pending', paid_amount = 0, payment_date = NULL, expense_id = NULL
                     WHERE expense_id = :eid",
                    ['eid' => $expense['id']]
                );
            }
            // take the spend back out of the books before the row goes
            if ($expense['voucher_id'] !== null) {
                VoucherService::cancel((int) $expense['voucher_id'], 'Expense deleted', $user->id);
            }
            Database::execute('DELETE FROM expenses WHERE id = :id', ['id' => $expense['id']]);
        });
    }

    /** Fixed expense → upsert the item's month row in the tracker. */
    private static function syncMonthlyTracker(int $itemId, float $amount, string $date, int $expenseId): void
    {
        $month = (int) date('n', strtotime($date));
        $year = (int) date('Y', strtotime($date));
        // if that month already had a linked expense, drop it first — the upsert below re-points
        // expense_id to this new row and would otherwise leave the old one orphaned/double-counted.
        $prior = Database::fetchValue(
            'SELECT expense_id FROM fixed_cost_monthly_payments WHERE fixed_cost_item_id = :i AND month = :m AND year = :y',
            ['i' => $itemId, 'm' => $month, 'y' => $year]
        );
        if ($prior !== null && (int) $prior !== $expenseId) {
            Database::execute('DELETE FROM expenses WHERE id = :e', ['e' => $prior]);
        }
        Database::execute(
            "INSERT INTO fixed_cost_monthly_payments
                (fixed_cost_item_id, month, year, paid_amount, payment_status, payment_date, expense_id)
             VALUES (:item, :m, :y, :amt, 'paid', :d, :eid)
             ON DUPLICATE KEY UPDATE paid_amount = :amt2, payment_status = 'paid', payment_date = :d2, expense_id = :eid2",
            ['item' => $itemId, 'm' => $month, 'y' => $year, 'amt' => $amount, 'd' => $date, 'eid' => $expenseId,
             'amt2' => $amount, 'd2' => $date, 'eid2' => $expenseId]
        );
    }

    // ------------------------------------------------------------- guards

    /** Salary + purchase-linked rows are managed by their own modules. */
    private static function assertNotSystemManaged(array $expense): void
    {
        if ($expense['ref_table'] !== null) {
            throw new \DomainException('This expense is managed by another module and cannot be edited here.');
        }
        $isSystem = (int) Database::fetchValue(
            'SELECT is_system FROM expense_categories WHERE id = :c',
            ['c' => $expense['category_id']]
        );
        if ($isSystem === 1) {
            throw new \DomainException('Expenses under a system category are managed automatically.');
        }
    }

    private static function assertCategoryNotSystem(int $categoryId): void
    {
        $isSystem = Database::fetchValue('SELECT is_system FROM expense_categories WHERE id = :c AND is_active = 1', ['c' => $categoryId]);
        if ($isSystem === null) {
            throw new \RuntimeException('Category not found.');
        }
        if ((int) $isSystem === 1) {
            throw new \DomainException('This category is managed automatically (purchases / fixed-cost tracker) and can’t take manual entries.');
        }
    }

    /**
     * A fixed_cost_item can be paid through this module only if the item AND its category are
     * non-system (system items are paid from the Fixed Costs tracker) and the item is active. Returns the item row
     * (with category_id) so callers can post the expense under the item's own category.
     * @return array<string,mixed>
     */
    private static function assertFixedItemPayable(int $itemId): array
    {
        $item = Database::fetchOne(
            'SELECT fi.id, fi.category_id, fi.status, fi.is_system AS item_system, c.is_system AS cat_system
             FROM fixed_cost_items fi JOIN expense_categories c ON c.id = fi.category_id WHERE fi.id = :i',
            ['i' => $itemId]
        );
        if ($item === null) {
            throw new \RuntimeException('Fixed-cost item not found.');
        }
        if ((int) $item['item_system'] === 1 || (int) $item['cat_system'] === 1) {
            throw new \DomainException('System fixed costs are paid from the Fixed Costs tracker, not here.');
        }
        if ($item['status'] !== 'active') {
            throw new \DomainException('That fixed-cost item is inactive.');
        }
        return $item;
    }

    private static function assertBankIfNeeded(string $mode, ?int $bankId): void
    {
        if ($mode === 'cash') {
            return;
        }
        $hasBanks = (int) Database::fetchValue('SELECT COUNT(*) FROM bank_accounts WHERE is_active = 1') > 0;
        if ($hasBanks && $bankId === null) {
            throw new \DomainException('Choose the bank account this expense was paid from.');
        }
    }

    private static function findOrFail(int $id): array
    {
        $expense = Database::fetchOne('SELECT * FROM expenses WHERE id = :id', ['id' => $id]);
        if ($expense === null) {
            throw new \RuntimeException('Expense not found.');
        }
        return $expense;
    }

    /** @return array<string,mixed> */
    private static function extractFields(array $body): array
    {
        $data = Validator::validate($body, [
            'category_id' => 'required|int|min:1',
            'amount' => 'required|numeric|min:0.01',
            'expense_date' => 'nullable|date',
            'type' => 'nullable|in:fixed,variable',
            'description' => 'nullable|string|max:255',
            'paid_to' => 'nullable|string|max:150',
            'notes' => 'nullable|string|max:2000',
            'payment_mode' => 'nullable|in:' . implode(',', self::PAYMENT_MODES),
            'bank_account_id' => 'nullable|int|min:1',
        ]);
        $data['expense_date'] = $data['expense_date'] ?? date('Y-m-d');
        $data['type'] = $data['type'] ?? 'variable';
        $data['payment_mode'] = self::normalizeMode($data['payment_mode'] ?? 'cash');
        $data['amount'] = round((float) $data['amount'], 2);
        $data['fixed_cost_item_id'] = isset($body['fixed_cost_item_id']) ? (int) $body['fixed_cost_item_id'] : null;
        return $data;
    }

    /** UI label "Bank Transfer"/"Net Banking" → 'bank' (planning/10 §1). */
    private static function normalizeMode(string $mode): string
    {
        $lower = strtolower(trim($mode));
        return match (true) {
            str_contains($lower, 'bank'), str_contains($lower, 'net') => 'bank',
            in_array($lower, self::PAYMENT_MODES, true) => $lower,
            default => 'cash',
        };
    }

    // ----------------------------------------------------------- insights

    /** @return array{start:string,end:string,label:string} */
    public static function periodRange(string $period, ?string $date): array
    {
        $ref = $date !== null && strtotime($date) ? $date : date('Y-m-d');
        $ts = strtotime($ref);
        return match ($period) {
            'weekly' => [
                'start' => date('Y-m-d', strtotime('monday this week', $ts)),
                'end' => date('Y-m-d', strtotime('sunday this week', $ts)),
                'label' => 'Week of ' . date('d M', strtotime('monday this week', $ts)),
            ],
            'quarterly' => (function () use ($ref) {
                $q = FiscalYear::quarter($ref);
                $r = FiscalYear::quarterRange($q, $ref);
                return ['start' => $r['start'], 'end' => $r['end'], 'label' => "Q$q FY" . FiscalYear::code($ref)];
            })(),
            'yearly' => (function () use ($ref) {
                $r = FiscalYear::range($ref);
                return ['start' => $r['start'], 'end' => $r['end'], 'label' => 'FY ' . FiscalYear::code($ref)];
            })(),
            default => [ // monthly
                'start' => date('Y-m-01', $ts),
                'end' => date('Y-m-t', $ts),
                'label' => date('F Y', $ts),
            ],
        };
    }
}
