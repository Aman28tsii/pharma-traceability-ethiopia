import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1 AND is_active = true',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.rows[0];
        const isValidPassword = await bcrypt.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                role: user.role,
                gln: user.gln,
                name: user.name
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                gln: user.gln
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Register (Admin only)
router.post('/register', async (req, res) => {
    const { name, email, password, role, gln } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.query(
            `INSERT INTO users (name, email, password, role, gln, is_active) 
             VALUES ($1, $2, $3, $4, $5, true) 
             RETURNING id, name, email, role, gln`,
            [name, email.toLowerCase(), hashedPassword, role, gln]
        );

        res.status(201).json({
            success: true,
            user: result.rows[0]
        });
    } catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Email already exists' });
        } else {
            console.error('Registration error:', err);
            res.status(500).json({ error: 'Registration failed' });
        }
    }
});

// Get current user
router.get('/me', async (req, res) => {
    // This would need authentication middleware
    res.status(501).json({ error: 'Not implemented' });
});

export default router;