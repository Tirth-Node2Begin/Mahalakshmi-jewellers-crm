-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 03, 2026 at 04:43 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `sejal_jewellers_crm`
--

-- --------------------------------------------------------

--
-- Table structure for table `api_rate_limits`
--

CREATE TABLE `api_rate_limits` (
  `id` int(10) UNSIGNED NOT NULL,
  `rate_key` char(64) NOT NULL,
  `bucket` varchar(60) NOT NULL,
  `attempts` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `window_started_at` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `audit_logs`
--

CREATE TABLE `audit_logs` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `entity_type` varchar(80) DEFAULT NULL,
  `entity_id` int(10) UNSIGNED DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `auth_sessions`
--

CREATE TABLE `auth_sessions` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `refresh_token_hash` char(64) NOT NULL,
  `previous_refresh_token_hash` char(64) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `revoke_reason` varchar(60) DEFAULT NULL,
  `expires_at` datetime NOT NULL,
  `last_used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `auth_sessions`
--

INSERT INTO `auth_sessions` (`id`, `user_id`, `refresh_token_hash`, `previous_refresh_token_hash`, `ip_address`, `user_agent`, `revoked_at`, `revoke_reason`, `expires_at`, `last_used_at`, `created_at`) VALUES
(1, 1, 'd10e5dbe68a04923898dec088a2a547965dbcab7cbe409a38d53599bd95053c0', '725c174f571c580c266f713811670208728d4a07512ecdf37de0b4374fb5d761', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-03 18:18:32', 'refresh_reuse', '2026-10-01 17:55:39', '2026-07-03 18:18:32', '2026-07-03 12:25:39'),
(2, 1, '7eab25cb072bbf29157e1aa5915f393708f920da849297877a3883ed8ca35129', '9f7ad4a4ce242dc34d59c46bc77468aa3b86d21ed469117cf66d6f86c097e45a', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', '2026-07-03 20:04:09', 'refresh_reuse', '2026-10-01 18:34:38', '2026-07-03 20:04:09', '2026-07-03 13:04:38'),
(3, 1, '5a51330349b09c357cb38541aa10118edc0e1c0ef464cc57b5907e6181d33b2a', NULL, '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', NULL, NULL, '2026-10-01 20:06:44', NULL, '2026-07-03 14:36:44');

-- --------------------------------------------------------

--
-- Table structure for table `bank_accounts`
--

CREATE TABLE `bank_accounts` (
  `id` int(10) UNSIGNED NOT NULL,
  `account_name` varchar(120) NOT NULL,
  `bank_name` varchar(120) DEFAULT NULL,
  `account_number` varchar(40) DEFAULT NULL,
  `ifsc_code` varchar(20) DEFAULT NULL,
  `upi_id` varchar(120) DEFAULT NULL,
  `qr_code_path` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` int(10) UNSIGNED NOT NULL,
  `customer_code` varchar(20) NOT NULL,
  `name` varchar(150) NOT NULL,
  `company` varchar(150) DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `pan_no` varchar(15) DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `alt_mobile` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `dob` date DEFAULT NULL,
  `anniversary` date DEFAULT NULL,
  `occupation` varchar(100) DEFAULT NULL,
  `vip` tinyint(1) NOT NULL DEFAULT 0,
  `last_visit_at` datetime DEFAULT NULL,
  `stage` enum('onboarding','active','inactive','churned') NOT NULL DEFAULT 'onboarding',
  `assigned_to` int(10) UNSIGNED DEFAULT NULL,
  `source_lead_id` int(10) UNSIGNED DEFAULT NULL,
  `referred_by_customer_id` int(10) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `tags_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags_json`)),
  `opt_in_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`opt_in_json`)),
  `preferences_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`preferences_json`)),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `customer_code`, `name`, `company`, `gstin`, `pan_no`, `mobile`, `alt_mobile`, `email`, `address`, `city`, `state`, `pincode`, `gender`, `dob`, `anniversary`, `occupation`, `vip`, `last_visit_at`, `stage`, `assigned_to`, `source_lead_id`, `referred_by_customer_id`, `notes`, `tags_json`, `opt_in_json`, `preferences_json`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'CUST-0001', 'Meera Shah', NULL, NULL, NULL, '9990010001', NULL, 'meera@example.com', NULL, 'Mumbai', 'Maharashtra', NULL, 'female', '1990-07-05', '1990-07-08', 'Doctor', 1, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(2, 'CUST-0002', 'Anita Verma', NULL, NULL, NULL, '9990010002', NULL, 'anita@example.com', NULL, 'Pune', NULL, NULL, 'female', '1985-03-14', NULL, 'Architect', 0, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(3, 'CUST-0003', 'Rohit Mehta', NULL, NULL, NULL, '9990010003', NULL, NULL, NULL, 'Mumbai', NULL, NULL, 'male', '1990-07-09', NULL, 'Businessman', 1, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(4, 'CUST-0004', 'Priya Nair', NULL, NULL, NULL, '9990010004', NULL, 'priya@example.com', NULL, 'Thane', NULL, NULL, 'female', NULL, '1992-11-20', NULL, 0, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(5, 'CUST-0005', 'Karan Patel', NULL, NULL, NULL, '9990010005', NULL, NULL, NULL, 'Ahmedabad', NULL, NULL, 'male', NULL, NULL, 'CA', 0, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(6, 'CUST-0006', 'Sunita Desai', NULL, NULL, NULL, '9990010006', NULL, NULL, NULL, 'Mumbai', NULL, NULL, 'female', '1978-06-01', NULL, NULL, 0, NULL, 'onboarding', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(7, 'CUST-0007', 'Vikram Singh', NULL, NULL, NULL, '9990010007', NULL, NULL, NULL, 'Delhi', NULL, NULL, 'male', NULL, NULL, NULL, 0, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(8, 'CUST-0008', 'Deepa Iyer', NULL, NULL, NULL, '9990010008', NULL, 'deepa@example.com', NULL, 'Bengaluru', NULL, NULL, 'female', NULL, '1990-07-06', NULL, 1, NULL, 'active', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `customer_events`
--

CREATE TABLE `customer_events` (
  `id` int(10) UNSIGNED NOT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `event_type` varchar(60) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `ref_table` varchar(40) DEFAULT NULL,
  `ref_id` int(10) UNSIGNED DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer_events`
--

INSERT INTO `customer_events` (`id`, `customer_id`, `event_type`, `description`, `ref_table`, `ref_id`, `created_by`, `created_at`) VALUES
(1, 1, 'created', 'Customer added.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(2, 2, 'created', 'Customer added.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(3, 3, 'created', 'Customer added.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(4, 4, 'created', 'Customer added.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(5, 5, 'created', 'Customer added.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(6, 6, 'created', 'Customer added.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(7, 7, 'created', 'Customer added.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(8, 8, 'created', 'Customer added.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(9, 1, 'invoice_created', 'Invoice INV-2627-00001 sent (371,550.00).', 'invoices', 1, 1, '2026-07-03 12:30:43'),
(10, 1, 'payment_received', 'Payment ₹371,550.00 on INV-2627-00001', 'invoices', 1, 1, '2026-07-03 12:30:43'),
(11, 3, 'invoice_created', 'Invoice INV-2627-00002 sent (211,150.00).', 'invoices', 2, 1, '2026-07-03 12:30:43'),
(12, 3, 'payment_received', 'Payment ₹211,150.00 on INV-2627-00002', 'invoices', 2, 1, '2026-07-03 12:30:43'),
(13, 8, 'invoice_created', 'Invoice INV-2627-00003 sent (149,350.00).', 'invoices', 3, 1, '2026-07-03 12:30:43'),
(14, 8, 'payment_received', 'Payment ₹59,740.00 on INV-2627-00003', 'invoices', 3, 1, '2026-07-03 12:30:43'),
(15, 2, 'invoice_created', 'Invoice INV-2627-00004 sent (12,875.00).', 'invoices', 4, 1, '2026-07-03 12:30:43'),
(16, 2, 'payment_received', 'Payment ₹12,875.00 on INV-2627-00004', 'invoices', 4, 1, '2026-07-03 12:30:43'),
(17, 4, 'invoice_created', 'Invoice INV-2627-00005 sent (159,950.00).', 'invoices', 5, 1, '2026-07-03 12:30:43'),
(18, 7, 'invoice_created', 'Invoice INV-2627-00006 sent (80,340.00).', 'invoices', 6, 1, '2026-07-03 12:30:43'),
(19, 7, 'payment_received', 'Payment ₹80,340.00 on INV-2627-00006', 'invoices', 6, 1, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `head_employee_id` int(10) UNSIGNED DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `departments`
--

INSERT INTO `departments` (`id`, `name`, `head_employee_id`, `is_active`, `created_at`) VALUES
(1, 'Sales', NULL, 1, '2026-07-03 12:30:43'),
(2, 'Production', NULL, 1, '2026-07-03 12:30:43'),
(3, 'Administration', NULL, 1, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `designations`
--

CREATE TABLE `designations` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `department_id` int(10) UNSIGNED DEFAULT NULL,
  `level` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `designations`
--

INSERT INTO `designations` (`id`, `name`, `department_id`, `level`, `is_active`, `created_at`) VALUES
(1, 'Sales Executive', NULL, 0, 1, '2026-07-03 12:30:43'),
(2, 'Karigar', NULL, 0, 1, '2026-07-03 12:30:43'),
(3, 'Store Manager', NULL, 0, 1, '2026-07-03 12:30:43'),
(4, 'Cashier', NULL, 0, 1, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `employees`
--

CREATE TABLE `employees` (
  `id` int(10) UNSIGNED NOT NULL,
  `employee_code` varchar(20) NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `first_name` varchar(80) NOT NULL,
  `last_name` varchar(80) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `gender` enum('male','female','other') DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `date_of_joining` date NOT NULL,
  `department_id` int(10) UNSIGNED DEFAULT NULL,
  `designation_id` int(10) UNSIGNED DEFAULT NULL,
  `shift_id` int(10) UNSIGNED DEFAULT NULL,
  `reporting_manager_id` int(10) UNSIGNED DEFAULT NULL,
  `employee_type` enum('full_time','part_time','contract','intern') NOT NULL DEFAULT 'full_time',
  `address` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `emergency_contact_name` varchar(100) DEFAULT NULL,
  `emergency_contact_phone` varchar(20) DEFAULT NULL,
  `bank_name` varchar(120) DEFAULT NULL,
  `bank_account_no` varchar(40) DEFAULT NULL,
  `bank_ifsc` varchar(20) DEFAULT NULL,
  `pan_number` varchar(20) DEFAULT NULL,
  `aadhar_number` varchar(20) DEFAULT NULL,
  `basic_salary` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('active','on_leave','terminated','resigned') NOT NULL DEFAULT 'active',
  `photo_path` varchar(500) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employees`
--

INSERT INTO `employees` (`id`, `employee_code`, `user_id`, `first_name`, `last_name`, `email`, `phone`, `gender`, `date_of_birth`, `date_of_joining`, `department_id`, `designation_id`, `shift_id`, `reporting_manager_id`, `employee_type`, `address`, `city`, `emergency_contact_name`, `emergency_contact_phone`, `bank_name`, `bank_account_no`, `bank_ifsc`, `pan_number`, `aadhar_number`, `basic_salary`, `status`, `photo_path`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'EMP-0001', NULL, 'Rajesh', 'Kumar', NULL, '9000000001', NULL, NULL, '2022-04-01', 1, NULL, 1, NULL, 'full_time', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 35000.00, 'active', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(2, 'EMP-0002', NULL, 'Sneha', 'Pawar', NULL, '9000000002', NULL, NULL, '2023-01-15', 1, NULL, 1, NULL, 'full_time', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 30000.00, 'active', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(3, 'EMP-0003', NULL, 'Imran', 'Shaikh', NULL, '9000000003', NULL, NULL, '2021-08-10', 2, NULL, 1, NULL, 'full_time', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 40000.00, 'active', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(4, 'EMP-0004', NULL, 'Kavita', 'Rane', NULL, '9000000004', NULL, NULL, '2023-06-05', 2, NULL, 1, NULL, 'part_time', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 22000.00, 'active', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(5, 'EMP-0005', NULL, 'Farhan', 'Ali', NULL, '9000000005', NULL, NULL, '2024-02-20', 1, NULL, 1, NULL, 'contract', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 28000.00, 'active', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `employee_attendance`
--

CREATE TABLE `employee_attendance` (
  `id` int(10) UNSIGNED NOT NULL,
  `employee_id` int(10) UNSIGNED NOT NULL,
  `attendance_date` date NOT NULL,
  `check_in` time DEFAULT NULL,
  `check_out` time DEFAULT NULL,
  `status` enum('present','absent','half_day','late','on_leave','holiday','week_off') NOT NULL,
  `worked_minutes` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `late_minutes` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `source` enum('punch','manual') NOT NULL DEFAULT 'manual',
  `remarks` varchar(255) DEFAULT NULL,
  `marked_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employee_attendance`
--

INSERT INTO `employee_attendance` (`id`, `employee_id`, `attendance_date`, `check_in`, `check_out`, `status`, `worked_minutes`, `late_minutes`, `source`, `remarks`, `marked_by`, `created_at`, `updated_at`) VALUES
(1, 1, '2026-07-03', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(2, 2, '2026-07-03', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(3, 3, '2026-07-03', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(4, 4, '2026-07-03', '10:00:00', '19:00:00', 'on_leave', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(5, 5, '2026-07-03', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(6, 1, '2026-07-02', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(7, 2, '2026-07-02', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(8, 3, '2026-07-02', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(9, 4, '2026-07-02', '10:20:00', '19:00:00', 'late', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(10, 5, '2026-07-02', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(11, 1, '2026-07-01', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(12, 2, '2026-07-01', '10:00:00', '19:00:00', 'half_day', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(13, 3, '2026-07-01', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(14, 4, '2026-07-01', '10:20:00', '19:00:00', 'late', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(15, 5, '2026-07-01', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(16, 1, '2026-06-30', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(17, 2, '2026-06-30', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(18, 3, '2026-06-30', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(19, 4, '2026-06-30', '10:20:00', '19:00:00', 'late', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(20, 5, '2026-06-30', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(21, 1, '2026-06-29', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(22, 2, '2026-06-29', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(23, 3, '2026-06-29', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(24, 4, '2026-06-29', '10:20:00', '19:00:00', 'late', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(25, 5, '2026-06-29', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(26, 1, '2026-06-28', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(27, 2, '2026-06-28', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(28, 3, '2026-06-28', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(29, 4, '2026-06-28', '10:20:00', '19:00:00', 'late', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(30, 5, '2026-06-28', '10:00:00', '19:00:00', 'present', 0, 0, 'manual', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `expenses`
--

CREATE TABLE `expenses` (
  `id` int(10) UNSIGNED NOT NULL,
  `expense_date` date NOT NULL,
  `category_id` int(10) UNSIGNED NOT NULL,
  `fixed_cost_item_id` int(10) UNSIGNED DEFAULT NULL,
  `type` enum('fixed','variable') NOT NULL DEFAULT 'variable',
  `amount` decimal(12,2) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `paid_to` varchar(150) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `payment_mode` enum('cash','bank','upi','cheque','card') NOT NULL DEFAULT 'cash',
  `bank_account_id` int(10) UNSIGNED DEFAULT NULL,
  `ref_table` varchar(40) DEFAULT NULL,
  `ref_id` int(10) UNSIGNED DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `expenses`
--

INSERT INTO `expenses` (`id`, `expense_date`, `category_id`, `fixed_cost_item_id`, `type`, `amount`, `description`, `paid_to`, `notes`, `payment_mode`, `bank_account_id`, `ref_table`, `ref_id`, `created_by`, `created_at`) VALUES
(1, '2026-07-03', 3, NULL, 'fixed', 60000.00, 'Showroom rent', 'Landlord', NULL, 'bank', NULL, NULL, NULL, 1, '2026-07-03 12:30:43'),
(2, '2026-06-30', 4, NULL, 'variable', 8500.00, 'Electricity bill', NULL, NULL, 'upi', NULL, NULL, NULL, 1, '2026-07-03 12:30:43'),
(3, '2026-06-27', 7, NULL, 'variable', 15000.00, 'Instagram ads', NULL, NULL, 'card', NULL, NULL, NULL, 1, '2026-07-03 12:30:43'),
(4, '2026-06-23', 4, NULL, 'variable', 2200.00, 'Internet & phone', NULL, NULL, 'upi', NULL, NULL, NULL, 1, '2026-07-03 12:30:43'),
(5, '2026-06-19', 7, NULL, 'variable', 9000.00, 'Festival banners', NULL, NULL, 'cash', NULL, NULL, NULL, 1, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `expense_categories`
--

CREATE TABLE `expense_categories` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `type` enum('fixed','variable') NOT NULL DEFAULT 'variable',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `system_key` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `expense_categories`
--

INSERT INTO `expense_categories` (`id`, `name`, `type`, `is_active`, `is_system`, `system_key`, `created_at`) VALUES
(1, 'Salaries', 'fixed', 1, 1, 'SALARY', '2026-07-03 12:24:54'),
(2, 'Inventory Purchase', 'variable', 1, 1, 'INVENTORY_PURCHASE', '2026-07-03 12:24:54'),
(3, 'Rent', 'fixed', 1, 0, NULL, '2026-07-03 12:24:54'),
(4, 'Utilities', 'fixed', 1, 0, NULL, '2026-07-03 12:24:54'),
(5, 'Travel', 'variable', 1, 0, NULL, '2026-07-03 12:24:54'),
(6, 'Office Supplies', 'variable', 1, 0, NULL, '2026-07-03 12:24:54'),
(7, 'Marketing', 'variable', 1, 0, NULL, '2026-07-03 12:24:54');

-- --------------------------------------------------------

--
-- Table structure for table `expense_reminders`
--

CREATE TABLE `expense_reminders` (
  `id` int(10) UNSIGNED NOT NULL,
  `category_id` int(10) UNSIGNED NOT NULL,
  `fixed_cost_item_id` int(10) UNSIGNED DEFAULT NULL,
  `due_day` tinyint(3) UNSIGNED NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `description` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `family_members`
--

CREATE TABLE `family_members` (
  `id` int(10) UNSIGNED NOT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `relation` varchar(30) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `dob` date DEFAULT NULL,
  `anniversary` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `family_members`
--

INSERT INTO `family_members` (`id`, `customer_id`, `relation`, `name`, `dob`, `anniversary`, `created_at`) VALUES
(1, 1, 'spouse', 'Raj Shah', '1990-07-07', NULL, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `fixed_cost_items`
--

CREATE TABLE `fixed_cost_items` (
  `id` int(10) UNSIGNED NOT NULL,
  `category_id` int(10) UNSIGNED NOT NULL,
  `employee_id` int(10) UNSIGNED DEFAULT NULL,
  `name` varchar(120) NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `fixed_cost_items`
--

INSERT INTO `fixed_cost_items` (`id`, `category_id`, `employee_id`, `name`, `amount`, `notes`, `is_system`, `status`, `sort_order`, `created_at`) VALUES
(1, 1, 1, 'Salary — Rajesh Kumar', 35000.00, NULL, 1, 'active', 0, '2026-07-03 12:30:43'),
(2, 1, 2, 'Salary — Sneha Pawar', 30000.00, NULL, 1, 'active', 0, '2026-07-03 12:30:43'),
(3, 1, 3, 'Salary — Imran Shaikh', 40000.00, NULL, 1, 'active', 0, '2026-07-03 12:30:43'),
(4, 1, 4, 'Salary — Kavita Rane', 22000.00, NULL, 1, 'active', 0, '2026-07-03 12:30:43'),
(5, 1, 5, 'Salary — Farhan Ali', 28000.00, NULL, 1, 'active', 0, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `fixed_cost_monthly_payments`
--

CREATE TABLE `fixed_cost_monthly_payments` (
  `id` int(10) UNSIGNED NOT NULL,
  `fixed_cost_item_id` int(10) UNSIGNED NOT NULL,
  `month` tinyint(3) UNSIGNED NOT NULL,
  `year` smallint(5) UNSIGNED NOT NULL,
  `paid_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payment_status` enum('paid','pending') NOT NULL DEFAULT 'pending',
  `payment_date` date DEFAULT NULL,
  `expense_id` int(10) UNSIGNED DEFAULT NULL,
  `payroll_item_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `holidays`
--

CREATE TABLE `holidays` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `holiday_date` date NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `integration_accounts`
--

CREATE TABLE `integration_accounts` (
  `id` int(10) UNSIGNED NOT NULL,
  `provider` enum('google','facebook') NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `external_account_id` varchar(128) NOT NULL,
  `account_name` varchar(150) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `access_token` text DEFAULT NULL,
  `access_token_expires_at` datetime DEFAULT NULL,
  `refresh_token` text DEFAULT NULL,
  `scopes` text DEFAULT NULL,
  `status` enum('active','revoked','error') NOT NULL DEFAULT 'active',
  `last_synced_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `integration_keywords`
--

CREATE TABLE `integration_keywords` (
  `id` int(10) UNSIGNED NOT NULL,
  `integration_location_id` int(10) UNSIGNED NOT NULL,
  `month` date NOT NULL,
  `keyword` varchar(255) NOT NULL,
  `impressions` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `is_threshold` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `integration_locations`
--

CREATE TABLE `integration_locations` (
  `id` int(10) UNSIGNED NOT NULL,
  `integration_account_id` int(10) UNSIGNED NOT NULL,
  `external_id` varchar(128) NOT NULL,
  `name` varchar(200) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `asset_token` text DEFAULT NULL,
  `extra` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`extra`)),
  `is_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `integration_metrics_daily`
--

CREATE TABLE `integration_metrics_daily` (
  `id` int(10) UNSIGNED NOT NULL,
  `integration_location_id` int(10) UNSIGNED NOT NULL,
  `metric` varchar(64) NOT NULL,
  `date` date NOT NULL,
  `value` bigint(20) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `integration_posts`
--

CREATE TABLE `integration_posts` (
  `id` int(10) UNSIGNED NOT NULL,
  `integration_location_id` int(10) UNSIGNED NOT NULL,
  `external_post_id` varchar(128) NOT NULL,
  `message` text DEFAULT NULL,
  `media_type` varchar(32) DEFAULT NULL,
  `permalink` varchar(512) DEFAULT NULL,
  `posted_at` datetime DEFAULT NULL,
  `views_unique` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `clicks` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `reactions` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `comments` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `shares` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `engagement` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `synced_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `integration_reviews`
--

CREATE TABLE `integration_reviews` (
  `id` int(10) UNSIGNED NOT NULL,
  `integration_location_id` int(10) UNSIGNED NOT NULL,
  `external_review_id` varchar(128) NOT NULL,
  `rating` tinyint(3) UNSIGNED DEFAULT NULL,
  `reviewer_name` varchar(150) DEFAULT NULL,
  `comment` text DEFAULT NULL,
  `reply` text DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `replied_at` datetime DEFAULT NULL,
  `synced_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `integration_sync_log`
--

CREATE TABLE `integration_sync_log` (
  `id` int(10) UNSIGNED NOT NULL,
  `integration_account_id` int(10) UNSIGNED NOT NULL,
  `kind` enum('metrics','keywords','reviews','locations','posts','token','backfill') NOT NULL,
  `status` enum('pending','running','success','error') NOT NULL,
  `message` text DEFAULT NULL,
  `ran_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_categories`
--

CREATE TABLE `inventory_categories` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `item_type` enum('raw_material','stock') NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `inventory_categories`
--

INSERT INTO `inventory_categories` (`id`, `name`, `item_type`, `is_active`, `created_at`) VALUES
(1, 'Gold', 'stock', 1, '2026-07-03 12:24:54'),
(2, 'Diamond', 'stock', 1, '2026-07-03 12:24:54'),
(3, 'Silver', 'stock', 1, '2026-07-03 12:24:54'),
(4, 'Platinum', 'stock', 1, '2026-07-03 12:24:54'),
(5, 'Bridal Collection', 'stock', 1, '2026-07-03 12:24:54'),
(6, 'Temple Jewellery', 'stock', 1, '2026-07-03 12:24:54'),
(7, 'Antique Jewellery', 'stock', 1, '2026-07-03 12:24:54'),
(8, 'Daily Wear', 'stock', 1, '2026-07-03 12:24:54'),
(9, 'Kids Collection', 'stock', 1, '2026-07-03 12:24:54'),
(10, 'Men\'s Collection', 'stock', 1, '2026-07-03 12:24:54'),
(11, 'Coins & Bars', 'stock', 1, '2026-07-03 12:24:54');

-- --------------------------------------------------------

--
-- Table structure for table `inventory_items`
--

CREATE TABLE `inventory_items` (
  `id` int(10) UNSIGNED NOT NULL,
  `item_code` varchar(30) NOT NULL,
  `barcode` varchar(64) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `item_type` enum('raw_material','stock') NOT NULL,
  `category_id` int(10) UNSIGNED DEFAULT NULL,
  `unit_id` int(10) UNSIGNED NOT NULL,
  `current_stock` decimal(12,3) NOT NULL DEFAULT 0.000,
  `avg_cost` decimal(12,2) NOT NULL DEFAULT 0.00,
  `selling_price` decimal(12,2) DEFAULT NULL,
  `show_on_website` tinyint(1) NOT NULL DEFAULT 1,
  `purchase_price` decimal(14,2) NOT NULL DEFAULT 0.00,
  `vendor_id` int(10) UNSIGNED DEFAULT NULL,
  `jw_status` enum('in_stock','reserved','sold','under_repair','melting') NOT NULL DEFAULT 'in_stock',
  `source_order_id` int(10) UNSIGNED DEFAULT NULL,
  `images_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`images_json`)),
  `reorder_level` decimal(12,3) NOT NULL DEFAULT 0.000,
  `description` varchar(255) DEFAULT NULL,
  `metal_type` varchar(30) DEFAULT NULL,
  `gross_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `net_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `stone_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `purity` varchar(10) DEFAULT NULL,
  `making_charge` decimal(14,2) NOT NULL DEFAULT 0.00,
  `wastage_pct` decimal(6,3) NOT NULL DEFAULT 0.000,
  `hsn_code` varchar(12) DEFAULT NULL,
  `location` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `inventory_items`
--

INSERT INTO `inventory_items` (`id`, `item_code`, `barcode`, `name`, `item_type`, `category_id`, `unit_id`, `current_stock`, `avg_cost`, `selling_price`, `purchase_price`, `vendor_id`, `jw_status`, `source_order_id`, `images_json`, `reorder_level`, `description`, `metal_type`, `gross_wt`, `net_wt`, `stone_wt`, `purity`, `making_charge`, `wastage_pct`, `hsn_code`, `location`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'ST-0001', NULL, '22K Gold Bangle Pair', 'stock', 1, 3, 2.000, 350000.00, 385000.00, 350000.00, 1, 'in_stock', NULL, NULL, 1.000, NULL, 'Gold', 42.500, 41.000, 0.000, '22K', 12000.00, 8.000, '7113', NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(2, 'ST-0002', NULL, 'Diamond Solitaire Ring', 'stock', 2, 3, 1.000, 120000.00, 145000.00, 120000.00, 2, 'in_stock', NULL, NULL, 2.000, NULL, 'Gold', 5.200, 4.100, 1.100, '18K', 18000.00, 0.000, '7113', NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(3, 'ST-0003', NULL, 'Bridal Necklace Set', 'stock', 5, 3, 1.000, 640000.00, 720000.00, 640000.00, 3, 'in_stock', NULL, NULL, 1.000, NULL, 'Gold', 88.000, 82.500, 0.000, '22K', 35000.00, 10.000, '7113', NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(4, 'ST-0004', NULL, 'Silver Payal Pair', 'stock', 3, 3, 6.000, 9500.00, 12500.00, 9500.00, 4, 'in_stock', NULL, NULL, 2.000, NULL, 'Silver', 120.000, 120.000, 0.000, '92.5', 1500.00, 0.000, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(5, 'ST-0005', NULL, 'Temple Jhumka Earrings', 'stock', 6, 3, 1.000, 148000.00, 165000.00, 148000.00, 1, 'in_stock', NULL, NULL, 3.000, NULL, 'Gold', 18.400, 17.200, 0.000, '22K', 9000.00, 0.000, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(6, 'ST-0006', NULL, 'Gold Chain 20 inch', 'stock', 1, 3, 4.000, 190000.00, 205000.00, 190000.00, 2, 'in_stock', NULL, NULL, 2.000, NULL, 'Gold', 24.000, 24.000, 0.000, '22K', 6000.00, 0.000, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(7, 'ST-0007', NULL, 'Men\'s Kada', 'stock', 10, 3, 2.000, 280000.00, 300000.00, 280000.00, 3, 'in_stock', NULL, NULL, 1.000, NULL, 'Gold', 35.000, 34.000, 0.000, '22K', 8000.00, 0.000, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(8, 'ST-0008', NULL, 'Kids Gold Nazariya', 'stock', 9, 3, 1.000, 21000.00, 24000.00, 21000.00, 4, 'in_stock', NULL, NULL, 4.000, NULL, 'Gold', 3.100, 3.000, 0.000, '18K', 1500.00, 0.000, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(9, 'ST-0009', NULL, 'Platinum Couple Band', 'stock', 4, 3, 2.000, 82000.00, 95000.00, 82000.00, 1, 'in_stock', NULL, NULL, 1.000, NULL, 'Platinum', 9.000, 9.000, 0.000, NULL, 12000.00, 0.000, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(10, 'ST-0010', NULL, 'Gold Coin 10g', 'stock', 11, 3, 5.000, 75000.00, 78000.00, 75000.00, 2, 'in_stock', NULL, NULL, 3.000, NULL, 'Gold', 10.000, 10.000, 0.000, '24K', 0.00, 0.000, NULL, NULL, 1, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `inventory_transactions`
--

CREATE TABLE `inventory_transactions` (
  `id` int(10) UNSIGNED NOT NULL,
  `item_id` int(10) UNSIGNED NOT NULL,
  `type` enum('in','out') NOT NULL,
  `reason` enum('purchase','production','adjustment_in','sale_reversal','sale','work_issue','production_consume','adjustment_out','damage','purchase_reversal') NOT NULL,
  `qty` decimal(12,3) NOT NULL,
  `unit_cost` decimal(12,2) NOT NULL DEFAULT 0.00,
  `purchase_id` int(10) UNSIGNED DEFAULT NULL,
  `invoice_id` int(10) UNSIGNED DEFAULT NULL,
  `work_id` int(10) UNSIGNED DEFAULT NULL,
  `production_batch` varchar(30) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `inventory_transactions`
--

INSERT INTO `inventory_transactions` (`id`, `item_id`, `type`, `reason`, `qty`, `unit_cost`, `purchase_id`, `invoice_id`, `work_id`, `production_batch`, `notes`, `created_by`, `created_at`) VALUES
(1, 1, 'in', 'adjustment_in', 2.000, 350000.00, NULL, NULL, NULL, NULL, 'Opening stock', 1, '2026-07-03 12:30:43'),
(2, 2, 'in', 'adjustment_in', 1.000, 120000.00, NULL, NULL, NULL, NULL, 'Opening stock', 1, '2026-07-03 12:30:43'),
(3, 3, 'in', 'adjustment_in', 1.000, 640000.00, NULL, NULL, NULL, NULL, 'Opening stock', 1, '2026-07-03 12:30:43'),
(4, 4, 'in', 'adjustment_in', 6.000, 9500.00, NULL, NULL, NULL, NULL, 'Opening stock', 1, '2026-07-03 12:30:43'),
(5, 5, 'in', 'adjustment_in', 1.000, 148000.00, NULL, NULL, NULL, NULL, 'Opening stock', 1, '2026-07-03 12:30:43'),
(6, 6, 'in', 'adjustment_in', 4.000, 190000.00, NULL, NULL, NULL, NULL, 'Opening stock', 1, '2026-07-03 12:30:43'),
(7, 7, 'in', 'adjustment_in', 2.000, 280000.00, NULL, NULL, NULL, NULL, 'Opening stock', 1, '2026-07-03 12:30:43'),
(8, 8, 'in', 'adjustment_in', 1.000, 21000.00, NULL, NULL, NULL, NULL, 'Opening stock', 1, '2026-07-03 12:30:43'),
(9, 9, 'in', 'adjustment_in', 2.000, 82000.00, NULL, NULL, NULL, NULL, 'Opening stock', 1, '2026-07-03 12:30:43'),
(10, 10, 'in', 'adjustment_in', 5.000, 75000.00, NULL, NULL, NULL, NULL, 'Opening stock', 1, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` int(10) UNSIGNED NOT NULL,
  `invoice_no` varchar(30) NOT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `work_id` int(10) UNSIGNED DEFAULT NULL,
  `invoice_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `status` enum('draft','sent','partially_paid','paid','cancelled') NOT NULL DEFAULT 'draft',
  `sale_type` enum('ready','custom') NOT NULL DEFAULT 'ready',
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `old_gold_adjustment` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tax_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `cgst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sgst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `igst` decimal(12,2) NOT NULL DEFAULT 0.00,
  `grand_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `notes` varchar(500) DEFAULT NULL,
  `terms` varchar(1000) DEFAULT NULL,
  `hallmark_no` varchar(40) DEFAULT NULL,
  `huid` varchar(40) DEFAULT NULL,
  `warranty_months` int(11) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `invoices`
--

INSERT INTO `invoices` (`id`, `invoice_no`, `customer_id`, `work_id`, `invoice_date`, `due_date`, `status`, `sale_type`, `subtotal`, `discount_total`, `old_gold_adjustment`, `tax_total`, `cgst`, `sgst`, `igst`, `grand_total`, `paid_amount`, `notes`, `terms`, `hallmark_no`, `huid`, `warranty_months`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'INV-2627-00001', 1, NULL, '2026-07-03', NULL, 'paid', 'ready', 385000.00, 0.00, 25000.00, 11550.00, 5775.00, 5775.00, 0.00, 371550.00, 371550.00, NULL, NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(2, 'INV-2627-00002', 3, NULL, '2026-07-01', NULL, 'paid', 'ready', 205000.00, 0.00, 0.00, 6150.00, 3075.00, 3075.00, 0.00, 211150.00, 211150.00, NULL, NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(3, 'INV-2627-00003', 8, NULL, '2026-06-28', NULL, 'partially_paid', 'ready', 145000.00, 0.00, 0.00, 4350.00, 2175.00, 2175.00, 0.00, 149350.00, 59740.00, NULL, NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(4, 'INV-2627-00004', 2, NULL, '2026-06-25', NULL, 'paid', 'ready', 12500.00, 0.00, 0.00, 375.00, 187.50, 187.50, 0.00, 12875.00, 12875.00, NULL, NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(5, 'INV-2627-00005', 4, NULL, '2026-07-02', NULL, 'sent', 'ready', 165000.00, 0.00, 10000.00, 4950.00, 2475.00, 2475.00, 0.00, 159950.00, 0.00, NULL, NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(6, 'INV-2627-00006', 7, NULL, '2026-06-21', NULL, 'paid', 'ready', 78000.00, 0.00, 0.00, 2340.00, 1170.00, 1170.00, 0.00, 80340.00, 80340.00, NULL, NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `invoice_items`
--

CREATE TABLE `invoice_items` (
  `id` int(10) UNSIGNED NOT NULL,
  `invoice_id` int(10) UNSIGNED NOT NULL,
  `item_type` enum('service','stock','custom') NOT NULL DEFAULT 'service',
  `service_id` int(10) UNSIGNED DEFAULT NULL,
  `inventory_item_id` int(10) UNSIGNED DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `metal_type` varchar(30) DEFAULT NULL,
  `gross_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `net_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `stone_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `purity` varchar(10) DEFAULT NULL,
  `making_charge` decimal(14,2) NOT NULL DEFAULT 0.00,
  `wastage_pct` decimal(6,3) NOT NULL DEFAULT 0.000,
  `hsn_code` varchar(12) DEFAULT NULL,
  `diamond_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `diamond_grade` varchar(30) DEFAULT NULL,
  `qty` decimal(12,3) NOT NULL DEFAULT 1.000,
  `unit` varchar(20) DEFAULT NULL,
  `rate` decimal(12,2) NOT NULL DEFAULT 0.00,
  `discount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tax_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tax_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `sort_order` int(11) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `invoice_items`
--

INSERT INTO `invoice_items` (`id`, `invoice_id`, `item_type`, `service_id`, `inventory_item_id`, `description`, `metal_type`, `gross_wt`, `net_wt`, `stone_wt`, `purity`, `making_charge`, `wastage_pct`, `hsn_code`, `diamond_wt`, `diamond_grade`, `qty`, `unit`, `rate`, `discount`, `tax_rate`, `tax_amount`, `line_total`, `sort_order`) VALUES
(1, 1, 'stock', NULL, NULL, '22K Gold Bangle Pair', 'Gold', 42.500, 0.000, 0.000, '22K', 12000.00, 0.000, '7113', 0.000, NULL, 1.000, NULL, 385000.00, 0.00, 3.00, 11550.00, 396550.00, 0),
(2, 2, 'stock', NULL, NULL, 'Gold Chain 20 inch', 'Gold', 24.000, 0.000, 0.000, '22K', 6000.00, 0.000, '7113', 0.000, NULL, 1.000, NULL, 205000.00, 0.00, 3.00, 6150.00, 211150.00, 0),
(3, 3, 'stock', NULL, NULL, 'Diamond Solitaire Ring', 'Gold', 5.200, 0.000, 0.000, '18K', 18000.00, 0.000, '7113', 0.000, NULL, 1.000, NULL, 145000.00, 0.00, 3.00, 4350.00, 149350.00, 0),
(4, 4, 'stock', NULL, NULL, 'Silver Payal Pair', 'Gold', 120.000, 0.000, 0.000, '92.5', 1500.00, 0.000, '7113', 0.000, NULL, 1.000, NULL, 12500.00, 0.00, 3.00, 375.00, 12875.00, 0),
(5, 5, 'stock', NULL, NULL, 'Temple Jhumka Earrings', 'Gold', 18.400, 0.000, 0.000, '22K', 9000.00, 0.000, '7113', 0.000, NULL, 1.000, NULL, 165000.00, 0.00, 3.00, 4950.00, 169950.00, 0),
(6, 6, 'stock', NULL, NULL, 'Gold Coin 10g', 'Gold', 10.000, 0.000, 0.000, '24K', 0.00, 0.000, '7113', 0.000, NULL, 1.000, NULL, 78000.00, 0.00, 3.00, 2340.00, 80340.00, 0);

-- --------------------------------------------------------

--
-- Table structure for table `invoice_payments`
--

CREATE TABLE `invoice_payments` (
  `id` int(10) UNSIGNED NOT NULL,
  `invoice_id` int(10) UNSIGNED NOT NULL,
  `receipt_no` varchar(30) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `payment_date` date NOT NULL,
  `payment_mode` enum('cash','upi','bank','card','cheque') NOT NULL DEFAULT 'cash',
  `bank_account_id` int(10) UNSIGNED DEFAULT NULL,
  `cheque_number` varchar(50) DEFAULT NULL,
  `cheque_date` date DEFAULT NULL,
  `cheque_bank` varchar(100) DEFAULT NULL,
  `cheque_status` enum('pending','deposited','cleared','bounced') DEFAULT NULL,
  `cheque_cleared_at` datetime DEFAULT NULL,
  `notes` varchar(500) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `invoice_payments`
--

INSERT INTO `invoice_payments` (`id`, `invoice_id`, `receipt_no`, `amount`, `payment_date`, `payment_mode`, `bank_account_id`, `cheque_number`, `cheque_date`, `cheque_bank`, `cheque_status`, `cheque_cleared_at`, `notes`, `created_by`, `created_at`) VALUES
(1, 1, 'RCPT-2627-00001', 371550.00, '2026-07-03', 'upi', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43'),
(2, 2, 'RCPT-2627-00002', 211150.00, '2026-07-01', 'upi', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43'),
(3, 3, 'RCPT-2627-00003', 59740.00, '2026-06-28', 'cash', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43'),
(4, 4, 'RCPT-2627-00004', 12875.00, '2026-06-25', 'upi', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43'),
(5, 6, 'RCPT-2627-00005', 80340.00, '2026-06-21', 'upi', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `leads`
--

CREATE TABLE `leads` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `company` varchar(150) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `source_id` int(10) UNSIGNED DEFAULT NULL,
  `source_detail` varchar(255) DEFAULT NULL,
  `channel_type` enum('walk_in','phone','website','whatsapp','facebook','instagram','google','referral','other') NOT NULL DEFAULT 'other',
  `entry_type` enum('manual','import','api','webhook') NOT NULL DEFAULT 'manual',
  `platform_lead_id` varchar(150) DEFAULT NULL,
  `service_interest` varchar(255) DEFAULT NULL,
  `interest_type` enum('Gold','Diamond','Bridal','Silver','Platinum','Custom','General') DEFAULT NULL,
  `budget_range` varchar(60) DEFAULT NULL,
  `expected_value` decimal(12,2) DEFAULT NULL,
  `status` enum('New','Contacted','Qualified','Meeting Scheduled','Meeting Done','Proposal Sent','Negotiation','Converted','Dropped','Lost') NOT NULL DEFAULT 'New',
  `assigned_to` int(10) UNSIGNED DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `referred_by_customer_id` int(10) UNSIGNED DEFAULT NULL,
  `referred_by_lead_id` int(10) UNSIGNED DEFAULT NULL,
  `customer_id` int(10) UNSIGNED DEFAULT NULL,
  `converted_at` datetime DEFAULT NULL,
  `dropped_at` datetime DEFAULT NULL,
  `drop_reason` varchar(255) DEFAULT NULL,
  `drop_reason_desc` text DEFAULT NULL,
  `tags_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags_json`)),
  `ai_score` decimal(5,2) DEFAULT NULL,
  `ai_classification` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `lead_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `leads`
--

INSERT INTO `leads` (`id`, `name`, `mobile`, `email`, `company`, `city`, `source_id`, `source_detail`, `channel_type`, `entry_type`, `platform_lead_id`, `service_interest`, `interest_type`, `budget_range`, `expected_value`, `status`, `assigned_to`, `created_by`, `referred_by_customer_id`, `referred_by_lead_id`, `customer_id`, `converted_at`, `dropped_at`, `drop_reason`, `drop_reason_desc`, `tags_json`, `ai_score`, `ai_classification`, `notes`, `lead_date`, `created_at`, `updated_at`) VALUES
(1, 'Neha Kulkarni', '9871000001', NULL, NULL, NULL, 1, NULL, 'walk_in', 'manual', NULL, NULL, 'Bridal', '₹2L–5L', 300000.00, 'New', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(2, 'Amit Joshi', '9871000002', NULL, NULL, NULL, 3, NULL, 'google', 'manual', NULL, NULL, 'Diamond', '₹1L–2L', 150000.00, 'Contacted', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(3, 'Sneha Rao', '9871000003', NULL, NULL, NULL, 4, NULL, 'instagram', 'manual', NULL, NULL, 'Gold', '₹50k–1L', 80000.00, 'Qualified', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(4, 'Rahul Kapoor', '9871000004', NULL, NULL, NULL, 2, NULL, 'referral', 'manual', NULL, NULL, 'Custom', NULL, 220000.00, 'Meeting Scheduled', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(5, 'Pooja Shetty', '9871000005', NULL, NULL, NULL, 1, NULL, 'walk_in', 'manual', NULL, NULL, 'Silver', NULL, 20000.00, 'New', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(6, 'Manish Gupta', '9871000006', NULL, NULL, NULL, NULL, NULL, 'phone', 'manual', NULL, NULL, 'Gold', NULL, 120000.00, 'Negotiation', NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-03 12:30:43', '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `lead_activities`
--

CREATE TABLE `lead_activities` (
  `id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `activity_type` varchar(80) NOT NULL,
  `description` text DEFAULT NULL,
  `old_status` varchar(80) DEFAULT NULL,
  `new_status` varchar(80) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `lead_activities`
--

INSERT INTO `lead_activities` (`id`, `lead_id`, `activity_type`, `description`, `old_status`, `new_status`, `created_by`, `created_at`) VALUES
(1, 1, 'Lead Created', 'Lead added manually.', NULL, 'New', 1, '2026-07-03 12:30:43'),
(2, 1, 'Follow-up Scheduled', 'Auto follow-up 1 of 3 scheduled.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(3, 2, 'Lead Created', 'Lead added manually.', NULL, 'Contacted', 1, '2026-07-03 12:30:43'),
(4, 2, 'Follow-up Scheduled', 'Auto follow-up 1 of 3 scheduled.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(5, 3, 'Lead Created', 'Lead added manually.', NULL, 'Qualified', 1, '2026-07-03 12:30:43'),
(6, 3, 'Follow-up Scheduled', 'Auto follow-up 1 of 3 scheduled.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(7, 4, 'Lead Created', 'Lead added manually.', NULL, 'Meeting Scheduled', 1, '2026-07-03 12:30:43'),
(8, 4, 'Follow-up Scheduled', 'Auto follow-up 1 of 3 scheduled.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(9, 5, 'Lead Created', 'Lead added manually.', NULL, 'New', 1, '2026-07-03 12:30:43'),
(10, 5, 'Follow-up Scheduled', 'Auto follow-up 1 of 3 scheduled.', NULL, NULL, 1, '2026-07-03 12:30:43'),
(11, 6, 'Lead Created', 'Lead added manually.', NULL, 'Negotiation', 1, '2026-07-03 12:30:43'),
(12, 6, 'Follow-up Scheduled', 'Auto follow-up 1 of 3 scheduled.', NULL, NULL, 1, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `lead_drop_reasons`
--

CREATE TABLE `lead_drop_reasons` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `lead_drop_reasons`
--

INSERT INTO `lead_drop_reasons` (`id`, `name`, `is_active`, `created_at`) VALUES
(1, 'Price Too High', 1, '2026-07-03 12:24:54'),
(2, 'Bought Elsewhere', 1, '2026-07-03 12:24:54'),
(3, 'Just Browsing', 1, '2026-07-03 12:24:54'),
(4, 'Not Reachable', 1, '2026-07-03 12:24:54'),
(5, 'Changed Mind', 1, '2026-07-03 12:24:54');

-- --------------------------------------------------------

--
-- Table structure for table `lead_followups`
--

CREATE TABLE `lead_followups` (
  `id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `scheduled_date` date NOT NULL,
  `scheduled_time` time DEFAULT NULL,
  `status` enum('Pending','Completed','Cancelled') NOT NULL DEFAULT 'Pending',
  `completed_at` datetime DEFAULT NULL,
  `outcome` varchar(150) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_auto` tinyint(1) NOT NULL DEFAULT 0,
  `auto_step` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `lead_followups`
--

INSERT INTO `lead_followups` (`id`, `lead_id`, `scheduled_date`, `scheduled_time`, `status`, `completed_at`, `outcome`, `notes`, `is_auto`, `auto_step`, `created_by`, `created_at`) VALUES
(1, 1, '2026-07-10', NULL, 'Pending', NULL, NULL, 'Auto follow-up 1 of 3.', 1, 1, 1, '2026-07-03 12:30:43'),
(2, 2, '2026-07-10', NULL, 'Pending', NULL, NULL, 'Auto follow-up 1 of 3.', 1, 1, 1, '2026-07-03 12:30:43'),
(3, 3, '2026-07-10', NULL, 'Pending', NULL, NULL, 'Auto follow-up 1 of 3.', 1, 1, 1, '2026-07-03 12:30:43'),
(4, 4, '2026-07-10', NULL, 'Pending', NULL, NULL, 'Auto follow-up 1 of 3.', 1, 1, 1, '2026-07-03 12:30:43'),
(5, 5, '2026-07-10', NULL, 'Pending', NULL, NULL, 'Auto follow-up 1 of 3.', 1, 1, 1, '2026-07-03 12:30:43'),
(6, 6, '2026-07-10', NULL, 'Pending', NULL, NULL, 'Auto follow-up 1 of 3.', 1, 1, 1, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `lead_meetings`
--

CREATE TABLE `lead_meetings` (
  `id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED DEFAULT NULL,
  `title` varchar(200) DEFAULT NULL,
  `meeting_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `mode` enum('in_person','call','video') NOT NULL DEFAULT 'in_person',
  `location` varchar(255) DEFAULT NULL,
  `assigned_to` int(10) UNSIGNED DEFAULT NULL,
  `attended` tinyint(1) NOT NULL DEFAULT 0,
  `outcome_notes` text DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `lead_services`
--

CREATE TABLE `lead_services` (
  `id` int(10) UNSIGNED NOT NULL,
  `lead_id` int(10) UNSIGNED NOT NULL,
  `service_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `lead_sources`
--

CREATE TABLE `lead_sources` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `lead_sources`
--

INSERT INTO `lead_sources` (`id`, `name`, `is_active`, `created_at`) VALUES
(1, 'Walk-in', 1, '2026-07-03 12:24:54'),
(2, 'Referral', 1, '2026-07-03 12:24:54'),
(3, 'Google', 1, '2026-07-03 12:24:54'),
(4, 'Instagram', 1, '2026-07-03 12:24:54'),
(5, 'Just Dial', 1, '2026-07-03 12:24:54'),
(6, 'Newspaper', 1, '2026-07-03 12:24:54'),
(7, 'Wedding Expo', 1, '2026-07-03 12:24:54');

-- --------------------------------------------------------

--
-- Table structure for table `leave_balances`
--

CREATE TABLE `leave_balances` (
  `id` int(10) UNSIGNED NOT NULL,
  `employee_id` int(10) UNSIGNED NOT NULL,
  `leave_type_id` int(10) UNSIGNED NOT NULL,
  `year` smallint(5) UNSIGNED NOT NULL,
  `allocated` decimal(5,1) NOT NULL DEFAULT 0.0,
  `used` decimal(5,1) NOT NULL DEFAULT 0.0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `leave_balances`
--

INSERT INTO `leave_balances` (`id`, `employee_id`, `leave_type_id`, `year`, `allocated`, `used`) VALUES
(1, 1, 1, 2026, 12.0, 0.0);

-- --------------------------------------------------------

--
-- Table structure for table `leave_requests`
--

CREATE TABLE `leave_requests` (
  `id` int(10) UNSIGNED NOT NULL,
  `employee_id` int(10) UNSIGNED NOT NULL,
  `leave_type_id` int(10) UNSIGNED NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `total_days` decimal(5,1) NOT NULL,
  `reason` varchar(500) DEFAULT NULL,
  `status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  `approved_by` int(10) UNSIGNED DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `rejection_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `leave_requests`
--

INSERT INTO `leave_requests` (`id`, `employee_id`, `leave_type_id`, `start_date`, `end_date`, `total_days`, `reason`, `status`, `approved_by`, `approved_at`, `rejection_reason`, `created_at`) VALUES
(1, 1, 1, '2026-07-06', '2026-07-07', 2.0, 'Family function', 'pending', NULL, NULL, NULL, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `leave_types`
--

CREATE TABLE `leave_types` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(80) NOT NULL,
  `code` varchar(10) NOT NULL,
  `is_paid` tinyint(1) NOT NULL DEFAULT 1,
  `max_days_per_year` decimal(5,1) NOT NULL DEFAULT 12.0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `leave_types`
--

INSERT INTO `leave_types` (`id`, `name`, `code`, `is_paid`, `max_days_per_year`, `is_active`) VALUES
(1, 'Casual Leave', 'CL', 1, 12.0, 1),
(2, 'Sick Leave', 'SL', 1, 6.0, 1),
(3, 'Leave Without Pay', 'LWP', 0, 0.0, 1);

-- --------------------------------------------------------

--
-- Table structure for table `meeting_customers`
--

CREATE TABLE `meeting_customers` (
  `id` int(10) UNSIGNED NOT NULL,
  `meeting_id` int(10) UNSIGNED NOT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `meeting_users`
--

CREATE TABLE `meeting_users` (
  `id` int(10) UNSIGNED NOT NULL,
  `meeting_id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `message_log`
--

CREATE TABLE `message_log` (
  `id` int(10) UNSIGNED NOT NULL,
  `channel` enum('whatsapp','email') NOT NULL DEFAULT 'whatsapp',
  `template_id` int(10) UNSIGNED DEFAULT NULL,
  `event` varchar(40) DEFAULT NULL,
  `recipient_name` varchar(150) DEFAULT NULL,
  `recipient_contact` varchar(190) DEFAULT NULL,
  `subject` varchar(190) DEFAULT NULL,
  `body` text DEFAULT NULL,
  `status` enum('queued','sent','delivered','failed') NOT NULL DEFAULT 'queued',
  `related_type` varchar(40) DEFAULT NULL,
  `related_id` int(10) UNSIGNED DEFAULT NULL,
  `error` varchar(255) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `message_log`
--

INSERT INTO `message_log` (`id`, `channel`, `template_id`, `event`, `recipient_name`, `recipient_contact`, `subject`, `body`, `status`, `related_type`, `related_id`, `error`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'whatsapp', 1, 'lead_followup', 'Amit Joshi', '9871000002', NULL, 'Hi Amit, following up on your diamond enquiry.', 'delivered', NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(2, 'email', 2, 'invoice_receipt', 'Meera Shah', 'meera@example.com', 'Your invoice', 'Thank you for your purchase.', 'sent', NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(3, 'whatsapp', 4, 'repair_status', 'Priya Nair', '9990010004', NULL, 'Your repair is ready for pickup.', 'delivered', NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43'),
(4, 'whatsapp', 5, 'birthday', 'Rohit Mehta', '9990010003', NULL, 'Happy Birthday Rohit!', 'queued', NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `message_templates`
--

CREATE TABLE `message_templates` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(120) NOT NULL,
  `channel` enum('whatsapp','email') NOT NULL DEFAULT 'whatsapp',
  `event` enum('lead_followup','invoice_receipt','order_status','repair_status','appointment_reminder','birthday','anniversary','order_review','custom') NOT NULL DEFAULT 'custom',
  `subject` varchar(190) DEFAULT NULL,
  `body` text NOT NULL,
  `variables_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`variables_json`)),
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `message_templates`
--

INSERT INTO `message_templates` (`id`, `name`, `channel`, `event`, `subject`, `body`, `variables_json`, `is_active`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 'Lead follow-up reminder', 'whatsapp', 'lead_followup', NULL, 'Hi {{name}}, this is Sejal Jewellers following up on your enquiry. Would you like to visit our showroom? Reply to book a slot.', NULL, 1, NULL, '2026-07-03 12:24:54', '2026-07-03 12:24:54'),
(2, 'Invoice receipt', 'email', 'invoice_receipt', 'Your Sejal Jewellers Invoice {{invoice_no}}', 'Dear {{name}}, thank you for your purchase. Your invoice {{invoice_no}} for {{amount}} is attached. — Sejal Jewellers', NULL, 1, NULL, '2026-07-03 12:24:54', '2026-07-03 12:24:54'),
(3, 'Order ready for review', 'whatsapp', 'order_review', NULL, 'Hi {{name}}, your custom order {{order_no}} is ready for your review at Sejal Jewellers. Please visit us to approve.', NULL, 1, NULL, '2026-07-03 12:24:54', '2026-07-03 12:24:54'),
(4, 'Repair ready', 'whatsapp', 'repair_status', NULL, 'Hi {{name}}, your repair {{repair_no}} is ready for pickup at Sejal Jewellers. See you soon!', NULL, 1, NULL, '2026-07-03 12:24:54', '2026-07-03 12:24:54'),
(5, 'Birthday wish', 'whatsapp', 'birthday', NULL, 'Happy Birthday {{name}}! Wishing you a sparkling year ahead. Visit us for a special birthday offer. — Sejal Jewellers', NULL, 1, NULL, '2026-07-03 12:24:54', '2026-07-03 12:24:54'),
(6, 'Anniversary wish', 'whatsapp', 'anniversary', NULL, 'Happy Anniversary {{name}}! Celebrate your special day with something timeless from Sejal Jewellers.', NULL, 1, NULL, '2026-07-03 12:24:54', '2026-07-03 12:24:54');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `type` varchar(80) NOT NULL,
  `title` varchar(150) NOT NULL,
  `body` varchar(500) DEFAULT NULL,
  `entity_type` varchar(40) DEFAULT NULL,
  `entity_id` int(10) UNSIGNED DEFAULT NULL,
  `link_url` varchar(255) DEFAULT NULL,
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `read_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `number_sequences`
--

CREATE TABLE `number_sequences` (
  `id` int(10) UNSIGNED NOT NULL,
  `seq_key` varchar(30) NOT NULL,
  `period` varchar(10) NOT NULL DEFAULT '',
  `prefix` varchar(10) NOT NULL,
  `next_number` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `padding` tinyint(3) UNSIGNED NOT NULL DEFAULT 5
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `number_sequences`
--

INSERT INTO `number_sequences` (`id`, `seq_key`, `period`, `prefix`, `next_number`, `padding`) VALUES
(1, 'invoice', '2627', 'INV-', 7, 5),
(2, 'receipt', '2627', 'RCPT-', 6, 5),
(3, 'order', '2627', 'ORD-', 1, 5),
(4, 'repair', '2627', 'RPR-', 1, 5),
(5, 'customer', '', 'CUST-', 9, 4),
(6, 'employee', '', 'EMP-', 6, 4),
(7, 'vendor', '', 'VND-', 1, 4),
(8, 'item_rm', '', 'RM-', 1, 4),
(9, 'item_st', '', 'ST-', 11, 4),
(10, 'order', '', 'ORDER-', 6, 5),
(11, 'repair', '', 'REPAIR-', 6, 5);

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` int(10) UNSIGNED NOT NULL,
  `order_no` varchar(30) NOT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `title` varchar(190) NOT NULL,
  `category` varchar(60) DEFAULT NULL,
  `production_type` enum('in_house','outsource') NOT NULL DEFAULT 'in_house',
  `vendor_id` int(10) UNSIGNED DEFAULT NULL,
  `karigar` varchar(120) DEFAULT NULL,
  `material_issued_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `material_returned_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `material_note` varchar(255) DEFAULT NULL,
  `metal_details` varchar(190) DEFAULT NULL,
  `design_images_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`design_images_json`)),
  `estimated_cost` decimal(14,2) NOT NULL DEFAULT 0.00,
  `advance_paid` decimal(14,2) NOT NULL DEFAULT 0.00,
  `quoted_price` decimal(14,2) NOT NULL DEFAULT 0.00,
  `final_price` decimal(14,2) NOT NULL DEFAULT 0.00,
  `order_date` date NOT NULL,
  `expected_date` date DEFAULT NULL,
  `delivered_date` date DEFAULT NULL,
  `status` enum('pending','in_production','quality_check','customer_review','approved','delivered','cancelled','rejected') NOT NULL DEFAULT 'pending',
  `review_notes` text DEFAULT NULL,
  `invoice_id` int(10) UNSIGNED DEFAULT NULL,
  `stock_item_id` int(10) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `order_no`, `customer_id`, `title`, `category`, `production_type`, `vendor_id`, `karigar`, `metal_details`, `design_images_json`, `estimated_cost`, `advance_paid`, `quoted_price`, `final_price`, `order_date`, `expected_date`, `delivered_date`, `status`, `review_notes`, `invoice_id`, `stock_item_id`, `notes`, `created_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'ORDER-00001', 1, 'Bridal necklace set (custom)', 'Bridal', 'in_house', NULL, 'In-house team', '22K gold, 85g', NULL, 450000.00, 100000.00, 620000.00, 0.00, '2026-06-30', '2026-07-10', NULL, 'in_production', NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43', NULL),
(2, 'ORDER-00002', 2, 'Diamond pendant', 'Diamond', 'outsource', 2, NULL, '18K, 0.8ct', NULL, 90000.00, 30000.00, 140000.00, 0.00, '2026-06-29', '2026-07-11', NULL, 'quality_check', NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43', NULL),
(3, 'ORDER-00003', 3, 'Custom kada engraving', 'Gold', 'outsource', 3, NULL, '22K, 40g', NULL, 260000.00, 80000.00, 320000.00, 0.00, '2026-06-28', '2026-07-12', NULL, 'customer_review', NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43', NULL),
(4, 'ORDER-00004', 4, 'Temple jhumka pair', 'Temple', 'in_house', NULL, NULL, NULL, NULL, 140000.00, 0.00, 185000.00, 0.00, '2026-06-27', '2026-07-13', '2026-07-03', 'in_production', NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:36:20', NULL),
(5, 'ORDER-00005', 5, 'Engagement ring', 'Diamond', 'in_house', NULL, NULL, NULL, NULL, 70000.00, 20000.00, 110000.00, 0.00, '2026-06-26', '2026-07-14', '2026-07-03', 'delivered', NULL, NULL, NULL, NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(10) UNSIGNED NOT NULL,
  `order_id` int(10) UNSIGNED NOT NULL,
  `description` varchar(190) NOT NULL,
  `category` varchar(60) DEFAULT NULL,
  `gold_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `purity` varchar(10) DEFAULT NULL,
  `diamond_wt` decimal(10,3) NOT NULL DEFAULT 0.000,
  `diamond_grade` varchar(30) DEFAULT NULL,
  `making_charge` decimal(14,2) NOT NULL DEFAULT 0.00,
  `wastage_pct` decimal(6,3) NOT NULL DEFAULT 0.000,
  `qty` int(11) NOT NULL DEFAULT 1,
  `line_total` decimal(14,2) NOT NULL DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `description`, `category`, `gold_wt`, `purity`, `diamond_wt`, `diamond_grade`, `making_charge`, `wastage_pct`, `qty`, `line_total`) VALUES
(1, 1, 'Bridal necklace set (custom)', NULL, 20.000, '22K', 0.000, NULL, 8000.00, 0.000, 1, 620000.00),
(2, 2, 'Diamond pendant', NULL, 21.000, '22K', 0.000, NULL, 8000.00, 0.000, 1, 140000.00),
(3, 3, 'Custom kada engraving', NULL, 22.000, '22K', 0.000, NULL, 8000.00, 0.000, 1, 320000.00),
(4, 4, 'Temple jhumka pair', NULL, 23.000, '22K', 0.000, NULL, 8000.00, 0.000, 1, 185000.00),
(5, 5, 'Engagement ring', NULL, 24.000, '22K', 0.000, NULL, 8000.00, 0.000, 1, 110000.00);

-- --------------------------------------------------------

--
-- Table structure for table `order_status_history`
--

CREATE TABLE `order_status_history` (
  `id` int(10) UNSIGNED NOT NULL,
  `order_id` int(10) UNSIGNED NOT NULL,
  `status` enum('pending','in_production','quality_check','customer_review','approved','delivered','cancelled','rejected') NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `order_status_history`
--

INSERT INTO `order_status_history` (`id`, `order_id`, `status`, `note`, `created_by`, `created_at`) VALUES
(1, 1, 'pending', 'Order created', 1, '2026-07-03 12:30:43'),
(2, 1, 'in_production', NULL, 1, '2026-07-03 12:30:43'),
(3, 2, 'pending', 'Order created', 1, '2026-07-03 12:30:43'),
(4, 2, 'in_production', NULL, 1, '2026-07-03 12:30:43'),
(5, 2, 'quality_check', NULL, 1, '2026-07-03 12:30:43'),
(6, 3, 'pending', 'Order created', 1, '2026-07-03 12:30:43'),
(7, 3, 'in_production', NULL, 1, '2026-07-03 12:30:43'),
(8, 3, 'quality_check', NULL, 1, '2026-07-03 12:30:43'),
(9, 3, 'customer_review', NULL, 1, '2026-07-03 12:30:43'),
(10, 4, 'pending', 'Order created', 1, '2026-07-03 12:30:43'),
(11, 4, 'in_production', NULL, 1, '2026-07-03 12:30:43'),
(12, 4, 'quality_check', NULL, 1, '2026-07-03 12:30:43'),
(13, 4, 'customer_review', NULL, 1, '2026-07-03 12:30:43'),
(14, 4, 'approved', NULL, 1, '2026-07-03 12:30:43'),
(15, 4, 'delivered', NULL, 1, '2026-07-03 12:30:43'),
(16, 5, 'pending', 'Order created', 1, '2026-07-03 12:30:43'),
(17, 5, 'in_production', NULL, 1, '2026-07-03 12:30:43'),
(18, 5, 'quality_check', NULL, 1, '2026-07-03 12:30:43'),
(19, 5, 'customer_review', NULL, 1, '2026-07-03 12:30:43'),
(20, 5, 'approved', NULL, 1, '2026-07-03 12:30:43'),
(21, 5, 'delivered', NULL, 1, '2026-07-03 12:30:43'),
(22, 4, 'in_production', NULL, 1, '2026-07-03 12:36:20');

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_otps`
--

CREATE TABLE `password_reset_otps` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `otp_hash` char(64) NOT NULL,
  `reset_token_hash` char(64) DEFAULT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_items`
--

CREATE TABLE `payroll_items` (
  `id` int(10) UNSIGNED NOT NULL,
  `payroll_run_id` int(10) UNSIGNED NOT NULL,
  `employee_id` int(10) UNSIGNED NOT NULL,
  `basic_salary` decimal(12,2) NOT NULL DEFAULT 0.00,
  `working_days` decimal(5,1) NOT NULL DEFAULT 0.0,
  `payable_days` decimal(5,1) NOT NULL DEFAULT 0.0,
  `present_days` decimal(5,1) NOT NULL DEFAULT 0.0,
  `half_days` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `paid_leave_days` decimal(5,1) NOT NULL DEFAULT 0.0,
  `unpaid_leave_days` decimal(5,1) NOT NULL DEFAULT 0.0,
  `late_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `gross` decimal(12,2) NOT NULL DEFAULT 0.00,
  `bonus` decimal(12,2) NOT NULL DEFAULT 0.00,
  `deduction` decimal(12,2) NOT NULL DEFAULT 0.00,
  `deduction_note` varchar(255) DEFAULT NULL,
  `net` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` enum('draft','finalized','paid') NOT NULL DEFAULT 'draft',
  `paid_at` datetime DEFAULT NULL,
  `expense_id` int(10) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_runs`
--

CREATE TABLE `payroll_runs` (
  `id` int(10) UNSIGNED NOT NULL,
  `pay_period` char(7) NOT NULL,
  `status` enum('draft','completed','paid') NOT NULL DEFAULT 'draft',
  `total_employees` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `total_gross` decimal(14,2) NOT NULL DEFAULT 0.00,
  `total_deductions` decimal(14,2) NOT NULL DEFAULT 0.00,
  `total_net` decimal(14,2) NOT NULL DEFAULT 0.00,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `computed_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` int(10) UNSIGNED NOT NULL,
  `resource` varchar(60) NOT NULL,
  `action` varchar(40) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`id`, `resource`, `action`, `description`, `is_active`) VALUES
(1, 'dashboard', 'read', NULL, 1),
(2, 'reports', 'read', NULL, 1),
(3, 'leads', 'read', NULL, 1),
(4, 'leads', 'create', NULL, 1),
(5, 'leads', 'update', NULL, 1),
(6, 'leads', 'delete', NULL, 1),
(7, 'leads', 'assign', NULL, 1),
(8, 'lead_sources', 'read', NULL, 1),
(9, 'lead_sources', 'manage', NULL, 1),
(10, 'customers', 'read', NULL, 1),
(11, 'customers', 'create', NULL, 1),
(12, 'customers', 'update', NULL, 1),
(13, 'customers', 'delete', NULL, 1),
(14, 'invoices', 'read', NULL, 1),
(15, 'invoices', 'create', NULL, 1),
(16, 'invoices', 'update', NULL, 1),
(17, 'invoices', 'delete', NULL, 1),
(18, 'payments', 'create', NULL, 1),
(19, 'payments', 'update', NULL, 1),
(20, 'payments', 'refund', NULL, 1),
(21, 'orders', 'read', NULL, 1),
(22, 'orders', 'create', NULL, 1),
(23, 'orders', 'update', NULL, 1),
(24, 'orders', 'delete', NULL, 1),
(25, 'orders', 'review', NULL, 1),
(26, 'orders', 'production', NULL, 1),
(27, 'repairs', 'read', NULL, 1),
(28, 'repairs', 'create', NULL, 1),
(29, 'repairs', 'update', NULL, 1),
(30, 'repairs', 'delete', NULL, 1),
(31, 'expenses', 'read', NULL, 1),
(32, 'expenses', 'create', NULL, 1),
(33, 'expenses', 'update', NULL, 1),
(34, 'expenses', 'delete', NULL, 1),
(35, 'bank_accounts', 'manage', NULL, 1),
(36, 'inventory', 'read', NULL, 1),
(37, 'inventory', 'manage', NULL, 1),
(38, 'inventory', 'adjust', NULL, 1),
(39, 'inventory', 'issue', NULL, 1),
(40, 'vendors', 'read', NULL, 1),
(41, 'vendors', 'manage', NULL, 1),
(42, 'automation', 'read', NULL, 1),
(43, 'automation', 'manage', NULL, 1),
(44, 'hr', 'read', NULL, 1),
(45, 'hr.employees', 'manage', NULL, 1),
(46, 'hr.attendance', 'read', NULL, 1),
(47, 'hr.attendance', 'manage', NULL, 1),
(48, 'hr.leaves', 'read', NULL, 1),
(49, 'hr.leaves', 'manage', NULL, 1),
(50, 'hr.leaves', 'approve', NULL, 1),
(51, 'hr.payroll', 'read', NULL, 1),
(52, 'hr.payroll', 'manage', NULL, 1),
(53, 'hr.payroll', 'pay', NULL, 1),
(54, 'hr.settings', 'manage', NULL, 1),
(55, 'users', 'read', NULL, 1),
(56, 'users', 'manage', NULL, 1),
(57, 'rbac', 'manage', NULL, 1),
(58, 'settings', 'read', NULL, 1),
(59, 'settings', 'manage', NULL, 1),
(60, 'integrations.google', 'view', NULL, 1),
(61, 'integrations.google', 'manage', NULL, 1),
(62, 'integrations.facebook', 'view', NULL, 1),
(63, 'integrations.facebook', 'manage', NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `purchases`
--

CREATE TABLE `purchases` (
  `id` int(10) UNSIGNED NOT NULL,
  `purchase_no` varchar(30) NOT NULL,
  `supplier_id` int(10) UNSIGNED NOT NULL,
  `purchase_date` date NOT NULL,
  `status` enum('draft','received','cancelled') NOT NULL DEFAULT 'draft',
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tax_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `grand_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `payment_status` enum('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  `payment_mode` enum('cash','bank','upi','cheque','card') DEFAULT NULL,
  `bank_account_id` int(10) UNSIGNED DEFAULT NULL,
  `expense_id` int(10) UNSIGNED DEFAULT NULL,
  `invoice_ref` varchar(60) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_items`
--

CREATE TABLE `purchase_items` (
  `id` int(10) UNSIGNED NOT NULL,
  `purchase_id` int(10) UNSIGNED NOT NULL,
  `item_id` int(10) UNSIGNED NOT NULL,
  `qty` decimal(12,3) NOT NULL,
  `rate` decimal(12,2) NOT NULL,
  `tax_rate` decimal(5,2) NOT NULL DEFAULT 0.00,
  `line_total` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `repairs`
--

CREATE TABLE `repairs` (
  `id` int(10) UNSIGNED NOT NULL,
  `repair_no` varchar(30) NOT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `item_description` varchar(190) NOT NULL,
  `category` varchar(60) DEFAULT NULL,
  `metal_details` varchar(190) DEFAULT NULL,
  `issue` text DEFAULT NULL,
  `estimated_cost` decimal(14,2) NOT NULL DEFAULT 0.00,
  `final_cost` decimal(14,2) NOT NULL DEFAULT 0.00,
  `advance_paid` decimal(14,2) NOT NULL DEFAULT 0.00,
  `received_date` date NOT NULL,
  `expected_date` date DEFAULT NULL,
  `delivered_date` date DEFAULT NULL,
  `technician` varchar(120) DEFAULT NULL,
  `vendor_id` int(10) UNSIGNED DEFAULT NULL,
  `before_images_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`before_images_json`)),
  `after_images_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`after_images_json`)),
  `status` enum('received','diagnosed','in_progress','quality_check','ready','delivered','cancelled') NOT NULL DEFAULT 'received',
  `notes` text DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `repairs`
--

INSERT INTO `repairs` (`id`, `repair_no`, `customer_id`, `item_description`, `category`, `metal_details`, `issue`, `estimated_cost`, `final_cost`, `advance_paid`, `received_date`, `expected_date`, `delivered_date`, `technician`, `vendor_id`, `before_images_json`, `after_images_json`, `status`, `notes`, `created_by`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'REPAIR-00001', 1, 'Gold chain — broken clasp', 'Gold', NULL, 'Clasp broken, needs resolder', 800.00, 0.00, 0.00, '2026-07-02', '2026-07-06', NULL, 'In-house', NULL, NULL, NULL, 'in_progress', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43', NULL),
(2, 'REPAIR-00002', 2, 'Diamond ring — loose stone', 'Diamond', NULL, 'Stone loose in setting', 1500.00, 0.00, 0.00, '2026-07-01', '2026-07-07', NULL, 'In-house', NULL, NULL, NULL, 'ready', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43', NULL),
(3, 'REPAIR-00003', 3, 'Bangle — resize', 'Gold', NULL, 'Resize to smaller', 1200.00, 0.00, 0.00, '2026-06-30', '2026-07-08', '2026-07-03', 'In-house', 4, NULL, NULL, 'delivered', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43', NULL),
(4, 'REPAIR-00004', 4, 'Necklace — polish', 'Gold', NULL, 'Full polish & rhodium', 600.00, 0.00, 0.00, '2026-06-29', '2026-07-09', '2026-07-03', 'In-house', NULL, NULL, NULL, 'delivered', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43', NULL),
(5, 'REPAIR-00005', 5, 'Earrings — hook repair', 'Silver', NULL, 'Broken hook', 300.00, 0.00, 0.00, '2026-06-28', '2026-07-10', NULL, 'In-house', NULL, NULL, NULL, 'quality_check', NULL, 1, '2026-07-03 12:30:43', '2026-07-03 12:30:43', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `repair_status_history`
--

CREATE TABLE `repair_status_history` (
  `id` int(10) UNSIGNED NOT NULL,
  `repair_id` int(10) UNSIGNED NOT NULL,
  `status` enum('received','diagnosed','in_progress','quality_check','ready','delivered','cancelled') NOT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `repair_status_history`
--

INSERT INTO `repair_status_history` (`id`, `repair_id`, `status`, `note`, `created_by`, `created_at`) VALUES
(1, 1, 'received', 'Repair received', 1, '2026-07-03 12:30:43'),
(2, 1, 'diagnosed', NULL, 1, '2026-07-03 12:30:43'),
(3, 1, 'in_progress', NULL, 1, '2026-07-03 12:30:43'),
(4, 2, 'received', 'Repair received', 1, '2026-07-03 12:30:43'),
(5, 2, 'diagnosed', NULL, 1, '2026-07-03 12:30:43'),
(6, 2, 'in_progress', NULL, 1, '2026-07-03 12:30:43'),
(7, 2, 'quality_check', NULL, 1, '2026-07-03 12:30:43'),
(8, 2, 'ready', NULL, 1, '2026-07-03 12:30:43'),
(9, 3, 'received', 'Repair received', 1, '2026-07-03 12:30:43'),
(10, 3, 'diagnosed', NULL, 1, '2026-07-03 12:30:43'),
(11, 3, 'in_progress', NULL, 1, '2026-07-03 12:30:43'),
(12, 3, 'quality_check', NULL, 1, '2026-07-03 12:30:43'),
(13, 3, 'ready', NULL, 1, '2026-07-03 12:30:43'),
(14, 3, 'delivered', NULL, 1, '2026-07-03 12:30:43'),
(15, 4, 'received', 'Repair received', 1, '2026-07-03 12:30:43'),
(16, 4, 'diagnosed', NULL, 1, '2026-07-03 12:30:43'),
(17, 4, 'in_progress', NULL, 1, '2026-07-03 12:30:43'),
(18, 4, 'quality_check', NULL, 1, '2026-07-03 12:30:43'),
(19, 4, 'ready', NULL, 1, '2026-07-03 12:30:43'),
(20, 4, 'delivered', NULL, 1, '2026-07-03 12:30:43'),
(21, 5, 'received', 'Repair received', 1, '2026-07-03 12:30:43'),
(22, 5, 'diagnosed', NULL, 1, '2026-07-03 12:30:43'),
(23, 5, 'in_progress', NULL, 1, '2026-07-03 12:30:43'),
(24, 5, 'quality_check', NULL, 1, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(60) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `data_scope` enum('all','own') NOT NULL DEFAULT 'all',
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`, `display_name`, `description`, `data_scope`, `is_system`, `is_active`, `created_at`) VALUES
(1, 'super_admin', 'Super Admin', NULL, 'all', 1, 1, '2026-07-03 12:24:54'),
(2, 'admin', 'Admin', NULL, 'all', 0, 1, '2026-07-03 12:24:54'),
(3, 'billing_officer', 'Billing Officer', NULL, 'all', 0, 1, '2026-07-03 12:24:54'),
(4, 'inventory', 'Inventory', NULL, 'all', 0, 1, '2026-07-03 12:24:54');

-- --------------------------------------------------------

--
-- Table structure for table `role_permission_grants`
--

CREATE TABLE `role_permission_grants` (
  `id` int(10) UNSIGNED NOT NULL,
  `role_id` int(10) UNSIGNED NOT NULL,
  `permission_id` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `role_permission_grants`
--

INSERT INTO `role_permission_grants` (`id`, `role_id`, `permission_id`) VALUES
(1, 2, 1),
(2, 2, 2),
(3, 2, 3),
(4, 2, 4),
(5, 2, 5),
(6, 2, 6),
(7, 2, 7),
(8, 2, 8),
(9, 2, 9),
(10, 2, 10),
(11, 2, 11),
(12, 2, 12),
(13, 2, 13),
(14, 2, 14),
(15, 2, 15),
(16, 2, 16),
(17, 2, 17),
(18, 2, 18),
(19, 2, 19),
(20, 2, 20),
(21, 2, 21),
(22, 2, 22),
(23, 2, 23),
(24, 2, 24),
(25, 2, 25),
(26, 2, 26),
(27, 2, 27),
(28, 2, 28),
(29, 2, 29),
(30, 2, 30),
(31, 2, 31),
(32, 2, 32),
(33, 2, 33),
(34, 2, 34),
(35, 2, 35),
(36, 2, 36),
(37, 2, 37),
(38, 2, 38),
(39, 2, 39),
(40, 2, 40),
(41, 2, 41),
(42, 2, 42),
(43, 2, 43),
(44, 2, 44),
(45, 2, 45),
(46, 2, 46),
(47, 2, 47),
(48, 2, 48),
(49, 2, 49),
(50, 2, 50),
(51, 2, 51),
(52, 2, 52),
(53, 2, 53),
(54, 2, 54),
(55, 2, 55),
(56, 2, 56),
(57, 2, 58),
(58, 2, 59),
(59, 2, 60),
(60, 2, 61),
(61, 2, 62),
(62, 2, 63),
(63, 3, 1),
(64, 3, 2),
(65, 3, 3),
(66, 3, 4),
(67, 3, 5),
(68, 3, 7),
(69, 3, 8),
(70, 3, 10),
(71, 3, 11),
(72, 3, 12),
(73, 3, 13),
(74, 3, 14),
(75, 3, 15),
(76, 3, 18),
(77, 3, 21),
(78, 3, 22),
(79, 3, 25),
(80, 3, 27),
(81, 3, 28),
(82, 3, 36),
(83, 3, 42),
(84, 4, 1),
(85, 4, 2),
(86, 4, 10),
(93, 4, 21),
(94, 4, 26),
(95, 4, 27),
(96, 4, 29),
(87, 4, 36),
(88, 4, 37),
(89, 4, 38),
(90, 4, 39),
(91, 4, 40),
(92, 4, 41);

-- --------------------------------------------------------

--
-- Table structure for table `security_audit_logs`
--

CREATE TABLE `security_audit_logs` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED DEFAULT NULL,
  `event` varchar(60) NOT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(255) DEFAULT NULL,
  `meta` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `security_audit_logs`
--

INSERT INTO `security_audit_logs` (`id`, `user_id`, `event`, `ip_address`, `user_agent`, `meta`, `created_at`) VALUES
(1, 1, 'login.success', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', NULL, '2026-07-03 12:25:39'),
(2, 1, 'refresh.reuse', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', NULL, '2026-07-03 12:48:32'),
(3, 1, 'login.success', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', NULL, '2026-07-03 13:04:38'),
(4, 1, 'refresh.reuse', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', NULL, '2026-07-03 14:34:09'),
(5, 1, 'refresh.reuse', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', NULL, '2026-07-03 14:34:09'),
(6, 1, 'refresh.reuse', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', NULL, '2026-07-03 14:34:09'),
(7, 1, 'login.success', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36', NULL, '2026-07-03 14:36:44');

-- --------------------------------------------------------

--
-- Table structure for table `services`
--

CREATE TABLE `services` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `default_rate` decimal(12,2) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `settings`
--

CREATE TABLE `settings` (
  `id` int(10) UNSIGNED NOT NULL,
  `skey` varchar(60) NOT NULL,
  `svalue` text DEFAULT NULL,
  `updated_by` int(10) UNSIGNED DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `settings`
--

INSERT INTO `settings` (`id`, `skey`, `svalue`, `updated_by`, `updated_at`) VALUES
(1, 'company_name', 'Sejal Jewellers', NULL, '2026-07-03 12:24:54'),
(2, 'company_address', '', NULL, '2026-07-03 12:24:54'),
(3, 'company_phone', '', NULL, '2026-07-03 12:24:54'),
(4, 'company_email', '', NULL, '2026-07-03 12:24:54'),
(5, 'company_gstin', '', NULL, '2026-07-03 12:24:54'),
(6, 'company_logo_path', '', NULL, '2026-07-03 12:24:54'),
(7, 'default_tax_rate', '3', NULL, '2026-07-03 12:24:54'),
(8, 'invoice_terms', 'Goods once sold will not be taken back or exchanged.', NULL, '2026-07-03 12:24:54'),
(9, 'invoice_footer_note', 'Thank you for shopping with Sejal Jewellers!', NULL, '2026-07-03 12:24:54'),
(10, 'currency', 'INR', NULL, '2026-07-03 12:24:54');

-- --------------------------------------------------------

--
-- Table structure for table `shifts`
--

CREATE TABLE `shifts` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `grace_minutes` int(10) UNSIGNED NOT NULL DEFAULT 10,
  `working_days` varchar(60) NOT NULL DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat',
  `week_off_days` varchar(60) NOT NULL DEFAULT 'Sun',
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `shifts`
--

INSERT INTO `shifts` (`id`, `name`, `start_time`, `end_time`, `grace_minutes`, `working_days`, `week_off_days`, `is_default`, `is_active`, `created_at`) VALUES
(1, 'General Shift', '10:00:00', '19:00:00', 10, 'Mon,Tue,Wed,Thu,Fri,Sat', 'Sun', 1, 1, '2026-07-03 12:24:54');

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

CREATE TABLE `suppliers` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(150) NOT NULL,
  `vendor_type` varchar(30) NOT NULL DEFAULT 'other',
  `company` varchar(150) DEFAULT NULL,
  `contact_person` varchar(120) DEFAULT NULL,
  `gstin` varchar(20) DEFAULT NULL,
  `pan_no` varchar(15) DEFAULT NULL,
  `bank_name` varchar(120) DEFAULT NULL,
  `account_no` varchar(40) DEFAULT NULL,
  `ifsc` varchar(20) DEFAULT NULL,
  `upi` varchar(80) DEFAULT NULL,
  `payment_terms` varchar(120) DEFAULT NULL,
  `specialisation` varchar(120) DEFAULT NULL,
  `karigar_rate` decimal(12,2) DEFAULT NULL,
  `vendor_status` enum('active','inactive','blacklisted') NOT NULL DEFAULT 'active',
  `mobile` varchar(20) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `pincode` varchar(12) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` (`id`, `name`, `vendor_type`, `company`, `contact_person`, `gstin`, `pan_no`, `bank_name`, `account_no`, `ifsc`, `upi`, `payment_terms`, `specialisation`, `karigar_rate`, `vendor_status`, `mobile`, `email`, `address`, `city`, `state`, `pincode`, `notes`, `is_active`, `created_by`, `created_at`) VALUES
(1, 'Shah Bullion House', 'bullion', 'Shah Bullion', NULL, '27AABCS1234A1Z5', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'active', '9820011111', NULL, NULL, 'Mumbai', NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43'),
(2, 'Kirti Diamonds', 'diamond', 'Kirti Gems', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'active', '9820022222', NULL, NULL, 'Surat', NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43'),
(3, 'Ramesh Karigar', 'karigar', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Kundan & meenakari', 1200.00, 'active', '9820033333', NULL, NULL, 'Jaipur', NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43'),
(4, 'Suresh Polish Works', 'karigar', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Polishing & finishing', 800.00, 'active', '9820044444', NULL, NULL, NULL, NULL, NULL, NULL, 1, 1, '2026-07-03 12:30:43');

-- --------------------------------------------------------

--
-- Table structure for table `units`
--

CREATE TABLE `units` (
  `id` int(10) UNSIGNED NOT NULL,
  `name` varchar(30) NOT NULL,
  `short_name` varchar(10) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `units`
--

INSERT INTO `units` (`id`, `name`, `short_name`, `is_active`) VALUES
(1, 'Pieces', 'pcs', 1),
(2, 'Kilogram', 'kg', 1),
(3, 'Gram', 'g', 1),
(4, 'Litre', 'l', 1),
(5, 'Meter', 'm', 1),
(6, 'Box', 'box', 1),
(7, 'Set', 'set', 1);

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(10) UNSIGNED NOT NULL,
  `username` varchar(60) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(120) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `mobile` varchar(20) DEFAULT NULL,
  `avatar_color` varchar(7) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `must_change_password` tinyint(1) NOT NULL DEFAULT 0,
  `last_login_at` datetime DEFAULT NULL,
  `password_changed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password_hash`, `full_name`, `email`, `mobile`, `avatar_color`, `is_active`, `must_change_password`, `last_login_at`, `password_changed_at`, `created_at`, `updated_at`) VALUES
(1, 'admin', '$2y$10$uC1YBKdyybI84RyJeDIpsuI3cpcuOwiTWRfn3cnKE8Wd5NilJFTsC', 'Super Admin', 'admin@sejaljewellers.local', NULL, '#6C63FF', 1, 0, '2026-07-03 20:06:44', NULL, '2026-07-03 12:24:54', '2026-07-03 14:36:44');

-- --------------------------------------------------------

--
-- Table structure for table `user_role_assignments`
--

CREATE TABLE `user_role_assignments` (
  `id` int(10) UNSIGNED NOT NULL,
  `user_id` int(10) UNSIGNED NOT NULL,
  `role_id` int(10) UNSIGNED NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `expires_at` datetime DEFAULT NULL,
  `assigned_by` int(10) UNSIGNED DEFAULT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `user_role_assignments`
--

INSERT INTO `user_role_assignments` (`id`, `user_id`, `role_id`, `is_active`, `expires_at`, `assigned_by`, `assigned_at`) VALUES
(1, 1, 1, 1, NULL, NULL, '2026-07-03 12:24:54');

-- --------------------------------------------------------

--
-- Table structure for table `works`
--

CREATE TABLE `works` (
  `id` int(10) UNSIGNED NOT NULL,
  `work_code` varchar(20) NOT NULL,
  `customer_id` int(10) UNSIGNED NOT NULL,
  `title` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `service_id` int(10) UNSIGNED DEFAULT NULL,
  `status` enum('pending','in_progress','on_hold','review','completed','cancelled') NOT NULL DEFAULT 'pending',
  `priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `assigned_to` int(10) UNSIGNED DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `estimated_amount` decimal(12,2) DEFAULT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `work_comments`
--

CREATE TABLE `work_comments` (
  `id` int(10) UNSIGNED NOT NULL,
  `work_id` int(10) UNSIGNED NOT NULL,
  `comment` text NOT NULL,
  `created_by` int(10) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `api_rate_limits`
--
ALTER TABLE `api_rate_limits`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_rate_key` (`rate_key`);

--
-- Indexes for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_audit_entity` (`entity_type`,`entity_id`),
  ADD KEY `idx_audit_user` (`user_id`),
  ADD KEY `idx_audit_created` (`created_at`);

--
-- Indexes for table `auth_sessions`
--
ALTER TABLE `auth_sessions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_sessions_refresh` (`refresh_token_hash`),
  ADD KEY `idx_sessions_user` (`user_id`),
  ADD KEY `idx_sessions_prev` (`previous_refresh_token_hash`);

--
-- Indexes for table `bank_accounts`
--
ALTER TABLE `bank_accounts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_customers_code` (`customer_code`),
  ADD KEY `idx_customers_stage` (`stage`),
  ADD KEY `idx_customers_mobile` (`mobile`),
  ADD KEY `idx_customers_email` (`email`),
  ADD KEY `idx_customers_assigned` (`assigned_to`),
  ADD KEY `idx_customers_created` (`created_at`),
  ADD KEY `idx_customers_source_lead` (`source_lead_id`),
  ADD KEY `idx_customers_referrer` (`referred_by_customer_id`),
  ADD KEY `fk_customers_creator` (`created_by`);

--
-- Indexes for table `customer_events`
--
ALTER TABLE `customer_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customer_events_customer` (`customer_id`),
  ADD KEY `idx_customer_events_created` (`created_at`),
  ADD KEY `fk_customer_events_creator` (`created_by`);

--
-- Indexes for table `departments`
--
ALTER TABLE `departments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_departments_name` (`name`),
  ADD KEY `idx_departments_head` (`head_employee_id`);

--
-- Indexes for table `designations`
--
ALTER TABLE `designations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_designations_department` (`department_id`);

--
-- Indexes for table `employees`
--
ALTER TABLE `employees`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_employees_code` (`employee_code`),
  ADD UNIQUE KEY `uq_employees_user` (`user_id`),
  ADD KEY `idx_employees_status` (`status`),
  ADD KEY `idx_employees_department` (`department_id`),
  ADD KEY `idx_employees_designation` (`designation_id`),
  ADD KEY `idx_employees_shift` (`shift_id`),
  ADD KEY `idx_employees_manager` (`reporting_manager_id`),
  ADD KEY `fk_employees_creator` (`created_by`);

--
-- Indexes for table `employee_attendance`
--
ALTER TABLE `employee_attendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_attendance` (`employee_id`,`attendance_date`),
  ADD KEY `idx_attendance_date` (`attendance_date`),
  ADD KEY `fk_attendance_marker` (`marked_by`);

--
-- Indexes for table `expenses`
--
ALTER TABLE `expenses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_expenses_date_category` (`expense_date`,`category_id`),
  ADD KEY `idx_expenses_item` (`fixed_cost_item_id`),
  ADD KEY `idx_expenses_bank` (`bank_account_id`),
  ADD KEY `idx_expenses_category` (`category_id`),
  ADD KEY `fk_expenses_creator` (`created_by`);

--
-- Indexes for table `expense_categories`
--
ALTER TABLE `expense_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_expense_categories_name` (`name`),
  ADD UNIQUE KEY `uq_expense_categories_syskey` (`system_key`);

--
-- Indexes for table `expense_reminders`
--
ALTER TABLE `expense_reminders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_reminders_category` (`category_id`),
  ADD KEY `idx_reminders_item` (`fixed_cost_item_id`);

--
-- Indexes for table `family_members`
--
ALTER TABLE `family_members`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_family_customer` (`customer_id`);

--
-- Indexes for table `fixed_cost_items`
--
ALTER TABLE `fixed_cost_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_fixed_items_name` (`category_id`,`name`),
  ADD UNIQUE KEY `uq_fixed_items_employee` (`category_id`,`employee_id`),
  ADD KEY `idx_fixed_items_employee` (`employee_id`);

--
-- Indexes for table `fixed_cost_monthly_payments`
--
ALTER TABLE `fixed_cost_monthly_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_tracker` (`fixed_cost_item_id`,`month`,`year`),
  ADD KEY `idx_tracker_expense` (`expense_id`),
  ADD KEY `idx_tracker_payroll` (`payroll_item_id`);

--
-- Indexes for table `holidays`
--
ALTER TABLE `holidays`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_holidays_date` (`holiday_date`),
  ADD KEY `fk_holidays_creator` (`created_by`);

--
-- Indexes for table `integration_accounts`
--
ALTER TABLE `integration_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_integration_accounts` (`provider`,`external_account_id`),
  ADD KEY `fk_integration_accounts_user` (`user_id`);

--
-- Indexes for table `integration_keywords`
--
ALTER TABLE `integration_keywords`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_keywords` (`integration_location_id`,`month`,`keyword`);

--
-- Indexes for table `integration_locations`
--
ALTER TABLE `integration_locations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_integration_locations` (`integration_account_id`,`external_id`);

--
-- Indexes for table `integration_metrics_daily`
--
ALTER TABLE `integration_metrics_daily`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_metric` (`integration_location_id`,`metric`,`date`);

--
-- Indexes for table `integration_posts`
--
ALTER TABLE `integration_posts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_posts_external` (`external_post_id`),
  ADD KEY `idx_posts_location` (`integration_location_id`);

--
-- Indexes for table `integration_reviews`
--
ALTER TABLE `integration_reviews`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_reviews_external` (`external_review_id`),
  ADD KEY `idx_reviews_location` (`integration_location_id`);

--
-- Indexes for table `integration_sync_log`
--
ALTER TABLE `integration_sync_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sync_log_account` (`integration_account_id`,`ran_at`);

--
-- Indexes for table `inventory_categories`
--
ALTER TABLE `inventory_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_inventory_categories` (`name`,`item_type`);

--
-- Indexes for table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_inventory_items_code` (`item_code`),
  ADD KEY `idx_inventory_items_type` (`item_type`),
  ADD KEY `idx_inventory_items_category` (`category_id`),
  ADD KEY `idx_inventory_items_name` (`name`),
  ADD KEY `idx_inventory_items_unit` (`unit_id`),
  ADD KEY `fk_inventory_items_creator` (`created_by`),
  ADD KEY `idx_inventory_vendor` (`vendor_id`),
  ADD KEY `idx_inventory_jw_status` (`jw_status`);

--
-- Indexes for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_inv_txn_item` (`item_id`,`created_at`),
  ADD KEY `idx_inv_txn_reason` (`reason`),
  ADD KEY `idx_inv_txn_work` (`work_id`),
  ADD KEY `idx_inv_txn_invoice` (`invoice_id`),
  ADD KEY `idx_inv_txn_purchase` (`purchase_id`),
  ADD KEY `fk_inv_txn_creator` (`created_by`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_invoices_no` (`invoice_no`),
  ADD KEY `idx_invoices_customer` (`customer_id`),
  ADD KEY `idx_invoices_status` (`status`),
  ADD KEY `idx_invoices_date` (`invoice_date`),
  ADD KEY `idx_invoices_due` (`due_date`),
  ADD KEY `idx_invoices_work` (`work_id`),
  ADD KEY `fk_invoices_creator` (`created_by`);

--
-- Indexes for table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_invoice_items_invoice` (`invoice_id`),
  ADD KEY `idx_invoice_items_service` (`service_id`),
  ADD KEY `idx_invoice_items_inventory` (`inventory_item_id`);

--
-- Indexes for table `invoice_payments`
--
ALTER TABLE `invoice_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_payments_receipt` (`receipt_no`),
  ADD KEY `idx_payments_invoice` (`invoice_id`),
  ADD KEY `idx_payments_date` (`payment_date`),
  ADD KEY `idx_payments_bank` (`bank_account_id`),
  ADD KEY `fk_payments_creator` (`created_by`);

--
-- Indexes for table `leads`
--
ALTER TABLE `leads`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_leads_platform` (`platform_lead_id`),
  ADD KEY `idx_leads_status` (`status`),
  ADD KEY `idx_leads_mobile` (`mobile`),
  ADD KEY `idx_leads_email` (`email`),
  ADD KEY `idx_leads_source` (`source_id`),
  ADD KEY `idx_leads_assigned` (`assigned_to`),
  ADD KEY `idx_leads_created` (`created_at`),
  ADD KEY `idx_leads_created_by` (`created_by`),
  ADD KEY `idx_leads_referred_lead` (`referred_by_lead_id`),
  ADD KEY `idx_leads_customer` (`customer_id`),
  ADD KEY `idx_leads_referred_customer` (`referred_by_customer_id`);

--
-- Indexes for table `lead_activities`
--
ALTER TABLE `lead_activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_activities_lead` (`lead_id`),
  ADD KEY `idx_activities_created` (`created_at`),
  ADD KEY `fk_activities_creator` (`created_by`);

--
-- Indexes for table `lead_drop_reasons`
--
ALTER TABLE `lead_drop_reasons`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_drop_reasons_name` (`name`);

--
-- Indexes for table `lead_followups`
--
ALTER TABLE `lead_followups`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_followups_sched` (`scheduled_date`,`status`),
  ADD KEY `idx_followups_lead` (`lead_id`),
  ADD KEY `fk_followups_creator` (`created_by`);

--
-- Indexes for table `lead_meetings`
--
ALTER TABLE `lead_meetings`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_meetings_date` (`meeting_date`),
  ADD KEY `idx_meetings_lead` (`lead_id`),
  ADD KEY `idx_meetings_assigned` (`assigned_to`),
  ADD KEY `fk_meetings_creator` (`created_by`);

--
-- Indexes for table `lead_services`
--
ALTER TABLE `lead_services`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_lead_services` (`lead_id`,`service_id`),
  ADD KEY `idx_lead_services_service` (`service_id`);

--
-- Indexes for table `lead_sources`
--
ALTER TABLE `lead_sources`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_lead_sources_name` (`name`);

--
-- Indexes for table `leave_balances`
--
ALTER TABLE `leave_balances`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_leave_balances` (`employee_id`,`leave_type_id`,`year`),
  ADD KEY `idx_leave_balances_type` (`leave_type_id`);

--
-- Indexes for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_leave_requests_employee` (`employee_id`),
  ADD KEY `idx_leave_requests_status` (`status`),
  ADD KEY `idx_leave_requests_start` (`start_date`),
  ADD KEY `idx_leave_requests_type` (`leave_type_id`),
  ADD KEY `fk_leave_requests_approver` (`approved_by`);

--
-- Indexes for table `leave_types`
--
ALTER TABLE `leave_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_leave_types_name` (`name`),
  ADD UNIQUE KEY `uq_leave_types_code` (`code`);

--
-- Indexes for table `meeting_customers`
--
ALTER TABLE `meeting_customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_meeting_customer` (`meeting_id`,`customer_id`),
  ADD KEY `idx_mc_customer` (`customer_id`);

--
-- Indexes for table `meeting_users`
--
ALTER TABLE `meeting_users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_meeting_user` (`meeting_id`,`user_id`),
  ADD KEY `idx_mu_user` (`user_id`);

--
-- Indexes for table `message_log`
--
ALTER TABLE `message_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ml_status` (`status`),
  ADD KEY `idx_ml_channel` (`channel`),
  ADD KEY `idx_ml_created` (`created_at`),
  ADD KEY `fk_ml_template` (`template_id`);

--
-- Indexes for table `message_templates`
--
ALTER TABLE `message_templates`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_mt_channel` (`channel`),
  ADD KEY `idx_mt_event` (`event`),
  ADD KEY `fk_mt_creator` (`created_by`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_notifications_user` (`user_id`,`is_read`),
  ADD KEY `idx_notifications_created` (`created_at`);

--
-- Indexes for table `number_sequences`
--
ALTER TABLE `number_sequences`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_sequence` (`seq_key`,`period`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_order_no` (`order_no`),
  ADD KEY `idx_order_customer` (`customer_id`),
  ADD KEY `idx_order_status` (`status`),
  ADD KEY `idx_order_vendor` (`vendor_id`),
  ADD KEY `idx_order_deleted` (`deleted_at`),
  ADD KEY `fk_order_invoice` (`invoice_id`),
  ADD KEY `fk_order_stock` (`stock_item_id`),
  ADD KEY `fk_order_creator` (`created_by`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_oi_order` (`order_id`);

--
-- Indexes for table `order_status_history`
--
ALTER TABLE `order_status_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_osh_order` (`order_id`);

--
-- Indexes for table `password_reset_otps`
--
ALTER TABLE `password_reset_otps`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_otps_user` (`user_id`);

--
-- Indexes for table `payroll_items`
--
ALTER TABLE `payroll_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_payroll_items` (`payroll_run_id`,`employee_id`),
  ADD KEY `idx_payroll_items_employee` (`employee_id`),
  ADD KEY `idx_payroll_items_expense` (`expense_id`);

--
-- Indexes for table `payroll_runs`
--
ALTER TABLE `payroll_runs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_payroll_period` (`pay_period`),
  ADD KEY `fk_payroll_runs_creator` (`created_by`);

--
-- Indexes for table `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_permission` (`resource`,`action`);

--
-- Indexes for table `purchases`
--
ALTER TABLE `purchases`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_purchases_no` (`purchase_no`),
  ADD KEY `idx_purchases_supplier` (`supplier_id`),
  ADD KEY `idx_purchases_status` (`status`),
  ADD KEY `idx_purchases_date` (`purchase_date`),
  ADD KEY `idx_purchases_expense` (`expense_id`),
  ADD KEY `idx_purchases_bank` (`bank_account_id`),
  ADD KEY `fk_purchases_creator` (`created_by`);

--
-- Indexes for table `purchase_items`
--
ALTER TABLE `purchase_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_purchase_items_purchase` (`purchase_id`),
  ADD KEY `idx_purchase_items_item` (`item_id`);

--
-- Indexes for table `repairs`
--
ALTER TABLE `repairs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_repair_no` (`repair_no`),
  ADD KEY `idx_repair_customer` (`customer_id`),
  ADD KEY `idx_repair_status` (`status`),
  ADD KEY `idx_repair_vendor` (`vendor_id`),
  ADD KEY `idx_repair_deleted` (`deleted_at`),
  ADD KEY `fk_repair_creator` (`created_by`);

--
-- Indexes for table `repair_status_history`
--
ALTER TABLE `repair_status_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_rsh_repair` (`repair_id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_roles_name` (`name`);

--
-- Indexes for table `role_permission_grants`
--
ALTER TABLE `role_permission_grants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_grant` (`role_id`,`permission_id`),
  ADD KEY `idx_grant_permission` (`permission_id`);

--
-- Indexes for table `security_audit_logs`
--
ALTER TABLE `security_audit_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_sec_audit_user` (`user_id`),
  ADD KEY `idx_sec_audit_event` (`event`);

--
-- Indexes for table `services`
--
ALTER TABLE `services`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_services_name` (`name`);

--
-- Indexes for table `settings`
--
ALTER TABLE `settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_settings_key` (`skey`),
  ADD KEY `fk_settings_user` (`updated_by`);

--
-- Indexes for table `shifts`
--
ALTER TABLE `shifts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_suppliers_creator` (`created_by`);

--
-- Indexes for table `units`
--
ALTER TABLE `units`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_units_name` (`name`),
  ADD UNIQUE KEY `uq_units_short` (`short_name`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_users_username` (`username`),
  ADD UNIQUE KEY `uq_users_email` (`email`);

--
-- Indexes for table `user_role_assignments`
--
ALTER TABLE `user_role_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_assignment` (`user_id`,`role_id`),
  ADD KEY `idx_assignment_role` (`role_id`),
  ADD KEY `fk_assignments_assigner` (`assigned_by`);

--
-- Indexes for table `works`
--
ALTER TABLE `works`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uq_works_code` (`work_code`),
  ADD KEY `idx_works_customer` (`customer_id`),
  ADD KEY `idx_works_status` (`status`),
  ADD KEY `idx_works_assigned` (`assigned_to`),
  ADD KEY `idx_works_due` (`due_date`),
  ADD KEY `fk_works_service` (`service_id`),
  ADD KEY `fk_works_creator` (`created_by`);

--
-- Indexes for table `work_comments`
--
ALTER TABLE `work_comments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_work_comments_work` (`work_id`),
  ADD KEY `fk_work_comments_creator` (`created_by`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `api_rate_limits`
--
ALTER TABLE `api_rate_limits`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `audit_logs`
--
ALTER TABLE `audit_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `auth_sessions`
--
ALTER TABLE `auth_sessions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `bank_accounts`
--
ALTER TABLE `bank_accounts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `customer_events`
--
ALTER TABLE `customer_events`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `departments`
--
ALTER TABLE `departments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `designations`
--
ALTER TABLE `designations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `employees`
--
ALTER TABLE `employees`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `employee_attendance`
--
ALTER TABLE `employee_attendance`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=31;

--
-- AUTO_INCREMENT for table `expenses`
--
ALTER TABLE `expenses`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `expense_categories`
--
ALTER TABLE `expense_categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `expense_reminders`
--
ALTER TABLE `expense_reminders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `family_members`
--
ALTER TABLE `family_members`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `fixed_cost_items`
--
ALTER TABLE `fixed_cost_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `fixed_cost_monthly_payments`
--
ALTER TABLE `fixed_cost_monthly_payments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `holidays`
--
ALTER TABLE `holidays`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `integration_accounts`
--
ALTER TABLE `integration_accounts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `integration_keywords`
--
ALTER TABLE `integration_keywords`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `integration_locations`
--
ALTER TABLE `integration_locations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `integration_metrics_daily`
--
ALTER TABLE `integration_metrics_daily`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `integration_posts`
--
ALTER TABLE `integration_posts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `integration_reviews`
--
ALTER TABLE `integration_reviews`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `integration_sync_log`
--
ALTER TABLE `integration_sync_log`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_categories`
--
ALTER TABLE `inventory_categories`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `inventory_items`
--
ALTER TABLE `inventory_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `invoice_items`
--
ALTER TABLE `invoice_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `invoice_payments`
--
ALTER TABLE `invoice_payments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `leads`
--
ALTER TABLE `leads`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `lead_activities`
--
ALTER TABLE `lead_activities`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;

--
-- AUTO_INCREMENT for table `lead_drop_reasons`
--
ALTER TABLE `lead_drop_reasons`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `lead_followups`
--
ALTER TABLE `lead_followups`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `lead_meetings`
--
ALTER TABLE `lead_meetings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `lead_services`
--
ALTER TABLE `lead_services`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `lead_sources`
--
ALTER TABLE `lead_sources`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `leave_balances`
--
ALTER TABLE `leave_balances`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `leave_requests`
--
ALTER TABLE `leave_requests`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `leave_types`
--
ALTER TABLE `leave_types`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `meeting_customers`
--
ALTER TABLE `meeting_customers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `meeting_users`
--
ALTER TABLE `meeting_users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `message_log`
--
ALTER TABLE `message_log`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `message_templates`
--
ALTER TABLE `message_templates`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `number_sequences`
--
ALTER TABLE `number_sequences`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `order_status_history`
--
ALTER TABLE `order_status_history`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `password_reset_otps`
--
ALTER TABLE `password_reset_otps`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payroll_items`
--
ALTER TABLE `payroll_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payroll_runs`
--
ALTER TABLE `payroll_runs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=64;

--
-- AUTO_INCREMENT for table `purchases`
--
ALTER TABLE `purchases`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `purchase_items`
--
ALTER TABLE `purchase_items`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `repairs`
--
ALTER TABLE `repairs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `repair_status_history`
--
ALTER TABLE `repair_status_history`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `role_permission_grants`
--
ALTER TABLE `role_permission_grants`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=97;

--
-- AUTO_INCREMENT for table `security_audit_logs`
--
ALTER TABLE `security_audit_logs`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `services`
--
ALTER TABLE `services`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `settings`
--
ALTER TABLE `settings`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `shifts`
--
ALTER TABLE `shifts`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `suppliers`
--
ALTER TABLE `suppliers`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `units`
--
ALTER TABLE `units`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `user_role_assignments`
--
ALTER TABLE `user_role_assignments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `works`
--
ALTER TABLE `works`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `work_comments`
--
ALTER TABLE `work_comments`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `audit_logs`
--
ALTER TABLE `audit_logs`
  ADD CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `auth_sessions`
--
ALTER TABLE `auth_sessions`
  ADD CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `fk_customers_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_customers_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_customers_referrer` FOREIGN KEY (`referred_by_customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_customers_source_lead` FOREIGN KEY (`source_lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `customer_events`
--
ALTER TABLE `customer_events`
  ADD CONSTRAINT `fk_customer_events_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_customer_events_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `departments`
--
ALTER TABLE `departments`
  ADD CONSTRAINT `fk_departments_head` FOREIGN KEY (`head_employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `designations`
--
ALTER TABLE `designations`
  ADD CONSTRAINT `fk_designations_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `employees`
--
ALTER TABLE `employees`
  ADD CONSTRAINT `fk_employees_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_employees_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_employees_designation` FOREIGN KEY (`designation_id`) REFERENCES `designations` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_employees_manager` FOREIGN KEY (`reporting_manager_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_employees_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_employees_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `employee_attendance`
--
ALTER TABLE `employee_attendance`
  ADD CONSTRAINT `fk_attendance_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_attendance_marker` FOREIGN KEY (`marked_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `expenses`
--
ALTER TABLE `expenses`
  ADD CONSTRAINT `fk_expenses_bank` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_expenses_category` FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`),
  ADD CONSTRAINT `fk_expenses_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_expenses_item` FOREIGN KEY (`fixed_cost_item_id`) REFERENCES `fixed_cost_items` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `expense_reminders`
--
ALTER TABLE `expense_reminders`
  ADD CONSTRAINT `fk_reminders_category` FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_reminders_item` FOREIGN KEY (`fixed_cost_item_id`) REFERENCES `fixed_cost_items` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `family_members`
--
ALTER TABLE `family_members`
  ADD CONSTRAINT `fk_family_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `fixed_cost_items`
--
ALTER TABLE `fixed_cost_items`
  ADD CONSTRAINT `fk_fixed_items_category` FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_fixed_items_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `fixed_cost_monthly_payments`
--
ALTER TABLE `fixed_cost_monthly_payments`
  ADD CONSTRAINT `fk_tracker_expense` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_tracker_item` FOREIGN KEY (`fixed_cost_item_id`) REFERENCES `fixed_cost_items` (`id`),
  ADD CONSTRAINT `fk_tracker_payroll` FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `holidays`
--
ALTER TABLE `holidays`
  ADD CONSTRAINT `fk_holidays_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `integration_accounts`
--
ALTER TABLE `integration_accounts`
  ADD CONSTRAINT `fk_integration_accounts_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `integration_keywords`
--
ALTER TABLE `integration_keywords`
  ADD CONSTRAINT `fk_keywords_location` FOREIGN KEY (`integration_location_id`) REFERENCES `integration_locations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `integration_locations`
--
ALTER TABLE `integration_locations`
  ADD CONSTRAINT `fk_integration_locations_account` FOREIGN KEY (`integration_account_id`) REFERENCES `integration_accounts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `integration_metrics_daily`
--
ALTER TABLE `integration_metrics_daily`
  ADD CONSTRAINT `fk_metrics_location` FOREIGN KEY (`integration_location_id`) REFERENCES `integration_locations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `integration_posts`
--
ALTER TABLE `integration_posts`
  ADD CONSTRAINT `fk_posts_location` FOREIGN KEY (`integration_location_id`) REFERENCES `integration_locations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `integration_reviews`
--
ALTER TABLE `integration_reviews`
  ADD CONSTRAINT `fk_reviews_location` FOREIGN KEY (`integration_location_id`) REFERENCES `integration_locations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `integration_sync_log`
--
ALTER TABLE `integration_sync_log`
  ADD CONSTRAINT `fk_sync_log_account` FOREIGN KEY (`integration_account_id`) REFERENCES `integration_accounts` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD CONSTRAINT `fk_inventory_items_category` FOREIGN KEY (`category_id`) REFERENCES `inventory_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inventory_items_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inventory_items_unit` FOREIGN KEY (`unit_id`) REFERENCES `units` (`id`),
  ADD CONSTRAINT `fk_inventory_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  ADD CONSTRAINT `fk_inv_txn_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inv_txn_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inv_txn_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`),
  ADD CONSTRAINT `fk_inv_txn_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_inv_txn_work` FOREIGN KEY (`work_id`) REFERENCES `works` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `fk_invoices_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_invoices_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_invoices_work` FOREIGN KEY (`work_id`) REFERENCES `works` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD CONSTRAINT `fk_invoice_items_inventory` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_invoice_items_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_invoice_items_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `invoice_payments`
--
ALTER TABLE `invoice_payments`
  ADD CONSTRAINT `fk_payments_bank` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_payments_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_payments_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`);

--
-- Constraints for table `leads`
--
ALTER TABLE `leads`
  ADD CONSTRAINT `fk_leads_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_leads_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_leads_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_leads_referred_customer` FOREIGN KEY (`referred_by_customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_leads_referred_lead` FOREIGN KEY (`referred_by_lead_id`) REFERENCES `leads` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_leads_source` FOREIGN KEY (`source_id`) REFERENCES `lead_sources` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `lead_activities`
--
ALTER TABLE `lead_activities`
  ADD CONSTRAINT `fk_activities_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_activities_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `lead_followups`
--
ALTER TABLE `lead_followups`
  ADD CONSTRAINT `fk_followups_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_followups_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `lead_meetings`
--
ALTER TABLE `lead_meetings`
  ADD CONSTRAINT `fk_meetings_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_meetings_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_meetings_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `lead_services`
--
ALTER TABLE `lead_services`
  ADD CONSTRAINT `fk_lead_services_lead` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_lead_services_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `leave_balances`
--
ALTER TABLE `leave_balances`
  ADD CONSTRAINT `fk_leave_balances_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_leave_balances_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD CONSTRAINT `fk_leave_requests_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_leave_requests_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_leave_requests_type` FOREIGN KEY (`leave_type_id`) REFERENCES `leave_types` (`id`);

--
-- Constraints for table `meeting_customers`
--
ALTER TABLE `meeting_customers`
  ADD CONSTRAINT `fk_mc_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_mc_meeting` FOREIGN KEY (`meeting_id`) REFERENCES `lead_meetings` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `meeting_users`
--
ALTER TABLE `meeting_users`
  ADD CONSTRAINT `fk_mu_meeting` FOREIGN KEY (`meeting_id`) REFERENCES `lead_meetings` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_mu_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `message_log`
--
ALTER TABLE `message_log`
  ADD CONSTRAINT `fk_ml_template` FOREIGN KEY (`template_id`) REFERENCES `message_templates` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `message_templates`
--
ALTER TABLE `message_templates`
  ADD CONSTRAINT `fk_mt_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_order_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_order_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_order_invoice` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_order_stock` FOREIGN KEY (`stock_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_order_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_oi_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `order_status_history`
--
ALTER TABLE `order_status_history`
  ADD CONSTRAINT `fk_osh_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `password_reset_otps`
--
ALTER TABLE `password_reset_otps`
  ADD CONSTRAINT `fk_otps_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payroll_items`
--
ALTER TABLE `payroll_items`
  ADD CONSTRAINT `fk_payroll_items_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
  ADD CONSTRAINT `fk_payroll_items_expense` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_payroll_items_run` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payroll_runs`
--
ALTER TABLE `payroll_runs`
  ADD CONSTRAINT `fk_payroll_runs_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `purchases`
--
ALTER TABLE `purchases`
  ADD CONSTRAINT `fk_purchases_bank` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_purchases_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_purchases_expense` FOREIGN KEY (`expense_id`) REFERENCES `expenses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_purchases_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`);

--
-- Constraints for table `purchase_items`
--
ALTER TABLE `purchase_items`
  ADD CONSTRAINT `fk_purchase_items_item` FOREIGN KEY (`item_id`) REFERENCES `inventory_items` (`id`),
  ADD CONSTRAINT `fk_purchase_items_purchase` FOREIGN KEY (`purchase_id`) REFERENCES `purchases` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `repairs`
--
ALTER TABLE `repairs`
  ADD CONSTRAINT `fk_repair_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_repair_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_repair_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `repair_status_history`
--
ALTER TABLE `repair_status_history`
  ADD CONSTRAINT `fk_rsh_repair` FOREIGN KEY (`repair_id`) REFERENCES `repairs` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `role_permission_grants`
--
ALTER TABLE `role_permission_grants`
  ADD CONSTRAINT `fk_grants_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_grants_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `settings`
--
ALTER TABLE `settings`
  ADD CONSTRAINT `fk_settings_user` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD CONSTRAINT `fk_suppliers_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `user_role_assignments`
--
ALTER TABLE `user_role_assignments`
  ADD CONSTRAINT `fk_assignments_assigner` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_assignments_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_assignments_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `works`
--
ALTER TABLE `works`
  ADD CONSTRAINT `fk_works_assigned` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_works_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_works_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_works_service` FOREIGN KEY (`service_id`) REFERENCES `services` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `work_comments`
--
ALTER TABLE `work_comments`
  ADD CONSTRAINT `fk_work_comments_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_work_comments_work` FOREIGN KEY (`work_id`) REFERENCES `works` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
