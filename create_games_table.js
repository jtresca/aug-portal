import pool from './src/db.js';

async function createGamesTable() {
    const query = `
        CREATE TABLE IF NOT EXISTS games (
            id SERIAL PRIMARY KEY,
            creator_id INTEGER REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
            title VARCHAR(150) NOT NULL,
            slug VARCHAR(150) UNIQUE NOT NULL,
            thumbnail_url TEXT,
            game_file_path TEXT NOT NULL,
            category VARCHAR(50),
            is_published BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        console.log('Creating games table...');
        await pool.query(query);
        console.log('✅ Games table created successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error creating games table:', err.message);
        process.exit(1);
    }
}

createGamesTable();
