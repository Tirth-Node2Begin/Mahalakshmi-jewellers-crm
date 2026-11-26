<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Expenses\ExpenseRepository;
use CRM\Expenses\ExpenseService;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('expenses.read');
    $view = $_GET['view'] ?? 'list';

    if ($view === 'insights') {
        $period = (string) ($_GET['period'] ?? 'monthly');
        $range = ExpenseService::periodRange($period, $_GET['date'] ?? null);
        $payload = [
            'period' => $period,
            'range' => $range,
            'total' => ExpenseRepository::periodTotal($range['start'], $range['end']),
            'daily' => ExpenseRepository::dailyBreakdown($range['start'], $range['end']),
            'categories' => ExpenseRepository::categoryBreakdown($range['start'], $range['end']),
            'payments' => ExpenseRepository::paymentBreakdown($range['start'], $range['end']),
        ];
        if (!empty($_GET['compare_date'])) {
            $cmp = ExpenseService::periodRange($period, $_GET['compare_date']);
            $payload['comparison'] = [
                'range' => $cmp,
                'total' => ExpenseRepository::periodTotal($cmp['start'], $cmp['end']),
                'categories' => ExpenseRepository::categoryBreakdown($cmp['start'], $cmp['end']),
                'payments' => ExpenseRepository::paymentBreakdown($cmp['start'], $cmp['end']),
            ];
        }
        Response::success($payload);
    }

    // default list (whole FY, client filters day/type/search off it)
    Response::success([
        'expenses' => ExpenseRepository::list([
            'type' => $_GET['type'] ?? null,
            'category_id' => $_GET['category_id'] ?? null,
            'search' => $_GET['search'] ?? null,
        ]),
        'kpis' => ExpenseRepository::kpis(),
        'categories' => ExpenseRepository::categories('variable'),
        'bank_accounts' => Database::fetchAll('SELECT id, account_name FROM bank_accounts WHERE is_active = 1 ORDER BY account_name'),
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? 'create');

switch ($action) {
    case 'create':
        requirePermission('expenses.create');
        $ids = ExpenseService::create($body, $user);
        Response::success(['message' => 'Expense recorded.', 'ids' => $ids], 201);

    case 'update':
        requirePermission('expenses.update');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        ExpenseService::update((int) $data['id'], $body, $user);
        Response::success(['message' => 'Expense updated.']);

    case 'delete':
        requirePermission('expenses.delete');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        ExpenseService::delete((int) $data['id'], $user);
        Response::success(['message' => 'Expense deleted.']);

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
