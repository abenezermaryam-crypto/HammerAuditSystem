const test = require('node:test');
const assert = require('node:assert/strict');
const { migrateUserSchema } = require('../src/config/database');

test('adds missing account columns and converts legacy administrator roles', async () => {
  const statements = [];
  const connection = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes("SHOW COLUMNS FROM users LIKE 'phone_number'")) return [[]];
      if (sql.includes("SHOW COLUMNS FROM users LIKE 'is_approved'")) return [[]];
      if (sql.includes("SHOW COLUMNS FROM users LIKE 'role'")) {
        return [[{ Type: "enum('recorder','manager','auditor','admin')" }]];
      }
      if (sql.startsWith('SHOW COLUMNS') || sql.startsWith('SHOW INDEX') || sql.startsWith('SELECT business_day_id')) return [[]];
      return [{ affectedRows: 1 }];
    }
  };

  await migrateUserSchema(connection);

  assert.ok(statements.includes('ALTER TABLE users ADD COLUMN phone_number VARCHAR(30) NULL AFTER full_name'));
  assert.ok(statements.includes(
    'ALTER TABLE users ADD COLUMN is_approved BOOLEAN NOT NULL DEFAULT TRUE AFTER is_active'
  ));
  assert.ok(statements.includes("UPDATE users SET role = 'manager' WHERE role = 'admin'"));
  assert.ok(statements.includes(
    "ALTER TABLE users MODIFY role ENUM('recorder', 'manager', 'auditor') NOT NULL DEFAULT 'recorder'"
  ));
  assert.ok(statements.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS password_reset_tokens')));
  assert.ok(statements.some((sql) => sql.includes('ADD UNIQUE KEY `uq_income_day_reference`')));
});

test('does not rewrite a current user schema', async () => {
  const statements = [];
  const connection = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes("SHOW COLUMNS FROM users LIKE 'role'")) {
        return [[{ Type: "enum('recorder','manager','auditor')" }]];
      }
      if (sql.startsWith('SHOW COLUMNS') || sql.startsWith('SHOW INDEX')) return [[{ Field: 'present', Key_name: 'present' }]];
      if (sql.startsWith('SELECT business_day_id')) return [[]];
      return [[{ Field: 'present' }]];
    }
  };

  await migrateUserSchema(connection);

  assert.equal(statements.some((sql) => sql.startsWith('ALTER TABLE users')), false);
  assert.equal(statements.some((sql) => sql.startsWith('ALTER TABLE business_days')), false);
  assert.ok(statements.some((sql) => sql.includes('CREATE TABLE IF NOT EXISTS password_reset_tokens')));
});
