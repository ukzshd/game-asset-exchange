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
        const payout = await db.prepare('SELECT * FROM seller_payouts WHERE id = ?').get(id);
        if (!payout) {
            return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
        }

        await db.prepare(`
            UPDATE seller_payouts
            SET status = ?, note = ?, paid_at = CASE WHEN ? = 'paid' THEN NOW() ELSE paid_at END,
                paid_by = CASE WHEN ? = 'paid' THEN ? ELSE paid_by END,
                updated_at = NOW()
            WHERE id = ?
        `).run(status, note, status, status, admin.id, id);

        if (payout.order_id) {
            await db.prepare(`
                UPDATE orders
                SET settlement_status = CASE WHEN ? = 'paid' THEN 'paid' ELSE settlement_status END,
                    updated_at = NOW()
                WHERE id = ?
            `).run(status, payout.order_id);
        }

        const updated = await db.prepare('SELECT * FROM seller_payouts WHERE id = ?').get(id);
        return NextResponse.json({ payout: updated });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Update payout error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
