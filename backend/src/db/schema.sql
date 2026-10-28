-- ============================================================================
-- MINI MARKET FINANCIAL CONTROL & THREE-DAY AUDIT MANAGEMENT SYSTEM
-- MySQL 8.0+ Schema Definition
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `minimarket_audit_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `minimarket_audit_db`;

-- 1. USERS & ROLES
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `email` VARCHAR(100) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `phone_number` VARCHAR(30) NULL,
    `role` ENUM('recorder', 'manager', 'auditor') NOT NULL DEFAULT 'recorder',
    `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
    `is_approved` BOOLEAN NOT NULL DEFAULT FALSE,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_users_role` (`role`)
) ENGINE=InnoDB;

-- 2. BUSINESS DAYS
CREATE TABLE IF NOT EXISTS `business_days` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `business_date` DATE NOT NULL UNIQUE,
    `opening_cash` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `opening_bank` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `status` ENUM('OPEN', 'PENDING_CLOSING', 'CLOSED', 'AUDITED') NOT NULL DEFAULT 'OPEN',
    `opened_by` INT NOT NULL,
    `opened_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `open_source` ENUM('MANUAL', 'AUTOMATIC') NOT NULL DEFAULT 'MANUAL',
    `closed_by` INT NULL,
    `closed_at` DATETIME NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_business_date` (`business_date`),
    INDEX `idx_business_status` (`status`)
) ENGINE=InnoDB;

-- 3. DAILY AGGREGATED INCOMES
CREATE TABLE IF NOT EXISTS `daily_incomes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `business_day_id` INT NOT NULL,
    `cash_income` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `bank_income` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `total_income` DECIMAL(14,2) GENERATED ALWAYS AS (`cash_income` + `bank_income`) STORED,
    `description` VARCHAR(255) NULL,
    `reference_number` VARCHAR(100) NULL,
    `created_by` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`business_day_id`) REFERENCES `business_days`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_income_business_day` (`business_day_id`),
    UNIQUE KEY `uq_income_day_reference` (`business_day_id`, `reference_number`)
) ENGINE=InnoDB;

-- 4. DAILY OPERATIONAL EXPENSES
CREATE TABLE IF NOT EXISTS `daily_expenses` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `business_day_id` INT NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `amount` DECIMAL(14,2) NOT NULL,
    `payment_source` ENUM('CASH', 'BANK') NOT NULL,
    `reference_number` VARCHAR(100) NULL,
    `expense_category` VARCHAR(100) NULL,
    `created_by` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`business_day_id`) REFERENCES `business_days`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_expense_business_day` (`business_day_id`),
    INDEX `idx_expense_payment_source` (`payment_source`),
    UNIQUE KEY `uq_expense_day_reference` (`business_day_id`, `reference_number`)
) ENGINE=InnoDB;

