import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const now = new Date();
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(now.getDate() + 30);

        const stats = await pool.query(`
            SELECT 
                (SELECT COUNT(*) FROM products WHERE is_active = true) as total_products,
                (SELECT COUNT(*) FROM batches) as total_batches,
                (SELECT COUNT(*) FROM serialized_units) as total_units,
                (SELECT COUNT(*) FROM serialized_units WHERE status = 'sold') as sold_units,
                (SELECT COUNT(*) FROM serialized_units WHERE status = 'recalled') as recalled_units,
                (SELECT COUNT(*) FROM serialized_units WHERE expiry_date < NOW()) as expired_units,
                (SELECT COUNT(*) FROM serialized_units WHERE expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days') as expiring_soon,
                (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users,
                (SELECT COUNT(*) FROM trace_events WHERE created_at >= NOW() - INTERVAL '30 days') as scans_last_30_days,
                (SELECT COUNT(*) FROM trace_events WHERE created_at >= NOW() - INTERVAL '7 days') as scans_last_7_days,
                (SELECT COALESCE(SUM(quantity), 0) FROM batches WHERE created_at >= NOW() - INTERVAL '30 days') as units_added_30d
        `);

        res.json(stats.rows[0]);
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
    }
});

// Get recent activity
router.get('/recent-activity', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                te.*,
                u.name as user_name,
                u.role as user_role,
                p.product_name
             FROM trace_events te
             LEFT JOIN users u ON te.user_id = u.id
             LEFT JOIN serialized_units su ON te.serial_number = su.serial_number
             LEFT JOIN products p ON su.gtin = p.gtin
             ORDER BY te.created_at DESC
             LIMIT 20`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Recent activity error:', err);
        res.status(500).json({ error: 'Failed to fetch recent activity' });
    }
});

// Get expiry alerts
router.get('/expiry-alerts', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                su.*,
                p.product_name,
                p.manufacturer,
                CASE 
                    WHEN su.expiry_date < NOW() THEN 'expired'
                    WHEN su.expiry_date <= NOW() + INTERVAL '30 days' THEN 'expiring_soon'
                    ELSE 'valid'
                END as alert_type,
                EXTRACT(DAY FROM (su.expiry_date - NOW())) as days_remaining
             FROM serialized_units su
             JOIN products p ON su.gtin = p.gtin
             WHERE su.expiry_date <= NOW() + INTERVAL '90 days'
             ORDER BY su.expiry_date ASC
             LIMIT 50`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Expiry alerts error:', err);
        res.status(500).json({ error: 'Failed to fetch expiry alerts' });
    }
});

export default router;