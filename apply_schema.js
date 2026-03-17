import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './src/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applySchema() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        
        console.log('Running schema.sql...');
        await pool.query(schemaSql);
        console.log('✅ Schema applied successfully!');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Error applying schema:', err.message);
        process.exit(1);
    }
}

applySchema();
