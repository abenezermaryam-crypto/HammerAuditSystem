const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const databaseName = process.env.DB_NAME || 'minimarket_audit_db';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'minimarket_audit_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  decimalNumbers: true, // Parse decimals as numbers/floats or maintain precision in strings
  timezone: '+03:00' // East Africa Time (ETB)
});

// Helper for running queries
async function query(sql, params) {
  const [rows, fields] = await pool.execute(sql, params);
  return rows;
}

// Transaction runner
async function transaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Database schema initializer
async function initDb() {
  let rootConnection;

  try {
    if (databaseName.length > 64 || /[^A-Za-z0-9_]/.test(databaseName)) {
      throw new Error('DB_NAME must be at most 64 characters and contain only letters, numbers, and underscores.');
    }

    const password = process.env.DB_PASSWORD || '';
    if (['your_password', 'your_mysql_password'].includes(password.toLowerCase())) {
      throw new Error(
        'DB_PASSWORD is still set to the example placeholder. Set it to your MySQL password in backend/.env.'
      );
    }

    rootConnection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password,
      multipleStatements: true
    });

    const schemaSql = fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf-8')
      .replace(/`minimarket_audit_db`/g, `\`${databaseName}\``);
    console.log(`🔄 Initializing MySQL schema in database '${databaseName}'...`);
    await rootConnection.query(schemaSql);
    await migrateUserSchema(rootConnection);
    console.log('✅ Schema created successfully.');
  } catch (err) {
    console.error('❌ Error initializing database:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error(
        'Check DB_HOST, DB_PORT, DB_USER, and DB_PASSWORD in backend/.env. Use credentials accepted by your MySQL server.'
      );
    }
    process.exitCode = 1;
  } finally {
    if (rootConnection) {
      await rootConnection.end();
    }
  }
}

async function migrateUserSchema(connection) {
  const [phoneColumns] = await connection.query("SHOW COLUMNS FROM users LIKE 'phone_number'");
  if (phoneColumns.length === 0) {
    await connection.query('ALTER TABLE users ADD COLUMN phone_number VARCHAR(30) NULL AFTER full_name');
  }

  const [approvalColumns] = await connection.query("SHOW COLUMNS FROM users LIKE 'is_approved'");
  if (approvalColumns.length === 0) {
    await connection.query('ALTER TABLE users ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT TRUE AFTER is_active');
  }

  const [roleColumns] = await connection.query("SHOW COLUMNS FROM users LIKE 'role'");
  if (roleColumns.length > 0 && String(roleColumns[0].Type).includes("'admin'")) {
    await connection.query("UPDATE users SET role = 'manager' WHERE role = 'admin'");
    await connection.query(
      "ALTER TABLE users MODIFY role ENUM('recorder', 'manager', 'auditor') NOT NULL DEFAULT 'recorder'"
    );
  }

  const addColumnIfMissing = async (table, column, definition) => {
    const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
    if (columns.length === 0) {
      await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    }
  };

  await addColumnIfMissing('business_days', 'opened_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER opened_by');
  await addColumnIfMissing('business_days', 'open_source', "ENUM('MANUAL', 'AUTOMATIC') NOT NULL DEFAULT 'MANUAL' AFTER opened_at");
  await addColumnIfMissing('daily_closings', 'automatically_closed', 'BOOLEAN NOT NULL DEFAULT FALSE AFTER verified_by');

  const ensureReferenceIndex = async (table, indexName) => {
    const [indexes] = await connection.query(`SHOW INDEX FROM \`${table}\` WHERE Key_name = ?`, [indexName]);
    if (indexes.length) return;
    const [duplicates] = await connection.query(
      `SELECT business_day_id, reference_number FROM \`${table}\`
       WHERE reference_number IS NOT NULL AND reference_number <> ''
       GROUP BY business_day_id, reference_number HAVING COUNT(*) > 1 LIMIT 1`
    );
    if (!duplicates.length) {
      await connection.query(
        `ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${indexName}\` (business_day_id, reference_number)`
      );
    } else {
      console.warn(`⚠️ Duplicate references exist in ${table}; application-level duplicate protection remains active.`);
    }
  };
  await ensureReferenceIndex('daily_incomes', 'uq_income_day_reference');
  await ensureReferenceIndex('daily_expenses', 'uq_expense_day_reference');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS business_day_schedule_overrides (
      business_date DATE PRIMARY KEY,
      override_action ENUM('OPEN', 'CLOSED') NOT NULL,
      changed_by INT NOT NULL,
      changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS business_day_reopenings (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      business_day_id INT NOT NULL,
      reopened_by INT NOT NULL,
      reason TEXT NOT NULL,
      previous_closing JSON NOT NULL,
      reopened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_day_id) REFERENCES business_days(id) ON DELETE RESTRICT,
      FOREIGN KEY (reopened_by) REFERENCES users(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS financial_record_changes (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      record_type ENUM('INCOME', 'EXPENSE') NOT NULL,
      record_id INT NOT NULL,
      business_day_id INT NOT NULL,
      changed_by INT NOT NULL,
      reason TEXT NOT NULL,
      old_values JSON NOT NULL,
      new_values JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (business_day_id) REFERENCES business_days(id) ON DELETE RESTRICT,
      FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE RESTRICT,
      INDEX idx_financial_change_record (record_type, record_id)
    ) ENGINE=InnoDB
  `);
  await connection.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_password_reset_user (user_id, expires_at)
    ) ENGINE=InnoDB
  `);
  await addColumnIfMissing('password_reset_tokens', 'code_hash', 'CHAR(64) NULL AFTER token_hash');
  await addColumnIfMissing('password_reset_tokens', 'delivery_method', "ENUM('EMAIL', 'SMS') NOT NULL DEFAULT 'EMAIL' AFTER code_hash");
  await addColumnIfMissing('password_reset_tokens', 'destination', 'VARCHAR(100) NULL AFTER delivery_method');
  await addColumnIfMissing('password_reset_tokens', 'attempts', 'INT NOT NULL DEFAULT 0 AFTER destination');
}

module.exports = {
  pool,
  query,
  transaction,
  initDb,
  migrateUserSchema
};
