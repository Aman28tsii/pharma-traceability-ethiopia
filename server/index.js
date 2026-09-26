// server/index.js - Phase 8 reliability + hygiene
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import importRoutes from './routes/import.routes.js';
import { logAction } from './middleware/audit.js';
import platformRoutes from './routes/platform.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;
const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

/// ============ DATABASE CONFIGURATION ============
let pool;

if (process.env.NODE_ENV === 'production') {
    console.log('ðŸ”µ Running in PRODUCTION mode - using Neon database');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
            require: true
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
} else {
    console.log('ðŸŸ¢ Running in DEVELOPMENT mode - using local database');
    pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'pharma_traceability_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres123',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
}

// Phase 8: prevent unhandled pool errors from crashing the process on Neon cold-start
pool.on('error', (err) => {
    console.error('âš ï¸ Idle pool error (handled):', err.message);
});

// Middleware
app.disable('x-powered-by');
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const ALLOWED_ORIGINS = [
    'https://fili-pharma-traceability-ethiopia.onrender.com',
    'http://localhost:3000',
    'http://localhost:5000',
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error('CORS: origin not allowed'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}));

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many login attempts. Try again in 15 minutes.' },
});

app.use(express.json());
app.use('/api/import', importRoutes);
app.use('/api/platform', platformRoutes);

// Phase 8: startup connect with retry/backoff so Neon cold-starts do not leave
// the service stuck. Server starts listening regardless; queries retry on demand.
const connectWithRetry = async (attempt = 1, maxAttempts = 5) => {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1 AS ok');
        client.release();
        console.log(`âœ… Database connected (attempt ${attempt})`);
    } catch (err) {
        console.error(`âŒ Database connection attempt ${attempt}/${maxAttempts} failed:`, err.message);
        if (attempt < maxAttempts) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
            console.log(`   Retrying in ${delay}ms...`);
            setTimeout(() => connectWithRetry(attempt + 1, maxAttempts), delay);
        } else {
            console.error('âŒ All database connection attempts failed. Server continues running; queries will retry on demand.');
        }
    }
};
connectWithRetry();

// ============ AUTH MIDDLEWARE ============
const auth = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
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
        const user = result.rows[0];
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
            gln: user.gln,
            organization_id: user.organization_id,
            location_id: user.location_id,
        };
        next();
    } catch (err) {
        console.error('Auth lookup error:', err);
        return res.status(500).json({ error: 'Auth lookup failed' });
    }
};

const requireRole = (roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
};

// ============ AUTH ROUTES ============

// LOGIN
app.post('/api/auth/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        
        const valid = await bcrypt.compare(password, user.password);
        
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, name: user.name, gln: user.gln },
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
app.post('/api/auth/register', auth, requireRole(['admin']), async (req, res) => {
    const { name, email, password, role, gln } = req.body;
    
    if (!name || !email || !password || !role) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            `INSERT INTO users (name, email, password, role, gln, is_active, organization_id, location_id) 
             VALUES ($1, $2, $3, $4, $5, true, $6, $7) 
             RETURNING id, name, email, role, gln, organization_id, location_id`,
            [name, email.toLowerCase(), hashedPassword, role, gln || null, req.user.organization_id, req.user.location_id]
        );
        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'CREATE',
            entityType: 'user',
            entityId: result.rows[0].id,
            newData: result.rows[0],
            ipAddress: req.ip,
        });
        res.status(201).json({ success: true, user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Email already exists' });
        } else {
            console.error('Registration error:', err);
            res.status(500).json({ error: 'Registration failed' });
        }
    }
});

// ============ USER MANAGEMENT (ADMIN) ============

