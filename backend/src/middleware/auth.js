const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { getJwtSecret } = require('../config/security');
const JWT_SECRET = getJwtSecret();

// Middleware to authenticate JWT token
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token required. Please login.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch user from DB to ensure still active and valid
    const rows = await query(
      'SELECT id, username, email, full_name, phone_number, role, is_active, is_approved FROM users WHERE id = ?',
      [decoded.id]
    );
    if (!rows || rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid session. User not found.'
      });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'Account is deactivated. Contact your manager.'
      });
    }

    if (!user.is_approved) {
      return res.status(403).json({
        success: false,
        error: 'Account is awaiting Manager approval.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.code === 'ER_BAD_DB_ERROR') {
      return res.status(503).json({
        success: false,
        error: 'Database is not initialized. Run "npm run db:init" from the backend directory, then restart the API.'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Token expired or invalid. Please login again.'
    });
  }
}

// Middleware to authorize specific roles
function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthenticated access.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access Denied. Role '${req.user.role}' lacks permission for this financial action. Allowed roles: [${allowedRoles.join(', ')}]`
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  authorize
};
