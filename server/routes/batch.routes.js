import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import QRCode from 'qrcode';

const router = express.Router();

// Generate GS1 DataMatrix compatible serial number
function generateSerialNumber(batchNumber, sequence, gtin) {
    const timestamp = Date.now().toString().slice(-8);
    const seq = sequence.toString().padStart(6, '0');
    return `${gtin.slice(-6)}${batchNumber.slice(0, 4)}${timestamp}${seq}`;
}

// Create new batch with serialized units
router.post('/', authenticateToken, requireRole(['admin', 'importer']), async (req, res) => {
    const {
        product_id,
        batch_number,
        manufacturer_date,
        expiry_date,
        quantity,
        location
    } = req.body;

    if (!product_id || !batch_number || !expiry_date || !quantity) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get product details
        const productResult = await client.query(
            'SELECT gtin, product_name FROM products WHERE id = $1',
            [product_id]
        );

        if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Product not found' });
        }

        const product = productResult.rows[0];

        // Create batch
        const batchResult = await client.query(
            `INSERT INTO batches 
             (batch_number, product_id, manufacturer_date, expiry_date, quantity, total_units, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [batch_number, product_id, manufacturer_date, expiry_date, quantity, quantity, req.user.id]
        );

        const batch = batchResult.rows[0];

        // Generate serialized units
        const serialUnits = [];
        const barcodes = [];

        for (let i = 1; i <= quantity; i++) {
            const serialNumber = generateSerialNumber(batch_number, i, product.gtin);
            
            const unitResult = await client.query(
                `INSERT INTO serialized_units 
                 (gtin, serial_number, batch_number, expiry_date, status, current_owner_gln) 
                 VALUES ($1, $2, $3, $4, $5, $6) 
                 RETURNING *`,
                [product.gtin, serialNumber, batch_number, expiry_date, 'manufactured', req.user.gln || null]
            );

            serialUnits.push(unitResult.rows[0]);

            // Generate GS1 DataMatrix barcode
            const gs1Data = `(01)${product.gtin}(21)${serialNumber}(10)${batch_number}(17)${expiry_date.replace(/-/g, '')}`;
            const qrCodeDataUrl = await QRCode.toDataURL(gs1Data);
            barcodes.push({ serialNumber, qrCodeDataUrl });
        }

        // Create trace event
        await client.query(
            `INSERT INTO trace_events 
             (serial_number, event_type, from_gln, to_gln, location, user_id) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [serialUnits[0].serial_number, 'manufacture', null, req.user.gln, location, req.user.id]
        );

        await client.query('COMMIT');

        res.status(201).json({
            batch,
            serial_units_count: serialUnits.length,
            serial_units: serialUnits.slice(0, 10), // First 10 samples
            barcodes: barcodes.slice(0, 5) // First 5 barcodes
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create batch error:', err);
        res.status(500).json({ error: 'Failed to create batch' });
    } finally {
        client.release();
    }
});

// Get all batches
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.*, p.product_name, p.gtin,
                    COUNT(su.id) as serialized_count,
                    SUM(CASE WHEN su.status = 'sold' THEN 1 ELSE 0 END) as sold_count
             FROM batches b
             JOIN products p ON b.product_id = p.id
             LEFT JOIN serialized_units su ON su.batch_number = b.batch_number
             GROUP BY b.id, p.product_name, p.gtin
             ORDER BY b.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch batches error:', err);
        res.status(500).json({ error: 'Failed to fetch batches' });
    }
});

// Get batch details with serial units
router.get('/:batchNumber', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.*, p.product_name, p.gtin,
                    json_agg(su.*) as serial_units
             FROM batches b
             JOIN products p ON b.product_id = p.id
             LEFT JOIN serialized_units su ON su.batch_number = b.batch_number
             WHERE b.batch_number = $1
             GROUP BY b.id, p.product_name, p.gtin`,
            [req.params.batchNumber]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Fetch batch error:', err);
        res.status(500).json({ error: 'Failed to fetch batch' });
    }
});

// Generate barcode for a specific serial unit
router.get('/barcode/:serialNumber', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT su.*, p.product_name 
             FROM serialized_units su
             JOIN products p ON su.gtin = p.gtin
             WHERE su.serial_number = $1`,
            [req.params.serialNumber]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Serial number not found' });
        }

        const unit = result.rows[0];
        const gs1Data = `(01)${unit.gtin}(21)${unit.serial_number}(10)${unit.batch_number}(17)${unit.expiry_date.replace(/-/g, '')}`;
        const qrCodeDataUrl = await QRCode.toDataURL(gs1Data, { width: 300 });

        res.json({
            serial_number: unit.serial_number,
            barcode_data: gs1Data,
            barcode_image: qrCodeDataUrl
        });
    } catch (err) {
        console.error('Generate barcode error:', err);
        res.status(500).json({ error: 'Failed to generate barcode' });
    }
});

export default router;