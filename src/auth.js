import pool from './db.js';
import bcrypt from 'bcrypt';

/**
 * Registers a new user and creates their associated profile.
 * Uses a transaction to ensure both records are created together.
 */
export const registerUser = async (email, password, isCreator, profileData) => {
    // 1. Password Complexity Check
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        throw new Error('Password does not meet complexity requirements.');
    }

    // 2. Duplicate Check (Username or Studio Name)
    if (isCreator) {
        const studioRes = await pool.query('SELECT 1 FROM creator_profiles WHERE studio_name ILIKE $1', [profileData.studioName]);
        if (studioRes.rows.length > 0) throw new Error('Studio name taken already');
    } else {
        const userRes = await pool.query('SELECT 1 FROM fan_profiles WHERE username ILIKE $1', [profileData.username]);
        if (userRes.rows.length > 0) throw new Error('Username exists already');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 2. Hash the password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 3. Insert into users table
        const userRes = await client.query(
            'INSERT INTO users (email, password_hash, is_creator) VALUES ($1, $2, $3) RETURNING id',
            [email, passwordHash, isCreator]
        );
        const userId = userRes.rows[0].id;

        // 4. Create associated wallet
        await client.query(
            'INSERT INTO wallets (user_id, balance_points) VALUES ($1, 0)',
            [userId]
        );

        // 5. Insert into specific profile table
        if (isCreator) {
            await client.query(
                'INSERT INTO creator_profiles (user_id, studio_name) VALUES ($1, $2)',
                [userId, profileData.studioName]
            );
        } else {
            await client.query(
                'INSERT INTO fan_profiles (user_id, username) VALUES ($1, $2)',
                [userId, profileData.username]
            );
        }

        await client.query('COMMIT');
        return { 
            success: true, 
            user: {
                id: userId,
                email: email,
                isCreator: isCreator
            }
        };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Registration error:', error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Validates a user's credentials and returns user details on success.
 */
export const loginUser = async (email, password) => {
    try {
        // 1. Find the user by email
        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (res.rows.length === 0) {
            return { success: false, message: 'User not found' };
        }

        const user = res.rows[0];

        // 2. Compare the provided password with the stored hash
        const match = await bcrypt.compare(password, user.password_hash);

        if (match) {
            return {
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    isCreator: user.is_creator
                }
            };
        } else {
            return { success: false, message: 'Invalid password' };
        }
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};