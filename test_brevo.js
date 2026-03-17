import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const testBrevo = async () => {
    const apiKey = process.env.BREVO_API_KEY;
    const targetEmail = 'joe@animeuniverse.com';
    
    console.log('Testing Key:', apiKey.substring(0, 10) + '...');
    console.log('Target Email:', targetEmail);

    try {
        console.log('Sending test email...');
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: 'AUG Portal Test', email: 'no-reply@augportal.com' },
                to: [{ email: targetEmail }],
                subject: 'Test Email from AUG CLI',
                htmlContent: '<h1>Hello!</h1><p>If you see this, Brevo is working.</p>'
            })
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Body:', JSON.stringify(data, null, 2));

        if (response.ok) {
            console.log('\n--- SUCCESS: EMAIL ACCEPTED BY BREVO ---');
        } else {
            console.log('\n--- FAILED ---');
            if (data.code === 'unauthorized') {
                console.log('API key is still being rejected.');
            } else if (data.message && data.message.includes('sender')) {
                console.log('The sender email no-reply@augportal.com might not be verified.');
            }
        }
    } catch (err) {
        console.error('Fetch Error:', err);
    }
};

testBrevo();
