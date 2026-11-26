<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Customers\CustomerRepository;
use CRM\Customers\CustomerService;
use CRM\Database\Database;
use CRM\Support\GstVisibility;
use CRM\Validation\Validator;

$user = requireApiAuth();
$gstVisibleOnly = GstVisibility::restrictedUsername($user->username);

if (Request::method() === 'GET') {
    requirePermission('customers.read');

    if (isset($_GET['id'])) {
        $customer = CustomerService::findOrFail($user, (int) $_GET['id']);
        $id = (int) $customer['id'];
        Response::success([
            'customer' => $customer,
            'family' => CustomerRepository::family($id),
            'invoices' => CustomerRepository::invoices($id, $gstVisibleOnly),
            'events' => CustomerRepository::events($id),
            'totals' => CustomerRepository::totals($id, $gstVisibleOnly),
            'users' => Database::fetchAll('SELECT id, full_name FROM users WHERE is_active = 1 ORDER BY full_name'),
        ]);
    }

    Response::success([
        'customers' => CustomerRepository::list($user, [
            'stage' => $_GET['stage'] ?? null,
            'assigned_to' => $_GET['assigned_to'] ?? null,
            'search' => $_GET['search'] ?? null,
        ]),
        'stats' => CustomerRepository::stats($user),
        'users' => Database::fetchAll('SELECT id, full_name FROM users WHERE is_active = 1 ORDER BY full_name'),
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? 'create');

switch ($action) {
    case 'create':
        requirePermission('customers.create');
        $id = CustomerService::create($body, $user);
        Response::success(['message' => 'Customer created.', 'id' => $id], 201);

    case 'update':
        requirePermission('customers.update');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        CustomerService::update((int) $data['id'], $body, $user);
        Response::success(['message' => 'Customer updated.']);

    case 'update_stage':
        requirePermission('customers.update');
        $data = Validator::validate($body, [
            'id' => 'required|int|min:1',
            'stage' => 'required|in:onboarding,active,inactive,churned',
        ]);
        CustomerService::updateStage((int) $data['id'], $data['stage'], $user);
        Response::success(['message' => 'Stage updated.']);

    case 'add_note':
        requirePermission('customers.update');
        $data = Validator::validate($body, [
            'id' => 'required|int|min:1',
            'note' => 'required|string|max:500',
        ]);
        CustomerService::addNote((int) $data['id'], $data['note'], $user);
        Response::success(['message' => 'Note added.']);

    case 'archive':
        requirePermission('customers.delete');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        CustomerService::archive((int) $data['id'], false, $user);
        Response::success(['message' => 'Customer archived.']);

    case 'restore':
        requirePermission('customers.delete');
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        CustomerService::archive((int) $data['id'], true, $user);
        Response::success(['message' => 'Customer restored.']);

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
