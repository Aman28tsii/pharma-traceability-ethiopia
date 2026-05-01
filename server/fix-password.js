import pg from 'pg';
import bcrypt from 'bcryptjs';

const client = new pg.Client({
    host: 'localhost',
    port: 5432,
    database: 'pharma_traceability_db',
    user: 'postgres',
    password: 'postgres123',
});

async function fixPassword() {
    try {
        await client.connect();
        
        // Generate correct hash for 'admin123'
        const hash = await bcrypt.hash('admin123', 10);
        console.log('New hash:', hash);
        
        // Update the password
        await client.query(
            "UPDATE users SET password = $1 WHERE email = 'admin@pharma.com'",
            [hash]
        );
        
        console.log('✅ Password updated!');
        
        // Verify it works
        const result = await client.query("SELECT password FROM users WHERE email = 'admin@pharma.com'");
        const isValid = await bcrypt.compare('admin123', result.rows[0].password);
        console.log('Verification:', isValid ? '✅ SUCCESS' : '❌ FAILED');
        
        await client.end();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

fixPassword();