-- AUG Schema 
-- 1. The Core Identity (Shared Auth)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_creator BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Fan Profiles (Role-Specific Data)
CREATE TABLE fan_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    username VARCHAR(50) UNIQUE NOT NULL,
    xp_points INTEGER DEFAULT 0
);

-- 3. Creator Profiles (Business-Specific Data)
CREATE TABLE creator_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    studio_name VARCHAR(100) UNIQUE NOT NULL,
    wallet_balance DECIMAL(12, 2) DEFAULT 0.00,
    is_verified BOOLEAN DEFAULT FALSE
);

-- 4. Games Catalog
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER REFERENCES creator_profiles(user_id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    slug VARCHAR(150) UNIQUE NOT NULL,
    thumbnail_url TEXT,
    game_file_path TEXT NOT NULL,
    plays INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
