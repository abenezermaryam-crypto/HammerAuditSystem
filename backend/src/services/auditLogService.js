const { query } = require('../config/database');

/**
 * IMMUTABLE AUDIT LOG SERVICE
 * Logs every security, financial, and reconciliation event for compliance and traceability.
 */
async function logAudit({
  userId,
  action,
  entityName,
  entityId,
  oldValues = null,
  newValues = null,
  reason = null,
  req = null
}) {
  try {
    const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
    const userAgent = req?.headers ? req.headers['user-agent'] : null;

    const oldJson = oldValues ? JSON.stringify(oldValues) : null;
    const newJson = newValues ? JSON.stringify(newValues) : null;

    await query(
      `INSERT INTO audit_logs 
        (user_id, action, entity_name, entity_id, old_values, new_values, reason, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        action,
        entityName,
        String(entityId),
        oldJson,
        newJson,
        reason,
        ipAddress,
        userAgent
      ]
    );
  } catch (err) {
    console.error('⚠️ Failed to write audit log:', err.message);
    // Non-blocking for business queries, but logged to stderr
  }
}

module.exports = {
  logAudit
};
