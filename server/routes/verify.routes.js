import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Verify product by scanning GS1 barcode
router.post('/', authenticateToken, async (req, res) => {
    const { serial_number, gtin } = req.body;

    if (!serial_number || !gtin) {
        return res.status(400).json({ 
            error: 'Missing required fields: serial_number and gtin' 
        });
    }

    try {
        // Query the serialized unit with product info
        const result = await pool.query(
            `SELECT 
                su.*,
                p.product_name,
                p.manufacturer,
                p.dosage_form,
                p.strength
             FROM serialized_units su
             JOIN products p ON su.gtin = p.gtin
             WHERE su.serial_number = $1 AND su.gtin = $2`,
            [serial_number, gtin]
        );

        if (result.rows.length === 0) {
            // Log suspicious scan
            await pool.query(
                `INSERT INTO scan_history (serial_number, gtin, scanned_by_gln, scan_result, ip_address) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [serial_number, gtin, req.user.gln, 'invalid', req.ip]
            );

            return res.status(404).json({
                status: 'invalid',
                message: '❌ Product not found - Possible counterfeit',
                product: null
            });
        }

        const unit = result.rows[0];
        const now = new Date();
        const expiryDate = new Date(unit.expiry_date);
        const daysToExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

        // Determine product status
        let status = 'valid';
        let message = '✅ Product is AUTHENTIC and VALID';
        let alertLevel = null;

        if (unit.status === 'recalled') {
            status = 'recalled';
            message = '⚠️ CRITICAL: Product has been RECALLED! Do not use.';
            alertLevel = 'critical';
        } else if (expiryDate < now) {
            status = 'expired';
            message = '❌ Product has EXPIRED - Destroy or return to supplier';
            alertLevel = 'high';
        } else if (daysToExpiry <= 30) {
            status = 'warning';
            message = `⚠️ Warning: Product expires in ${daysToExpiry} days`;
            alertLevel = 'medium';
        } else if (daysToExpiry <= 90) {
            status = 'notice';
            message = `ℹ️ Notice: Product expires in ${daysToExpiry} days`;
            alertLevel = 'low';
        }

        if (unit.current_owner_gln && unit.current_owner_gln !== req.user.gln) {
            message += ` - Note: Product belongs to another facility`;
        }

        // Log successful scan
        await pool.query(
            `INSERT INTO trace_events (serial_number, event_type, from_gln, to_gln, user_id) 
             VALUES ($1, $2, $3, $4, $5)`,
            [serial_number, 'verify', null, req.user.gln, req.user.id]
        );

        // Update last scanned timestamp
        await pool.query(
            `UPDATE serialized_units SET last_scanned_at = NOW() WHERE id = $1`,
            [unit.id]
        );

        res.json({
            status,
            message,
            alert_level: alertLevel,
            product: {
                id: unit.id,
                name: unit.product_name,
                gtin: unit.gtin,
                serial_number: unit.serial_number,
                batch_number: unit.batch_number,
                expiry_date: unit.expiry_date,
                days_to_expiry: daysToExpiry,
                current_status: unit.status,
                current_owner: unit.current_owner_gln,
                manufacturer: unit.manufacturer,
                dosage_form: unit.dosage_form,
                strength: unit.strength
            },
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Verification error:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// Bulk verify (for batch scanning)
router.post('/bulk', authenticateToken, async (req, res) => {
    const { products } = req.body; // Array of {serial_number, gtin}

    if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: 'Products array required' });
    }

    try {
        const results = [];
        for (const product of products) {
            const verifyResult = await pool.query(
                `SELECT su.*, p.product_name 
                 FROM serialized_units su
                 JOIN products p ON su.gtin = p.gtin
                 WHERE su.serial_number = $1 AND su.gtin = $2`,
                [product.serial_number, product.gtin]
            );

            results.push({
                serial_number: product.serial_number,
                found: verifyResult.rows.length > 0,
                product: verifyResult.rows[0] || null
            });
        }

        res.json({ results, total_checked: products.length });
    } catch (err) {
        console.error('Bulk verification error:', err);
        res.status(500).json({ error: 'Bulk verification failed' });
    }
});

export default router;