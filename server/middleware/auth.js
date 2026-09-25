import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pool from '../config/database.js';

dotenv.config();

export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
        const result = await pool.query(
            'SELECT id, email, role, name, gln, organization_id, location_id, is_active FROM users WHERE id = $1',
            [decoded.id]
        );
        if (result.rows.length === 0 || !result.rows[0].is_active) {
            return res.status(403).json({ error: 'Account not found or inactive' });
        }
        const u = result.rows[0];
        req.user = {
            id: u.id,
            email: u.email,
            role: u.role,
            name: u.name,
            gln: u.gln,
            organization_id: u.organization_id,
            location_id: u.location_id,
        };
        next();
    } catch (err) {
        console.error('Auth lookup error:', err);
        return res.status(500).json({ error: 'Auth lookup failed' });
    }
};

export const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};