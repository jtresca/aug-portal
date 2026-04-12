import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'aug_portal' // Or whatever it is from .env
});

async function run() {
  const res = await pool.query("SELECT * FROM games");
  console.log('Games count:', res.rows.length);
  const warGods = res.rows.filter(g => g.title === 'War Gods');
  if (warGods.length > 0) {
    console.log(warGods);
  }
  process.exit(0);
}
run();
