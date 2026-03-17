import pool from './src/db.js';

async function alterGamesTable() {
    try {
        console.log('Adding plays column to games table...');
        await pool.query('ALTER TABLE games ADD COLUMN IF NOT EXISTS plays INTEGER DEFAULT 0;');
        console.log('✅ Column added successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error altering games table:', err.message);
        process.exit(1);
    }
}

alterGamesTable();
