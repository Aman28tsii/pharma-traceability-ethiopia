import pool from '../config/database.js';

export const logAction = async (userId, action, entityType, entityId, oldData, newData, ipAddress) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, old_data, new_data, ip_address) 
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, action, entityType, entityId, oldData, newData, ipAddress]
    );
  } catch (err) {
    console.error('Audit log error:', err);
  }
};