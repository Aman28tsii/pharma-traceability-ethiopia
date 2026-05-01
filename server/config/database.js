// server/config/database.js
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

// Handle empty password properly
const dbPassword = process.env.DB_PASSWORD === undefined ? '' : process.env.DB_PASSWORD;

console.log('📡 Database Config:', {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'pharma_traceability_db',
    user: process.env.DB_USER || 'postgres',
    password: dbPassword === '' ? '(empty)' : '***set***'
});

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'pharma_traceability_db',
    user: process.env.DB_USER || 'postgres',
    password: dbPassword, // This can be empty string
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// Test connection immediately
const testConnection = async () => {
    let client;
    try {
        client = await pool.connect();
        const result = await client.query('SELECT NOW() as time, current_database() as db, current_user as user');
        console.log('✅ Database connected successfully');
        console.log(`   Database: ${result.rows[0].db}`);
        console.log(`   User: ${result.rows[0].user}`);
        console.log(`   Time: ${result.rows[0].time}`);
        client.release();
        return true;
    } catch (err) {
        console.error('❌ Database connection error:', err.message);
        if (err.message.includes('password')) {
            console.error('   → Password issue. Try setting DB_PASSWORD= in .env');
        }
        if (err.message.includes('does not exist')) {
            console.error('   → Database does not exist. Run the schema first.');
        }
        if (err.message.includes('connect') || err.message.includes('timeout')) {
            console.error('   → PostgreSQL may not be running. Start it with: net start postgresql');
        }
        if (client) client.release();
        return false;
    }
};

export default pool;
export { testConnection };