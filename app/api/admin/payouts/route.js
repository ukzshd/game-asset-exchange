import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request) {
    try {
        await requireAdmin(request);
        const db = await getDb();

        const payouts = await db.prepare(`
            SELECT p.*, seller.username AS seller_username, o.order_no
            FROM seller_payouts p
            JOIN users seller ON seller.id = p.seller_user_id
            JOIN orders o ON o.id = p.order_id
            ORDER BY p.created_at DESC, p.id DESC
        `).all();

        return NextResponse.json({ payouts });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Admin payouts error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
