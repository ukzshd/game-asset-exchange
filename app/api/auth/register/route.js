import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, generateToken, generateReferralCode } from '@/lib/auth';
import { assertRateLimit } from '@/lib/rate-limit';
import { assertTrustedOrigin } from '@/lib/request-security';
import { normalizeEmail, cleanText, isValidEmail, isStrongEnoughPassword } from '@/lib/validation';

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        assertRateLimit(request, 'auth-register', { limit: 10, windowMs: 15 * 60 * 1000 });

        const body = await request.json();
        const email = normalizeEmail(body?.email);
        const password = body?.password || '';
        const username = cleanText(body?.username, 64);
        const referredBy = cleanText(body?.referredBy, 32).toUpperCase();

        if (!email || !password || !username) {
            return NextResponse.json({ error: 'Email, password, and username are required' }, { status: 400 });
        }
        if (!isValidEmail(email)) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }
        if (!isStrongEnoughPassword(password)) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
        }

        const db = await getDb();
        const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
        }

        let referralCode = generateReferralCode();
        while (await db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCode)) {
            referralCode = generateReferralCode();
        }

        const passwordHash = await hashPassword(password);
        const result = await db.prepare(
            'INSERT INTO users (email, password_hash, username, referral_code, referred_by) VALUES (?, ?, ?, ?, ?)'
        ).run(email, passwordHash, username, referralCode, referredBy || '');

        const user = await db.prepare(`
            SELECT id, email, username, role, embark_id, phone, referral_code, referred_by, created_at
            FROM users WHERE id = ?
        `).get(result.lastInsertRowid);
        const token = await generateToken(user);

        return NextResponse.json({ user, token }, { status: 201 });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Register error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
