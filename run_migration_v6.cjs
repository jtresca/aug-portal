const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function migrate() {
    const client = new Client({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });
    try {
        await client.connect();
        const sqlPath = path.join(__dirname, 'scripts', 'migrate_v6.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('Applying migration...');
        await client.query(sql);
        console.log('Migration successful');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
