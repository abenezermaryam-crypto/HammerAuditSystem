-- ============================================================================
-- MINI MARKET FINANCIAL CONTROL & THREE-DAY AUDIT MANAGEMENT SYSTEM
-- Step 6: Complete Relational Database Schema (MySQL 8.0+ / InnoDB)
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `minimarket_audit_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `minimarket_audit_db`;

-- 1. USERS & AUTHENTICATION TABLE
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

-- 2. BUSINESS DAYS & DAILY CONTROL CYCLE
CREATE TABLE IF NOT EXISTS `business_days` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `business_date` DATE NOT NULL UNIQUE,
    `opening_cash` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `opening_bank` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `status` ENUM('OPEN', 'PENDING_CLOSING', 'CLOSED', 'AUDITED') NOT NULL DEFAULT 'OPEN',
    `opened_by` INT NOT NULL,
    `closed_by` INT NULL,
    `closed_at` DATETIME NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_business_date` (`business_date`),
    INDEX `idx_business_status` (`status`)
) ENGINE=InnoDB;

-- 3. DAILY AGGREGATED INCOME TABLE
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
    INDEX `idx_income_business_day` (`business_day_id`)
) ENGINE=InnoDB;

-- 4. DAILY OPERATIONAL EXPENSES TABLE
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
    INDEX `idx_expense_payment_source` (`payment_source`)
) ENGINE=InnoDB;

-- 5. DAILY RECONCILIATION & CLOSINGS TABLE
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
    `bank_status` ENUM('BALANCED', 'DISCREPANCY') NOT NULL,

    `daily_status` ENUM('BALANCED', 'CASH_DISCREPANCY', 'BANK_DISCREPANCY', 'DUAL_DISCREPANCY') NOT NULL,
    `notes` TEXT NULL,
    `closed_by` INT NOT NULL,
    `verified_by` INT NULL,
    `closed_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`business_day_id`) REFERENCES `business_days`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT,
    INDEX `idx_daily_closing_status` (`daily_status`)
) ENGINE=InnoDB;

-- 6. THREE-DAY AUDIT PERIODS TABLE (የሦስት ቀን ኦዲት)
CREATE TABLE IF NOT EXISTS `three_day_audits` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `audit_code` VARCHAR(50) NOT NULL UNIQUE, -- e.g., AUD-2026-OCT-P01
    `start_date` DATE NOT NULL,
    `end_date` DATE NOT NULL,
    `day_1_id` INT NOT NULL,
    `day_2_id` INT NOT NULL,
    `day_3_id` INT NOT NULL,
    
    `opening_cash` DECIMAL(14,2) NOT NULL,
    `total_3day_cash_income` DECIMAL(14,2) NOT NULL,
    `total_3day_cash_expenses` DECIMAL(14,2) NOT NULL,
    `additional_cash_income` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `cash_adjustments` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `expected_cash` DECIMAL(14,2) NOT NULL,
    `actual_cash` DECIMAL(14,2) NOT NULL,
    `cash_difference` DECIMAL(14,2) NOT NULL,
    `cash_audit_status` ENUM('BALANCED', 'SHORTAGE', 'SURPLUS') NOT NULL,

    `opening_bank` DECIMAL(14,2) NOT NULL,
    `total_3day_bank_income` DECIMAL(14,2) NOT NULL,
    `total_3day_bank_expenses` DECIMAL(14,2) NOT NULL,
    `bank_adjustments` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
    `expected_bank` DECIMAL(14,2) NOT NULL,
    `actual_bank` DECIMAL(14,2) NOT NULL,
    `bank_difference` DECIMAL(14,2) NOT NULL,
    `bank_audit_status` ENUM('BALANCED', 'DISCREPANCY') NOT NULL,

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

-- 7. DISCREPANCY MANAGEMENT TABLE
CREATE TABLE IF NOT EXISTS `discrepancies` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `discrepancy_code` VARCHAR(50) NOT NULL UNIQUE, -- e.g., DISC-2026-001
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

-- 8. APPROVED FINANCIAL ADJUSTMENTS TABLE
CREATE TABLE IF NOT EXISTS `adjustments` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `adjustment_code` VARCHAR(50) NOT NULL UNIQUE, -- e.g., ADJ-2026-001
    `discrepancy_id` INT NULL,
    `business_day_id` INT NOT NULL,
    `account_type` ENUM('CASH', 'BANK') NOT NULL,
    `amount` DECIMAL(14,2) NOT NULL, -- Negative for unrecorded expenses, Positive for unrecorded income
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

-- 9. IMMUTABLE SYSTEM AUDIT LOGS TABLE
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

-- 10. PASSWORD RESET TOKENS & VERIFICATION CODES TABLE
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `user_id` INT NOT NULL,
    `token_hash` CHAR(64) NOT NULL UNIQUE,
    `code_hash` CHAR(64) NULL,
    `delivery_method` ENUM('EMAIL', 'SMS') NOT NULL DEFAULT 'EMAIL',
    `destination` VARCHAR(100) NULL,
    `attempts` INT NOT NULL DEFAULT 0,
    `expires_at` DATETIME NOT NULL,
    `used_at` DATETIME NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    INDEX `idx_password_reset_user` (`user_id`, `expires_at`),
    INDEX `idx_password_reset_code` (`code_hash`)
) ENGINE=InnoDB;
