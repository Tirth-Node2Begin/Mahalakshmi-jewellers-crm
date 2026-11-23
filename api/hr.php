<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/src/Support/api_bootstrap.php';

use CRM\Accounting\Ledgers;
use CRM\Accounting\VoucherService;
use CRM\Auth\AuthUser;
use CRM\Core\Request;
use CRM\Core\Response;
use CRM\Database\Database;
use CRM\Support\Audit;
use CRM\Support\NumberSequence;
use CRM\Validation\Validator;

const EMPLOYEE_TYPES = ['full_time', 'part_time', 'contract', 'intern'];
const EMPLOYEE_STATUSES = ['active', 'on_leave', 'terminated', 'resigned'];
const PAYMENT_MODES = ['cash', 'bank', 'upi', 'cheque', 'card'];

function employeeFullName(array $row): string
{
    return trim((string) $row['first_name'] . ' ' . (string) ($row['last_name'] ?? ''));
}

function employeeLookups(): array
{
    return [
        'departments' => Database::fetchAll('SELECT id, name FROM departments WHERE is_active = 1 ORDER BY name'),
        'designations' => Database::fetchAll('SELECT id, name, department_id FROM designations WHERE is_active = 1 ORDER BY level, name'),
        'shifts' => Database::fetchAll('SELECT id, name, start_time, end_time FROM shifts WHERE is_active = 1 ORDER BY is_default DESC, name'),
        'users' => Database::fetchAll('SELECT id, full_name FROM users WHERE is_active = 1 ORDER BY full_name'),
    ];
}

function employeeSelectSql(): string
{
    return "SELECT e.*,
                   CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS full_name,
                   d.name AS department_name,
                   des.name AS designation_name,
                   s.name AS shift_name,
                   u.full_name AS user_name
              FROM employees e
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN designations des ON des.id = e.designation_id
         LEFT JOIN shifts s ON s.id = e.shift_id
         LEFT JOIN users u ON u.id = e.user_id";
}

function listEmployees(): array
{
    $where = ['1=1'];
    $params = [];

    $status = (string) ($_GET['status'] ?? '');
    if ($status !== '' && in_array($status, EMPLOYEE_STATUSES, true)) {
        $where[] = 'e.status = :status';
        $params['status'] = $status;
    }

    $departmentId = (int) ($_GET['department_id'] ?? 0);
    if ($departmentId > 0) {
        $where[] = 'e.department_id = :department_id';
        $params['department_id'] = $departmentId;
    }

    $search = trim((string) ($_GET['search'] ?? ''));
    if ($search !== '') {
        $like = '%' . $search . '%';
        $where[] = '(e.employee_code LIKE :q_code
                  OR e.first_name LIKE :q_first
                  OR e.last_name LIKE :q_last
                  OR e.phone LIKE :q_phone
                  OR e.email LIKE :q_email
                  OR d.name LIKE :q_dept
                  OR des.name LIKE :q_desig)';
        $params += [
            'q_code' => $like,
            'q_first' => $like,
            'q_last' => $like,
            'q_phone' => $like,
            'q_email' => $like,
            'q_dept' => $like,
            'q_desig' => $like,
        ];
    }

    return Database::fetchAll(
        employeeSelectSql() . ' WHERE ' . implode(' AND ', $where) . ' ORDER BY e.status, e.first_name, e.last_name LIMIT 500',
        $params
    );
}

function employeeStats(): array
{
    return Database::fetchOne(
        "SELECT COUNT(*) AS total,
                COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active,
                COALESCE(SUM(CASE WHEN status = 'on_leave' THEN 1 ELSE 0 END), 0) AS on_leave,
                COALESCE(SUM(CASE WHEN status IN ('terminated', 'resigned') THEN 1 ELSE 0 END), 0) AS inactive,
                COALESCE(SUM(CASE WHEN status IN ('active', 'on_leave') THEN basic_salary ELSE 0 END), 0) AS monthly_salary
           FROM employees"
    ) ?? ['total' => 0, 'active' => 0, 'on_leave' => 0, 'inactive' => 0, 'monthly_salary' => 0];
}

