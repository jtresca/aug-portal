const { Pool } = require("pg");
require("dotenv").config({ path: "c:/Projects/aug/aug-portal/.env" });

(async () => {
    const pool = new Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT,
    });

    try {
        console.log("Starting Phase 3 Migrations...");

        // 1. Password Resets Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS password_resets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                code VARCHAR(6) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Table 'password_resets' checked/created.");

        // 2. Wallets Table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS wallets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                balance_points INTEGER DEFAULT 0,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Table 'wallets' checked/created.");

        // 3. Ensure all existing users have a wallet
        await pool.query(`
            INSERT INTO wallets (user_id)
            SELECT id FROM users
            ON CONFLICT (user_id) DO NOTHING;
        `);
        console.log("Wallets initialized for existing users.");

        console.log("Phase 3 Migrations completed successfully!");
    } catch (e) {
        console.error("Migration failed:", e);
    } finally {
        await pool.end();
    }
})();
