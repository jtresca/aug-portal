import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import session from 'express-session';
import { registerUser, loginUser } from './src/auth.js';
import bcrypt from 'bcrypt';
import { sendRecoveryCode } from './src/utils/mailer.js';

// Setup env and pathing for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
// Database Connection
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'anime_universe_db'
});

// DB Cleanup/Migration Check
(async () => {
    try {
        await pool.query(`
            DO $$ 
            BEGIN 
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='password_resets' AND column_name='code') THEN
                    ALTER TABLE password_resets DROP COLUMN code;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='password_resets' AND column_name='token_hash') THEN
                    ALTER TABLE password_resets ADD COLUMN token_hash TEXT;
                END IF;
            END $$;
        `);
        console.log('Database schema for recovery flow verified.');
    } catch (err) {
        console.error('Schema migration check failed:', err);
    }
})();

// Initialize users table
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    google_id VARCHAR(255) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error('Error creating users table:', err));

// Middleware
app.use(cors());
app.use(express.json());

// GLOBAL REQUEST LOGGER
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        console.log(`[API REQUEST] ${req.method} ${req.path}`);
        if (req.method === 'POST') console.log('Body:', JSON.stringify(req.body));
    }
    next();
});

// Security Headers for WebGPU / SharedArrayBuffer / OPFS
app.use((req, res, next) => {
  // Allow all origins for assets (CORP)
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  
  // Explicit MIME Fixes for Game Loading Errors
  if (req.url.endsWith('.html')) {
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  } else if (req.url.endsWith('.js') || req.url.endsWith('.js.unityweb')) {
    res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
  } else if (req.url.endsWith('.wasm') || req.url.endsWith('.wasm.unityweb')) {
    res.setHeader('Content-Type', 'application/wasm');
  } else if (req.url.endsWith('.data.unityweb')) {
    res.setHeader('Content-Type', 'application/octet-stream');
  } else if (req.url.endsWith('.mp4')) {
    res.setHeader('Content-Type', 'video/mp4');
  }

  next();
});

// Session & Passport Authentication Middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'aug_super_secret_session_key',
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport Google Strategy Scaffolding
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_client_id_pending_setup',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_secret_pending_setup',
    callbackURL: "/auth/google/callback"
  },
  async function(accessToken, refreshToken, profile, cb) {
    try {
      const email = profile.emails[0].value;
      const googleId = profile.id;
      const displayName = profile.displayName;
      const avatarUrl = profile.photos && profile.photos.length > 0 
        ? profile.photos[0].value.replace('=s96-c', '=s200-c') 
        : null;

      // 1. Check if user already exists based on google_id
      const res = await pool.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
      
      if (res.rows.length > 0) {
        // User exists, return the user row
        return cb(null, res.rows[0]);
      } else {
        // 2. User doesn't exist, create a new row
        const insertRes = await pool.query(
          'INSERT INTO users (google_id, email, display_name, avatar_url) VALUES ($1, $2, $3, $4) RETURNING *',
          [googleId, email, displayName, avatarUrl]
        );
        return cb(null, insertRes.rows[0]);
      }
    } catch (err) {
      return cb(err, null);
    }
  }
));

// Basic session serialization mock
passport.serializeUser((user, done) => {
  done(null, user.id); // Store only ID in session
});

passport.deserializeUser(async (id, done) => {
  try {
    const res = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (res.rows.length > 0) {
      done(null, res.rows[0]);
    } else {
      done(null, false);
    }
  } catch (err) {
    done(err, null);
  }
});

// ** API ROUTES **

// ** AUTHENTICATION ROUTES **
app.get('/api/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json({ user: null });
  }
});

// ** SECURE PASSWORD RECOVERY FLOW (Lead Architect Refactor) **

