import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const db = getDb();
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

        if (!user) {
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
                created_at: user.created_at,
            },
            token,
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
