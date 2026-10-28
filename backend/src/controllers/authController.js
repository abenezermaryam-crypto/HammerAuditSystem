const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { query, transaction } = require('../config/database');
const { logAudit } = require('../services/auditLogService');
const { getJwtSecret } = require('../config/security');
const { validateUserInput, isStrongPassword, PASSWORD_REQUIREMENT } = require('../services/userValidation');
const JWT_SECRET = getJwtSecret();
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Helper: Extract only digits from phone number
function normalizeDigits(phone) {
  if (typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

// Helper: Mask email or phone number for user privacy
function maskDestination(dest, method) {
  if (!dest) return '';
  if (method === 'EMAIL') {
    const [local, domain] = dest.split('@');
    if (!domain) return dest;
    const maskedLocal = local.length > 2 ? `${local[0]}***${local[local.length - 1]}` : `${local[0]}***`;
    return `${maskedLocal}@${domain}`;
  }
  const digits = dest.replace(/\D/g, '');
  if (digits.length >= 4) {
    return `***-***-${digits.slice(-4)}`;
  }
  return '***' + digits;
}

// In-memory rate limiter: maximum requests within window per key
const resetRateLimiter = new Map();

function checkRateLimit(key, maxRequests = 5, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const timestamps = (resetRateLimiter.get(key) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= maxRequests) {
    const oldest = timestamps[0];
    const retryAfter = Math.ceil((windowMs - (now - oldest)) / 1000);
    return { allowed: false, retryAfter };
  }
  timestamps.push(now);
  resetRateLimiter.set(key, timestamps);
  return { allowed: true };
}

function sendGenericPasswordResetResponse(res) {
  return res.json({
    success: true,
    message: 'If the account details match an active, approved account, reset instructions will be sent to its registered email.'
  });
}

function getMailTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD }
  });
}

async function sendSmsVerification({ to, code, fullName }) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  const messageText = `Hamer Shop: Your password recovery verification code is ${code}. It expires in 15 minutes. Never share this code.`;

  if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER) {
    try {
      const authHeader = 'Basic ' + Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
      const params = new URLSearchParams({
        To: to,
        From: TWILIO_PHONE_NUMBER,
        Body: messageText
      });
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      console.log(`[SMS Gateway] Dispatched SMS to ${to}`);
      return;
    } catch (err) {
      console.error('[SMS Gateway] Twilio dispatch failed:', err.message);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Production SMS recovery is unavailable without a configured SMS provider.');
  }

  // Fallback simulator for development/local environment
  console.log(`
============================================================
📱 [HAMER SHOP SMS VERIFICATION CODE]
Recipient: ${to} (${fullName || 'Staff'})
Verification Code: ${code}
Validity: 15 Minutes
Message: "${messageText}"
============================================================
  `);
}

