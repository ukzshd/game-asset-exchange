import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function PUT(request) {
    try {
        const user = await requireAuth(request);
        const { username, embark_id, phone } = await request.json();

        const db = getDb();
        db.prepare('UPDATE users SET username = ?, embark_id = ?, phone = ? WHERE id = ?')
            .run(username || user.username, embark_id ?? user.embark_id, phone ?? user.phone, user.id);

        const updated = db.prepare('SELECT id, email, username, embark_id, phone, role, referral_code, created_at FROM users WHERE id = ?').get(user.id);
        return NextResponse.json({ user: updated });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Profile update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
