const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const { logAudit } = require('../services/auditLogService');
const { isStrongPassword, PASSWORD_REQUIREMENT, validateUserInput } = require('../services/userValidation');

async function listUsers(req, res) {
  try {
    const users = await query(
      `SELECT id, username, email, full_name, phone_number, role, is_active, is_approved, created_at
       FROM users ORDER BY created_at DESC, id DESC`
    );
    return res.json({ success: true, users });
  } catch (err) {
    console.error('List users error:', err);
    return res.status(500).json({ success: false, error: 'Server error retrieving users.' });
  }
}

async function createUser(req, res) {
  const { errors, values } = validateUserInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: errors[0] });
  }

  try {
    const passwordHash = await bcrypt.hash(values.password, 12);
    const result = await query(
      `INSERT INTO users (username, email, password_hash, full_name, phone_number, role, is_active, is_approved)
       VALUES (?, ?, ?, ?, ?, ?, TRUE, TRUE)`,
      [values.username, values.email, passwordHash, values.full_name, values.phone_number, values.role]
    );
    await logAudit({
      userId: req.user.id,
      action: 'MANAGER_CREATED_USER',
      entityName: 'users',
      entityId: result.insertId,
      newValues: { username: values.username, role: values.role },
      req
    });
    return res.status(201).json({ success: true, message: 'User created.', userId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'That username or email address is already in use.' });
    }
    console.error('Create user error:', err);
    return res.status(500).json({ success: false, error: 'Server error creating user.' });
  }
}

async function updateOwnProfile(req, res) {
  const { errors, values } = validateUserInput(
    { ...req.body, role: 'manager' },
    { requirePassword: false }
  );
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: errors[0] });
  }
  if (req.body?.password !== undefined) {
    return res.status(400).json({ success: false, error: 'Use Change Password to update your password.' });
  }

  try {
    await query(
      'UPDATE users SET full_name = ?, phone_number = ?, username = ?, email = ? WHERE id = ? AND role = ?',
      [values.full_name, values.phone_number, values.username, values.email, req.user.id, 'manager']
    );
    const [user] = await query(
      'SELECT id, username, email, full_name, phone_number, role FROM users WHERE id = ?',
      [req.user.id]
    );
    await logAudit({
      userId: req.user.id,
      action: 'MANAGER_UPDATED_OWN_PROFILE',
      entityName: 'users',
      entityId: req.user.id,
      newValues: {
        username: values.username,
        email: values.email,
        full_name: values.full_name,
        phone_number: values.phone_number
      },
      req
    });
    return res.json({ success: true, message: 'Profile updated.', user });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'That username or email address is already in use.' });
    }
    console.error('Update own profile error:', err);
    return res.status(500).json({ success: false, error: 'Server error updating profile.' });
  }
}

async function updateUser(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ success: false, error: 'Invalid user id.' });
  }

  const { errors, values } = validateUserInput(req.body, { requirePassword: false });
  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: errors[0] });
  }
  if (req.body.password && typeof req.body.password !== 'string') {
    return res.status(400).json({ success: false, error: 'Password must be text.' });
  }
  if (req.body.password) {
    if (!isStrongPassword(req.body.password)) {
      return res.status(400).json({ success: false, error: PASSWORD_REQUIREMENT });
    }
  }

  try {
    const currentRows = await query('SELECT id, role, is_active FROM users WHERE id = ?', [id]);
    if (currentRows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    const current = currentRows[0];
    if (id === req.user.id && values.role !== 'manager') {
      return res.status(400).json({ success: false, error: 'You cannot change your own Manager role.' });
    }
    if (current.role === 'manager' && values.role !== 'manager') {
      const [managers] = await query(
        'SELECT COUNT(*) AS count FROM users WHERE role = ? AND is_active = TRUE AND is_approved = TRUE',
        ['manager']
      );
      if (managers.count <= 1) {
        return res.status(409).json({ success: false, error: 'The last active Manager cannot be demoted.' });
      }
    }

    const updateValues = [
      values.full_name, values.phone_number, values.username, values.email, values.role
    ];
    let updateSql = 'UPDATE users SET full_name = ?, phone_number = ?, username = ?, email = ?, role = ?';
    if (req.body.password) {
      updateSql += ', password_hash = ?';
      updateValues.push(await bcrypt.hash(req.body.password, 12));
    }
    updateSql += ' WHERE id = ?';
    updateValues.push(id);
    await query(updateSql, updateValues);

    await logAudit({
      userId: req.user.id,
      action: 'MANAGER_UPDATED_USER',
      entityName: 'users',
      entityId: id,
      oldValues: { role: current.role },
      newValues: { username: values.username, role: values.role },
      req
    });
    return res.json({ success: true, message: 'User updated.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'That username or email address is already in use.' });
    }
    console.error('Update user error:', err);
    return res.status(500).json({ success: false, error: 'Server error updating user.' });
  }
}

async function approveUser(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ success: false, error: 'Invalid user id.' });
  }

  try {
    const result = await query('UPDATE users SET is_approved = TRUE WHERE id = ? AND is_active = TRUE', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Active user not found.' });
    }
    await logAudit({
      userId: req.user.id,
      action: 'MANAGER_APPROVED_USER',
      entityName: 'users',
      entityId: id,
      newValues: { is_approved: true },
      req
    });
    return res.json({ success: true, message: 'User approved.' });
  } catch (err) {
    console.error('Approve user error:', err);
    return res.status(500).json({ success: false, error: 'Server error approving user.' });
  }
}

async function setUserActive(req, res) {
  const id = Number(req.params.id);
  const isActive = req.method !== 'DELETE';
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ success: false, error: 'Invalid user id.' });
  }
  if (id === req.user.id && !isActive) {
    return res.status(400).json({ success: false, error: 'You cannot deactivate your own account.' });
  }

  try {
    const users = await query('SELECT id, role, is_active FROM users WHERE id = ?', [id]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }
    if (!isActive && users[0].role === 'manager' && users[0].is_active) {
      const [managers] = await query(
        'SELECT COUNT(*) AS count FROM users WHERE role = ? AND is_active = TRUE AND is_approved = TRUE',
        ['manager']
      );
      if (managers.count <= 1) {
        return res.status(409).json({ success: false, error: 'The last active Manager cannot be removed.' });
      }
    }
    await query('UPDATE users SET is_active = ? WHERE id = ?', [isActive, id]);
    await logAudit({
      userId: req.user.id,
      action: isActive ? 'MANAGER_REACTIVATED_USER' : 'MANAGER_DEACTIVATED_USER',
      entityName: 'users',
      entityId: id,
      newValues: { is_active: isActive },
      req
    });
    return res.json({ success: true, message: isActive ? 'User reactivated.' : 'User removed.' });
  } catch (err) {
    console.error('Set user status error:', err);
    return res.status(500).json({ success: false, error: 'Server error updating user status.' });
  }
}

module.exports = {
  listUsers,
  createUser,
  updateOwnProfile,
  updateUser,
  approveUser,
  setUserActive
};