function findEmployeeOrFail(int $id): array
{
    $row = Database::fetchOne(employeeSelectSql() . ' WHERE e.id = :id', ['id' => $id]);
    if ($row === null) {
        Response::error('NOT_FOUND', 'Employee not found.', 404);
    }
    return $row;
}

function defaultShiftId(): ?int
{
    $id = Database::fetchValue('SELECT id FROM shifts WHERE is_active = 1 ORDER BY is_default DESC, id LIMIT 1');
    return $id === null ? null : (int) $id;
}

function employeePayload(array $body): array
{
    $data = Validator::validate($body, [
        'id' => 'nullable|int|min:1',
        'user_id' => 'nullable|int|min:1',
        'first_name' => 'required|string|max:80',
        'last_name' => 'nullable|string|max:80',
        'email' => 'nullable|email|max:150',
        'phone' => 'nullable|string|max:20',
        'gender' => 'nullable|in:male,female,other',
        'date_of_birth' => 'nullable|date',
        'date_of_joining' => 'required|date',
        'department_id' => 'nullable|int|min:1',
        'designation_id' => 'nullable|int|min:1',
        'shift_id' => 'nullable|int|min:1',
        'employee_type' => 'required|in:full_time,part_time,contract,intern',
        'address' => 'nullable|string|max:255',
        'city' => 'nullable|string|max:100',
        'emergency_contact_name' => 'nullable|string|max:100',
        'emergency_contact_phone' => 'nullable|string|max:20',
        'bank_name' => 'nullable|string|max:120',
        'bank_account_no' => 'nullable|string|max:40',
        'bank_ifsc' => 'nullable|string|max:20',
        'pan_number' => 'nullable|string|max:20',
        'aadhar_number' => 'nullable|string|max:20',
        'basic_salary' => 'nullable|numeric|min:0',
        'status' => 'required|in:active,on_leave,terminated,resigned',
    ]);

    foreach (['department_id' => 'departments', 'designation_id' => 'designations', 'shift_id' => 'shifts', 'user_id' => 'users'] as $field => $table) {
        if ($data[$field] !== null) {
            $activeClause = $table === 'users' ? ' AND is_active = 1' : ' AND is_active = 1';
            if (Database::fetchValue("SELECT id FROM {$table} WHERE id = :id{$activeClause}", ['id' => $data[$field]]) === null) {
                Response::error('VALIDATION_ERROR', 'Validation failed.', 422, [$field => 'Choose an active option.']);
            }
        }
    }

    if ($data['shift_id'] === null) {
        $data['shift_id'] = defaultShiftId();
    }
    $data['basic_salary'] = round((float) ($data['basic_salary'] ?? 0), 2);
    return $data;
}

function salaryCategoryId(): int
{
    $id = Database::fetchValue("SELECT id FROM expense_categories WHERE system_key = 'SALARY' LIMIT 1");
    if ($id === null) {
        $id = Database::insert('expense_categories', [
            'name' => 'Salaries',
            'type' => 'fixed',
            'is_system' => 1,
            'system_key' => 'SALARY',
        ]);
    }
    return (int) $id;
}

function ensureSalaryItem(array $employee): int
{
    $categoryId = salaryCategoryId();
    $name = trim('Salary - ' . $employee['employee_code'] . ' ' . employeeFullName($employee));
    $existing = Database::fetchValue(
        'SELECT id FROM fixed_cost_items WHERE category_id = :category_id AND employee_id = :employee_id LIMIT 1',
        ['category_id' => $categoryId, 'employee_id' => (int) $employee['id']]
    );
    if ($existing !== null) {
        Database::execute(
            "UPDATE fixed_cost_items
                SET name = :name, amount = :amount, is_system = 1,
                    status = IF(:active_status IN ('active', 'on_leave'), 'active', 'inactive')
              WHERE id = :id",
            [
                'name' => substr($name, 0, 120),
                'amount' => round((float) $employee['basic_salary'], 2),
                'active_status' => (string) $employee['status'],
                'id' => (int) $existing,
            ]
        );
        return (int) $existing;
    }

    return Database::insert('fixed_cost_items', [
        'category_id' => $categoryId,
        'employee_id' => (int) $employee['id'],
        'name' => substr($name, 0, 120),
        'amount' => round((float) $employee['basic_salary'], 2),
        'is_system' => 1,
        'status' => in_array((string) $employee['status'], ['active', 'on_leave'], true) ? 'active' : 'inactive',
    ]);
}

