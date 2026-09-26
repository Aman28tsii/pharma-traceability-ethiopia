// server/config/database.js
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory (server/.env)
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

// ---------------------------------------------------------------------------
// Single source of truth for the DB pool.
//
// This module mirrors the pool configuration used inline in server/index.js
// so that anything importing from this file (e.g. middleware/auth.js) talks
// to the SAME database as everything else.
//
// Previously this file unconditionally built a localhost-only pool, which
// caused middleware/auth.js to fail on Render with "Auth lookup failed"
// because it could not reach a local Postgres.
// ---------------------------------------------------------------------------

let pool;

if (process.env.NODE_ENV === 'production') {
    console.log('🔵 [config/database.js] PRODUCTION mode - using DATABASE_URL (Neon)');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false,
            require: true,
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
} else {
    const dbPassword = process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD;
    console.log('🟢 [config/database.js] DEVELOPMENT mode - using local DB', {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'pharma_traceability_db',
        user: process.env.DB_USER || 'postgres',
        password: dbPassword === '' ? '(empty)' : '***set***',
    });
    pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'pharma_traceability_db',
        user: process.env.DB_USER || 'postgres',
        password: dbPassword,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    });
}

// Prevent unhandled pool errors from crashing the process (Neon cold-starts).
pool.on('error', (err) => {
    console.error('⚠️ [config/database.js] Idle pool error (handled):', err.message);
});

// ---------------------------------------------------------------------------
// Named export for the dead controllers that import `{ query }`.
// Safe to leave unused; if any of those files ever gets wired up, it works.
// ---------------------------------------------------------------------------
export const query = (text, params) => pool.query(text, params);

// ---------------------------------------------------------------------------
// Startup connectivity probe (optional to call). Never throws.
// ---------------------------------------------------------------------------
export const testConnection = async () => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query(
            'SELECT NOW() as time, current_database() as db, current_user as "user"'
        );
        console.log('✅ [config/database.js] Database connected');
        console.log(`   Database: ${result.rows[0].db}`);
        console.log(`   User: ${result.rows[0].user}`);
        console.log(`   Time: ${result.rows[0].time}`);
        return true;
    } catch (err) {
        console.error('❌ [config/database.js] Database connection error:', err.message);
        if (err.message.includes('password')) {
            console.error('   → Password issue. Check DB_PASSWORD or DATABASE_URL.');
        }
        if (err.message.includes('does not exist')) {
            console.error('   → Database does not exist. Run schema first.');
        }
        if (err.message.includes('connect') || err.message.includes('timeout')) {
            console.error('   → Postgres may not be reachable from this environment.');
        }
        return false;
    } finally {
        if (client) client.release();
    }
};

export default pool;