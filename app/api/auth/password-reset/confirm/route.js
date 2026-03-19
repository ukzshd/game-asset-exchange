import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { assertTrustedOrigin } from '@/lib/request-security';
import { hashOpaqueToken } from '@/lib/email';
import { hashPassword } from '@/lib/auth';
import { isStrongEnoughPassword, normalizeEmail } from '@/lib/validation';

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        const body = await request.json();
        const email = normalizeEmail(body?.email || '');
        const token = body?.token || '';
        const password = body?.password || '';

        if (!email || !token || !isStrongEnoughPassword(password)) {
            return NextResponse.json({ error: 'Valid email, token, and password are required' }, { status: 400 });
        }

        const db = await getDb();
        const user = await db.prepare('SELECT id FROM users WHERE email = ? AND is_active = 1').get(email);
        if (!user) {
            return NextResponse.json({ error: 'Invalid reset request' }, { status: 400 });
        }

        const tokenHash = hashOpaqueToken(token);
        const resetToken = await db.prepare(`
            SELECT id
            FROM password_reset_tokens
            WHERE user_id = ?
              AND token_hash = ?
              AND used_at IS NULL
              AND expires_at > NOW()
            ORDER BY created_at DESC
            LIMIT 1
        `).get(user.id, tokenHash);

        if (!resetToken) {
            return NextResponse.json({ error: 'Reset token is invalid or expired' }, { status: 400 });
        }

        const passwordHash = await hashPassword(password);
        const tx = db.transaction(async () => {
            await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);
            await db.prepare('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?').run(resetToken.id);
        });
        await tx();

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Password reset confirm error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