function saveEmployee(array $body, AuthUser $user): int
{
    $data = employeePayload($body);
    return Database::transaction(static function () use ($data, $user): int {
        if ($data['id'] !== null) {
            $old = findEmployeeOrFail((int) $data['id']);
            Database::execute(
                'UPDATE employees
                    SET user_id = :user_id, first_name = :first_name, last_name = :last_name,
                        email = :email, phone = :phone, gender = :gender, date_of_birth = :date_of_birth,
                        date_of_joining = :date_of_joining, department_id = :department_id,
                        designation_id = :designation_id, shift_id = :shift_id,
                        employee_type = :employee_type, address = :address, city = :city,
                        emergency_contact_name = :emergency_contact_name,
                        emergency_contact_phone = :emergency_contact_phone,
                        bank_name = :bank_name, bank_account_no = :bank_account_no,
                        bank_ifsc = :bank_ifsc, pan_number = :pan_number,
                        aadhar_number = :aadhar_number, basic_salary = :basic_salary,
                        status = :status
                  WHERE id = :id',
                $data
            );
            $employee = findEmployeeOrFail((int) $data['id']);
            ensureSalaryItem($employee);
            Audit::log($user->id, 'hr.employee.update', 'employees', (int) $data['id'], $old, $data);
            return (int) $data['id'];
        }

        $employeeCode = NumberSequence::next('employee');
        $id = Database::insert('employees', [
            'employee_code' => $employeeCode,
            'user_id' => $data['user_id'],
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'phone' => $data['phone'],
            'gender' => $data['gender'],
            'date_of_birth' => $data['date_of_birth'],
            'date_of_joining' => $data['date_of_joining'],
            'department_id' => $data['department_id'],
            'designation_id' => $data['designation_id'],
            'shift_id' => $data['shift_id'],
            'employee_type' => $data['employee_type'],
            'address' => $data['address'],
            'city' => $data['city'],
            'emergency_contact_name' => $data['emergency_contact_name'],
            'emergency_contact_phone' => $data['emergency_contact_phone'],
            'bank_name' => $data['bank_name'],
            'bank_account_no' => $data['bank_account_no'],
            'bank_ifsc' => $data['bank_ifsc'],
            'pan_number' => $data['pan_number'],
            'aadhar_number' => $data['aadhar_number'],
            'basic_salary' => $data['basic_salary'],
            'status' => $data['status'],
            'created_by' => $user->id,
        ]);
        $employee = findEmployeeOrFail($id);
        ensureSalaryItem($employee);
        Audit::log($user->id, 'hr.employee.create', 'employees', $id, null, $data + ['employee_code' => $employeeCode]);
        return $id;
    });
}

function validPayPeriod(string $period): bool
{
    return preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period) === 1;
}

function periodRange(string $period): array
{
    $start = new DateTimeImmutable($period . '-01');
    $end = $start->modify('last day of this month');
    return [$start, $end];
}

function csvHasDay(?string $csv, string $day): bool
{
    $days = array_map('trim', explode(',', (string) $csv));
    return in_array($day, $days, true);
}

function workingDaysFor(string $period, array $employee): float
{
    [$start, $end] = periodRange($period);
    $join = new DateTimeImmutable((string) $employee['date_of_joining']);
    if ($join > $end) {
        return 0.0;
    }
    if ($join > $start) {
        $start = $join;
    }
    $count = 0.0;
    for ($day = $start; $day <= $end; $day = $day->modify('+1 day')) {
        if (!csvHasDay($employee['week_off_days'] ?? 'Sun', $day->format('D'))) {
            $count += 1.0;
        }
    }
    return $count;
}

