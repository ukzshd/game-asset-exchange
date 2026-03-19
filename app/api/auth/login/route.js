import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { assertRateLimit } from '@/lib/rate-limit';
import { assertTrustedOrigin } from '@/lib/request-security';
import { normalizeEmail } from '@/lib/validation';

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        assertRateLimit(request, 'auth-login', { limit: 12, windowMs: 15 * 60 * 1000 });

        const body = await request.json();
        const email = normalizeEmail(body?.email);
        const password = body?.password || '';

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const db = await getDb();
        const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user || user.is_active === 0) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        const token = await generateToken(user);

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
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
