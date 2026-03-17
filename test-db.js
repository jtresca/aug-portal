import pool from './src/db.js';

async function testConnection() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('✅ Connection Successful! Database Time:', res.rows[0].now);
        process.exit(0);
    } catch (err) {
        console.error('❌ Connection Error:', err.message);
        process.exit(1);
    }
}

testConnection();
