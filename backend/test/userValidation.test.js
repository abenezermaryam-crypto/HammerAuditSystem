const test = require('node:test');
const assert = require('node:assert/strict');
const { isStrongPassword, validateUserInput } = require('../src/services/userValidation');

const validRegistration = {
  full_name: 'Taylor Morgan',
  phone_number: '+1 (555) 123-4567',
  username: 'Taylor_M',
  email: 'Taylor@example.com',
  password: 'StrongPass9!',
  role: 'auditor'
};

test('accepts valid registration and normalizes unique identifiers', () => {
  const result = validateUserInput(validRegistration, { allowedRoles: ['recorder', 'auditor'] });
  assert.deepEqual(result.errors, []);
  assert.equal(result.values.username, 'taylor_m');
  assert.equal(result.values.email, 'taylor@example.com');
});

test('allows Manager assignment but rejects Manager and unknown roles from public registration', () => {
  assert.deepEqual(validateUserInput({ ...validRegistration, role: 'manager' }).errors, []);
  assert.match(
    validateUserInput({ ...validRegistration, role: 'manager' }, { allowedRoles: ['recorder', 'auditor'] }).errors[0],
    /Role must be one of/
  );
  assert.match(
    validateUserInput({ ...validRegistration, role: 'admin' }).errors[0],
    /Role must be one of/
  );
});

test('enforces strong password character requirements and bcrypt byte limit', () => {
  assert.equal(isStrongPassword('StrongPass9!'), true);
  assert.equal(isStrongPassword('weakpassword'), false);
  assert.equal(isStrongPassword(`Aa1!${'x'.repeat(69)}`), false);
});

test('rejects malformed phone numbers, usernames, and email addresses', () => {
  const result = validateUserInput({
    ...validRegistration,
    phone_number: '123',
    username: 'bad username',
    email: 'not-an-email'
  });
  assert.equal(result.errors.length, 3);
});

test('allows profile edits without a password but validates one when supplied', () => {
  assert.deepEqual(validateUserInput(validRegistration, { requirePassword: false }).errors, []);
  assert.match(
    validateUserInput({ ...validRegistration, password: 'short' }, { requirePassword: false }).errors[0],
    /Password must be/
  );
});