function payrollEmployees(string $period): array
{
    [, $end] = periodRange($period);
    return Database::fetchAll(
        "SELECT e.*, s.week_off_days
           FROM employees e
      LEFT JOIN shifts s ON s.id = e.shift_id
          WHERE e.status IN ('active', 'on_leave')
            AND e.date_of_joining <= :period_end
          ORDER BY e.first_name, e.last_name",
        ['period_end' => $end->format('Y-m-d')]
    );
}

function attendanceSummary(int $employeeId, string $period, float $workingDays): array
{
    [$start, $end] = periodRange($period);
    $rows = Database::fetchAll(
        'SELECT status, COUNT(*) AS count
           FROM employee_attendance
          WHERE employee_id = :employee_id
            AND attendance_date BETWEEN :start_date AND :end_date
          GROUP BY status',
        ['employee_id' => $employeeId, 'start_date' => $start->format('Y-m-d'), 'end_date' => $end->format('Y-m-d')]
    );

    $counts = [];
    foreach ($rows as $row) {
        $counts[(string) $row['status']] = (float) $row['count'];
    }

    $present = ($counts['present'] ?? 0.0) + ($counts['late'] ?? 0.0);
    $half = $counts['half_day'] ?? 0.0;
    $paidLeave = $counts['on_leave'] ?? 0.0;
    $unpaidLeave = $counts['absent'] ?? 0.0;
    $markedWorking = $present + $half + $paidLeave + $unpaidLeave;
    if ($markedWorking < $workingDays) {
        $present += $workingDays - $markedWorking;
    }
    $lateCount = (int) ($counts['late'] ?? 0);
    $latePenalty = floor($lateCount / 3) * 0.5;
    $payable = max(0.0, min($workingDays, $present + ($half * 0.5) + $paidLeave - $latePenalty));

    return [
        'present_days' => round($present, 1),
        'half_days' => (int) $half,
        'paid_leave_days' => round($paidLeave, 1),
        'unpaid_leave_days' => round($unpaidLeave, 1),
        'late_count' => $lateCount,
        'payable_days' => round($payable, 1),
    ];
}

function computedPayrollRow(array $employee, string $period, array $existing = []): array
{
    $workingDays = workingDaysFor($period, $employee);
    $summary = attendanceSummary((int) $employee['id'], $period, $workingDays);
    $basic = round((float) $employee['basic_salary'], 2);
    $gross = $workingDays > 0 ? round($basic * ((float) $summary['payable_days'] / $workingDays), 2) : 0.0;
    $bonus = round((float) ($existing['bonus'] ?? 0), 2);
    $deduction = round((float) ($existing['deduction'] ?? 0), 2);
    $override = $existing['override_net'] ?? null;
    $net = $override !== null ? round((float) $override, 2) : round(max(0.0, $gross + $bonus - $deduction), 2);

    return [
        'employee_id' => (int) $employee['id'],
        'basic_salary' => $basic,
        'working_days' => round($workingDays, 1),
        'payable_days' => $summary['payable_days'],
        'present_days' => $summary['present_days'],
        'half_days' => $summary['half_days'],
        'paid_leave_days' => $summary['paid_leave_days'],
        'unpaid_leave_days' => $summary['unpaid_leave_days'],
        'late_count' => $summary['late_count'],
        'gross' => $gross,
        'bonus' => $bonus,
        'deduction' => $deduction,
        'deduction_note' => $existing['deduction_note'] ?? null,
        'override_net' => $override,
        'net' => $net,
    ];
}

function recomputePayrollItems(int $runId): void
{
    $run = Database::fetchOne('SELECT * FROM payroll_runs WHERE id = :id', ['id' => $runId]);
    if ($run === null) {
        throw new RuntimeException('Payroll run not found.');
    }
    if ($run['status'] !== 'draft') {
        throw new DomainException('Only draft payroll can be recomputed.');
    }

    $existingRows = Database::fetchAll('SELECT * FROM payroll_items WHERE payroll_run_id = :run_id', ['run_id' => $runId]);
    $existingByEmployee = [];
    foreach ($existingRows as $row) {
        $existingByEmployee[(int) $row['employee_id']] = $row;
    }

    Database::execute('DELETE FROM payroll_items WHERE payroll_run_id = :run_id', ['run_id' => $runId]);
    foreach (payrollEmployees((string) $run['pay_period']) as $employee) {
        $row = computedPayrollRow($employee, (string) $run['pay_period'], $existingByEmployee[(int) $employee['id']] ?? []);
        Database::insert('payroll_items', ['payroll_run_id' => $runId, 'status' => 'draft'] + $row);
    }
    updatePayrollTotals($runId);
}

