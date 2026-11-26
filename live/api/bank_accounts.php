<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    // either finance permission grants read access (shared master, planning/10 §3)
    if (!checkPermission('expenses.read') && !checkPermission('payments.create') && !checkPermission('bank_accounts.manage')) {
        Response::error('FORBIDDEN', 'You do not have permission to do that.', 403);
    }
    Response::success([
        'accounts' => Database::fetchAll(
            'SELECT id, account_name, bank_name, account_number, ifsc_code, upi_id, qr_code_path, is_active
             FROM bank_accounts WHERE is_active = 1 ORDER BY account_name'
        ),
    ]);
}

requireMethod('POST');
requirePermission('bank_accounts.manage');

$body = Request::json();
$action = (string) ($body['action'] ?? 'save');

switch ($action) {
    case 'save': {
        $data = Validator::validate($body, [
            'id' => 'nullable|int|min:1',
            'account_name' => 'required|string|max:120',
            'bank_name' => 'nullable|string|max:120',
            'account_number' => 'nullable|string|max:40',
            'ifsc_code' => 'nullable|string|max:20',
            'upi_id' => 'nullable|string|max:120',
        ]);
        $fields = [
            'account_name' => $data['account_name'],
            'bank_name' => $data['bank_name'],
            'account_number' => $data['account_number'],
            'ifsc_code' => $data['ifsc_code'],
            'upi_id' => $data['upi_id'],
        ];
        if ($data['id'] !== null) {
            $set = implode(', ', array_map(static fn (string $c): string => "`$c` = :$c", array_keys($fields)));
            Database::execute("UPDATE bank_accounts SET $set WHERE id = :pk", $fields + ['pk' => $data['id']]);
            Response::success(['message' => 'Bank account updated.']);
        }
        $id = Database::insert('bank_accounts', $fields);
        Response::success(['message' => 'Bank account added.', 'id' => $id], 201);
    }

    case 'delete': {
        $data = Validator::validate($body, ['id' => 'required|int|min:1']);
        Database::execute('UPDATE bank_accounts SET is_active = 0 WHERE id = :id', ['id' => $data['id']]);
        Response::success(['message' => 'Bank account removed.']);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
