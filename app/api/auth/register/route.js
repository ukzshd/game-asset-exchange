import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { hashPassword, generateToken, generateReferralCode } from '@/lib/auth';

export async function POST(request) {
    try {
        const { email, password, username, referredBy } = await request.json();

        if (!email || !password || !username) {
            return NextResponse.json({ error: 'Email, password, and username are required' }, { status: 400 });
        }

        if (password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        const db = getDb();

        // Check if email already exists
        const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existing) {
            return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
        }

        const passwordHash = await hashPassword(password);
        const referralCode = generateReferralCode();

        const result = db.prepare(
            'INSERT INTO users (email, password_hash, username, referral_code, referred_by) VALUES (?, ?, ?, ?, ?)'
        ).run(email, passwordHash, username, referralCode, referredBy || '');

        const user = db.prepare('SELECT id, email, username, role, referral_code, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
        const token = await generateToken(user);

        return NextResponse.json({ user, token }, { status: 201 });
    } catch (error) {
        console.error('Register error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
