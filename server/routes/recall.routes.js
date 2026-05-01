import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Initiate recall
router.post('/', authenticateToken, requireRole(['admin', 'importer']), async (req, res) => {
    const { batch_number, recall_reason, recall_level, instructions } = req.body;

    if (!batch_number || !recall_reason) {
        return res.status(400).json({ error: 'Batch number and recall reason required' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Get batch details
        const batchResult = await client.query(
            `SELECT b.*, p.product_name, p.gtin 
             FROM batches b
             JOIN products p ON b.product_id = p.id
             WHERE b.batch_number = $1`,
            [batch_number]
        );

        if (batchResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Batch not found' });
        }

        const batch = batchResult.rows[0];

        // Update batch status
        await client.query(
            `UPDATE batches SET status = 'recalled', is_recalled = true WHERE id = $1`,
            [batch.id]
        );

        // Update all serial units in this batch
        await client.query(
            `UPDATE serialized_units SET status = 'recalled' WHERE batch_number = $1`,
            [batch_number]
        );

        // Create recall record
        const recallResult = await client.query(
            `INSERT INTO recalls 
             (batch_number, reason, severity, status, initiated_date, instructions, created_by) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [batch_number, recall_reason, recall_level, 'active', new Date(), instructions, req.user.id]
        );

        // Create trace events for recall
        await client.query(
            `INSERT INTO trace_events (serial_number, event_type, event_data, user_id)
             SELECT serial_number, 'recall', $1, $2
             FROM serialized_units WHERE batch_number = $3`,
            [JSON.stringify({ reason: recall_reason, level: recall_level }), req.user.id, batch_number]
        );

        await client.query('COMMIT');

        res.status(201).json({
            recall: recallResult.rows[0],
            batch: {
                batch_number: batch.batch_number,
                product_name: batch.product_name,
                gtin: batch.gtin
            },
            message: `Recall initiated for batch ${batch_number}`
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Recall initiation error:', err);
        res.status(500).json({ error: 'Failed to initiate recall' });
    } finally {
        client.release();
    }
});

// Get all recalls
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT r.*, 
                    u.name as initiated_by_name,
                    b.product_id,
                    p.product_name
             FROM recalls r
             LEFT JOIN users u ON r.created_by = u.id
             LEFT JOIN batches b ON r.batch_number = b.batch_number
             LEFT JOIN products p ON b.product_id = p.id
             ORDER BY r.created_at DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch recalls error:', err);
        res.status(500).json({ error: 'Failed to fetch recalls' });
    }
});

// Update recall status
router.put('/:id', authenticateToken, requireRole(['admin']), async (req, res) => {
    const { status, completion_date, report_url } = req.body;

    try {
        const result = await pool.query(
            `UPDATE recalls 
             SET status = COALESCE($1, status),
                 completion_date = COALESCE($2, completion_date),
                 report_url = COALESCE($3, report_url)
             WHERE id = $4
             RETURNING *`,
            [status, completion_date, report_url, req.params.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Recall not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update recall error:', err);
        res.status(500).json({ error: 'Failed to update recall' });
    }
});

export default router;