app.post('/api/auth/forgot', async (req, res) => {
    const { email } = req.body;
    console.log('[RECOVERY] Forgot password request for:', email);
    try {
        const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) {
            console.log('[RECOVERY] Email not found:', email);
            return res.status(200).set('Content-Type', 'application/json').json({ success: false, message: 'Email not found' });
        }
        
        const userId = userRes.rows[0].id;
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        
        const saltRounds = 10;
        const tokenHash = await bcrypt.hash(code, saltRounds);

        await pool.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);
        await pool.query(
            'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [userId, tokenHash, expiresAt]
        );

        const emailSent = await sendRecoveryCode(email, code);
        if (!emailSent) {
            console.error('[RECOVERY] Failed to send recovery email to:', email);
            return res.status(200).json({ success: false, message: 'Failed to send recovery email. Please contact support.' });
        }

        res.json({ success: true, message: 'Recovery code sent' });
    } catch (err) {
        console.error('[RECOVERY] Auth forgot error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/auth/reset', async (req, res) => {
    const { email, code, newPassword } = req.body;
    try {
        const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userRes.rows.length === 0) return res.status(200).set('Content-Type', 'application/json').json({ success: false, message: 'User not found' });
        
        const userId = userRes.rows[0].id;
        const resetRes = await pool.query(
            'SELECT * FROM password_resets WHERE user_id = $1 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [userId]
        );

        if (resetRes.rows.length === 0) return res.status(200).set('Content-Type', 'application/json').json({ success: false, message: 'Invalid or expired code' });

        const isMatch = await bcrypt.compare(code, resetRes.rows[0].token_hash);
        if (!isMatch) return res.status(200).set('Content-Type', 'application/json').json({ success: false, message: 'Invalid or expired code' });

        const passwordHash = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
        await pool.query('DELETE FROM password_resets WHERE user_id = $1', [userId]);

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        console.error('[RECOVERY] Auth reset error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ** STATIC SERVING **
// Serve the main Vanilla UI
app.use(express.static(path.join(__dirname, 'public')));
// Serve game files (creators would upload to here, or a cloud bucket)
app.use('/games-data', express.static(path.join(__dirname, 'games-data')));

// ** API ROUTES **

// ** AUTHENTICATION ROUTES **
app.get('/auth/google', (req, res, next) => {
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', { 
    failureRedirect: '/',
    failureMessage: true 
  })(req, res, (err) => {
    if (err) {
      console.error('Passport Auth Error:', err);
      return res.status(500).send('Auth Error: ' + err.message);
    }
    res.redirect('/');
  });
});

app.get('/auth/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.redirect('/');
  });
});

