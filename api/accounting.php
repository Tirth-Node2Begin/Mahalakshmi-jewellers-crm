<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Accounting\AccountingRepository;
use CRM\Accounting\VoucherService;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Support\Audit;
use CRM\Support\FiscalYear;
use CRM\Validation\Validator;

$user = requireApiAuth();

if (Request::method() === 'GET') {
    requirePermission('accounting.read');
    $view = (string) ($_GET['view'] ?? 'coa');

    if ($view === 'ledger') {
        $ledgerId = (int) ($_GET['ledger_id'] ?? 0);
        if ($ledgerId <= 0) {
            Response::error('BAD_REQUEST', 'A ledger is required.', 400);
        }
        $fy = FiscalYear::range();
        $from = (string) ($_GET['from'] ?? $fy['start']);
        $to = (string) ($_GET['to'] ?? $fy['end']);
        Response::success(['statement' => AccountingRepository::ledgerStatement($ledgerId, $from, $to)]);
    }

    if ($view === 'daybook') {
        $date = (string) ($_GET['date'] ?? date('Y-m-d'));
        Response::success(['date' => $date, 'vouchers' => AccountingRepository::dayBook($date)]);
    }

    if ($view === 'voucher') {
        $id = (int) ($_GET['id'] ?? 0);
        $voucher = Database::fetchOne(
            'SELECT v.id, v.voucher_no, v.vtype, v.vdate, v.narration, v.ref_type, v.ref_id,
                    v.status, v.cancel_reason, v.created_at, u.full_name AS created_by_name
               FROM vouchers v
          LEFT JOIN users u ON u.id = v.created_by
              WHERE v.id = :id',
            ['id' => $id]
        );
        if ($voucher === null) {
            Response::error('NOT_FOUND', 'Voucher not found.', 404);
        }
        $voucher['entries'] = Database::fetchAll(
            'SELECT e.id, e.ledger_id, l.name AS ledger_name, l.code AS ledger_code,
                    e.dr_amount, e.cr_amount, e.narration
               FROM voucher_entries e
               JOIN ledger_accounts l ON l.id = e.ledger_id
              WHERE e.voucher_id = :id
              ORDER BY e.id',
            ['id' => $id]
        );
        Response::success(['voucher' => $voucher]);
    }

    // default: chart of accounts + a flat ledger list for dropdowns
    Response::success([
        'coa' => AccountingRepository::chartOfAccounts(),
        'groups' => Database::fetchAll(
            'SELECT id, name, parent_id, nature FROM account_groups ORDER BY sort_order, name'
        ),
        'ledgers' => Database::fetchAll(
            'SELECT l.id, l.name, l.code, l.group_id, g.name AS group_name, g.nature, l.is_system
               FROM ledger_accounts l
               JOIN account_groups g ON g.id = l.group_id
              WHERE l.is_active = 1
              ORDER BY g.nature, l.name'
        ),
    ]);
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    case 'ledger_create':
    case 'ledger_update': {
        requirePermission('accounting.manage');
        $isUpdate = $action === 'ledger_update';

        $data = Validator::validate($body, [
            'id' => $isUpdate ? 'required|int|min:1' : 'nullable|int|min:1',
            'name' => 'required|string|max:120',
            'group_id' => 'required|int|min:1',
            'code' => 'nullable|string|max:30',
            'opening_balance' => 'nullable|numeric',
            'opening_type' => 'nullable|in:dr,cr',
        ]);

        $group = Database::fetchOne('SELECT id FROM account_groups WHERE id = :id', ['id' => $data['group_id']]);
        if ($group === null) {
            Response::error('VALIDATION_ERROR', 'Account group not found.', 422);
        }

        $fields = [
            'group_id' => $data['group_id'],
            'name' => $data['name'],
            'code' => $data['code'],
            'opening_balance' => $data['opening_balance'] ?? 0,
            'opening_type' => $data['opening_type'] ?? 'dr',
        ];

        if ($isUpdate) {
            $existing = Database::fetchOne(
                'SELECT id, group_id, name, code, opening_balance, opening_type, is_system
                   FROM ledger_accounts WHERE id = :id',
                ['id' => $data['id']]
            );
            if ($existing === null) {
                Response::error('NOT_FOUND', 'Ledger not found.', 404);
            }
            // system ledgers are wired into the posting maps — renaming/regrouping breaks them
            if ((int) $existing['is_system'] === 1) {
                Response::error('FORBIDDEN', 'System ledgers cannot be changed.', 403);
            }

            $set = implode(', ', array_map(static fn (string $c): string => "`$c` = :$c", array_keys($fields)));
            Database::execute("UPDATE ledger_accounts SET $set WHERE id = :pk", $fields + ['pk' => $data['id']]);
            Audit::log($user->id, 'accounting.ledger_update', 'ledger_accounts', (int) $data['id'], $existing, $fields);
            Response::success(['message' => 'Ledger updated.', 'id' => (int) $data['id']]);
        }

        $id = Database::insert('ledger_accounts', $fields);
        Audit::log($user->id, 'accounting.ledger_create', 'ledger_accounts', $id, null, $fields);
        Response::success(['message' => 'Ledger created.', 'id' => $id], 201);
    }

    case 'journal_create': {
        requirePermission('accounting.journal');
        $data = Validator::validate($body, [
            'vdate' => 'required|date',
            'narration' => 'nullable|string|max:255',
            'entries' => 'required|array|min:2',
        ]);

        $entries = [];
        foreach ($data['entries'] as $row) {
            if (!is_array($row)) {
                Response::error('VALIDATION_ERROR', 'Each journal line needs a ledger and an amount.', 422);
            }
            $entries[] = [
                'ledger_id' => (int) ($row['ledger_id'] ?? 0),
                'dr' => (float) ($row['dr'] ?? 0),
                'cr' => (float) ($row['cr'] ?? 0),
                'narration' => $row['narration'] ?? null,
            ];
        }

        try {
            $voucherId = Database::transaction(static fn (): int => VoucherService::post(
                'journal',
                $data['vdate'],
                $entries,
                $data['narration'],
                null,
                null,
                $user->id
            ));
        } catch (\LogicException $e) {
            // unbalanced or malformed lines — a user error here, not a bug
            Response::error('VALIDATION_ERROR', 'Debits and credits must be equal.', 422);
        }

        Audit::log($user->id, 'accounting.journal_create', 'vouchers', $voucherId, null, [
            'vdate' => $data['vdate'],
            'narration' => $data['narration'],
            'entries' => $entries,
        ]);
        Response::success(['message' => 'Journal posted.', 'voucher_id' => $voucherId], 201);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown action.', 400);
}
