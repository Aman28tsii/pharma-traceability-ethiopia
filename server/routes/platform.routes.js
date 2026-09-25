// server/routes/platform.routes.js
import express from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logAction } from '../middleware/audit.js';

const router = express.Router();

// All platform routes require the platform role. Not a branch role.
const platformOnly = [authenticateToken, requireRole(['platform'])];

// GET /api/platform/branches — list all branches
router.get('/branches', platformOnly, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, created_at FROM organizations ORDER BY id'
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Platform list branches error:', err);
        res.status(500).json({ error: 'Failed to list branches' });
    }
});

// POST /api/platform/branches — create a new branch
router.post('/branches', platformOnly, async (req, res) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Branch name is required' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO organizations (name) VALUES ($1) RETURNING id, name, created_at',
            [name.trim()]
        );

        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'CREATE',
            entityType: 'branch',
            entityId: result.rows[0].id,
            newData: result.rows[0],
            ipAddress: req.ip,
        });

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Platform create branch error:', err);
        res.status(500).json({ error: 'Failed to create branch' });
    }
});

// POST /api/platform/branches/:id/admins — create the first admin for a branch
router.post('/branches/:id/admins', platformOnly, async (req, res) => {
    const branchId = parseInt(req.params.id);
    const { name, email, password } = req.body;

    if (!Number.isInteger(branchId) || branchId < 1) {
        return res.status(400).json({ error: 'Invalid branch id' });
    }
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'name, email, and password are required' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const branchCheck = await client.query(
            'SELECT id, name FROM organizations WHERE id = $1',
            [branchId]
        );
        if (branchCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Branch not found' });
        }

        const hashed = await bcrypt.hash(password, 10);
        const result = await client.query(
            `INSERT INTO users (name, email, password, role, gln, is_active, organization_id, location_id)
             VALUES ($1, $2, $3, 'admin', NULL, true, $4, NULL)
             RETURNING id, name, email, role, organization_id, created_at`,
            [name, email.toLowerCase(), hashed, branchId]
        );

        await client.query('COMMIT');

        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'CREATE',
            entityType: 'user',
            entityId: result.rows[0].id,
            newData: { ...result.rows[0], branch_name: branchCheck.rows[0].name },
            ipAddress: req.ip,
        });

        res.status(201).json({
            success: true,
            user: result.rows[0],
            branch: branchCheck.rows[0],
        });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(409).json({ error: 'Email already exists' });
        }
        console.error('Platform create admin error:', err);
        res.status(500).json({ error: 'Failed to create admin' });
    } finally {
        client.release();
    }
});

export default router;