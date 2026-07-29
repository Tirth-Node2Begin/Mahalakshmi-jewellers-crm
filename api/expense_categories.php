<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Expenses\ExpenseRepository;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('expenses.read');
    Response::success(['categories' => ExpenseRepository::categories()]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

/** Salary/system categories & their items are managed by other modules. */
function assertCategoryEditable(int $categoryId): void
{
    $isSystem = Database::fetchValue('SELECT is_system FROM expense_categories WHERE id = :c', ['c' => $categoryId]);
    if ($isSystem === null) {
        Response::error('NOT_FOUND', 'Category not found.', 404);
    }
    if ((int) $isSystem === 1) {
        Response::error('FORBIDDEN', 'System categories are managed automatically.', 403);
    }
}

/** A fixed-cost item is editable only if NEITHER it NOR its parent category is a system row. */
function assertItemEditable(int $itemId): void
{
    $item = Database::fetchOne(
        'SELECT fi.is_system AS item_system, c.is_system AS cat_system
         FROM fixed_cost_items fi JOIN expense_categories c ON c.id = fi.category_id WHERE fi.id = :id',
        ['id' => $itemId]
    );
    if ($item === null) {
        Response::error('NOT_FOUND', 'Item not found.', 404);
    }
    if ((int) $item['item_system'] === 1 || (int) $item['cat_system'] === 1) {
        Response::error('FORBIDDEN', 'System items are managed automatically.', 403);
    }
}

switch ($action) {
    case 'add': {
        requirePermission('expenses.create');
        $data = Validator::validate($body, [
            'name' => 'required|string|min:2|max:120',
            'type' => 'required|in:fixed,variable',
        ]);
        if (Database::fetchValue('SELECT id FROM expense_categories WHERE name = :n', ['n' => $data['name']]) !== null) {
            Response::error('CONFLICT', 'A category with that name already exists.', 409);
        }
        $catId = Database::transaction(static function () use ($data, $body): int {
            $id = Database::insert('expense_categories', ['name' => $data['name'], 'type' => $data['type']]);
            if ($data['type'] === 'fixed' && !empty($body['subcategories'])) {
                $subs = array_filter(array_map('trim', explode(',', (string) $body['subcategories'])));
                $sort = 0;
                foreach ($subs as $sub) {
                    Database::insert('fixed_cost_items', ['category_id' => $id, 'name' => substr($sub, 0, 120), 'sort_order' => $sort++]);
                }
            }
            return $id;
        });
        Response::success(['message' => 'Category added.', 'id' => $catId], 201);
    }

    case 'update': {
        requirePermission('expenses.update');
        $data = Validator::validate($body, [
            'id' => 'required|int|min:1',
            'name' => 'required|string|min:2|max:120',
            'type' => 'required|in:fixed,variable',
        ]);
        assertCategoryEditable((int) $data['id']);
        Database::execute('UPDATE expense_categories SET name = :n, type = :t WHERE id = :id', ['n' => $data['name'], 't' => $data['type'], 'id' => $data['id']]);
        Response::success(['message' => 'Category updated.']);
    }

    case 'toggle': {
        requirePermission('expenses.update');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        assertCategoryEditable((int) $data['id']);
        Database::execute('UPDATE expense_categories SET is_active = 1 - is_active WHERE id = :id', ['id' => $data['id']]);
        Response::success(['message' => 'Category updated.']);
    }

    case 'delete': {
        requirePermission('expenses.delete');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        assertCategoryEditable((int) $data['id']);
        $usage = (int) Database::fetchValue('SELECT COUNT(*) FROM expenses WHERE category_id = :c', ['c' => $data['id']])
            + (int) Database::fetchValue('SELECT COUNT(*) FROM expense_reminders WHERE category_id = :c', ['c' => $data['id']]);
        if ($usage > 0) {
            Response::error('CONFLICT', 'Category is in use — deactivate it instead.', 409);
        }
        Database::execute('DELETE FROM expense_categories WHERE id = :id', ['id' => $data['id']]); // items cascade
        Response::success(['message' => 'Category deleted.']);
    }

    case 'add_sub': {
        requirePermission('expenses.create');
        $data = Validator::validate($body, [
            'category_id' => 'required|int|min:1',
            'name' => 'required|string|min:2|max:120',
            'amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:2000',
        ]);
        assertCategoryEditable((int) $data['category_id']);
        if (Database::fetchValue('SELECT id FROM fixed_cost_items WHERE category_id = :c AND name = :n', ['c' => $data['category_id'], 'n' => $data['name']]) !== null) {
            Response::error('CONFLICT', 'An item with that name already exists in this category.', 409);
        }
        $id = Database::insert('fixed_cost_items', [
            'category_id' => $data['category_id'],
            'name' => $data['name'],
            'amount' => round((float) ($data['amount'] ?? 0), 2),
            'notes' => $data['notes'],
        ]);
        Response::success(['message' => 'Item added.', 'id' => $id], 201);
    }

    case 'update_sub': {
        requirePermission('expenses.update');
        $data = Validator::validate($body, [
            'id' => 'required|int|min:1',
            'name' => 'required|string|min:2|max:120',
            'amount' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:2000',
        ]);
        assertItemEditable((int) $data['id']); // blocks system item OR system parent category
        Database::execute('UPDATE fixed_cost_items SET name = :n, amount = :a, notes = :notes WHERE id = :id', ['n' => $data['name'], 'a' => round((float) ($data['amount'] ?? 0), 2), 'notes' => $data['notes'], 'id' => $data['id']]);
        Response::success(['message' => 'Item updated.']);
    }

    case 'toggle_sub': {
        requirePermission('expenses.update');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        assertItemEditable((int) $data['id']); // blocks system item OR system parent category
        Database::execute("UPDATE fixed_cost_items SET status = IF(status='active','inactive','active') WHERE id = :id", ['id' => $data['id']]);
        Response::success(['message' => 'Item updated.']);
    }

    case 'delete_sub': {
        requirePermission('expenses.delete');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        assertItemEditable((int) $data['id']); // blocks system item OR system parent category
        $usage = (int) Database::fetchValue('SELECT COUNT(*) FROM expenses WHERE fixed_cost_item_id = :i', ['i' => $data['id']])
            + (int) Database::fetchValue('SELECT COUNT(*) FROM fixed_cost_monthly_payments WHERE fixed_cost_item_id = :i AND payment_status = \'paid\'', ['i' => $data['id']]);
        if ($usage > 0) {
            Response::error('CONFLICT', 'Item has payment history — deactivate it instead.', 409);
        }
        Database::execute('DELETE FROM fixed_cost_items WHERE id = :id', ['id' => $data['id']]);
        Response::success(['message' => 'Item deleted.']);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
