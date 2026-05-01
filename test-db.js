import pg from 'pg';
const { Client } = pg;

const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'pharma_traceability_db',
    user: 'postgres',
    password: 'postgres123',
});

async function test() {
    try {
        await client.connect();
        console.log('✅ Connected successfully!');
        const res = await client.query('SELECT NOW() as time, current_database() as db');
        console.log(`   Database: ${res.rows[0].db}`);
        console.log(`   Time: ${res.rows[0].time}`);
        await client.end();
    } catch (err) {
        console.error('❌ Connection failed:', err.message);
    }
}

test();