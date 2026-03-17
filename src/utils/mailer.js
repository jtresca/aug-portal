/**
 * Brevo Mailer Utility
 * Handles transactional email sending using Brevo API
 */

export const sendRecoveryCode = async (email, code) => {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
        console.error('BREVO_API_KEY not found in environment');
        return false;
    }

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': apiKey,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { 
                    name: process.env.FROM_NAME || 'AUG Portal', 
                    email: process.env.FROM_EMAIL || 'no-reply@augportal.com' 
                },
                to: [{ email: email }],
                subject: 'Account Security: 6-Digit Recovery Code',
                htmlContent: `
                    <div style="font-family: sans-serif; padding: 30px; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px;">
                        <h2 style="color: #682dba; margin-top: 0;">Password Recovery</h2>
                        <p>We received a request to access your AUG account. Use the verification code below to complete the reset process:</p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <div style="font-size: 42px; font-weight: 900; color: #682dba; letter-spacing: 5px; background: #f8fafc; padding: 20px; border-radius: 12px; display: inline-block; border: 2px dashed #cbd5e1;">
                                ${code}
                            </div>
                        </div>
                        
                        <p style="font-weight: 600;">This code is valid for 5 minutes.</p>
                        <p>If you did not request this code, your account is still secure. No further action is required.</p>
                        
                        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
                        <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                            AUG Portal &copy; 2026<br>
                            Secure Identity System
                        </p>
                    </div>
                `
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Brevo API Error Detail:', JSON.stringify(error, null, 2));
            return false;
        }

        return true;
    } catch (err) {
        console.error('Error sending email via Brevo:', err);
        return false;
    }
};