app.get('/api/admin/users', auth, requireRole(['admin']), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, name, email, role, gln, is_active, created_at FROM users WHERE organization_id = $1 ORDER BY created_at DESC',
            [req.user.organization_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch users error:', err);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.put('/api/admin/users/:id', auth, requireRole(['admin']), async (req, res) => {
    const { role, is_active } = req.body;
    try {
        const result = await pool.query(
            'UPDATE users SET role = $1, is_active = $2 WHERE id = $3 AND organization_id = $4 RETURNING id, name, email, role, is_active',
            [role, is_active, req.params.id, req.user.organization_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'UPDATE',
            entityType: 'user',
            entityId: result.rows[0].id,
            newData: result.rows[0],
            ipAddress: req.ip,
        });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update user error:', err);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Reset a user's password (admin-triggered, branch-scoped)
app.post('/api/admin/users/:id/reset-password', auth, requireRole(['admin']), async (req, res) => {
    const { new_password } = req.body;

    if (!new_password || typeof new_password !== 'string') {
        return res.status(400).json({ error: 'New password required' });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const hashedPassword = await bcrypt.hash(new_password, 10);

        const result = await pool.query(
            `UPDATE users
             SET password = $1, updated_at = NOW()
             WHERE id = $2 AND organization_id = $3
             RETURNING id, name, email, role, is_active`,
            [hashedPassword, req.params.id, req.user.organization_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'RESET_PASSWORD',
            entityType: 'user',
            entityId: result.rows[0].id,
            newData: { id: result.rows[0].id, email: result.rows[0].email },
            ipAddress: req.ip,
        });

        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

app.delete('/api/admin/users/:id', auth, requireRole(['admin']), async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM users WHERE id = $1 AND organization_id = $2 RETURNING id',
            [req.params.id, req.user.organization_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'DELETE',
            entityType: 'user',
            entityId: result.rows[0].id,
            ipAddress: req.ip,
        });
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// GET /api/admin/audit-logs â€” admin-only, branch-scoped
app.get('/api/admin/audit-logs', auth, requireRole(['admin']), async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 50, 200);
        const offset = parseInt(req.query.offset) || 0;
        const { action, user_id, start_date, end_date } = req.query;

        const params = [req.user.organization_id];
        let where = 'WHERE a.organization_id = $1';

        if (action) {
            params.push(action);
            where += ` AND a.action = $${params.length}`;
        }
        if (user_id) {
            params.push(user_id);
            where += ` AND a.user_id = $${params.length}`;
        }
        if (start_date) {
            params.push(start_date);
            where += ` AND a.created_at >= $${params.length}`;
        }
        if (end_date) {
            params.push(end_date);
            where += ` AND a.created_at <= $${params.length}`;
        }

        params.push(limit, offset);

        const result = await pool.query(
            `SELECT a.*, u.name AS user_name, u.email AS user_email
             FROM audit_logs a
             LEFT JOIN users u ON a.user_id = u.id
             ${where}
             ORDER BY a.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Fetch audit logs error:', err);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

// ============ PRODUCT ROUTES ============

app.get('/api/products', auth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM products WHERE organization_id = $1 ORDER BY created_at DESC',
            [req.user.organization_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch products error:', err);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

app.get('/api/products/:id', auth, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM products WHERE id = $1 AND organization_id = $2',
            [req.params.id, req.user.organization_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Fetch product error:', err);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// ---- Phase 12 P0-2: persist dosage_form, pack_size, prescription_required on create ----
app.post('/api/products', auth, requireRole(['admin', 'importer']), async (req, res) => {
    const {
        gtin,
        product_name,
        manufacturer,
        strength,
        dosage_form,
        pack_size,
        prescription_required,
    } = req.body;

    if (!gtin || !product_name) {
        return res.status(400).json({ error: 'GTIN and product name required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO products
                (gtin, product_name, manufacturer, strength,
                 dosage_form, pack_size, prescription_required,
                 created_by, organization_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [
                gtin,
                product_name,
                manufacturer || null,
                strength || null,
                dosage_form || null,
                pack_size || null,
                typeof prescription_required === 'boolean' ? prescription_required : false,
                req.user.id,
                req.user.organization_id,
            ]
        );
        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'CREATE',
            entityType: 'product',
            entityId: result.rows[0].id,
            newData: result.rows[0],
            ipAddress: req.ip,
        });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            res.status(409).json({ error: 'Product with this GTIN already exists' });
        } else {
            console.error('Create product error:', err);
            res.status(500).json({ error: 'Failed to create product' });
        }
    }
});

// ---- Phase 12 P0-2: persist dosage_form, pack_size, prescription_required on update ----
app.put('/api/products/:id', auth, requireRole(['admin', 'importer']), async (req, res) => {
    const {
        product_name,
        manufacturer,
        strength,
        dosage_form,
        pack_size,
        prescription_required,
    } = req.body;

    try {
        const result = await pool.query(
            `UPDATE products
             SET product_name = COALESCE($1, product_name),
                 manufacturer = COALESCE($2, manufacturer),
                 strength = COALESCE($3, strength),
                 dosage_form = COALESCE($4, dosage_form),
                 pack_size = COALESCE($5, pack_size),
                 prescription_required = COALESCE($6, prescription_required)
             WHERE id = $7 AND organization_id = $8
             RETURNING *`,
            [
                product_name,
                manufacturer,
                strength,
                dosage_form,
                pack_size,
                typeof prescription_required === 'boolean' ? prescription_required : null,
                req.params.id,
                req.user.organization_id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'UPDATE',
            entityType: 'product',
            entityId: result.rows[0].id,
            newData: result.rows[0],
            ipAddress: req.ip,
        });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Update product error:', err);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

app.delete('/api/products/:id', auth, requireRole(['admin', 'importer']), async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM products WHERE id = $1 AND organization_id = $2 RETURNING id',
            [req.params.id, req.user.organization_id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'DELETE',
            entityType: 'product',
            entityId: result.rows[0].id,
            ipAddress: req.ip,
        });
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Delete product error:', err);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ============ BATCH ROUTES ============

app.get('/api/batches', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT b.*, p.product_name, p.gtin,
                    COUNT(su.id) as serialized_count
             FROM batches b
             JOIN products p ON b.product_id = p.id
             LEFT JOIN serialized_units su ON su.batch_number = b.batch_number
             WHERE b.organization_id = $1
             GROUP BY b.id, p.product_name, p.gtin
             ORDER BY b.created_at DESC`,
            [req.user.organization_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch batches error:', err);
        res.status(500).json({ error: 'Failed to fetch batches' });
    }
});

app.post('/api/batches', auth, requireRole(['admin', 'importer']), async (req, res) => {
    const { product_id, batch_number, expiry_date, quantity } = req.body;
    
    if (!product_id || !batch_number || !expiry_date || !quantity) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const productResult = await client.query(
            'SELECT gtin, product_name FROM products WHERE id = $1 AND organization_id = $2',
            [product_id, req.user.organization_id]
        );
        if (productResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = productResult.rows[0];
        
        const batchResult = await client.query(
            `INSERT INTO batches (batch_number, product_id, expiry_date, quantity, created_by, organization_id, location_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) 
             RETURNING *`,
            [batch_number, product_id, expiry_date, quantity, req.user.id, req.user.organization_id, req.user.location_id]
        );
        
        const serialUnits = [];
        for (let i = 1; i <= quantity; i++) {
            const serialNumber = `${product.gtin.slice(-6)}${batch_number.slice(0, 4)}${String(i).padStart(8, '0')}`;
            const unitResult = await client.query(
                `INSERT INTO serialized_units (gtin, serial_number, batch_number, expiry_date, status, organization_id, location_id) 
                 VALUES ($1, $2, $3, $4, 'active', $5, $6) 
                 RETURNING *`,
                [product.gtin, serialNumber, batch_number, expiry_date, req.user.organization_id, req.user.location_id]
            );
            serialUnits.push(unitResult.rows[0]);
        }
        
        // Phase 6: write one manufacture trace event per serialized unit.
        if (serialUnits.length > 0) {
            const serialNumbers = serialUnits.map(u => u.serial_number);
            await client.query(
                `INSERT INTO trace_events
                    (serial_number, event_type, to_gln, location, user_id,
                     organization_id, location_id, batch_number)
                 SELECT s, 'manufacture', $2, $3, $4, $5, $6, $7
                 FROM unnest($1::text[]) AS s`,
                [
                    serialNumbers,
                    req.user.gln || null,
                    null,
                    req.user.id,
                    req.user.organization_id,
                    req.user.location_id,
                    batch_number,
                ]
            );
        }
        
        await client.query('COMMIT');
        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'CREATE',
            entityType: 'batch',
            entityId: batchResult.rows[0].id,
            newData: { batch: batchResult.rows[0], serial_units_count: serialUnits.length },
            ipAddress: req.ip,
        });
        res.status(201).json({ 
            batch: batchResult.rows[0], 
            serial_units_count: serialUnits.length,
            message: `Batch ${batch_number} created with ${serialUnits.length} serial units`
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create batch error:', err);
        res.status(500).json({ error: 'Failed to create batch' });
    } finally {
        client.release();
    }
});

// ============ VERIFICATION (SCANNER) ============

app.post('/api/verify', auth, async (req, res) => {
    const { gtin, serial_number } = req.body;
    
    if (!gtin || !serial_number) {
        return res.status(400).json({ error: 'GTIN and serial number required' });
    }
    
    try {
        const result = await pool.query(
            `SELECT su.*, p.product_name, p.manufacturer, p.strength
             FROM serialized_units su
             JOIN products p ON su.gtin = p.gtin
             WHERE su.serial_number = $1 AND su.gtin = $2 AND su.organization_id = $3`,
            [serial_number, gtin, req.user.organization_id]
        );
        
        if (result.rows.length === 0) {
            await pool.query(
                `INSERT INTO scan_history (serial_number, gtin, scanned_by_gln, scan_result, ip_address, organization_id) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [serial_number, gtin, req.user.gln, 'invalid', req.ip, req.user.organization_id]
            );
            return res.json({ 
                status: 'invalid', 
                message: 'âŒ Product not found - Possible counterfeit',
                product: null 
            });
        }
        
        const unit = result.rows[0];
        const expiry = new Date(unit.expiry_date);
        const now = new Date();
        const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
        
        let status = 'valid';
        let message = 'âœ… Product is AUTHENTIC and VALID';
        
        if (unit.status === 'recalled') {
            status = 'recalled';
            message = 'âš ï¸ CRITICAL: Product has been RECALLED! Do not use.';
        } else if (expiry < now) {
            status = 'expired';
            message = 'âŒ Product has EXPIRED - Do not use';
        } else if (daysLeft <= 30) {
            status = 'warning';
            message = `âš ï¸ Warning: Product expires in ${daysLeft} days`;
        }
        
        await pool.query(
            `INSERT INTO scan_history (serial_number, gtin, scanned_by_gln, scan_result, ip_address, organization_id) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [serial_number, gtin, req.user.gln, status, req.ip, req.user.organization_id]
        );
        
        if (status !== 'invalid') {
            await pool.query(
                `INSERT INTO trace_events
                    (serial_number, event_type, user_id, organization_id, location_id, batch_number) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [serial_number, 'verify', req.user.id, req.user.organization_id, req.user.location_id, unit.batch_number]
            );
            await pool.query(
                `UPDATE serialized_units
                 SET last_scanned_at = NOW(),
                     current_owner_gln = COALESCE(current_owner_gln, $1)
                 WHERE id = $2`,
                [req.user.gln, unit.id]
            );
        }
        
        res.json({
            status,
            message,
            product: {
                name: unit.product_name,
                gtin: unit.gtin,
                serial_number: unit.serial_number,
                batch: unit.batch_number,
                manufacturer: unit.manufacturer,
                strength: unit.strength,
                expiry_date: unit.expiry_date,
                days_left: daysLeft,
                current_status: unit.status
            }
        });
    } catch (err) {
        console.error('Verification error:', err);
        res.status(500).json({ error: 'Verification failed' });
    }
});

// ============ DASHBOARD ROUTES ============

app.get('/api/dashboard/stats', auth, async (req, res) => {
    const orgId = req.user.organization_id;
    try {
        let totalProducts = 0;
        let totalBatches = 0;
        let totalUnits = 0;
        let totalUsers = 0;
        let scansLast30Days = 0;
        let expiredUnits = 0;
        let expiringSoon = 0;
        
        try {
            const result = await pool.query('SELECT COUNT(*) as count FROM products WHERE organization_id = $1', [orgId]);
            totalProducts = parseInt(result.rows[0]?.count || 0);
        } catch (e) { console.log('Products count error:', e.message); }
        
        try {
            const result = await pool.query('SELECT COUNT(*) as count FROM batches WHERE organization_id = $1', [orgId]);
            totalBatches = parseInt(result.rows[0]?.count || 0);
        } catch (e) { console.log('Batches count error:', e.message); }
        
        try {
            const result = await pool.query('SELECT COUNT(*) as count FROM serialized_units WHERE organization_id = $1', [orgId]);
            totalUnits = parseInt(result.rows[0]?.count || 0);
        } catch (e) { console.log('Units count error:', e.message); }
        
        try {
            const result = await pool.query('SELECT COUNT(*) as count FROM users WHERE is_active = true AND organization_id = $1', [orgId]);
            totalUsers = parseInt(result.rows[0]?.count || 0);
        } catch (e) { console.log('Users count error:', e.message); }
        
        try {
            const result = await pool.query("SELECT COUNT(*) as count FROM trace_events WHERE organization_id = $1 AND created_at >= NOW() - INTERVAL '30 days'", [orgId]);
            scansLast30Days = parseInt(result.rows[0]?.count || 0);
        } catch (e) { console.log('Scans count error:', e.message); }
        
        try {
            const result = await pool.query('SELECT COUNT(*) as count FROM serialized_units WHERE organization_id = $1 AND expiry_date < NOW()', [orgId]);
            expiredUnits = parseInt(result.rows[0]?.count || 0);
        } catch (e) { console.log('Expired count error:', e.message); }
        
        try {
            const result = await pool.query("SELECT COUNT(*) as count FROM serialized_units WHERE organization_id = $1 AND expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'", [orgId]);
            expiringSoon = parseInt(result.rows[0]?.count || 0);
        } catch (e) { console.log('Expiring count error:', e.message); }
        
        res.json({
            total_products: totalProducts,
            total_batches: totalBatches,
            total_units: totalUnits,
            total_users: totalUsers,
            scans_last_30_days: scansLast30Days,
            expired_units: expiredUnits,
            expiring_soon: expiringSoon,
            recalled_units: 0
        });
    } catch (err) {
        console.error('Dashboard stats error:', err);
        res.json({
            total_products: 0,
            total_batches: 0,
            total_units: 0,
            total_users: 0,
            scans_last_30_days: 0,
            expired_units: 0,
            expiring_soon: 0,
            recalled_units: 0
        });
    }
});

app.get('/api/dashboard/recent-activity', auth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                te.id,
                te.serial_number,
                te.event_type,
                te.created_at,
                u.name as user_name,
                p.product_name
            FROM trace_events te
            LEFT JOIN users u ON te.user_id = u.id
            LEFT JOIN serialized_units su ON te.serial_number = su.serial_number
            LEFT JOIN products p ON su.gtin = p.gtin
            WHERE te.organization_id = $1
            ORDER BY te.created_at DESC
            LIMIT 20
        `, [req.user.organization_id]);
        res.json(result.rows || []);
    } catch (err) {
        console.error('Recent activity error:', err);
        res.json([]);
    }
});

app.get('/api/dashboard/expiry-alerts', auth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                su.id,
                su.serial_number,
                su.batch_number,
                su.expiry_date,
                su.status,
                p.product_name,
                EXTRACT(DAY FROM (su.expiry_date - NOW())) as days_remaining
            FROM serialized_units su
            JOIN products p ON su.gtin = p.gtin
            WHERE su.expiry_date <= NOW() + INTERVAL '90 days'
              AND su.organization_id = $1
            ORDER BY su.expiry_date ASC
            LIMIT 50
        `, [req.user.organization_id]);
        res.json(result.rows || []);
    } catch (err) {
        console.error('Expiry alerts error:', err);
        res.json([]);
    }
});

// ============ RECALL ROUTES ============

app.get('/api/recalls', auth, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT r.*, u.name as initiated_by_name
            FROM recalls r
            LEFT JOIN users u ON r.created_by = u.id
            WHERE r.organization_id = $1
            ORDER BY r.created_at DESC
        `, [req.user.organization_id]);
        res.json(result.rows || []);
    } catch (err) {
        console.error('Fetch recalls error:', err);
        res.json([]);
    }
});

app.post('/api/recalls', auth, requireRole(['admin', 'importer']), async (req, res) => {
    const { batch_number, recall_reason, recall_level, instructions } = req.body;
    
    if (!batch_number || !recall_reason) {
        return res.status(400).json({ error: 'Batch number and recall reason required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const batchCheck = await client.query(
            `SELECT b.id, b.batch_number, b.on_hand_quantity, p.gtin
             FROM batches b JOIN products p ON b.product_id = p.id
             WHERE b.batch_number = $1 AND b.organization_id = $2`,
            [batch_number, req.user.organization_id]
        );
        if (batchCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Batch not found' });
        }
        const rb = batchCheck.rows[0];

        const result = await client.query(
            `INSERT INTO recalls (batch_number, reason, severity, instructions, status, initiated_date, created_by, organization_id) 
             VALUES ($1, $2, $3, $4, 'active', CURRENT_DATE, $5, $6) 
             RETURNING *`,
            [batch_number, recall_reason, recall_level, instructions || null, req.user.id, req.user.organization_id]
        );

        if (rb.on_hand_quantity !== 0) {
            await client.query(
                `INSERT INTO stock_movements
                    (organization_id, batch_id, batch_number, gtin, movement_type, quantity_delta,
                     reference_type, reference_id, notes, performed_by)
                 VALUES ($1, $2, $3, $4, 'recall', $5, 'recall', $6, $7, $8)`,
                [req.user.organization_id, rb.id, batch_number, rb.gtin, -rb.on_hand_quantity,
                 result.rows[0].id, `Recall: ${recall_reason}`, req.user.id]
            );
        }
        await client.query(
            `UPDATE batches SET on_hand_quantity = 0, is_recalled = true, status = 'recalled', updated_at = NOW()
             WHERE id = $1`,
            [rb.id]
        );

        await client.query(
            `UPDATE serialized_units
             SET status = 'recalled', updated_at = NOW()
             WHERE batch_number = $1 AND organization_id = $2 AND status <> 'sold'`,
            [batch_number, req.user.organization_id]
        );

        await client.query(
            `INSERT INTO trace_events
                (serial_number, event_type, user_id, organization_id, location_id, batch_number, event_data)
             VALUES (NULL, 'recall', $1, $2, $3, $4, $5)`,
            [
                req.user.id,
                req.user.organization_id,
                req.user.location_id,
                batch_number,
                JSON.stringify({
                    reason: recall_reason,
                    severity: recall_level,
                    quantity_removed: rb.on_hand_quantity,
                    recall_id: result.rows[0].id,
                }),
            ]
        );

        await client.query('COMMIT');

        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'CREATE',
            entityType: 'recall',
            entityId: result.rows[0].id,
            newData: result.rows[0],
            ipAddress: req.ip,
        });
        res.status(201).json(result.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Create recall error:', err);
        res.status(500).json({ error: 'Failed to create recall' });
    } finally {
        client.release();
    }
});

// ============ STOCK ROUTES ============

app.post('/api/stock/receive', auth, requireRole(['admin', 'importer']), async (req, res) => {
    const { batch_id, quantity, counterparty, notes } = req.body;
    if (!batch_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'batch_id and positive quantity required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const batchResult = await client.query(
            `SELECT b.id, b.batch_number, b.organization_id, p.gtin
             FROM batches b JOIN products p ON b.product_id = p.id
             WHERE b.id = $1 AND b.organization_id = $2`,
            [batch_id, req.user.organization_id]
        );
        if (batchResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Batch not found' });
        }
        const b = batchResult.rows[0];

        const mv = await client.query(
            `INSERT INTO stock_movements
                (organization_id, batch_id, batch_number, gtin, movement_type, quantity_delta,
                 reference_type, counterparty, notes, performed_by, ip_address)
             VALUES ($1, $2, $3, $4, 'receive', $5, 'receive', $6, $7, $8, $9)
             RETURNING *`,
            [req.user.organization_id, b.id, b.batch_number, b.gtin, quantity,
             counterparty || null, notes || null, req.user.id, req.ip]
        );

        await client.query(
            'UPDATE batches SET on_hand_quantity = on_hand_quantity + $1, updated_at = NOW() WHERE id = $2',
            [quantity, b.id]
        );

        await client.query(
            `INSERT INTO trace_events
                (serial_number, event_type, user_id, organization_id, location_id, batch_number, event_data)
             VALUES (NULL, 'receive', $1, $2, $3, $4, $5)`,
            [
                req.user.id,
                req.user.organization_id,
                req.user.location_id,
                b.batch_number,
                JSON.stringify({ quantity, counterparty: counterparty || null, notes: notes || null }),
            ]
        );

        await client.query('COMMIT');

        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'RECEIVE',
            entityType: 'stock',
            entityId: mv.rows[0].id,
            newData: mv.rows[0],
            ipAddress: req.ip,
        });

        res.status(201).json(mv.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Stock receive error:', err);
        res.status(500).json({ error: 'Failed to receive stock' });
    } finally {
        client.release();
    }
});

app.post('/api/stock/transfer', auth, requireRole(['admin', 'importer', 'distributor']), async (req, res) => {
    const { batch_id, to_organization_id, quantity, notes } = req.body;
    if (!batch_id || !to_organization_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'batch_id, to_organization_id, positive quantity required' });
    }
    if (Number(to_organization_id) === Number(req.user.organization_id)) {
        return res.status(400).json({ error: 'Cannot transfer to the same branch' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const src = await client.query(
            `SELECT b.id, b.batch_number, b.organization_id, b.on_hand_quantity, p.gtin
             FROM batches b JOIN products p ON b.product_id = p.id
             WHERE b.id = $1 AND b.organization_id = $2`,
            [batch_id, req.user.organization_id]
        );
        if (src.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Batch not found' });
        }
        const source = src.rows[0];
        if (source.on_hand_quantity < quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient stock', available: source.on_hand_quantity });
        }

        const dest = await client.query(
            `SELECT id FROM organizations WHERE id = $1`,
            [to_organization_id]
        );
        if (dest.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Destination branch not found' });
        }

        const srcFull = await client.query(
            `SELECT product_id, expiry_date, manufacturer_date FROM batches WHERE id = $1`,
            [batch_id]
        );
        const bmeta = srcFull.rows[0];

        const destBatchLookup = await client.query(
            `SELECT id FROM batches WHERE batch_number = $1 AND organization_id = $2`,
            [source.batch_number, to_organization_id]
        );
        let destBatchId;
        if (destBatchLookup.rows.length > 0) {
            destBatchId = destBatchLookup.rows[0].id;
        } else {
            const created = await client.query(
                `INSERT INTO batches
                    (batch_number, product_id, manufacturer_date, expiry_date, quantity,
                     total_units, status, created_by, organization_id)
                 VALUES ($1, $2, $3, $4, 0, 0, 'active', $5, $6)
                 RETURNING id`,
                [source.batch_number, bmeta.product_id, bmeta.manufacturer_date, bmeta.expiry_date,
                 req.user.id, to_organization_id]
            );
            destBatchId = created.rows[0].id;
        }

        const out = await client.query(
            `INSERT INTO stock_movements
                (organization_id, batch_id, batch_number, gtin, movement_type, quantity_delta,
                 reference_type, counterparty, notes, performed_by, ip_address)
             VALUES ($1, $2, $3, $4, 'transfer_out', $5, 'transfer', $6, $7, $8, $9)
             RETURNING *`,
            [req.user.organization_id, source.id, source.batch_number, source.gtin, -quantity,
             `branch:${to_organization_id}`, notes || null, req.user.id, req.ip]
        );

        const inMv = await client.query(
            `INSERT INTO stock_movements
                (organization_id, batch_id, batch_number, gtin, movement_type, quantity_delta,
                 reference_type, reference_id, counterparty, notes, performed_by, ip_address)
             VALUES ($1, $2, $3, $4, 'transfer_in', $5, 'transfer', $6, $7, $8, $9, $10)
             RETURNING *`,
            [to_organization_id, destBatchId, source.batch_number, source.gtin, quantity,
             out.rows[0].id, `branch:${req.user.organization_id}`, notes || null, req.user.id, req.ip]
        );

        await client.query(
            'UPDATE batches SET on_hand_quantity = on_hand_quantity - $1, updated_at = NOW() WHERE id = $2',
            [quantity, source.id]
        );
        await client.query(
            'UPDATE batches SET on_hand_quantity = on_hand_quantity + $1, updated_at = NOW() WHERE id = $2',
            [quantity, destBatchId]
        );

        const unitIdsRes = await client.query(
            `SELECT id FROM serialized_units
             WHERE batch_number = $1 AND organization_id = $2 AND status <> 'sold'
             LIMIT $3`,
            [source.batch_number, req.user.organization_id, quantity]
        );
        const unitIds = unitIdsRes.rows.map(r => r.id);
        if (unitIds.length > 0) {
            await client.query(
                `UPDATE serialized_units SET organization_id = $1 WHERE id = ANY($2::int[])`,
                [to_organization_id, unitIds]
            );
        }

        const outEvent = await client.query(
            `INSERT INTO trace_events
                (serial_number, event_type, user_id, organization_id, location_id, batch_number, to_gln, event_data)
             VALUES (NULL, 'transfer_out', $1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
                req.user.id,
                req.user.organization_id,
                req.user.location_id,
                source.batch_number,
                null,
                JSON.stringify({ quantity, to_organization_id: Number(to_organization_id), notes: notes || null }),
            ]
        );

        await client.query(
            `INSERT INTO trace_events
                (serial_number, event_type, user_id, organization_id, location_id, batch_number, from_gln, event_data)
             VALUES (NULL, 'transfer_in', $1, $2, $3, $4, $5, $6)`,
            [
                req.user.id,
                to_organization_id,
                null,
                source.batch_number,
                null,
                JSON.stringify({
                    quantity,
                    from_organization_id: req.user.organization_id,
                    parent_event_id: outEvent.rows[0].id,
                    notes: notes || null,
                }),
            ]
        );

        await client.query('COMMIT');

        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'TRANSFER_OUT',
            entityType: 'stock',
            entityId: out.rows[0].id,
            newData: { out: out.rows[0], in: inMv.rows[0], to_organization_id },
            ipAddress: req.ip,
        });

        res.status(201).json({ transfer_out: out.rows[0], transfer_in: inMv.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Stock transfer error:', err);
        res.status(500).json({ error: 'Failed to transfer stock' });
    } finally {
        client.release();
    }
});

app.post('/api/stock/dispense', auth, requireRole(['admin', 'pharmacy']), async (req, res) => {
    const { batch_id, quantity, serial_number, counterparty, notes } = req.body;
    if (!batch_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'batch_id and positive quantity required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const src = await client.query(
            `SELECT b.id, b.batch_number, b.on_hand_quantity, p.gtin
             FROM batches b JOIN products p ON b.product_id = p.id
             WHERE b.id = $1 AND b.organization_id = $2`,
            [batch_id, req.user.organization_id]
        );
        if (src.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Batch not found' });
        }
        const batch = src.rows[0];
        if (batch.on_hand_quantity < quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient stock', available: batch.on_hand_quantity });
        }

        if (serial_number) {
            const unitRes = await client.query(
                `SELECT id, status FROM serialized_units
                 WHERE serial_number = $1 AND batch_number = $2 AND organization_id = $3`,
                [serial_number, batch.batch_number, req.user.organization_id]
            );
            if (unitRes.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Serialized unit not found' });
            }
            if (unitRes.rows[0].status === 'sold') {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Serialized unit already sold' });
            }
            if (unitRes.rows[0].status === 'recalled') {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Serialized unit is recalled' });
            }
            await client.query(
                `UPDATE serialized_units
                 SET status = 'sold',
                     last_scanned_at = NOW(),
                     current_owner_gln = COALESCE(current_owner_gln, $2),
                     updated_at = NOW()
                 WHERE id = $1`,
                [unitRes.rows[0].id, req.user.gln]
            );
        }

        const mv = await client.query(
            `INSERT INTO stock_movements
                (organization_id, batch_id, batch_number, gtin, movement_type, quantity_delta,
                 reference_type, counterparty, notes, performed_by, ip_address)
             VALUES ($1, $2, $3, $4, 'dispense', $5, 'dispense', $6, $7, $8, $9)
             RETURNING *`,
            [req.user.organization_id, batch.id, batch.batch_number, batch.gtin, -quantity,
             counterparty || null, notes || null, req.user.id, req.ip]
        );

        await client.query(
            'UPDATE batches SET on_hand_quantity = on_hand_quantity - $1, updated_at = NOW() WHERE id = $2',
            [quantity, batch.id]
        );

        await client.query(
            `INSERT INTO trace_events
                (serial_number, event_type, user_id, organization_id, location_id, batch_number, event_data)
             VALUES ($1, 'dispense', $2, $3, $4, $5, $6)`,
            [
                serial_number || null,
                req.user.id,
                req.user.organization_id,
                req.user.location_id,
                batch.batch_number,
                JSON.stringify({
                    quantity,
                    counterparty: counterparty || null,
                    notes: notes || null,
                    serial_number: serial_number || null,
                }),
            ]
        );

        await client.query('COMMIT');

        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'DISPENSE',
            entityType: 'stock',
            entityId: mv.rows[0].id,
            newData: mv.rows[0],
            ipAddress: req.ip,
        });

        res.status(201).json(mv.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Stock dispense error:', err);
        res.status(500).json({ error: 'Failed to dispense stock' });
    } finally {
        client.release();
    }
});

app.post('/api/stock/return', auth, requireRole(['admin', 'importer']), async (req, res) => {
    const { batch_id, quantity, counterparty, notes } = req.body;
    if (!batch_id || !quantity || quantity <= 0) {
        return res.status(400).json({ error: 'batch_id and positive quantity required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const src = await client.query(
            `SELECT b.id, b.batch_number, b.on_hand_quantity, p.gtin
             FROM batches b JOIN products p ON b.product_id = p.id
             WHERE b.id = $1 AND b.organization_id = $2`,
            [batch_id, req.user.organization_id]
        );
        if (src.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Batch not found' });
        }
        const batch = src.rows[0];
        if (batch.on_hand_quantity < quantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Insufficient stock', available: batch.on_hand_quantity });
        }

        const mv = await client.query(
            `INSERT INTO stock_movements
                (organization_id, batch_id, batch_number, gtin, movement_type, quantity_delta,
                 reference_type, counterparty, notes, performed_by, ip_address)
             VALUES ($1, $2, $3, $4, 'return_supplier', $5, 'return', $6, $7, $8, $9)
             RETURNING *`,
            [req.user.organization_id, batch.id, batch.batch_number, batch.gtin, -quantity,
             counterparty || null, notes || null, req.user.id, req.ip]
        );

        await client.query(
            'UPDATE batches SET on_hand_quantity = on_hand_quantity - $1, updated_at = NOW() WHERE id = $2',
            [quantity, batch.id]
        );

        await client.query(
            `INSERT INTO trace_events
                (serial_number, event_type, user_id, organization_id, location_id, batch_number, event_data)
             VALUES (NULL, 'return_supplier', $1, $2, $3, $4, $5)`,
            [
                req.user.id,
                req.user.organization_id,
                req.user.location_id,
                batch.batch_number,
                JSON.stringify({ quantity, counterparty: counterparty || null, notes: notes || null }),
            ]
        );

        await client.query('COMMIT');
        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'RETURN_SUPPLIER',
            entityType: 'stock',
            entityId: mv.rows[0].id,
            newData: mv.rows[0],
            ipAddress: req.ip,
        });
        res.status(201).json(mv.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Stock return error:', err);
        res.status(500).json({ error: 'Failed to return stock' });
    } finally {
        client.release();
    }
});

app.post('/api/stock/adjust', auth, requireRole(['admin', 'importer']), async (req, res) => {
    const { batch_id, quantity_delta, reason, notes } = req.body;
    if (!batch_id || typeof quantity_delta !== 'number' || quantity_delta === 0) {
        return res.status(400).json({ error: 'batch_id and non-zero quantity_delta required' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const src = await client.query(
            `SELECT b.id, b.batch_number, b.on_hand_quantity, p.gtin
             FROM batches b JOIN products p ON b.product_id = p.id
             WHERE b.id = $1 AND b.organization_id = $2`,
            [batch_id, req.user.organization_id]
        );
        if (src.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Batch not found' });
        }
        const batch = src.rows[0];
        if (batch.on_hand_quantity + quantity_delta < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'Adjustment would drive on_hand below zero', available: batch.on_hand_quantity });
        }

        const mv = await client.query(
            `INSERT INTO stock_movements
                (organization_id, batch_id, batch_number, gtin, movement_type, quantity_delta,
                 reference_type, counterparty, notes, performed_by, ip_address)
             VALUES ($1, $2, $3, $4, 'adjustment', $5, 'adjustment', $6, $7, $8, $9)
             RETURNING *`,
            [req.user.organization_id, batch.id, batch.batch_number, batch.gtin, quantity_delta,
             reason || null, notes || null, req.user.id, req.ip]
        );

        await client.query(
            'UPDATE batches SET on_hand_quantity = on_hand_quantity + $1, updated_at = NOW() WHERE id = $2',
            [quantity_delta, batch.id]
        );

        await client.query(
            `INSERT INTO trace_events
                (serial_number, event_type, user_id, organization_id, location_id, batch_number, event_data)
             VALUES (NULL, 'adjust', $1, $2, $3, $4, $5)`,
            [
                req.user.id,
                req.user.organization_id,
                req.user.location_id,
                batch.batch_number,
                JSON.stringify({ quantity_delta, reason: reason || null, notes: notes || null }),
            ]
        );

        await client.query('COMMIT');
        await logAction(pool, {
            userId: req.user.id,
            organizationId: req.user.organization_id,
            action: 'ADJUST',
            entityType: 'stock',
            entityId: mv.rows[0].id,
            newData: mv.rows[0],
            ipAddress: req.ip,
        });
        res.status(201).json(mv.rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Stock adjust error:', err);
        res.status(500).json({ error: 'Failed to adjust stock' });
    } finally {
        client.release();
    }
});

app.get('/api/stock/movements', auth, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 100, 500);
        const offset = parseInt(req.query.offset) || 0;
        const { batch_id, movement_type, from, to } = req.query;

        const params = [req.user.organization_id];
        let where = 'WHERE sm.organization_id = $1';

        if (batch_id) {
            params.push(batch_id);
            where += ` AND sm.batch_id = $${params.length}`;
        }
        if (movement_type) {
            params.push(movement_type);
            where += ` AND sm.movement_type = $${params.length}`;
        }
        if (from) {
            params.push(from);
            where += ` AND sm.created_at >= $${params.length}`;
        }
        if (to) {
            params.push(to);
            where += ` AND sm.created_at <= $${params.length}`;
        }

        params.push(limit, offset);

        const result = await pool.query(
            `SELECT sm.*, u.name AS performed_by_name
             FROM stock_movements sm
             LEFT JOIN users u ON sm.performed_by = u.id
             ${where}
             ORDER BY sm.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch stock movements error:', err);
        res.status(500).json({ error: 'Failed to fetch stock movements' });
    }
});

app.get('/api/stock/summary', auth, async (req, res) => {
    try {
        const branchResult = await pool.query(
            `SELECT id, name FROM organizations WHERE id = $1`,
            [req.user.organization_id]
        );
        const branch = branchResult.rows[0] || { id: req.user.organization_id, name: 'Unknown Branch' };

        const batchesResult = await pool.query(
            `SELECT b.id AS batch_id, b.batch_number, b.on_hand_quantity, b.expiry_date,
                    b.status, b.is_recalled,
                    p.product_name, p.gtin, p.manufacturer, p.strength
             FROM batches b
             JOIN products p ON b.product_id = p.id
             WHERE b.organization_id = $1
             ORDER BY p.product_name, b.batch_number`,
            [req.user.organization_id]
        );

        res.json({
            branch,
            batches: batchesResult.rows,
        });
    } catch (err) {
        console.error('Stock summary error:', err);
        res.status(500).json({ error: 'Failed to fetch stock summary' });
    }
});

// ============ BRANCH ROUTES ============

app.get('/api/branches', auth, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, name FROM organizations
             WHERE id <> $1
             ORDER BY name`,
            [req.user.organization_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Fetch branches error:', err);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

// ============ TRACE ROUTES ============

app.get('/api/trace/serial/:serialNumber', auth, async (req, res) => {
    try {
        const { serialNumber } = req.params;

        const unitCheck = await pool.query(
            `SELECT id, batch_number FROM serialized_units
             WHERE serial_number = $1 AND organization_id = $2`,
            [serialNumber, req.user.organization_id]
        );
        if (unitCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Serial not found' });
        }

        const result = await pool.query(
            `SELECT te.id, te.event_type, te.from_gln, te.to_gln, te.location,
                    te.event_data, te.created_at, te.batch_number,
                    u.name AS user_name
             FROM trace_events te
             LEFT JOIN users u ON te.user_id = u.id
             WHERE te.serial_number = $1 AND te.organization_id = $2
             ORDER BY te.created_at ASC`,
            [serialNumber, req.user.organization_id]
        );

        res.json({
            serial_number: serialNumber,
            batch_number: unitCheck.rows[0].batch_number,
            events: result.rows,
        });
    } catch (err) {
        console.error('Fetch serial trace error:', err);
        res.status(500).json({ error: 'Failed to fetch trace' });
    }
});

app.get('/api/trace/batch/:batchNumber', auth, async (req, res) => {
    try {
        const { batchNumber } = req.params;

        const batchCheck = await pool.query(
            `SELECT id FROM batches
             WHERE batch_number = $1 AND organization_id = $2`,
            [batchNumber, req.user.organization_id]
        );
        if (batchCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        const result = await pool.query(
            `SELECT te.id, te.event_type, te.serial_number, te.from_gln, te.to_gln,
                    te.location, te.event_data, te.created_at,
                    u.name AS user_name
             FROM trace_events te
             LEFT JOIN users u ON te.user_id = u.id
             WHERE te.batch_number = $1 AND te.organization_id = $2
             ORDER BY te.created_at ASC`,
            [batchNumber, req.user.organization_id]
        );

        res.json({
            batch_number: batchNumber,
            events: result.rows,
        });
    } catch (err) {
        console.error('Fetch batch trace error:', err);
        res.status(500).json({ error: 'Failed to fetch trace' });
    }
});

// ============ REPORT ROUTES ============

app.get('/api/reports/efda', auth, requireRole(['admin', 'auditor']), async (req, res) => {
    const { format = 'json', start_date, end_date } = req.query;
    const orgId = req.user.organization_id;

    try {
        // Event-centric: one row per trace_events row, scoped to the caller's branch.
        // Batch-level events (serial_number IS NULL) obtain product/batch info via batches.
        // Per-unit events obtain product/batch info via serialized_units. No LEFT JOIN
        // from serialized_units means no row multiplication.
        let query = `
            SELECT
                te.id                                              AS event_id,
                te.event_type,
                te.created_at                                      AS event_date,
                te.serial_number,
                COALESCE(te.batch_number, su.batch_number)         AS batch_number,
                COALESCE(su.gtin, p_batch.gtin)                    AS gtin,
                COALESCE(p_unit.product_name, p_batch.product_name) AS product_name,
                COALESCE(p_unit.manufacturer, p_batch.manufacturer) AS manufacturer,
                COALESCE(p_unit.strength, p_batch.strength)         AS strength,
                b.expiry_date,
                b.status                                           AS batch_status,
                b.is_recalled,
                te.from_gln,
                te.to_gln,
                te.location,
                te.event_data,
                u.name                                             AS performed_by_name,
                u.email                                            AS performed_by_email,
                te.organization_id
            FROM trace_events te
            LEFT JOIN users u
                   ON te.user_id = u.id
            LEFT JOIN serialized_units su
                   ON te.serial_number = su.serial_number
                  AND su.organization_id = te.organization_id
            LEFT JOIN batches b
                   ON b.batch_number = COALESCE(te.batch_number, su.batch_number)
                  AND b.organization_id = te.organization_id
            LEFT JOIN products p_unit
                   ON p_unit.gtin = su.gtin
                  AND p_unit.organization_id = te.organization_id
            LEFT JOIN products p_batch
                   ON p_batch.id = b.product_id
                  AND p_batch.organization_id = te.organization_id
            WHERE te.organization_id = $1
        `;
        const params = [orgId];
        let paramCount = 2;

        if (start_date) {
            query += ` AND te.created_at >= $${paramCount}`;
            params.push(start_date);
            paramCount++;
        }
        if (end_date) {
            query += ` AND te.created_at <= $${paramCount}`;
            params.push(end_date);
            paramCount++;
        }

        query += ` ORDER BY te.created_at DESC`;

        const result = await pool.query(query, params);

        if (format === 'csv') {
            const headers = [
                'event_id', 'event_type', 'event_date', 'serial_number', 'batch_number',
                'gtin', 'product_name', 'manufacturer', 'strength', 'expiry_date',
                'batch_status', 'is_recalled', 'from_gln', 'to_gln', 'location',
                'event_data', 'performed_by_name', 'performed_by_email', 'organization_id',
            ];
            const csvEscape = (v) => {
                if (v === null || v === undefined) return '';
                const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
                // quote if contains comma, quote, newline
                if (s.includes(',') || s.includes('"') || s.includes('\n')) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            };
            let csv = headers.join(',') + '\n';
            for (const row of result.rows) {
                csv += headers.map(h => csvEscape(row[h])).join(',') + '\n';
            }
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=efda-report-${Date.now()}.csv`);
            return res.send(csv);
        }

        res.json({
            report_date: new Date().toISOString(),
            total_records: result.rows.length,
            data: result.rows,
        });
    } catch (err) {
        console.error('Report generation error:', err);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// ============ ROOT ROUTE (Phase 8) ============
app.get('/', (req, res) => {
    res.json({
        name: 'PharmaTrace Ethiopia API',
        status: 'OK',
        version: '1.0.0',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Database readiness probe. Unlike /health, this checks the DB.
app.get('/readyz', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('Readiness check failed:', err.message);
        res.status(503).json({
            status: 'not_ready',
            timestamp: new Date().toISOString(),
        });
    }
});

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============ START SERVER ============
app.listen(PORT, () => {
    console.log(`\nðŸš€ Server running on http://localhost:${PORT}`);
    console.log(`ðŸ“¡ Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`ðŸ”— API URL: http://localhost:${PORT}`);
    console.log(`\nðŸ“‹ Available Endpoints:`);
    console.log(`   POST /api/auth/login`);
    console.log(`   POST /api/auth/register`);
    console.log(`   GET  /api/products`);
    console.log(`   POST /api/products`);
    console.log(`   PUT  /api/products/:id`);
    console.log(`   DELETE /api/products/:id`);
    console.log(`   GET  /api/batches`);
    console.log(`   POST /api/batches`);
    console.log(`   POST /api/verify     â† Scanner endpoint`);
    console.log(`   GET  /api/dashboard/stats`);
    console.log(`   GET  /api/dashboard/recent-activity`);
    console.log(`   GET  /api/dashboard/expiry-alerts`);
    console.log(`   GET  /api/recalls`);
    console.log(`   POST /api/recalls`);
    console.log(`   POST /api/stock/receive`);
    console.log(`   POST /api/stock/transfer`);
    console.log(`   POST /api/stock/dispense`);
    console.log(`   POST /api/stock/return`);
    console.log(`   POST /api/stock/adjust`);
    console.log(`   GET  /api/stock/movements`);
    console.log(`   GET  /api/stock/summary`);
    console.log(`   GET  /api/branches`);
    console.log(`   GET  /api/trace/serial/:serialNumber`);
    console.log(`   GET  /api/trace/batch/:batchNumber`);
    console.log(`   GET  /api/reports/efda`);
    console.log(`   GET  /api/admin/users`);
    console.log(`   GET  /api/admin/audit-logs`);
    console.log(`   GET  /`);
    console.log(`   GET  /health\n`);
});