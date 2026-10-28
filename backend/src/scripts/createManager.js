const bcrypt = require('bcryptjs');
const { createInterface } = require('node:readline/promises');
const { stdin, stdout } = require('node:process');
const { pool, migrateUserSchema } = require('../config/database');
const { isStrongPassword, PASSWORD_REQUIREMENT, validateUserInput } = require('../services/userValidation');

function askHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    return Promise.reject(new Error('Run this command in an interactive terminal to enter the Manager password securely.'));
  }

  return new Promise((resolve, reject) => {
    let value = '';
    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();

    const finish = (error) => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };

    const onData = (buffer) => {
      for (const byte of buffer) {
        if (byte === 3) {
          finish(new Error('Manager setup cancelled.'));
          return;
        }
        if (byte === 13 || byte === 10) {
          finish();
          return;
        }
        if (byte === 8 || byte === 127) {
          if (value.length > 0) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }
        if (byte >= 32 && byte <= 126) {
          value += String.fromCharCode(byte);
          stdout.write('*');
        }
      }
    };

    stdin.on('data', onData);
  });
}

async function main() {
  let manager;
  try {
    const prompt = createInterface({ input: stdin, output: stdout });
    manager = {
      full_name: (await prompt.question('Manager full name [Demo Manager]: ')).trim() || 'Demo Manager',
      phone_number: (await prompt.question('Phone number: ')).trim(),
      username: (await prompt.question('Username [demo.manager]: ')).trim() || 'demo.manager',
      email: (await prompt.question('Email [demo.manager@example.test]: ')).trim() || 'demo.manager@example.test',
      role: 'manager'
    };
    prompt.close();

    const validation = validateUserInput({ ...manager, password: 'TemporaryStrong9!' });
    if (validation.errors.length > 0) {
      throw new Error(validation.errors[0]);
    }

    const password = await askHidden('Choose a Manager password (input hidden): ');
    const confirmPassword = await askHidden('Confirm Manager password (input hidden): ');
    if (password !== confirmPassword) {
      throw new Error('Passwords do not match.');
    }
    if (!isStrongPassword(password)) {
      throw new Error(PASSWORD_REQUIREMENT);
    }

    await migrateUserSchema(pool);
    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      `INSERT INTO users (username, email, password_hash, full_name, phone_number, role, is_active, is_approved)
       VALUES (?, ?, ?, ?, ?, 'manager', TRUE, TRUE)`,
      [manager.username.toLowerCase(), manager.email.toLowerCase(), passwordHash, manager.full_name, manager.phone_number]
    );
    console.log(`Manager account created successfully (user id ${result.insertId}). Sign in with username "${manager.username.toLowerCase()}".`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.error('Could not create Manager: that username or email is already registered.');
    } else if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_DB_ERROR') {
      console.error('Database schema is missing. Run "npm run db:init" first, then retry "npm run manager:create".');
    } else {
      console.error('Could not create Manager:', err.message);
    }
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
