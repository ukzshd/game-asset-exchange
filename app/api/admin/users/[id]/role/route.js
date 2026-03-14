import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanText } from '@/lib/validation';

const ALLOWED_ROLES = new Set(['user', 'worker', 'support', 'admin']);

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        const admin = await requireAdmin(request);
        const { id } = await params;
        const body = await request.json();
        const nextRole = cleanText(body?.role, 16);

        if (!ALLOWED_ROLES.has(nextRole)) {
            return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }

        const db = getDb();
        const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(id);
        if (!target) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        if (target.id === admin.id && nextRole !== 'admin') {
            return NextResponse.json({ error: 'You cannot demote your own admin account' }, { status: 400 });
        }

        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(nextRole, id);
        const updated = db.prepare(`
            SELECT id, email, username, embark_id, phone, role, referral_code, referred_by, is_active, created_at
            FROM users WHERE id = ?
        `).get(id);
        return NextResponse.json({ user: updated });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Update user role error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