async function requestPasswordReset(req, res) {
  const clientIp = req.ip || req.connection?.remoteAddress || 'unknown_ip';
  const { username, email, identifier, phone_number } = req.body || {};

  const rawUsername = typeof username === 'string' ? username.trim() : '';
  const rawEmail = typeof email === 'string' ? email.trim() : '';
  const rawPhone = typeof phone_number === 'string' ? phone_number.trim() : '';
  const rawIdentifier = typeof identifier === 'string' ? identifier.trim() : '';
  const genericResponse = () => sendGenericPasswordResetResponse(res);

  // Rate limit by IP
  const ipLimit = checkRateLimit(`ip_${clientIp}`, 5, 15 * 60 * 1000);
  if (!ipLimit.allowed) {
    return res.status(429).json({
      success: false,
      error: `Too many password reset requests. Please wait ${ipLimit.retryAfter} seconds before trying again.`
    });
  }

  // Rate limit by account key
  const accountKey = (rawUsername || rawEmail || rawIdentifier || rawPhone || clientIp).toLowerCase();
  const idLimit = checkRateLimit(`id_${accountKey}`, 5, 15 * 60 * 1000);
  if (!idLimit.allowed) {
    return res.status(429).json({
      success: false,
      error: `Too many password reset requests for this account. Please wait ${idLimit.retryAfter} seconds before trying again.`
    });
  }

  if (process.env.NODE_ENV === 'production'
    && (rawPhone || (!rawIdentifier.includes('@') && normalizeDigits(rawIdentifier).length >= 7))) {
    return genericResponse();
  }

  let matchedUser = null;
  let deliveryMethod = 'EMAIL';

  try {
    // 1. Primary path: Check both username and email (Requirement: "please check the emaile and user name. the verification code must be sent by email")
    if (rawUsername && (rawEmail || rawIdentifier.includes('@'))) {
      const emailInput = (rawEmail || rawIdentifier).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput) || emailInput.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid registered email address (up to 100 characters).'
        });
      }

      // Check whether user exists by username
      const rows = await query('SELECT * FROM users WHERE LOWER(username) = ? LIMIT 1', [rawUsername.toLowerCase()]);
      if (rows.length === 0) {
        return genericResponse();
      }

      const candidate = rows[0];
      // Verify email matches the user's registered email
      if (!candidate.email || candidate.email.toLowerCase() !== emailInput) {
        return genericResponse();
      }

      matchedUser = candidate;
      deliveryMethod = 'EMAIL';
    } else if (rawUsername && !rawEmail && !rawPhone && !rawIdentifier) {
      // Username provided alone without email
      return res.status(400).json({
        success: false,
        error: 'Please enter both your username and registered email address.'
      });
    } else if (!rawUsername && (rawEmail || rawIdentifier.includes('@'))) {
      // Email provided alone without username
      const emailInput = (rawEmail || rawIdentifier).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput) || emailInput.length > 100) {
        return res.status(400).json({
          success: false,
          error: 'Please enter a valid registered email address.'
        });
      }

      const rows = await query('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1', [emailInput]);
      if (rows.length === 0) {
        return genericResponse();
      }
      matchedUser = rows[0];
      deliveryMethod = 'EMAIL';
    } else if (rawPhone || (!rawIdentifier.includes('@') && normalizeDigits(rawIdentifier).length >= 7)) {
      // Phone fallback
      const phoneInput = rawPhone || rawIdentifier;
      const inputDigits = normalizeDigits(phoneInput);
      if (inputDigits.length < 7 || inputDigits.length > 15) {
        return res.status(400).json({
          success: false,
          error: 'Enter a valid registered phone number with 7 to 15 digits.'
        });
      }

      if (rawUsername) {
        const rows = await query('SELECT * FROM users WHERE LOWER(username) = ? LIMIT 1', [rawUsername.toLowerCase()]);
        if (rows.length === 0) {
          return genericResponse();
        }
        const candidate = rows[0];
        const candDigits = normalizeDigits(candidate.phone_number || '');
        if (candDigits !== inputDigits && !candDigits.endsWith(inputDigits.slice(-9))) {
          return genericResponse();
        }
        matchedUser = candidate;
      } else {
        const rows = await query('SELECT * FROM users WHERE phone_number = ? LIMIT 1', [phoneInput]);
        if (rows.length > 0) {
          matchedUser = rows[0];
        } else {
          const allUsers = await query('SELECT * FROM users WHERE phone_number IS NOT NULL');
          for (const u of allUsers) {
            const uDigits = normalizeDigits(u.phone_number);
            if (uDigits === inputDigits || (inputDigits.length >= 9 && uDigits.endsWith(inputDigits.slice(-9)))) {
              matchedUser = u;
              break;
            }
          }
        }
      }
      deliveryMethod = 'SMS';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Please enter your username and registered email address.'
      });
    }

    if (!matchedUser) {
      return genericResponse();
    }

    // Preserve approval workflow and deactivated account status
    if (!matchedUser.is_active) {
      return genericResponse();
    }

    if (!matchedUser.is_approved) {
      return genericResponse();
    }

    // Generate secure time-limited token and 6-digit verification code (15 minutes)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const verificationCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');

    // Invalidate previous unused tokens for this user
    await query(
      'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL',
      [matchedUser.id]
    );

    const destination = deliveryMethod === 'EMAIL' ? matchedUser.email : matchedUser.phone_number;

    try {
      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, code_hash, delivery_method, destination, expires_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))`,
        [matchedUser.id, tokenHash, codeHash, deliveryMethod, destination]
      );
    } catch {
      await query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))`,
        [matchedUser.id, tokenHash]
      );
    }

    await logAudit({
      userId: matchedUser.id,
      action: 'PASSWORD_RESET_REQUESTED',
      entityName: 'users',
      entityId: matchedUser.id,
      reason: `Password reset requested for @${matchedUser.username} via ${deliveryMethod} to ${maskDestination(destination, deliveryMethod)}`,
      req
    });

    if (deliveryMethod === 'EMAIL') {
      const resetUrl = new URL(process.env.PASSWORD_RESET_URL || 'http://localhost:8081');
      resetUrl.searchParams.set('resetToken', rawToken);
      const transport = getMailTransport();
      if (transport) {
        try {
          await transport.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: matchedUser.email,
            subject: 'Hamer Shop - Password Recovery Verification Code',
            text: `Hello ${matchedUser.full_name} (@${matchedUser.username}),\n\nYour 6-digit password recovery verification code is: ${verificationCode}\n\nThis verification code expires in 15 minutes.\n\nAlternatively, you can use this secure reset link:\n${resetUrl.toString()}\n\nIf you did not request this, please contact your Manager immediately.`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #E2E8F0; border-radius: 12px; background-color: #FFFFFF;">
                <h2 style="color: #1E3A8A; margin-top: 0;">ሐመር ሱቅ / HAMER SHOP</h2>
                <h3 style="color: #0F172A; margin-bottom: 8px;">Password Recovery Verification</h3>
                <p style="color: #475569; font-size: 14px;">Hello <strong>${matchedUser.full_name}</strong> (@${matchedUser.username}),</p>
                <p style="color: #475569; font-size: 14px;">We received a request to recover your account password. Enter this 6-digit verification code in the app:</p>
                <div style="background-color: #F1F5F9; border: 1px dashed #38BDF8; padding: 16px; text-align: center; border-radius: 8px; font-size: 30px; font-weight: 800; letter-spacing: 6px; color: #1E3A8A; margin: 20px 0;">
                  ${verificationCode}
                </div>
                <p style="color: #64748B; font-size: 13px;">This code expires in <strong>15 minutes</strong>.</p>
                <p style="color: #475569; font-size: 13px;">Or click the direct reset link below:</p>
                <p><a href="${resetUrl.toString()}" style="color: #0284C7; font-weight: 600; word-break: break-all;">${resetUrl.toString()}</a></p>
                <hr style="border: none; border-top: 1px solid #E2E8F0; margin: 24px 0;" />
                <p style="color: #94A3B8; font-size: 11px;">If you did not request this recovery, ignore this email or notify your shop Manager.</p>
              </div>
            `
          });
          if (process.env.NODE_ENV !== 'production') console.log(`[Email Gateway] Successfully dispatched verification code to ${matchedUser.email}`);
        } catch (mailErr) {
          console.warn('[Email Warning] SMTP transport error:', mailErr.message);
        }
      }

      if (process.env.NODE_ENV !== 'production') console.log(`
============================================================
📧 [HAMER SHOP EMAIL VERIFICATION CODE]
Recipient Email: ${matchedUser.email}
Account Username: @${matchedUser.username} (${matchedUser.full_name})
Verification Code: ${verificationCode}
Validity: 15 Minutes
Reset Link: ${resetUrl.toString()}
============================================================
      `);
    } else {
      await sendSmsVerification({
        to: matchedUser.phone_number,
        code: verificationCode,
        fullName: matchedUser.full_name
      });
    }

    const masked = maskDestination(destination, deliveryMethod);
    const friendlyMsg = deliveryMethod === 'SMS'
      ? `A 6-digit verification code has been sent via SMS to your registered phone number (${masked}).`
      : `A 6-digit verification code has been sent to your registered email (${masked}).`;

    if (process.env.NODE_ENV !== 'production') {
      return res.json({
        success: true,
        message: friendlyMsg,
        delivery_method: deliveryMethod,
        destination: masked,
        username: matchedUser.username,
        email: matchedUser.email,
        identifier: deliveryMethod === 'EMAIL' ? matchedUser.email : matchedUser.phone_number,
        expires_in_minutes: 15,
        dev_code: verificationCode,
        reset_token: deliveryMethod === 'EMAIL' ? rawToken : undefined
      });
    }
    return genericResponse();
  } catch (err) {
    console.error('Password reset request error:', err);
    return res.status(500).json({ success: false, error: 'Server error processing password recovery request.' });
  }
}

async function verifyResetCode(req, res) {
  const { identifier, username, email, code, token } = req.body || {};
  if (!code && !token) {
    return res.status(400).json({ success: false, error: 'Verification code or reset token is required.' });
  }

  try {
    let tokenRow = null;
    if (token && /^[a-f0-9]{64}$/i.test(token)) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      let sql = `SELECT t.*, u.username, u.email, u.phone_number, u.role, u.is_active, u.is_approved
         FROM password_reset_tokens t
         JOIN users u ON t.user_id = u.id
         WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP()`;
      const params = [tokenHash];
      if (username && typeof username === 'string' && username.trim()) {
        sql += ' AND LOWER(u.username) = ?';
        params.push(username.trim().toLowerCase());
      }
      if (email && typeof email === 'string' && email.trim()) {
        sql += ' AND LOWER(u.email) = ?';
        params.push(email.trim().toLowerCase());
      }
      sql += ' LIMIT 1';
      const rows = await query(sql, params);
      if (rows.length > 0) tokenRow = rows[0];
    } else if (code) {
      const trimmedCode = String(code).trim();
      const codeHash = crypto.createHash('sha256').update(trimmedCode).digest('hex');
      let sql = `SELECT t.*, u.username, u.email, u.phone_number, u.role, u.is_active, u.is_approved
         FROM password_reset_tokens t
         JOIN users u ON t.user_id = u.id
         WHERE t.code_hash = ? AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP()`;
      const params = [codeHash];
      if (username && typeof username === 'string' && username.trim()) {
        sql += ' AND LOWER(u.username) = ?';
        params.push(username.trim().toLowerCase());
      }
      if (email && typeof email === 'string' && email.trim()) {
        sql += ' AND LOWER(u.email) = ?';
        params.push(email.trim().toLowerCase());
      }
      sql += ' ORDER BY t.created_at DESC LIMIT 1';
      const rows = await query(sql, params);
      if (rows.length > 0) tokenRow = rows[0];
    }

    if (!tokenRow) {
      return res.status(400).json({
        success: false,
        error: 'The verification code or reset link is invalid, expired, or already used.'
      });
    }

    if (!tokenRow.is_active) {
      return res.status(403).json({ success: false, error: 'This account is deactivated.' });
    }

    if (!tokenRow.is_approved) {
      return res.status(403).json({ success: false, error: 'This account is pending Manager approval.' });
    }

    return res.json({
      success: true,
      message: 'Verification code confirmed. You may now enter your new password.'
    });
  } catch (err) {
    console.error('Verify reset code error:', err);
    return res.status(500).json({ success: false, error: 'Server error verifying reset code.' });
  }
}

async function resetPassword(req, res) {
  const { token, code, identifier, username, email, new_password } = req.body || {};

  if (!token && !code) {
    return res.status(400).json({
      success: false,
      error: 'A valid verification code or reset token is required.'
    });
  }

  if (typeof new_password !== 'string' || !isStrongPassword(new_password)) {
    return res.status(400).json({
      success: false,
      error: typeof new_password === 'string' ? PASSWORD_REQUIREMENT : 'A new strong password is required.'
    });
  }

  try {
    let tokenRow = null;

    if (token && /^[a-f0-9]{64}$/i.test(token)) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      let sql = `SELECT t.*, u.id as uid, u.role, u.is_active, u.is_approved
         FROM password_reset_tokens t
         JOIN users u ON t.user_id = u.id
         WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP()`;
      const params = [tokenHash];
      if (username && typeof username === 'string' && username.trim()) {
        sql += ' AND LOWER(u.username) = ?';
        params.push(username.trim().toLowerCase());
      }
      if (email && typeof email === 'string' && email.trim()) {
        sql += ' AND LOWER(u.email) = ?';
        params.push(email.trim().toLowerCase());
      }
      sql += ' LIMIT 1';
      const rows = await query(sql, params);
      if (rows.length > 0) tokenRow = rows[0];
    } else if (code) {
      const trimmedCode = String(code).trim();
      const codeHash = crypto.createHash('sha256').update(trimmedCode).digest('hex');
      let sql = `SELECT t.*, u.id as uid, u.role, u.is_active, u.is_approved
         FROM password_reset_tokens t
         JOIN users u ON t.user_id = u.id
         WHERE t.code_hash = ? AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP()`;
      const params = [codeHash];
      if (username && typeof username === 'string' && username.trim()) {
        sql += ' AND LOWER(u.username) = ?';
        params.push(username.trim().toLowerCase());
      }
      if (email && typeof email === 'string' && email.trim()) {
        sql += ' AND LOWER(u.email) = ?';
        params.push(email.trim().toLowerCase());
      }
      sql += ' ORDER BY t.created_at DESC LIMIT 1';
      const rows = await query(sql, params);
      if (rows.length > 0) tokenRow = rows[0];
    }

    if (!tokenRow) {
      return res.status(400).json({
        success: false,
        error: 'This verification code or reset link is invalid, expired, or already used.'
      });
    }

    // REQUIREMENT: Preserve user roles and account approval status
    if (!tokenRow.is_active) {
      return res.status(403).json({ success: false, error: 'This account is deactivated.' });
    }

    if (!tokenRow.is_approved) {
      return res.status(403).json({ success: false, error: 'Account is pending Manager approval.' });
    }

    const passwordHash = await bcrypt.hash(new_password, 12);
    const resetApplied = await transaction(async (connection) => {
      const [claimedToken] = await connection.execute(
        `UPDATE password_reset_tokens
         SET used_at = UTC_TIMESTAMP()
         WHERE id = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()`,
        [tokenRow.id]
      );
      if (claimedToken.affectedRows !== 1) return false;

      const [updatedUser] = await connection.execute(
        'UPDATE users SET password_hash = ? WHERE id = ? AND is_active = TRUE AND is_approved = TRUE',
        [passwordHash, tokenRow.user_id]
      );
      if (updatedUser.affectedRows !== 1) {
        const error = new Error('Account is no longer eligible for password recovery.');
        error.status = 409;
        throw error;
      }

      await connection.execute(
        'UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND used_at IS NULL',
        [tokenRow.user_id]
      );
      return true;
    });
    if (!resetApplied) {
      return res.status(400).json({
        success: false,
        error: 'This verification code or reset link is invalid, expired, or already used.'
      });
    }

    await logAudit({
      userId: tokenRow.user_id,
      action: 'PASSWORD_RESET_COMPLETED',
      entityName: 'users',
      entityId: tokenRow.user_id,
      reason: `Password reset completed via ${tokenRow.delivery_method || 'VERIFICATION_CODE'}`,
      req
    });

    return res.json({
      success: true,
      message: 'Password reset successfully! You can now sign in with your new password.'
    });
  } catch (err) {
    console.error('Password reset completion error:', err);
    return res.status(500).json({ success: false, error: 'Server error completing password reset.' });
  }
}

async function login(req, res) {
  try {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const loginName = username.trim().toLowerCase();
    const rows = await query('SELECT * FROM users WHERE username = ? OR email = ?', [loginName, loginName]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await logAudit({
        userId: user.id,
        action: 'FAILED_LOGIN_ATTEMPT',
        entityName: 'users',
        entityId: user.id,
        reason: 'Incorrect password entered',
        req
      });
      return res.status(401).json({ success: false, error: 'Invalid credentials.' });
    }

    if (!user.is_active) {
      return res.status(403).json({ success: false, error: 'Account is deactivated.' });
    }

    if (!user.is_approved) {
      return res.status(403).json({ success: false, error: 'Your account is pending Manager approval.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    await logAudit({
      userId: user.id,
      action: 'USER_LOGIN',
      entityName: 'users',
      entityId: user.id,
      reason: 'Successful authentication',
      req
    });

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone_number: user.phone_number,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    if (err.code === 'ER_BAD_DB_ERROR') {
      return res.status(503).json({
        success: false,
        error: 'Database is not initialized. Run "npm run db:init" from the backend directory, then restart the API.'
      });
    }
    return res.status(500).json({ success: false, error: 'Server error during login.' });
  }
}

async function register(req, res) {
  const { errors, values } = validateUserInput(req.body, { allowedRoles: ['recorder', 'auditor'] });
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: errors[0] });
  }

  try {
    const passwordHash = await bcrypt.hash(values.password, 12);
    const result = await query(
      `INSERT INTO users (username, email, password_hash, full_name, phone_number, role, is_active, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, FALSE)`,
      [values.username, values.email, passwordHash, values.full_name, values.phone_number, values.role]
    );

    await logAudit({
      userId: null,
      action: 'USER_REGISTRATION',
      entityName: 'users',
      entityId: result.insertId,
      newValues: { username: values.username, role: values.role },
      reason: 'Public registration submitted for Manager approval',
      req
    });

    return res.status(201).json({
      success: true,
      message: 'Registration received. Your account will be available after Manager approval.'
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'That username or email address is already registered.' });
    }
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, error: 'Server error creating account.' });
  }
}

async function getMe(req, res) {
  try {
    const rows = await query(
      'SELECT id, username, email, full_name, phone_number, role FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('Get current user error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving user.' });
  }
}

async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body || {};
    if (typeof current_password !== 'string' || !current_password
      || typeof new_password !== 'string' || !new_password) {
      return res.status(400).json({ success: false, error: 'Current password and new password are required.' });
    }

    if (!isStrongPassword(new_password)) {
      return res.status(400).json({ success: false, error: PASSWORD_REQUIREMENT });
    }

    const rows = await query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Current password does not match.' });
    }

    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(new_password, salt);

    await query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    await logAudit({
      userId: req.user.id,
      action: 'PASSWORD_CHANGED',
      entityName: 'users',
      entityId: req.user.id,
      reason: 'User independently changed their password',
      req
    });

    return res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ success: false, error: 'Server error changing password.' });
  }
}

module.exports = {
  register,
  login,
  getMe,
  changePassword,
  requestPasswordReset,
  verifyResetCode,
  resetPassword
};
