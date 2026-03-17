import pg from 'pg';
import dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

// Debug log to ensure env is loaded (Safe)
if (!process.env.DB_PASSWORD) {
    console.error('FATAL: DB_PASSWORD is not defined in process.env. Check .env path.');
}

// This "Pool" manages multiple connections so your site stays fast
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

export default pool;