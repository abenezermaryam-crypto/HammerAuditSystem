const ROLES = ['recorder', 'auditor', 'manager'];
const PASSWORD_REQUIREMENT =
  'Password must be 10-72 bytes and include lowercase, uppercase, a number, and a symbol.';

function isStrongPassword(password) {
  return typeof password === 'string'
    && Buffer.byteLength(password, 'utf8') <= 72
    && password.length >= 10
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9\s]/.test(password);
}

function validateUserInput(input, { allowedRoles = ROLES, requirePassword = true } = {}) {
  const errors = [];
  const full_name = typeof input?.full_name === 'string' ? input.full_name.trim() : '';
  const phone_number = typeof input?.phone_number === 'string' ? input.phone_number.trim() : '';
  const username = typeof input?.username === 'string' ? input.username.trim().toLowerCase() : '';
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const role = typeof input?.role === 'string' ? input.role.trim().toLowerCase() : '';
  const password = typeof input?.password === 'string' ? input.password : '';

  if (input?.password !== undefined && typeof input.password !== 'string') {
    errors.push('Password must be text.');
  }
  if (full_name.length < 2 || full_name.length > 100) {
    errors.push('Full name must be between 2 and 100 characters.');
  }
  const phoneDigits = phone_number.replace(/\D/g, '');
  if (!/^\+?[0-9()\-\s]{7,25}$/.test(phone_number) || phoneDigits.length < 7 || phoneDigits.length > 15) {
    errors.push('Enter a valid phone number with 7 to 15 digits.');
  }
  if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
    errors.push('Username must be 3-50 characters using letters, numbers, dots, underscores, or hyphens.');
  }
  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Enter a valid email address (up to 100 characters).');
  }
  if (!allowedRoles.includes(role)) {
    errors.push(`Role must be one of: ${allowedRoles.join(', ')}.`);
  }
  if ((requirePassword || password) && !isStrongPassword(password)) {
    errors.push(PASSWORD_REQUIREMENT);
  }

  return {
    errors,
    values: { full_name, phone_number, username, email, role, password }
  };
}

module.exports = {
  ROLES,
  PASSWORD_REQUIREMENT,
  isStrongPassword,
  validateUserInput
};
