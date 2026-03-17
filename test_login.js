import { loginUser } from './src/auth.js';

async function runLoginTest() {
    console.log('🔑 Testing login for: joe@firstmoongames.com');

    try {
        // We're testing with the email you just updated in the DB
        // and the password used in your registration test
        const result = await loginUser('joe@firstmoongames.com', 'password123');

        if (result.success) {
            console.log('✅ Login Successful!');
            console.log('👋 Welcome back, User ID:', result.user.id);
            console.log('🏢 Creator Status:', result.user.isCreator ? 'Verified Studio' : 'Fan');
        } else {
            console.log('❌ Login Failed:', result.message);
        }
    } catch (err) {
        console.error('💥 An error occurred during the test:', err.message);
    } finally {
        process.exit();
    }
}

runLoginTest();