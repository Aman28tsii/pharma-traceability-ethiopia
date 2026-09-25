// server/middleware/audit.js
// Pure helper. Receives the pool from the caller so there is only one
// connection pool in the app and it is the same one used by server/index.js.
//
// Usage from server/index.js:
//   import { logAction } from './middleware/audit.js';
//   ...
//   await logAction(pool, {
//     userId: req.user?.id,
//     organizationId: req.user?.organization_id,
//     action: 'CREATE',
//     entityType: 'product',
//     entityId: newProduct.id,
//     newData: newProduct,
//     ipAddress: req.ip,
//   });

export const logAction = async (pool, {
  userId,
  organizationId,
  action,
  entityType,
  entityId,
  oldData,
  newData,
  ipAddress,
}) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs 
        (user_id, organization_id, action, entity_type, entity_id, old_data, new_data, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        userId || null,
        organizationId,
        action,
        entityType || null,
        entityId || null,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        ipAddress || null,
      ]
    );
  } catch (err) {
    // Never let an audit write break the caller
    console.error('Audit log error:', err.message);
  }
};