// ** NATIVE AUTH ROUTES **
app.post('/api/auth/register', async (req, res) => {
    const { email, password, username, isCreator, studioName } = req.body;
    try {
        const result = await registerUser(email, password, !!isCreator, { username, studioName });
        if (result.success) {
            res.json({ success: true, user: result.user });
        } else {
            res.status(200).json(result);
        }
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await loginUser(email, password);
        if (result.success) {
            req.login(result.user, (err) => {
                if (err) return res.status(500).json({ success: false, message: 'Session error' });
                res.json({ success: true, user: result.user });
            });
        } else {
            res.status(200).json(result);
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ** ANALYTICS ROUTES **

// Increment game plays
app.post('/api/games/:id/play', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('UPDATE games SET plays = plays + 1 WHERE id = $1 RETURNING plays', [id]);
        res.json({ success: true, plays: result.rows[0].plays });
    } catch (err) {
        console.error('Error incrementing plays:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Start a game session
app.post('/api/analytics/session/start', async (req, res) => {
    const { gameId } = req.body;
    const userId = req.user ? req.user.id : null;
    try {
        const result = await pool.query(
            'INSERT INTO game_sessions (game_id, user_id) VALUES ($1, $2) RETURNING id',
            [gameId, userId]
        );
        res.json({ sessionId: result.rows[0].id });
    } catch (err) {
        console.error('Error starting session:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// End a game session
app.post('/api/analytics/session/end', async (req, res) => {
    const { sessionId } = req.body;
    try {
        await pool.query(`
            UPDATE game_sessions 
            SET end_time = CURRENT_TIMESTAMP,
                duration = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - start_time))
            WHERE id = $1
        `, [sessionId]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error ending session:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

let cachedMockGames = null;

// GET /api/games : Fetch games for the UI grid
app.get('/api/games', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT g.id, g.title, g.slug, g.thumbnail_url, g.game_file_path, g.category, g.plays, cp.studio_name
      FROM games g
      JOIN creator_profiles cp ON g.creator_id = cp.user_id
      WHERE g.is_published = TRUE
      ORDER BY g.plays DESC, g.created_at DESC
    `);
    
        // If no games exist, return a large mock set for testing the dense UI
    if (result.rows.length === 0) {
        if (!cachedMockGames) {
            cachedMockGames = [];
            
            // The 10 locally generated full-bleed anime game artworks (Quota reached on last 2)
            const localThumbs = [
                '/images/game_cafe_bakery_1773630388790.png',
                '/images/game_cyberpunk_city_1773630427116.png',
                '/images/game_magic_academy_1773630414971.png',
                '/images/game_mermaid_ocean_1773630468558.png',
                '/images/game_ninja_stealth_1773630441926.png',
                '/images/game_racing_drift_1773630400854.png',
                '/images/game_rpg_fantasy_1773630361921.png',
                '/images/game_sci_fi_mech_1773630375234.png',
                '/images/game_space_explore_1773630454756.png',
                '/images/game_spooky_mansion_1773630481969.png'
            ];
            
            // Math for exactly 15 rows:
            // 15 cols * 15 rows = 225 grid cells required.
            // Header uses 2 cells. Large tiles (3) use 27 cells. Medium tiles (9) use 36 cells.
            // Small tiles needed = 225 - 2 - 27 - 36 = 160 cells. 
            const catNames = ['ACTION GAMES', 'ADVENTURE GAMES', 'BIKE GAMES', 'CAR GAMES', 'MULTIPLAYER GAMES', 'GAMES FOR GIRLS', 'ANIMAL GAMES', 'SHOOTING GAMES', 'PUZZLE GAMES', 'FIGHTING GAMES', 'FUNNY GAMES', 'SCARY GAMES', 'RPG GAMES', 'STRATEGY GAMES', 'ZOMBIE GAMES', 'ARCADE GAMES'];
            
            for(let i=1; i<=172; i++) {
                const mod = i % 4;
                let title, path;
                if (mod === 0) {
                    title = `WebGPU Population VFX ${i}`;
                    path = '/games/geo-vfx/index.html';
                } else if (mod === 1) {
                    title = i === 1 ? 'WebGPU Graphics Example' : `WebGPU Graphics Example ${i}`;
                    path = '/games/unity-webgpu/index.html';
                } else if (mod === 2) {
                    title = `Interactive Volume Demo ${i}`;
                    path = '/games/marching-cubes/index.html';
                } else {
                    title = `WebGPU Voxel Character ${i}`;
                    path = '/games/metavido-vfx/index.html';
                }

                cachedMockGames.push({
                    id: i,
                    title: title,
                    slug: `webgpu-demo-${i}`,
                    thumbnail_url: localThumbs[i % localThumbs.length],
                    preview_url: '/video_preview.mp4', 
                    game_file_path: path,
                    category: catNames[i % catNames.length],
                    plays: 1000000 - i,
                    studio_name: 'AUG Legacy'
                });
            }
            // No sorting needed, they are already in a stable order
        }
        
        return res.json({ games: cachedMockGames });
    }

    res.json({ games: result.rows });
  } catch (err) {
    console.error('Error fetching games:', err);
    res.status(500).json({ error: 'Server error fetching games' });
  }
});

// GET /api/categories : Fetch category layout for the UI grid
app.get('/api/categories', (req, res) => {
    const mockCategories = [
        { name: 'FIGHTING GAMES', size: 'large', image: '/images/cat_fighting_1773680376704.png' },
        { name: 'PUZZLE GAMES', size: 'large', image: '/images/cat_puzzle_1773680390733.png' },
        { name: 'SHOOTING GAMES', size: 'large', image: '/images/cat_shooting_1773680404946.png' },
        { name: 'ANIMAL GAMES', size: 'large', image: '/images/cat_animal_1773680423200.png' },
        { name: 'GAMES FOR GIRLS', size: 'large', image: '/images/cat_girls_1773680436243.png' },
        { name: 'MULTIPLAYER GAMES', size: 'small', image: '/images/cat_multiplayer_1773680450764.png' },
        { name: 'ACTION GAMES', size: 'small', image: '/images/cat_action_1773680466129.png' },
        { name: 'CAR GAMES', size: 'small', image: '/images/cat_car_1773680478242.png' },
        { name: 'SPORTS GAMES', size: 'small', image: '/images/cat_sports_1773680492990.png' },
        { name: 'FUNNY GAMES', size: 'small', image: '/images/cat_funny_1773680505943.png' },
        { name: 'SCARY GAMES', size: 'small', image: '/images/cat_scary_1773680517118.png' },
        { name: 'RPG GAMES', size: 'small', image: '/images/cat_rpg_1773680528866.png' },
        { name: 'STRATEGY GAMES', size: 'small', image: '/images/cat_strategy_1773680544124.png' },
        { name: 'ZOMBIE GAMES', size: 'small', image: '/images/cat_zombie_1773680557850.png' },
        { name: 'ARCADE GAMES', size: 'small', image: '/images/cat_arcade_1773680573784.png' }
    ];
    res.json({ categories: mockCategories });
});

// POST /api/games/upload : Simplified mock route for testing
app.post('/api/games/upload', async (req, res) => {
    // In a real app this uses multer + JWT auth verification
    // For now we just echo success to satisfy requirements
    res.json({ success: true, message: 'Game uploaded (mock)' });
});

// Creator Dashboard Routes
app.get('/creator/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'creator', 'dashboard.html'));
});

// API: Creator Revenue (90/10 Split)
app.get('/api/creator/revenue', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  try {
    const creatorId = req.user.id;
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_gross,
        COALESCE(SUM(amount * 0.9), 0) as creator_share,
        COALESCE(SUM(amount * 0.1), 0) as platform_fee,
        COUNT(*) filter (where id is not null) as total_transactions
      FROM transactions t
      JOIN games g ON t.game_id = g.id
      WHERE g.creator_id = $1 AND t.status = 'completed'
    `, [creatorId]);

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching revenue:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// API: Game Submission
app.post('/api/games/submit', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const { title, slug, thumbnail_url, description } = req.body;
  const creatorId = req.user.id;

  try {
    const result = await pool.query(`
      INSERT INTO games (creator_id, title, slug, thumbnail_url, description, is_published, game_file_path)
      VALUES ($1, $2, $3, $4, $5, false, 'pending')
      RETURNING *
    `, [creatorId, title, slug, thumbnail_url, description]);
    
    res.json({ success: true, game: result.rows[0] });
  } catch (err) {
    console.error('Error submitting game:', err);
    res.status(500).json({ error: 'Failed to submit game. Check if slug is unique.' });
  }
});

// API: Log Transaction (from SDK Bridge)
app.post('/api/transactions/log', async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ error: 'Unauthorized' });
  
  const { gameId, sku, amount, type } = req.body;
  const userId = req.user.id;

  try {
    const result = await pool.query(`
      INSERT INTO transactions (user_id, game_id, sku, amount, status, transaction_type)
      VALUES ($1, $2, $3, $4, 'completed', $5)
      RETURNING *
    `, [userId, gameId, sku, amount, type || 'iap']);
    
    res.json({ success: true, transaction: result.rows[0] });
  } catch (err) {
    console.error('Error logging transaction:', err);
    res.status(500).json({ error: 'Failed to log transaction.' });
  }
});

// Developer Sandbox Route
app.get('/developer/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'developer', 'test.html'));
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
