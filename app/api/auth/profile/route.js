import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanText } from '@/lib/validation';

export async function PUT(request) {
    try {
        assertTrustedOrigin(request);
        const user = await requireAuth(request);
        const body = await request.json();
        const username = cleanText(body?.username, 64) || user.username;
        const embarkId = cleanText(body?.embark_id, 64);
        const phone = cleanText(body?.phone, 32);

        const db = await getDb();
        await db.prepare('UPDATE users SET username = ?, embark_id = ?, phone = ? WHERE id = ?')
            .run(username, embarkId, phone, user.id);

        const updated = await db.prepare(`
            SELECT id, email, username, embark_id, phone, role, referral_code, referred_by, created_at
            FROM users WHERE id = ?
        `).get(user.id);
        return NextResponse.json({ user: updated });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Profile update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
