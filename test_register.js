import { registerUser } from './src/auth.js';

async function runTest() {
    try {
        console.log('🚀 Attempting to register "First Moon Studios"...');

        const result = await registerUser(
            'joe@firstmoongames.com',
            'password123',
            true, // isCreator
            { studioName: 'First Moon Games' }
        );

        if (result.success) {
            console.log('✅ Success! Creator account created with ID:', result.userId);
        }
    } catch (err) {
        if (err.code === '23505') {
            console.log('⚠️  Note: That email or studio name already exists in the DB.');
        } else {
            console.error('❌ Test failed:', err.message);
        }
    } finally {
        process.exit();
    }
}

runTest();