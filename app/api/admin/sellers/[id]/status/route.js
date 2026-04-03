import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanMultilineText, cleanText } from '@/lib/validation';

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        const admin = await requireAdmin(request);
        const { id } = await params;
        const body = await request.json();
        const status = cleanText(body?.status || '', 32);
        const note = cleanMultilineText(body?.note, 500);

        const db = await getDb();
        const profile = await db.prepare('SELECT * FROM seller_profiles WHERE user_id = ?').get(id);
        if (!profile) {
            return NextResponse.json({ error: 'Seller profile not found' }, { status: 404 });
        }

        await db.prepare(`
            UPDATE seller_profiles
            SET status = ?, reviewed_at = NOW(), reviewed_by = ?, review_note = ?, updated_at = NOW()
            WHERE user_id = ?
        `).run(status, admin.id, note, id);

        await db.prepare(`
            UPDATE seller_applications
            SET status = ?, reviewed_at = NOW(), reviewed_by = ?, review_note = ?, updated_at = NOW()
            WHERE id = (
                SELECT id
                FROM seller_applications
                WHERE user_id = ?
                ORDER BY created_at DESC, id DESC
                LIMIT 1
            )
        `).run(status, admin.id, note, id);

        const updated = await db.prepare('SELECT * FROM seller_profiles WHERE user_id = ?').get(id);
        return NextResponse.json({ profile: updated });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Admin update seller status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
