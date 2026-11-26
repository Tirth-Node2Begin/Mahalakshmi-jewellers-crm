-- Restore employee directory + simple payroll from the old CRM plan.
-- Safe on databases where the HR tables were dropped during the jewellery cutover.

CREATE TABLE IF NOT EXISTS departments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  head_employee_id INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_name (name),
  KEY idx_departments_head (head_employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS designations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  department_id INT UNSIGNED NULL,
  level INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_designations_department (department_id),
  CONSTRAINT fk_designations_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shifts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_minutes INT UNSIGNED NOT NULL DEFAULT 10,
  working_days VARCHAR(60) NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat',
  week_off_days VARCHAR(60) NOT NULL DEFAULT 'Sun',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employees (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_code VARCHAR(20) NOT NULL,
  user_id INT UNSIGNED NULL,
  first_name VARCHAR(80) NOT NULL,
  last_name VARCHAR(80) NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(20) NULL,
  gender ENUM('male','female','other') NULL,
  date_of_birth DATE NULL,
  date_of_joining DATE NOT NULL,
  department_id INT UNSIGNED NULL,
  designation_id INT UNSIGNED NULL,
  shift_id INT UNSIGNED NULL,
  reporting_manager_id INT UNSIGNED NULL,
  employee_type ENUM('full_time','part_time','contract','intern') NOT NULL DEFAULT 'full_time',
  address VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  emergency_contact_name VARCHAR(100) NULL,
  emergency_contact_phone VARCHAR(20) NULL,
  bank_name VARCHAR(120) NULL,
  bank_account_no VARCHAR(40) NULL,
  bank_ifsc VARCHAR(20) NULL,
  pan_number VARCHAR(20) NULL,
  aadhar_number VARCHAR(20) NULL,
  basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('active','on_leave','terminated','resigned') NOT NULL DEFAULT 'active',
  photo_path VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_code (employee_code),
  UNIQUE KEY uq_employees_user (user_id),
  KEY idx_employees_status (status),
  KEY idx_employees_department (department_id),
  KEY idx_employees_designation (designation_id),
  KEY idx_employees_shift (shift_id),
  KEY idx_employees_manager (reporting_manager_id),
  CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_designation FOREIGN KEY (designation_id) REFERENCES designations(id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_shift FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_manager FOREIGN KEY (reporting_manager_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_employees_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employee_attendance (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id INT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  check_in TIME NULL,
  check_out TIME NULL,
  status ENUM('present','absent','half_day','late','on_leave','holiday','week_off') NOT NULL,
  worked_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  late_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  source ENUM('punch','manual') NOT NULL DEFAULT 'manual',
  remarks VARCHAR(255) NULL,
  marked_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance (employee_id, attendance_date),
  KEY idx_attendance_date (attendance_date),
  CONSTRAINT fk_attendance_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_marker FOREIGN KEY (marked_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS holidays (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  holiday_date DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_holidays_date (holiday_date),
  CONSTRAINT fk_holidays_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_runs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  pay_period CHAR(7) NOT NULL,
  status ENUM('draft','completed','paid') NOT NULL DEFAULT 'draft',
  total_employees INT UNSIGNED NOT NULL DEFAULT 0,
  total_gross DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_deductions DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_net DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  computed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_period (pay_period),
  CONSTRAINT fk_payroll_runs_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payroll_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  payroll_run_id INT UNSIGNED NOT NULL,
  employee_id INT UNSIGNED NOT NULL,
  basic_salary DECIMAL(12,2) NOT NULL DEFAULT 0,
  working_days DECIMAL(5,1) NOT NULL DEFAULT 0,
  payable_days DECIMAL(5,1) NOT NULL DEFAULT 0,
  present_days DECIMAL(5,1) NOT NULL DEFAULT 0,
  half_days INT UNSIGNED NOT NULL DEFAULT 0,
  paid_leave_days DECIMAL(5,1) NOT NULL DEFAULT 0,
  unpaid_leave_days DECIMAL(5,1) NOT NULL DEFAULT 0,
  late_count INT UNSIGNED NOT NULL DEFAULT 0,
  gross DECIMAL(12,2) NOT NULL DEFAULT 0,
  bonus DECIMAL(12,2) NOT NULL DEFAULT 0,
  deduction DECIMAL(12,2) NOT NULL DEFAULT 0,
  deduction_note VARCHAR(255) NULL,
  override_net DECIMAL(12,2) NULL DEFAULT NULL,
  net DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('draft','finalized','paid') NOT NULL DEFAULT 'draft',
  paid_at DATETIME NULL,
  expense_id INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_items (payroll_run_id, employee_id),
  KEY idx_payroll_items_employee (employee_id),
  KEY idx_payroll_items_expense (expense_id),
  CONSTRAINT fk_payroll_items_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
  CONSTRAINT fk_payroll_items_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payroll_items_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE fixed_cost_items
  ADD COLUMN IF NOT EXISTS employee_id INT UNSIGNED NULL AFTER category_id;

ALTER TABLE fixed_cost_items
  ADD UNIQUE INDEX IF NOT EXISTS uq_fixed_items_employee (category_id, employee_id);

INSERT INTO departments (name, is_active)
VALUES ('Sales', 1), ('Accounts', 1), ('Workshop', 1), ('Inventory', 1)
ON DUPLICATE KEY UPDATE is_active = 1;

INSERT INTO designations (name, department_id, level, is_active)
SELECT 'Sales Executive', id, 1, 1
FROM departments
WHERE name = 'Sales'
  AND NOT EXISTS (SELECT 1 FROM designations WHERE name = 'Sales Executive');

INSERT INTO designations (name, department_id, level, is_active)
SELECT 'Accountant', id, 1, 1
FROM departments
WHERE name = 'Accounts'
  AND NOT EXISTS (SELECT 1 FROM designations WHERE name = 'Accountant');

INSERT INTO designations (name, department_id, level, is_active)
SELECT 'Jewellery Maker', id, 1, 1
FROM departments
WHERE name = 'Workshop'
  AND NOT EXISTS (SELECT 1 FROM designations WHERE name = 'Jewellery Maker');

INSERT INTO designations (name, department_id, level, is_active)
SELECT 'Inventory Manager', id, 2, 1
FROM departments
WHERE name = 'Inventory'
  AND NOT EXISTS (SELECT 1 FROM designations WHERE name = 'Inventory Manager');

INSERT INTO shifts (name, start_time, end_time, grace_minutes, working_days, week_off_days, is_default, is_active)
SELECT 'Shop shift', '10:00:00', '20:00:00', 10, 'Mon,Tue,Wed,Thu,Fri,Sat', 'Sun', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM shifts WHERE name = 'Shop shift');

INSERT INTO expense_categories (name, type, is_system, system_key)
VALUES ('Salaries', 'fixed', 1, 'SALARY')
ON DUPLICATE KEY UPDATE type = 'fixed', is_system = 1, system_key = 'SALARY', is_active = 1;

INSERT INTO number_sequences (seq_key, period, prefix, next_number, padding)
VALUES ('employee', '', 'EMP-', 1, 4)
ON DUPLICATE KEY UPDATE prefix = VALUES(prefix), padding = VALUES(padding);

INSERT INTO permissions (resource, action, description)
VALUES
  ('hr', 'read', 'See employee directory'),
  ('hr.employees', 'manage', 'Add and edit employees'),
  ('hr.payroll', 'read', 'See payroll'),
  ('hr.payroll', 'manage', 'Create and finalize payroll'),
  ('hr.payroll', 'pay', 'Pay and reverse salaries')
ON DUPLICATE KEY UPDATE description = VALUES(description), is_active = 1;

INSERT INTO roles (name, display_name, description, data_scope, is_system, is_active)
VALUES ('hr', 'HR Manager', 'Employee directory and payroll access.', 'all', 0, 1)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), description = VALUES(description), is_active = 1;

INSERT INTO role_permission_grants (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource IN ('hr', 'hr.employees', 'hr.payroll')
WHERE r.name = 'hr'
  AND NOT EXISTS (
    SELECT 1 FROM role_permission_grants g WHERE g.role_id = r.id AND g.permission_id = p.id
  );

INSERT INTO role_permission_grants (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.resource = 'hr.payroll' AND p.action IN ('read', 'pay')
WHERE r.name = 'accountant'
  AND NOT EXISTS (
    SELECT 1 FROM role_permission_grants g WHERE g.role_id = r.id AND g.permission_id = p.id
  );
