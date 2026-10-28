const { pool } = require('../config/database');

async function resetRecordedData() {
  const tablesToClear = [
    'audit_logs',
    'adjustments',
    'discrepancies',
    'three_day_audits',
    'financial_record_changes',
    'daily_closings',
    'daily_expenses',
    'daily_incomes',
    'business_day_reopenings',
    'business_day_schedule_overrides',
    'business_days',
    'password_reset_tokens',
  ];

  console.log('Clearing recorded operational and test data...');

  await pool.query('SET FOREIGN_KEY_CHECKS = 0;');

  for (const table of tablesToClear) {
    try {
      await pool.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`✅ Cleared ${table}`);
    } catch (err) {
      console.warn(`⚠️ Could not truncate ${table} (${err.message}). Trying DELETE...`);
      try {
        await pool.query(`DELETE FROM \`${table}\``);
        console.log(`✅ Emptied ${table}`);
      } catch (delErr) {
        console.error(`❌ Failed to clear ${table}:`, delErr.message);
      }
    }
  }

  await pool.query('SET FOREIGN_KEY_CHECKS = 1;');

  console.log('\n--- VERIFYING TABLE COUNTS AFTER RESET ---');
  for (const table of tablesToClear) {
    const [rows] = await pool.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
    console.log(`- ${table}: ${rows[0].cnt} records`);
  }

  const [users] = await pool.query('SELECT COUNT(*) as cnt FROM users');
  console.log(`- users (preserved): ${users[0].cnt} accounts active`);
  console.log('\n✨ Database is clean and ready for permanent production deployment!');
  process.exit(0);
}

resetRecordedData().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