function updatePayrollTotals(int $runId): void
{
    $totals = Database::fetchOne(
        'SELECT COUNT(*) AS total_employees,
                COALESCE(SUM(gross), 0) AS total_gross,
                COALESCE(SUM(deduction), 0) AS total_deductions,
                COALESCE(SUM(net), 0) AS total_net
           FROM payroll_items
          WHERE payroll_run_id = :run_id',
        ['run_id' => $runId]
    ) ?? ['total_employees' => 0, 'total_gross' => 0, 'total_deductions' => 0, 'total_net' => 0];
    Database::execute(
        'UPDATE payroll_runs
            SET total_employees = :employees,
                total_gross = :gross,
                total_deductions = :deductions,
                total_net = :net,
                computed_at = NOW()
          WHERE id = :id',
        [
            'employees' => (int) $totals['total_employees'],
            'gross' => round((float) $totals['total_gross'], 2),
            'deductions' => round((float) $totals['total_deductions'], 2),
            'net' => round((float) $totals['total_net'], 2),
            'id' => $runId,
        ]
    );
}

function payrollPayload(?int $runId = null): array
{
    $runs = Database::fetchAll(
        "SELECT pr.*,
                COALESCE(SUM(CASE WHEN pi.status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_items
           FROM payroll_runs pr
      LEFT JOIN payroll_items pi ON pi.payroll_run_id = pr.id
       GROUP BY pr.id
       ORDER BY pr.pay_period DESC
          LIMIT 36"
    );
    $selectedRun = null;
    $items = [];
    if ($runId === null && $runs !== []) {
        $runId = (int) $runs[0]['id'];
    }
    if ($runId !== null) {
        $selectedRun = Database::fetchOne('SELECT * FROM payroll_runs WHERE id = :id', ['id' => $runId]);
        if ($selectedRun !== null) {
            $items = Database::fetchAll(
                "SELECT pi.*,
                        e.employee_code,
                        CONCAT(e.first_name, ' ', COALESCE(e.last_name, '')) AS employee_name,
                        d.name AS department_name,
                        des.name AS designation_name
                   FROM payroll_items pi
                   JOIN employees e ON e.id = pi.employee_id
              LEFT JOIN departments d ON d.id = e.department_id
              LEFT JOIN designations des ON des.id = e.designation_id
                  WHERE pi.payroll_run_id = :run_id
                  ORDER BY e.first_name, e.last_name",
                ['run_id' => $runId]
            );
        }
    }
    return [
        'runs' => $runs,
        'run' => $selectedRun,
        'items' => $items,
        'bank_accounts' => Database::fetchAll('SELECT id, account_name FROM bank_accounts WHERE is_active = 1 ORDER BY account_name'),
    ];
}

function payrollItemOrFail(int $itemId): array
{
    $item = Database::fetchOne(
        "SELECT pi.*, pr.pay_period, pr.status AS run_status,
                e.employee_code, e.first_name, e.last_name, e.basic_salary, e.status AS employee_status
           FROM payroll_items pi
           JOIN payroll_runs pr ON pr.id = pi.payroll_run_id
           JOIN employees e ON e.id = pi.employee_id
          WHERE pi.id = :id",
        ['id' => $itemId]
    );
    if ($item === null) {
        Response::error('NOT_FOUND', 'Payroll item not found.', 404);
    }
    return $item;
}

function assertBankForPayment(string $mode, ?int $bankId): void
{
    if ($mode === 'cash') {
        return;
    }
    $hasBanks = (int) Database::fetchValue('SELECT COUNT(*) FROM bank_accounts WHERE is_active = 1') > 0;
    if ($hasBanks && $bankId === null) {
        throw new DomainException('Choose the bank account used for this salary payment.');
    }
}

function deleteExpenseAndVoucher(?int $expenseId, AuthUser $user): void
{
    if ($expenseId === null) {
        return;
    }
    $expense = Database::fetchOne('SELECT id, voucher_id FROM expenses WHERE id = :id', ['id' => $expenseId]);
    if ($expense === null) {
        return;
    }
    if ($expense['voucher_id'] !== null) {
        VoucherService::cancel((int) $expense['voucher_id'], 'Salary payment reversed', $user->id);
    }
    Database::execute('DELETE FROM expenses WHERE id = :id', ['id' => (int) $expense['id']]);
}

function refreshRunPaidStatus(int $runId): void
{
    $open = (int) Database::fetchValue(
        "SELECT COUNT(*) FROM payroll_items WHERE payroll_run_id = :run_id AND status <> 'paid'",
        ['run_id' => $runId]
    );
    Database::execute(
        "UPDATE payroll_runs SET status = IF(:open_items = 0, 'paid', 'completed') WHERE id = :run_id AND status <> 'draft'",
        ['open_items' => $open, 'run_id' => $runId]
    );
}

function paySalary(int $itemId, array $body, AuthUser $user): void
{
    $data = Validator::validate($body, [
        'payment_date' => 'required|date',
        'payment_mode' => 'required|in:cash,bank,upi,cheque,card',
        'bank_account_id' => 'nullable|int|min:1',
    ]);
    assertBankForPayment((string) $data['payment_mode'], $data['bank_account_id'] !== null ? (int) $data['bank_account_id'] : null);

    Database::transaction(static function () use ($itemId, $data, $user): void {
        $item = payrollItemOrFail($itemId);
        if ($item['status'] !== 'finalized') {
            throw new DomainException('Finalize payroll before paying salary, or reverse the existing payment first.');
        }
        $amount = round((float) $item['net'], 2);
        if ($amount <= 0) {
            throw new DomainException('This payroll item has no payable amount.');
        }

        $employee = findEmployeeOrFail((int) $item['employee_id']);
        $salaryItemId = ensureSalaryItem($employee);
        $categoryId = salaryCategoryId();
        [$year, $month] = array_map('intval', explode('-', (string) $item['pay_period']));

        $priorExpenseId = Database::fetchValue(
            'SELECT expense_id FROM fixed_cost_monthly_payments WHERE fixed_cost_item_id = :item_id AND month = :month_no AND year = :year_no',
            ['item_id' => $salaryItemId, 'month_no' => $month, 'year_no' => $year]
        );
        if ($priorExpenseId !== null) {
            deleteExpenseAndVoucher((int) $priorExpenseId, $user);
        }

        $employeeName = employeeFullName($employee);
        $expenseId = Database::insert('expenses', [
            'expense_date' => $data['payment_date'],
            'category_id' => $categoryId,
            'fixed_cost_item_id' => $salaryItemId,
            'type' => 'fixed',
            'amount' => $amount,
            'description' => 'Salary ' . $employeeName . ' - ' . $item['pay_period'],
            'paid_to' => $employeeName,
            'payment_mode' => $data['payment_mode'],
            'bank_account_id' => $data['bank_account_id'],
            'ref_table' => 'payroll_item',
            'ref_id' => $itemId,
            'created_by' => $user->id,
        ]);
        $voucherId = VoucherService::post(
            vtype: 'expense',
            vdate: (string) $data['payment_date'],
            entries: [
                ['ledger_id' => Ledgers::expenseCategory($categoryId), 'dr' => $amount],
                ['ledger_id' => Ledgers::forPaymentMode((string) $data['payment_mode'], $data['bank_account_id'] !== null ? (int) $data['bank_account_id'] : null, 'out'), 'cr' => $amount],
            ],
            narration: 'Salary ' . $employeeName . ' - ' . $item['pay_period'],
            refType: 'expense',
            refId: $expenseId,
            userId: $user->id
        );
        Database::execute(
            'UPDATE expenses SET voucher_id = :voucher_id, ledger_id = :ledger_id WHERE id = :id',
            ['voucher_id' => $voucherId, 'ledger_id' => Ledgers::expenseCategory($categoryId), 'id' => $expenseId]
        );
        Database::execute(
            "INSERT INTO fixed_cost_monthly_payments
                (fixed_cost_item_id, month, year, paid_amount, payment_status, payment_date, expense_id, payroll_item_id)
             VALUES (:item_id, :month_no, :year_no, :amount, 'paid', :pay_date, :expense_id, :payroll_item_id)
             ON DUPLICATE KEY UPDATE paid_amount = :amount_update,
                                     payment_status = 'paid',
                                     payment_date = :pay_date_update,
                                     expense_id = :expense_update,
                                     payroll_item_id = :payroll_update",
            [
                'item_id' => $salaryItemId,
                'month_no' => $month,
                'year_no' => $year,
                'amount' => $amount,
                'pay_date' => $data['payment_date'],
                'expense_id' => $expenseId,
                'payroll_item_id' => $itemId,
                'amount_update' => $amount,
                'pay_date_update' => $data['payment_date'],
                'expense_update' => $expenseId,
                'payroll_update' => $itemId,
            ]
        );
        Database::execute(
            "UPDATE payroll_items SET status = 'paid', paid_at = NOW(), expense_id = :expense_id WHERE id = :id",
            ['expense_id' => $expenseId, 'id' => $itemId]
        );
        refreshRunPaidStatus((int) $item['payroll_run_id']);
        Audit::log($user->id, 'hr.payroll.pay', 'payroll_items', $itemId, null, ['expense_id' => $expenseId]);
    });
}

function unpaySalary(int $itemId, AuthUser $user): void
{
    Database::transaction(static function () use ($itemId, $user): void {
        $item = payrollItemOrFail($itemId);
        if ($item['status'] !== 'paid') {
            throw new DomainException('This salary is not marked as paid.');
        }
        deleteExpenseAndVoucher($item['expense_id'] !== null ? (int) $item['expense_id'] : null, $user);
        Database::execute(
            "UPDATE fixed_cost_monthly_payments
                SET payment_status = 'pending',
                    paid_amount = 0,
                    payment_date = NULL,
                    expense_id = NULL,
                    payroll_item_id = NULL
              WHERE payroll_item_id = :item_id",
            ['item_id' => $itemId]
        );
        Database::execute(
            "UPDATE payroll_items SET status = 'finalized', paid_at = NULL, expense_id = NULL WHERE id = :id",
            ['id' => $itemId]
        );
        refreshRunPaidStatus((int) $item['payroll_run_id']);
        Audit::log($user->id, 'hr.payroll.unpay', 'payroll_items', $itemId);
    });
}

$user = requireApiAuth();

if (Request::method() === 'GET') {
    $module = (string) ($_GET['module'] ?? 'employees');
    switch ($module) {
        case 'employees':
            requirePermission('hr.read');
            if (isset($_GET['id'])) {
                Response::success(['employee' => findEmployeeOrFail((int) $_GET['id'])] + employeeLookups());
            }
            Response::success([
                'employees' => listEmployees(),
                'stats' => employeeStats(),
            ] + employeeLookups());

        case 'payroll':
            requirePermission('hr.payroll.read');
            $runId = isset($_GET['run_id']) ? (int) $_GET['run_id'] : null;
            Response::success(payrollPayload($runId));

        default:
            Response::error('BAD_REQUEST', 'Unknown HR module.', 400);
    }
}

requireMethod('POST');
$body = Request::json();
$action = (string) ($body['action'] ?? '');

switch ($action) {
    case 'save_employee':
        requirePermission('hr.employees.manage');
        $isCreate = empty($body['id']);
        $id = saveEmployee($body, $user);
        Response::success(['message' => 'Employee saved.', 'id' => $id], $isCreate ? 201 : 200);

    case 'create_payroll_run': {
        requirePermission('hr.payroll.manage');
        $period = trim((string) ($body['pay_period'] ?? ''));
        if (!validPayPeriod($period)) {
            Response::error('VALIDATION_ERROR', 'Validation failed.', 422, ['pay_period' => 'Use YYYY-MM.']);
        }
        if (Database::fetchValue('SELECT id FROM payroll_runs WHERE pay_period = :period', ['period' => $period]) !== null) {
            Response::error('CONFLICT', 'Payroll for this month already exists.', 409);
        }
        $runId = Database::transaction(static function () use ($period, $user): int {
            $id = Database::insert('payroll_runs', ['pay_period' => $period, 'created_by' => $user->id]);
            recomputePayrollItems($id);
            return $id;
        });
        Response::success(['message' => 'Payroll run created.', 'id' => $runId], 201);
    }

    case 'recompute_payroll': {
        requirePermission('hr.payroll.manage');
        $data = Validator::validate($body, ['run_id' => 'required|int|min:1']);
        Database::transaction(static fn () => recomputePayrollItems((int) $data['run_id']));
        Response::success(['message' => 'Payroll recomputed.']);
    }

    case 'update_payroll_item': {
        requirePermission('hr.payroll.manage');
        $data = Validator::validate($body, [
            'item_id' => 'required|int|min:1',
            'bonus' => 'nullable|numeric|min:0',
            'deduction' => 'nullable|numeric|min:0',
            'deduction_note' => 'nullable|string|max:255',
            'override_net' => 'nullable|numeric|min:0',
        ]);
        Database::transaction(static function () use ($data): void {
            $item = payrollItemOrFail((int) $data['item_id']);
            if ($item['run_status'] !== 'draft' || $item['status'] !== 'draft') {
                throw new DomainException('Only draft payroll items can be edited.');
            }
            $bonus = round((float) ($data['bonus'] ?? 0), 2);
            $deduction = round((float) ($data['deduction'] ?? 0), 2);
            $override = $data['override_net'] !== null ? round((float) $data['override_net'], 2) : null;
            $net = $override !== null ? $override : round(max(0.0, (float) $item['gross'] + $bonus - $deduction), 2);
            Database::execute(
                'UPDATE payroll_items
                    SET bonus = :bonus,
                        deduction = :deduction,
                        deduction_note = :deduction_note,
                        override_net = :override_net,
                        net = :net
                  WHERE id = :id',
                [
                    'bonus' => $bonus,
                    'deduction' => $deduction,
                    'deduction_note' => $data['deduction_note'],
                    'override_net' => $override,
                    'net' => $net,
                    'id' => (int) $item['id'],
                ]
            );
            updatePayrollTotals((int) $item['payroll_run_id']);
        });
        Response::success(['message' => 'Payroll item updated.']);
    }

    case 'finalize_payroll': {
        requirePermission('hr.payroll.manage');
        $data = Validator::validate($body, ['run_id' => 'required|int|min:1']);
        Database::transaction(static function () use ($data): void {
            $run = Database::fetchOne('SELECT * FROM payroll_runs WHERE id = :id', ['id' => $data['run_id']]);
            if ($run === null) {
                throw new RuntimeException('Payroll run not found.');
            }
            if ($run['status'] !== 'draft') {
                throw new DomainException('Only draft payroll can be finalized.');
            }
            Database::execute("UPDATE payroll_items SET status = 'finalized' WHERE payroll_run_id = :run_id", ['run_id' => (int) $run['id']]);
            Database::execute("UPDATE payroll_runs SET status = 'completed' WHERE id = :id", ['id' => (int) $run['id']]);
        });
        Response::success(['message' => 'Payroll finalized.']);
    }

    case 'pay_salary': {
        requirePermission('hr.payroll.pay');
        $data = Validator::validate($body, ['item_id' => 'required|int|min:1']);
        paySalary((int) $data['item_id'], $body, $user);
        Response::success(['message' => 'Salary paid.']);
    }

    case 'unpay_salary': {
        requirePermission('hr.payroll.pay');
        $data = Validator::validate($body, ['item_id' => 'required|int|min:1']);
        unpaySalary((int) $data['item_id'], $user);
        Response::success(['message' => 'Salary payment reversed.']);
    }

    default:
        Response::error('BAD_REQUEST', 'Unknown HR action.', 400);
}
