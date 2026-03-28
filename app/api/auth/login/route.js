import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { assertRateLimit } from '@/lib/rate-limit';
import { assertTrustedOrigin } from '@/lib/request-security';
import { normalizeEmail } from '@/lib/validation';
import { verifyEmailCode } from '@/lib/email-verification';

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        assertRateLimit(request, 'auth-login', { limit: 12, windowMs: 15 * 60 * 1000 });

        const body = await request.json();
        const email = normalizeEmail(body?.email);
        const password = body?.password || '';
        const verifyCode = String(body?.verifyCode || '').trim();

        if (!email || (!password && !verifyCode)) {
            return NextResponse.json({ error: 'Email and password or verification code are required' }, { status: 400 });
        }

        const db = await getDb();
        const user = await db.prepare(`
            SELECT id, email, password_hash, username, avatar_url, google_id, discord_id, steam_id,
                   role, embark_id, phone, referral_code, referred_by, is_active, created_at
            FROM users
            WHERE email = ?
        `).get(email);

        if (!user || user.is_active === 0) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const valid = verifyCode
            ? await verifyEmailCode({ email, purpose: 'login', code: verifyCode })
            : await verifyPassword(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: verifyCode ? 'Invalid or expired verification code' : 'Invalid email or password' }, { status: 401 });
        }

        const token = await generateToken(user);

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                avatar_url: user.avatar_url,
                google_id: user.google_id,
                discord_id: user.discord_id,
                steam_id: user.steam_id,
                role: user.role,
                embark_id: user.embark_id,
                phone: user.phone,
                referral_code: user.referral_code,
                referred_by: user.referred_by,
                created_at: user.created_at,
            },
            token,
        });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
