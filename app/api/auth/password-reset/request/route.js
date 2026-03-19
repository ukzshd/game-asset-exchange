import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assertTrustedOrigin } from '@/lib/request-security';
import { normalizeEmail, isValidEmail } from '@/lib/validation';
import { generateOpaqueToken, hashOpaqueToken, sendEmail } from '@/lib/email';
import { getAppUrl } from '@/lib/env';

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        const body = await request.json();
        const email = normalizeEmail(body?.email || '');

        if (!email || !isValidEmail(email)) {
            return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
        }

        const db = await getDb();
        const user = await db.prepare('SELECT id, email, username FROM users WHERE email = ? AND is_active = 1').get(email);

        if (user) {
            const token = generateOpaqueToken();
            const tokenHash = hashOpaqueToken(token);
            await db.prepare(`
                INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                VALUES (?, ?, NOW() + INTERVAL '1 hour')
            `).run(user.id, tokenHash);

            const resetUrl = `${getAppUrl(request)}/forgot-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
            await sendEmail({
                to: user.email,
                subject: 'Reset your password',
                text: `Hello ${user.username}, use the following link to reset your password: ${resetUrl}`,
            });
        }

        return NextResponse.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Password reset request error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
