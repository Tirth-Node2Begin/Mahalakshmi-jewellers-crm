-- ============================================================================
-- LeadSpark CRM — schema.sql  (authoritative spec: planning/01-database-schema.md)
-- MySQL/MariaDB ≥10.4 · InnoDB · utf8mb4 · 59 tables
-- Creation is dependency-ordered; circular FKs are added via ALTER at the end
-- of the affected block (leads↔customers, departments↔employees, payroll↔expenses).
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- A. AUTH, RBAC & AUDIT
-- ----------------------------------------------------------------------------

CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(60) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NULL,
  mobile VARCHAR(20) NULL,
  avatar_color VARCHAR(7) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  password_changed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  data_scope ENUM('all','own') NOT NULL DEFAULT 'all',
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  resource VARCHAR(60) NOT NULL,
  action VARCHAR(40) NOT NULL,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permission (resource, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permission_grants (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_grant (role_id, permission_id),
  KEY idx_grant_permission (permission_id),
  CONSTRAINT fk_grants_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_grants_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_role_assignments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  role_id INT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  expires_at DATETIME NULL,
  assigned_by INT UNSIGNED NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_assignment (user_id, role_id),
  KEY idx_assignment_role (role_id),
  CONSTRAINT fk_assignments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_assignments_assigner FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE auth_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  previous_refresh_token_hash CHAR(64) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  revoked_at DATETIME NULL,
  revoke_reason VARCHAR(60) NULL,
  expires_at DATETIME NOT NULL,
  last_used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_refresh (refresh_token_hash),
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_prev (previous_refresh_token_hash),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE password_reset_otps (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  reset_token_hash CHAR(64) NULL,
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_otps_user (user_id),
  CONSTRAINT fk_otps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE api_rate_limits (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rate_key CHAR(64) NOT NULL,
  bucket VARCHAR(60) NOT NULL,
  attempts INT UNSIGNED NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rate_key (rate_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(80) NULL,
  entity_id INT UNSIGNED NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_user (user_id),
  KEY idx_audit_created (created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE security_audit_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  event VARCHAR(60) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  meta JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sec_audit_user (user_id),
  KEY idx_sec_audit_event (event)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- B. CORE SHARED
-- ----------------------------------------------------------------------------

CREATE TABLE settings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  skey VARCHAR(60) NOT NULL,
  -- LONGTEXT: company_logo_path may hold a base64 data URI (up to ~5 MB upload -> ~6.7 MB encoded).
  svalue LONGTEXT NULL,
  updated_by INT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_settings_key (skey),
  CONSTRAINT fk_settings_user FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE number_sequences (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  seq_key VARCHAR(30) NOT NULL,
  period VARCHAR(10) NOT NULL DEFAULT '',
  prefix VARCHAR(10) NOT NULL,
  next_number INT UNSIGNED NOT NULL DEFAULT 1,
  padding TINYINT UNSIGNED NOT NULL DEFAULT 5,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sequence (seq_key, period)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  type VARCHAR(80) NOT NULL,
  title VARCHAR(150) NOT NULL,
  body VARCHAR(500) NULL,
  entity_type VARCHAR(40) NULL,
  entity_id INT UNSIGNED NULL,
  link_url VARCHAR(255) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  read_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user (user_id, is_read),
  KEY idx_notifications_created (created_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- C+D. LEADS · SERVICES · CUSTOMERS · WORKS
-- (leads created first without customer FKs; added after customers exists)
-- ----------------------------------------------------------------------------

CREATE TABLE lead_sources (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lead_sources_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE leads (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  mobile VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  company VARCHAR(150) NULL,
  city VARCHAR(100) NULL,
  source_id INT UNSIGNED NULL,
  source_detail VARCHAR(255) NULL,
  channel_type ENUM('walk_in','phone','website','whatsapp','facebook','instagram','google','referral','other') NOT NULL DEFAULT 'other',
  entry_type ENUM('manual','import','api','webhook') NOT NULL DEFAULT 'manual',
  platform_lead_id VARCHAR(150) NULL,
  service_interest VARCHAR(255) NULL,
  expected_value DECIMAL(12,2) NULL,
  status ENUM('New','Contacted','Qualified','Meeting Scheduled','Meeting Done','Proposal Sent','Negotiation','Converted','Dropped','Lost') NOT NULL DEFAULT 'New',
  assigned_to INT UNSIGNED NULL,
  created_by INT UNSIGNED NULL,
  referred_by_customer_id INT UNSIGNED NULL,
  referred_by_lead_id INT UNSIGNED NULL,
  customer_id INT UNSIGNED NULL,
  converted_at DATETIME NULL,
  dropped_at DATETIME NULL,
  drop_reason VARCHAR(255) NULL,
  drop_reason_desc TEXT NULL,
  tags_json JSON NULL,
  ai_score DECIMAL(5,2) NULL,
  ai_classification VARCHAR(100) NULL,
  notes TEXT NULL,
  lead_date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leads_platform (platform_lead_id),
  KEY idx_leads_status (status),
  KEY idx_leads_mobile (mobile),
  KEY idx_leads_email (email),
  KEY idx_leads_source (source_id),
  KEY idx_leads_assigned (assigned_to),
  KEY idx_leads_created (created_at),
  KEY idx_leads_created_by (created_by),
  KEY idx_leads_referred_lead (referred_by_lead_id),
  KEY idx_leads_customer (customer_id),
  KEY idx_leads_referred_customer (referred_by_customer_id),
  CONSTRAINT fk_leads_source FOREIGN KEY (source_id) REFERENCES lead_sources(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_leads_referred_lead FOREIGN KEY (referred_by_lead_id) REFERENCES leads(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE services (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(255) NULL,
  default_rate DECIMAL(12,2) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_services_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  company VARCHAR(150) NULL,
  gstin VARCHAR(20) NULL,
  mobile VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  pincode VARCHAR(10) NULL,
  stage ENUM('onboarding','active','inactive','churned') NOT NULL DEFAULT 'onboarding',
  assigned_to INT UNSIGNED NULL,
  source_lead_id INT UNSIGNED NULL,
  referred_by_customer_id INT UNSIGNED NULL,
  notes TEXT NULL,
  tags_json JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_code (customer_code),
  KEY idx_customers_stage (stage),
  KEY idx_customers_mobile (mobile),
  KEY idx_customers_email (email),
  KEY idx_customers_assigned (assigned_to),
  KEY idx_customers_created (created_at),
  KEY idx_customers_source_lead (source_lead_id),
  KEY idx_customers_referrer (referred_by_customer_id),
  CONSTRAINT fk_customers_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_source_lead FOREIGN KEY (source_lead_id) REFERENCES leads(id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_referrer FOREIGN KEY (referred_by_customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  CONSTRAINT fk_customers_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- circular FKs now that customers exists
ALTER TABLE leads
  ADD CONSTRAINT fk_leads_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_leads_referred_customer FOREIGN KEY (referred_by_customer_id) REFERENCES customers(id) ON DELETE SET NULL;

CREATE TABLE lead_services (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id INT UNSIGNED NOT NULL,
  service_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_lead_services (lead_id, service_id),
  KEY idx_lead_services_service (service_id),
  CONSTRAINT fk_lead_services_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_lead_services_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lead_followups (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id INT UNSIGNED NOT NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NULL,
  status ENUM('Pending','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  completed_at DATETIME NULL,
  outcome VARCHAR(150) NULL,
  notes TEXT NULL,
  is_auto TINYINT(1) NOT NULL DEFAULT 0,
  auto_step TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_followups_sched (scheduled_date, status),
  KEY idx_followups_lead (lead_id),
  CONSTRAINT fk_followups_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_followups_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Meetings: optionally tied to a lead (scheduled from lead detail) or standalone
-- (added manually from the Meetings board — internal / client meetings). Attendees
-- live in the meeting_customers / meeting_users junctions ("clients" and "team").
CREATE TABLE lead_meetings (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id INT UNSIGNED NULL,
  title VARCHAR(200) NULL,
  meeting_date DATE NOT NULL,
  start_time TIME NULL,
  end_time TIME NULL,
  mode ENUM('in_person','call','video') NOT NULL DEFAULT 'in_person',
  location VARCHAR(255) NULL,
  assigned_to INT UNSIGNED NULL,
  attended TINYINT(1) NOT NULL DEFAULT 0,
  outcome_notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_meetings_date (meeting_date),
  KEY idx_meetings_lead (lead_id),
  KEY idx_meetings_assigned (assigned_to),
  CONSTRAINT fk_meetings_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_meetings_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_meetings_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE meeting_customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  meeting_id INT UNSIGNED NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_meeting_customer (meeting_id, customer_id),
  KEY idx_mc_customer (customer_id),
  CONSTRAINT fk_mc_meeting FOREIGN KEY (meeting_id) REFERENCES lead_meetings(id) ON DELETE CASCADE,
  CONSTRAINT fk_mc_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE meeting_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  meeting_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_meeting_user (meeting_id, user_id),
  KEY idx_mu_user (user_id),
  CONSTRAINT fk_mu_meeting FOREIGN KEY (meeting_id) REFERENCES lead_meetings(id) ON DELETE CASCADE,
  CONSTRAINT fk_mu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lead_activities (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  lead_id INT UNSIGNED NOT NULL,
  activity_type VARCHAR(80) NOT NULL,
  description TEXT NULL,
  old_status VARCHAR(80) NULL,
  new_status VARCHAR(80) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activities_lead (lead_id),
  KEY idx_activities_created (created_at),
  CONSTRAINT fk_activities_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT fk_activities_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE lead_drop_reasons (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_drop_reasons_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE works (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_code VARCHAR(20) NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT NULL,
  service_id INT UNSIGNED NULL,
  status ENUM('pending','in_progress','on_hold','review','completed','cancelled') NOT NULL DEFAULT 'pending',
  priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  assigned_to INT UNSIGNED NULL,
  start_date DATE NULL,
  due_date DATE NULL,
  completed_at DATETIME NULL,
  estimated_amount DECIMAL(12,2) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_works_code (work_code),
  KEY idx_works_customer (customer_id),
  KEY idx_works_status (status),
  KEY idx_works_assigned (assigned_to),
  KEY idx_works_due (due_date),
  CONSTRAINT fk_works_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_works_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_works_assigned FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_works_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE work_comments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  work_id INT UNSIGNED NOT NULL,
  comment TEXT NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_work_comments_work (work_id),
  CONSTRAINT fk_work_comments_work FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
  CONSTRAINT fk_work_comments_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE customer_events (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  event_type VARCHAR(60) NOT NULL,
  description VARCHAR(500) NULL,
  ref_table VARCHAR(40) NULL,
  ref_id INT UNSIGNED NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customer_events_customer (customer_id),
  KEY idx_customer_events_created (created_at),
  CONSTRAINT fk_customer_events_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_events_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- H. HRMS  (departments.head FK added after employees)
-- ----------------------------------------------------------------------------

CREATE TABLE departments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  head_employee_id INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_name (name),
  KEY idx_departments_head (head_employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE designations (
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

CREATE TABLE shifts (
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

CREATE TABLE employees (
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

ALTER TABLE departments
  ADD CONSTRAINT fk_departments_head FOREIGN KEY (head_employee_id) REFERENCES employees(id) ON DELETE SET NULL;

CREATE TABLE employee_attendance (
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

CREATE TABLE leave_types (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL,
  code VARCHAR(10) NOT NULL,
  is_paid TINYINT(1) NOT NULL DEFAULT 1,
  max_days_per_year DECIMAL(5,1) NOT NULL DEFAULT 12,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_types_name (name),
  UNIQUE KEY uq_leave_types_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE leave_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id INT UNSIGNED NOT NULL,
  leave_type_id INT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days DECIMAL(5,1) NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  approved_by INT UNSIGNED NULL,
  approved_at DATETIME NULL,
  rejection_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leave_requests_employee (employee_id),
  KEY idx_leave_requests_status (status),
  KEY idx_leave_requests_start (start_date),
  KEY idx_leave_requests_type (leave_type_id),
  CONSTRAINT fk_leave_requests_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_requests_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE RESTRICT,
  CONSTRAINT fk_leave_requests_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE leave_balances (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id INT UNSIGNED NOT NULL,
  leave_type_id INT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  allocated DECIMAL(5,1) NOT NULL DEFAULT 0,
  used DECIMAL(5,1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_leave_balances (employee_id, leave_type_id, year),
  KEY idx_leave_balances_type (leave_type_id),
  CONSTRAINT fk_leave_balances_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CONSTRAINT fk_leave_balances_type FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE holidays (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  holiday_date DATE NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_holidays_date (holiday_date),
  CONSTRAINT fk_holidays_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payroll_runs (
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

CREATE TABLE payroll_items (
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
  override_net DECIMAL(12,2) NULL DEFAULT NULL, -- admin-set final payable; NULL = pay the computed net
  net DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('draft','finalized','paid') NOT NULL DEFAULT 'draft',
  paid_at DATETIME NULL,
  expense_id INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payroll_items (payroll_run_id, employee_id),
  KEY idx_payroll_items_employee (employee_id),
  KEY idx_payroll_items_expense (expense_id),
  CONSTRAINT fk_payroll_items_run FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
  CONSTRAINT fk_payroll_items_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- F. EXPENSES  (payroll_items.expense_id FK added after expenses)
-- ----------------------------------------------------------------------------

CREATE TABLE bank_accounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_name VARCHAR(120) NOT NULL,
  bank_name VARCHAR(120) NULL,
  account_number VARCHAR(40) NULL,
  ifsc_code VARCHAR(20) NULL,
  upi_id VARCHAR(120) NULL,
  qr_code_path VARCHAR(500) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE expense_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  type ENUM('fixed','variable') NOT NULL DEFAULT 'variable',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  system_key VARCHAR(50) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_expense_categories_name (name),
  UNIQUE KEY uq_expense_categories_syskey (system_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE fixed_cost_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id INT UNSIGNED NOT NULL,
  employee_id INT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fixed_items_name (category_id, name),
  UNIQUE KEY uq_fixed_items_employee (category_id, employee_id),
  KEY idx_fixed_items_employee (employee_id),
  CONSTRAINT fk_fixed_items_category FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE,
  CONSTRAINT fk_fixed_items_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE expenses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  expense_date DATE NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  fixed_cost_item_id INT UNSIGNED NULL,
  type ENUM('fixed','variable') NOT NULL DEFAULT 'variable',
  amount DECIMAL(12,2) NOT NULL,
  description VARCHAR(255) NULL,
  paid_to VARCHAR(150) NULL,
  notes TEXT NULL,
  payment_mode ENUM('cash','bank','upi','cheque','card') NOT NULL DEFAULT 'cash',
  bank_account_id INT UNSIGNED NULL,
  ref_table VARCHAR(40) NULL,
  ref_id INT UNSIGNED NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_expenses_date_category (expense_date, category_id),
  KEY idx_expenses_item (fixed_cost_item_id),
  KEY idx_expenses_bank (bank_account_id),
  KEY idx_expenses_category (category_id),
  CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_expenses_item FOREIGN KEY (fixed_cost_item_id) REFERENCES fixed_cost_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_expenses_bank FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_expenses_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE payroll_items
  ADD CONSTRAINT fk_payroll_items_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL;

CREATE TABLE fixed_cost_monthly_payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fixed_cost_item_id INT UNSIGNED NOT NULL,
  month TINYINT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status ENUM('paid','pending') NOT NULL DEFAULT 'pending',
  payment_date DATE NULL,
  expense_id INT UNSIGNED NULL,
  payroll_item_id INT UNSIGNED NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tracker (fixed_cost_item_id, month, year),
  KEY idx_tracker_expense (expense_id),
  KEY idx_tracker_payroll (payroll_item_id),
  CONSTRAINT fk_tracker_item FOREIGN KEY (fixed_cost_item_id) REFERENCES fixed_cost_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tracker_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL,
  CONSTRAINT fk_tracker_payroll FOREIGN KEY (payroll_item_id) REFERENCES payroll_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE expense_reminders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id INT UNSIGNED NOT NULL,
  fixed_cost_item_id INT UNSIGNED NULL,
  due_day TINYINT UNSIGNED NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_reminders_category (category_id),
  KEY idx_reminders_item (fixed_cost_item_id),
  CONSTRAINT fk_reminders_category FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE CASCADE,
  CONSTRAINT fk_reminders_item FOREIGN KEY (fixed_cost_item_id) REFERENCES fixed_cost_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- G. INVENTORY  (inventory_transactions created after invoices — FK invoice_id)
-- ----------------------------------------------------------------------------

CREATE TABLE inventory_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  item_type ENUM('raw_material','stock') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_categories (name, item_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE units (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(30) NOT NULL,
  short_name VARCHAR(10) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_units_name (name),
  UNIQUE KEY uq_units_short (short_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE suppliers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  company VARCHAR(150) NULL,
  gstin VARCHAR(20) NULL,
  mobile VARCHAR(20) NULL,
  email VARCHAR(150) NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  notes TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_suppliers_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE inventory_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  item_type ENUM('raw_material','stock') NOT NULL,
  category_id INT UNSIGNED NULL,
  unit_id INT UNSIGNED NOT NULL,
  current_stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  avg_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(12,2) NULL,
  reorder_level DECIMAL(12,3) NOT NULL DEFAULT 0,
  description VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_items_code (item_code),
  KEY idx_inventory_items_type (item_type),
  KEY idx_inventory_items_category (category_id),
  KEY idx_inventory_items_name (name),
  KEY idx_inventory_items_unit (unit_id),
  CONSTRAINT fk_inventory_items_category FOREIGN KEY (category_id) REFERENCES inventory_categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_inventory_items_unit FOREIGN KEY (unit_id) REFERENCES units(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_items_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchases (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_no VARCHAR(30) NOT NULL,
  supplier_id INT UNSIGNED NOT NULL,
  purchase_date DATE NOT NULL,
  status ENUM('draft','received','cancelled') NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_status ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  payment_mode ENUM('cash','bank','upi','cheque','card') NULL,
  bank_account_id INT UNSIGNED NULL,
  expense_id INT UNSIGNED NULL,
  invoice_ref VARCHAR(60) NULL,
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchases_no (purchase_no),
  KEY idx_purchases_supplier (supplier_id),
  KEY idx_purchases_status (status),
  KEY idx_purchases_date (purchase_date),
  KEY idx_purchases_expense (expense_id),
  KEY idx_purchases_bank (bank_account_id),
  CONSTRAINT fk_purchases_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_purchases_bank FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_purchases_expense FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL,
  CONSTRAINT fk_purchases_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE purchase_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  qty DECIMAL(12,3) NOT NULL,
  rate DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_purchase_items_purchase (purchase_id),
  KEY idx_purchase_items_item (item_id),
  CONSTRAINT fk_purchase_items_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  CONSTRAINT fk_purchase_items_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- E. INVOICES
-- ----------------------------------------------------------------------------

CREATE TABLE invoices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_no VARCHAR(30) NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  work_id INT UNSIGNED NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NULL,
  status ENUM('draft','sent','partially_paid','paid','cancelled') NOT NULL DEFAULT 'draft',
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  grand_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes VARCHAR(500) NULL,
  terms VARCHAR(1000) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invoices_no (invoice_no),
  KEY idx_invoices_customer (customer_id),
  KEY idx_invoices_status (status),
  KEY idx_invoices_date (invoice_date),
  KEY idx_invoices_due (due_date),
  KEY idx_invoices_work (work_id),
  CONSTRAINT fk_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_invoices_work FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE SET NULL,
  CONSTRAINT fk_invoices_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id INT UNSIGNED NOT NULL,
  item_type ENUM('service','stock','custom') NOT NULL DEFAULT 'service',
  service_id INT UNSIGNED NULL,
  inventory_item_id INT UNSIGNED NULL,
  description VARCHAR(255) NOT NULL,
  qty DECIMAL(12,3) NOT NULL DEFAULT 1,
  unit VARCHAR(20) NULL,
  rate DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  line_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_invoice_items_invoice (invoice_id),
  KEY idx_invoice_items_service (service_id),
  KEY idx_invoice_items_inventory (inventory_item_id),
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL,
  CONSTRAINT fk_invoice_items_inventory FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE invoice_payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id INT UNSIGNED NOT NULL,
  receipt_no VARCHAR(30) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_mode ENUM('cash','upi','bank','card','cheque') NOT NULL DEFAULT 'cash',
  bank_account_id INT UNSIGNED NULL,
  cheque_number VARCHAR(50) NULL,
  cheque_date DATE NULL,
  cheque_bank VARCHAR(100) NULL,
  cheque_status ENUM('pending','deposited','cleared','bounced') NULL,
  cheque_cleared_at DATETIME NULL,
  notes VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_receipt (receipt_no),
  KEY idx_payments_invoice (invoice_id),
  KEY idx_payments_date (payment_date),
  KEY idx_payments_bank (bank_account_id),
  CONSTRAINT fk_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_bank FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- inventory ledger (needs invoices + works + purchases)
CREATE TABLE inventory_transactions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id INT UNSIGNED NOT NULL,
  type ENUM('in','out') NOT NULL,
  reason ENUM('purchase','production','adjustment_in','sale_reversal','sale','work_issue','production_consume','adjustment_out','damage','purchase_reversal') NOT NULL,
  qty DECIMAL(12,3) NOT NULL,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  purchase_id INT UNSIGNED NULL,
  invoice_id INT UNSIGNED NULL,
  work_id INT UNSIGNED NULL,
  production_batch VARCHAR(30) NULL,
  notes VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_inv_txn_item (item_id, created_at),
  KEY idx_inv_txn_reason (reason),
  KEY idx_inv_txn_work (work_id),
  KEY idx_inv_txn_invoice (invoice_id),
  KEY idx_inv_txn_purchase (purchase_id),
  CONSTRAINT fk_inv_txn_item FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inv_txn_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_txn_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_txn_work FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_txn_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- I. INTEGRATIONS
-- ----------------------------------------------------------------------------

CREATE TABLE integration_accounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider ENUM('google','facebook') NOT NULL,
  user_id INT UNSIGNED NULL,
  external_account_id VARCHAR(128) NOT NULL,
  account_name VARCHAR(150) NULL,
  email VARCHAR(150) NULL,
  access_token TEXT NULL,
  access_token_expires_at DATETIME NULL,
  refresh_token TEXT NULL,
  scopes TEXT NULL,
  status ENUM('active','revoked','error') NOT NULL DEFAULT 'active',
  last_synced_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_integration_accounts (provider, external_account_id),
  CONSTRAINT fk_integration_accounts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integration_locations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  integration_account_id INT UNSIGNED NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  name VARCHAR(200) NULL,
  address VARCHAR(255) NULL,
  asset_token TEXT NULL,
  extra JSON NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_integration_locations (integration_account_id, external_id),
  CONSTRAINT fk_integration_locations_account FOREIGN KEY (integration_account_id) REFERENCES integration_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integration_metrics_daily (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  integration_location_id INT UNSIGNED NOT NULL,
  metric VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  value BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_metric (integration_location_id, metric, date),
  CONSTRAINT fk_metrics_location FOREIGN KEY (integration_location_id) REFERENCES integration_locations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integration_keywords (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  integration_location_id INT UNSIGNED NOT NULL,
  month DATE NOT NULL,
  keyword VARCHAR(255) NOT NULL,
  impressions INT UNSIGNED NOT NULL DEFAULT 0,
  is_threshold TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_keywords (integration_location_id, month, keyword),
  CONSTRAINT fk_keywords_location FOREIGN KEY (integration_location_id) REFERENCES integration_locations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integration_reviews (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  integration_location_id INT UNSIGNED NOT NULL,
  external_review_id VARCHAR(128) NOT NULL,
  rating TINYINT UNSIGNED NULL,
  reviewer_name VARCHAR(150) NULL,
  comment TEXT NULL,
  reply TEXT NULL,
  reviewed_at DATETIME NULL,
  replied_at DATETIME NULL,
  synced_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_reviews_external (external_review_id),
  KEY idx_reviews_location (integration_location_id),
  CONSTRAINT fk_reviews_location FOREIGN KEY (integration_location_id) REFERENCES integration_locations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integration_posts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  integration_location_id INT UNSIGNED NOT NULL,
  external_post_id VARCHAR(128) NOT NULL,
  message TEXT NULL,
  media_type VARCHAR(32) NULL,
  permalink VARCHAR(512) NULL,
  posted_at DATETIME NULL,
  views_unique INT UNSIGNED NOT NULL DEFAULT 0,
  clicks INT UNSIGNED NOT NULL DEFAULT 0,
  reactions INT UNSIGNED NOT NULL DEFAULT 0,
  comments INT UNSIGNED NOT NULL DEFAULT 0,
  shares INT UNSIGNED NOT NULL DEFAULT 0,
  engagement INT UNSIGNED NOT NULL DEFAULT 0,
  synced_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_posts_external (external_post_id),
  KEY idx_posts_location (integration_location_id),
  CONSTRAINT fk_posts_location FOREIGN KEY (integration_location_id) REFERENCES integration_locations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE integration_sync_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  integration_account_id INT UNSIGNED NOT NULL,
  kind ENUM('metrics','keywords','reviews','locations','posts','token','backfill') NOT NULL,
  status ENUM('pending','running','success','error') NOT NULL,
  message TEXT NULL,
  ran_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_sync_log_account (integration_account_id, ran_at),
  CONSTRAINT fk_sync_log_account FOREIGN KEY (integration_account_id) REFERENCES integration_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- JEWELLERY EXTENSIONS — Sejal Jewellers domain (info.md), added on top of the
-- base LeadSpark schema. Existing INT keys + FKs are preserved; jewellery data
-- is additive so nothing downstream breaks.
-- ============================================================================

-- --- Customer 360 (info.md §4, §5.2) ---------------------------------------
ALTER TABLE customers
  ADD COLUMN alt_mobile VARCHAR(20) NULL AFTER mobile,
  ADD COLUMN pan_no VARCHAR(15) NULL AFTER gstin,
  ADD COLUMN gender ENUM('male','female','other') NULL AFTER pincode,
  ADD COLUMN dob DATE NULL AFTER gender,
  ADD COLUMN anniversary DATE NULL AFTER dob,
  ADD COLUMN occupation VARCHAR(100) NULL AFTER anniversary,
  ADD COLUMN vip TINYINT(1) NOT NULL DEFAULT 0 AFTER occupation,
  ADD COLUMN last_visit_at DATETIME NULL AFTER vip,
  ADD COLUMN opt_in_json JSON NULL AFTER tags_json,
  ADD COLUMN preferences_json JSON NULL AFTER opt_in_json;

CREATE TABLE family_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id INT UNSIGNED NOT NULL,
  relation VARCHAR(30) NULL,
  name VARCHAR(150) NOT NULL,
  dob DATE NULL,
  anniversary DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_family_customer (customer_id),
  CONSTRAINT fk_family_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --- Leads / enquiries (info.md §5.3) --------------------------------------
ALTER TABLE leads
  ADD COLUMN interest_type ENUM('Gold','Diamond','Bridal','Silver','Platinum','Custom','General') NULL AFTER service_interest,
  ADD COLUMN budget_range VARCHAR(60) NULL AFTER interest_type;

-- --- Inventory (jewellery SKU — info.md §5.6) ------------------------------
ALTER TABLE inventory_items
  ADD COLUMN barcode VARCHAR(64) NULL AFTER item_code,
  ADD COLUMN metal_type VARCHAR(30) NULL AFTER description,
  ADD COLUMN gross_wt DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER metal_type,
  ADD COLUMN net_wt DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER gross_wt,
  ADD COLUMN stone_wt DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER net_wt,
  -- diamond content: per-piece for finished stock; "stones in this lot" for ct-measured raw lots
  ADD COLUMN diamond_ct DECIMAL(7,3) NOT NULL DEFAULT 0 AFTER stone_wt,
  ADD COLUMN diamond_pcs INT UNSIGNED NOT NULL DEFAULT 0 AFTER diamond_ct,
  ADD COLUMN purity VARCHAR(10) NULL AFTER diamond_pcs,
  ADD COLUMN making_charge DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER purity,
  ADD COLUMN wastage_pct DECIMAL(6,3) NOT NULL DEFAULT 0 AFTER making_charge,
  ADD COLUMN hsn_code VARCHAR(12) NULL AFTER wastage_pct,
  ADD COLUMN location VARCHAR(100) NULL AFTER hsn_code,
  ADD COLUMN show_on_website TINYINT(1) NOT NULL DEFAULT 1 AFTER selling_price,
  ADD COLUMN purchase_price DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER show_on_website,
  ADD COLUMN vendor_id INT UNSIGNED NULL AFTER purchase_price,
  ADD COLUMN jw_status ENUM('in_stock','reserved','sold','under_repair','melting') NOT NULL DEFAULT 'in_stock' AFTER vendor_id,
  ADD COLUMN source_order_id INT UNSIGNED NULL AFTER jw_status,
  ADD COLUMN images_json JSON NULL AFTER source_order_id,
  ADD KEY idx_inventory_vendor (vendor_id),
  ADD KEY idx_inventory_jw_status (jw_status),
  ADD CONSTRAINT fk_inventory_vendor FOREIGN KEY (vendor_id) REFERENCES suppliers(id) ON DELETE SET NULL;

-- --- Invoices (jewellery billing — info.md §5.4) ---------------------------
ALTER TABLE invoices
  ADD COLUMN sale_type ENUM('ready','custom') NOT NULL DEFAULT 'ready' AFTER status,
  ADD COLUMN old_gold_adjustment DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER discount_total,
  ADD COLUMN cgst DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER tax_total,
  ADD COLUMN sgst DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER cgst,
  ADD COLUMN igst DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER sgst,
  ADD COLUMN hallmark_no VARCHAR(40) NULL AFTER terms,
  ADD COLUMN huid VARCHAR(40) NULL AFTER hallmark_no,
  ADD COLUMN warranty_months INT NULL AFTER huid;

ALTER TABLE invoice_items
  ADD COLUMN metal_type VARCHAR(30) NULL AFTER description,
  ADD COLUMN gross_wt DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER metal_type,
  ADD COLUMN net_wt DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER gross_wt,
  ADD COLUMN stone_wt DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER net_wt,
  ADD COLUMN purity VARCHAR(10) NULL AFTER stone_wt,
  ADD COLUMN making_charge DECIMAL(14,2) NOT NULL DEFAULT 0 AFTER purity,
  ADD COLUMN wastage_pct DECIMAL(6,3) NOT NULL DEFAULT 0 AFTER making_charge,
  ADD COLUMN hsn_code VARCHAR(12) NULL AFTER wastage_pct,
  ADD COLUMN diamond_wt DECIMAL(10,3) NOT NULL DEFAULT 0 AFTER hsn_code,
  ADD COLUMN diamond_grade VARCHAR(30) NULL AFTER diamond_wt;

-- --- Vendors / Karigars (info.md §5.11 — extends the suppliers table) -------
ALTER TABLE suppliers
  ADD COLUMN vendor_type VARCHAR(30) NOT NULL DEFAULT 'other' AFTER name,
  ADD COLUMN contact_person VARCHAR(120) NULL AFTER company,
  ADD COLUMN state VARCHAR(100) NULL AFTER city,
  ADD COLUMN pincode VARCHAR(12) NULL AFTER state,
  ADD COLUMN pan_no VARCHAR(15) NULL AFTER gstin,
  ADD COLUMN bank_name VARCHAR(120) NULL AFTER pan_no,
  ADD COLUMN account_no VARCHAR(40) NULL AFTER bank_name,
  ADD COLUMN ifsc VARCHAR(20) NULL AFTER account_no,
  ADD COLUMN upi VARCHAR(80) NULL AFTER ifsc,
  ADD COLUMN payment_terms VARCHAR(120) NULL AFTER upi,
  ADD COLUMN specialisation VARCHAR(120) NULL AFTER payment_terms,
  ADD COLUMN karigar_rate DECIMAL(12,2) NULL AFTER specialisation,
  ADD COLUMN vendor_status ENUM('active','inactive','blacklisted') NOT NULL DEFAULT 'active' AFTER karigar_rate;

-- --- Custom Orders (info.md §5.7, life cycle §6.3.2) -----------------------
CREATE TABLE orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no VARCHAR(30) NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  title VARCHAR(190) NOT NULL,
  category VARCHAR(60) NULL,
  production_type ENUM('in_house','outsource') NOT NULL DEFAULT 'in_house',
  vendor_id INT UNSIGNED NULL,
  karigar VARCHAR(120) NULL,
  employee_id INT UNSIGNED NULL,
  material_issued_wt DECIMAL(10,3) NOT NULL DEFAULT 0,
  material_returned_wt DECIMAL(10,3) NOT NULL DEFAULT 0,
  material_note VARCHAR(255) NULL,
  outsource_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  metal_details VARCHAR(190) NULL,
  design_images_json JSON NULL,
  estimated_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  advance_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  quoted_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  final_price DECIMAL(14,2) NOT NULL DEFAULT 0,
  order_date DATE NOT NULL,
  expected_date DATE NULL,
  delivered_date DATE NULL,
  status ENUM('pending','in_production','quality_check','customer_review','approved','delivered','cancelled','rejected') NOT NULL DEFAULT 'pending',
  review_notes TEXT NULL,
  invoice_id INT UNSIGNED NULL,
  stock_item_id INT UNSIGNED NULL,
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_no (order_no),
  UNIQUE KEY uq_order_invoice (invoice_id),
  KEY idx_order_customer (customer_id),
  KEY idx_order_status (status),
  KEY idx_order_vendor (vendor_id),
  KEY idx_order_employee (employee_id),
  KEY idx_order_deleted (deleted_at),
  CONSTRAINT fk_order_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_vendor FOREIGN KEY (vendor_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_orders_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_stock FOREIGN KEY (stock_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_order_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  description VARCHAR(190) NOT NULL,
  category VARCHAR(60) NULL,
  gold_wt DECIMAL(10,3) NOT NULL DEFAULT 0,
  purity VARCHAR(10) NULL,
  diamond_wt DECIMAL(10,3) NOT NULL DEFAULT 0,
  diamond_grade VARCHAR(30) NULL,
  making_charge DECIMAL(14,2) NOT NULL DEFAULT 0,
  wastage_pct DECIMAL(6,3) NOT NULL DEFAULT 0,
  qty INT NOT NULL DEFAULT 1,
  line_total DECIMAL(14,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_oi_order (order_id),
  CONSTRAINT fk_oi_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_status_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  status ENUM('pending','in_production','quality_check','customer_review','approved','delivered','cancelled','rejected') NOT NULL,
  note VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_osh_order (order_id),
  CONSTRAINT fk_osh_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --- Repairs (info.md §5.9) ------------------------------------------------
CREATE TABLE repairs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  repair_no VARCHAR(30) NOT NULL,
  customer_id INT UNSIGNED NOT NULL,
  item_description VARCHAR(190) NOT NULL,
  category VARCHAR(60) NULL,
  metal_details VARCHAR(190) NULL,
  issue TEXT NULL,
  estimated_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  final_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  advance_paid DECIMAL(14,2) NOT NULL DEFAULT 0,
  received_date DATE NOT NULL,
  expected_date DATE NULL,
  delivered_date DATE NULL,
  technician VARCHAR(120) NULL,
  vendor_id INT UNSIGNED NULL,
  before_images_json JSON NULL,
  after_images_json JSON NULL,
  status ENUM('received','diagnosed','in_progress','quality_check','ready','delivered','cancelled') NOT NULL DEFAULT 'received',
  notes TEXT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_repair_no (repair_no),
  KEY idx_repair_customer (customer_id),
  KEY idx_repair_status (status),
  KEY idx_repair_vendor (vendor_id),
  KEY idx_repair_deleted (deleted_at),
  CONSTRAINT fk_repair_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_repair_vendor FOREIGN KEY (vendor_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  CONSTRAINT fk_repair_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE repair_status_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  repair_id INT UNSIGNED NOT NULL,
  status ENUM('received','diagnosed','in_progress','quality_check','ready','delivered','cancelled') NOT NULL,
  note VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_rsh_repair (repair_id),
  CONSTRAINT fk_rsh_repair FOREIGN KEY (repair_id) REFERENCES repairs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --- WhatsApp & Email automation (info.md §5.12) ---------------------------
CREATE TABLE message_templates (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  channel ENUM('whatsapp','email') NOT NULL DEFAULT 'whatsapp',
  event ENUM('lead_followup','invoice_receipt','order_status','repair_status','appointment_reminder','birthday','anniversary','order_review','custom') NOT NULL DEFAULT 'custom',
  subject VARCHAR(190) NULL,
  body TEXT NOT NULL,
  variables_json JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_mt_channel (channel),
  KEY idx_mt_event (event),
  CONSTRAINT fk_mt_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE message_log (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  channel ENUM('whatsapp','email') NOT NULL DEFAULT 'whatsapp',
  template_id INT UNSIGNED NULL,
  event VARCHAR(40) NULL,
  recipient_name VARCHAR(150) NULL,
  recipient_contact VARCHAR(190) NULL,
  subject VARCHAR(190) NULL,
  body TEXT NULL,
  status ENUM('queued','sent','delivered','failed') NOT NULL DEFAULT 'queued',
  related_type VARCHAR(40) NULL,
  related_id INT UNSIGNED NULL,
  error VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ml_status (status),
  KEY idx_ml_channel (channel),
  KEY idx_ml_created (created_at),
  CONSTRAINT fk_ml_template FOREIGN KEY (template_id) REFERENCES message_templates(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