-- 5. DAILY RECONCILIATION & CLOSINGS
CREATE TABLE IF NOT EXISTS `daily_closings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `business_day_id` INT NOT NULL UNIQUE,
    `opening_cash` DECIMAL(14,2) NOT NULL,
    `total_cash_income` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `total_cash_expenses` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `cash_adjustments` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `expected_cash` DECIMAL(14,2) NOT NULL,
    `actual_cash` DECIMAL(14,2) NOT NULL,
    `cash_difference` DECIMAL(14,2) NOT NULL,
    `cash_status` ENUM('BALANCED', 'SHORTAGE', 'SURPLUS') NOT NULL,

    `opening_bank` DECIMAL(14,2) NOT NULL,
    `total_bank_income` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `total_bank_expenses` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `bank_adjustments` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `expected_bank` DECIMAL(14,2) NOT NULL,
    `actual_bank` DECIMAL(14,2) NOT NULL,
    `bank_difference` DECIMAL(14,2) NOT NULL,
    `bank_status` ENUM('BALANCED', 'SHORTAGE', 'SURPLUS') NOT NULL,

    `daily_status` ENUM('BALANCED', 'CASH_DISCREPANCY', 'BANK_DISCREPANCY', 'DUAL_DISCREPANCY') NOT NULL,
    `notes` TEXT NULL,
    `closed_by` INT NOT NULL,
    `verified_by` INT NULL,
    `automatically_closed` BOOLEAN NOT NULL DEFAULT FALSE,
    `closed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`business_day_id`) REFERENCES `business_days`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_daily_closing_status` (`daily_status`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `business_day_schedule_overrides` (
    `business_date` DATE PRIMARY KEY,
    `override_action` ENUM('OPEN', 'CLOSED') NOT NULL,
    `changed_by` INT NOT NULL,
    `changed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `business_day_reopenings` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `business_day_id` INT NOT NULL,
    `reopened_by` INT NOT NULL,
    `reason` TEXT NOT NULL,
    `previous_closing` JSON NOT NULL,
    `reopened_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`business_day_id`) REFERENCES `business_days`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`reopened_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `financial_record_changes` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `record_type` ENUM('INCOME', 'EXPENSE') NOT NULL,
    `record_id` INT NOT NULL,
    `business_day_id` INT NOT NULL,
    `changed_by` INT NOT NULL,
    `reason` TEXT NOT NULL,
    `old_values` JSON NOT NULL,
    `new_values` JSON NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`business_day_id`) REFERENCES `business_days`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_financial_change_record` (`record_type`, `record_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `token_hash` CHAR(64) NOT NULL UNIQUE,
    `expires_at` DATETIME NOT NULL,
    `used_at` DATETIME NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_password_reset_user` (`user_id`, `expires_at`)
) ENGINE=InnoDB;

-- 6. THREE-DAY AUDITS (የሦስት ቀን ኦዲት)
CREATE TABLE IF NOT EXISTS `three_day_audits` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `audit_code` VARCHAR(50) NOT NULL UNIQUE,
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `day_1_id` INT NOT NULL,
    `day_2_id` INT NOT NULL,
    `day_3_id` INT NOT NULL,

    -- Starting balance source: INITIAL_BALANCE (first audit) or PREVIOUS_AUDIT (carry-forward)
    `starting_balance_source` ENUM('INITIAL_BALANCE','PREVIOUS_AUDIT') NOT NULL DEFAULT 'INITIAL_BALANCE',

    -- CASH: starting_balance = previous audit closing OR day-1 verified opening
    `opening_cash` DECIMAL(14,2) NOT NULL,
    `total_3day_cash_income` DECIMAL(14,2) NOT NULL,
    `total_3day_cash_expenses` DECIMAL(14,2) NOT NULL,
    `additional_cash_income` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `cash_adjustments` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    -- expected_cash = opening_cash + income - expenses ± adjustments (= three-day closing balance)
    `expected_cash` DECIMAL(14,2) NOT NULL,
    `actual_cash` DECIMAL(14,2) NOT NULL,
    -- cash_difference = actual_cash - expected_cash (negative=SHORTAGE, positive=SURPLUS)
    `cash_difference` DECIMAL(14,2) NOT NULL,
    `cash_audit_status` ENUM('BALANCED', 'SHORTAGE', 'SURPLUS') NOT NULL,

    -- BANK: same carry-forward logic, independent from cash
    `opening_bank` DECIMAL(14,2) NOT NULL,
    `total_3day_bank_income` DECIMAL(14,2) NOT NULL,
    `total_3day_bank_expenses` DECIMAL(14,2) NOT NULL,
    `bank_adjustments` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    -- expected_bank = opening_bank + income - expenses ± adjustments (= three-day closing balance)
    `expected_bank` DECIMAL(14,2) NOT NULL,
    `actual_bank` DECIMAL(14,2) NOT NULL,
    -- bank_difference = actual_bank - expected_bank (negative=SHORTAGE, positive=SURPLUS)
    `bank_difference` DECIMAL(14,2) NOT NULL,
    `bank_audit_status` ENUM('BALANCED', 'SHORTAGE', 'SURPLUS') NOT NULL,

    `overall_status` ENUM('OPEN', 'IN_REVIEW', 'BALANCED', 'DISCREPANCY_FOUND', 'INVESTIGATION', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `auditor_id` INT NOT NULL,
    `approved_by` INT NULL,
    `auditor_remarks` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`day_1_id`) REFERENCES `business_days`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`day_2_id`) REFERENCES `business_days`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`day_3_id`) REFERENCES `business_days`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`auditor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_audit_dates` (`start_date`, `end_date`),
    INDEX `idx_audit_status` (`overall_status`)
) ENGINE=InnoDB;

-- 7. DISCREPANCIES
CREATE TABLE IF NOT EXISTS `discrepancies` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `discrepancy_code` VARCHAR(50) NOT NULL UNIQUE,
    `source_type` ENUM('DAILY_CLOSING', 'THREE_DAY_AUDIT') NOT NULL,
    `source_id` INT NOT NULL,
    `business_date` DATE NOT NULL,
    `account_type` ENUM('CASH', 'BANK') NOT NULL,
    `expected_amount` DECIMAL(14,2) NOT NULL,
    `actual_amount` DECIMAL(14,2) NOT NULL,
    `difference_amount` DECIMAL(14,2) NOT NULL,
    `discrepancy_type` ENUM('SHORTAGE', 'SURPLUS', 'BANK_MISMATCH') NOT NULL,
    `status` ENUM('OPEN', 'IN_INVESTIGATION', 'REVIEWED', 'RESOLVED', 'ADJUSTED_RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `responsible_user_id` INT NULL,
    `explanation` TEXT NULL,
    `evidence_ref` VARCHAR(255) NULL,
    `investigated_by` INT NULL,
    `resolved_by` INT NULL,
    `resolution_notes` TEXT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`responsible_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`investigated_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_discrepancy_status` (`status`),
    INDEX `idx_discrepancy_account` (`account_type`)
) ENGINE=InnoDB;

-- 8. ADJUSTMENTS
CREATE TABLE IF NOT EXISTS `adjustments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `adjustment_code` VARCHAR(50) NOT NULL UNIQUE,
    `discrepancy_id` INT NULL,
    `business_day_id` INT NOT NULL,
    `account_type` ENUM('CASH', 'BANK') NOT NULL,
    `amount` DECIMAL(14,2) NOT NULL,
    `reason_category` ENUM('UNRECORDED_EXPENSE', 'UNRECORDED_INCOME', 'COUNTING_CORRECTION', 'DATA_ENTRY_ERROR', 'APPROVED_POLICY_ADJUSTMENT') NOT NULL,
    `detailed_reason` TEXT NOT NULL,
    `supporting_doc_ref` VARCHAR(255) NULL,
    `requested_by` INT NOT NULL,
    `approved_by` INT NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`discrepancy_id`) REFERENCES `discrepancies`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`business_day_id`) REFERENCES `business_days`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`requested_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_adjustment_business_day` (`business_day_id`)
) ENGINE=InnoDB;

-- 9. AUDIT LOGS
CREATE TABLE IF NOT EXISTS `audit_logs` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_name` VARCHAR(50) NOT NULL,
    `entity_id` VARCHAR(50) NOT NULL,
    `old_values` JSON NULL,
    `new_values` JSON NULL,
    `reason` TEXT NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
    INDEX `idx_audit_logs_action` (`action`),
    INDEX `idx_audit_logs_entity` (`entity_name`, `entity_id`),
    INDEX `idx_audit_logs_created_at` (`created_at`)
) ENGINE=InnoDB;
