import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request) {
    try {
        const user = await requireAuth(request);
        const db = await getDb();

        const profile = await db.prepare(`
            SELECT sp.*, u.username, u.email
            FROM seller_profiles sp
            JOIN users u ON u.id = sp.user_id
            WHERE sp.user_id = ?
        `).get(user.id);

        const latestApplication = await db.prepare(`
            SELECT *
            FROM seller_applications
            WHERE user_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 1
        `).get(user.id);

        const stats = {
            listingCount: 0,
            orderCount: 0,
            availablePayouts: 0,
        };

        if (profile) {
            stats.listingCount = (await db.prepare(`
                SELECT COUNT(*)::int AS c
                FROM products
                WHERE seller_user_id = ? AND catalog_source = 'marketplace'
            `).get(user.id)).c;
            stats.orderCount = (await db.prepare(`
                SELECT COUNT(*)::int AS c
                FROM orders
                WHERE seller_user_id = ? AND order_source = 'marketplace'
            `).get(user.id)).c;
            stats.availablePayouts = Number((await db.prepare(`
                SELECT COALESCE(SUM(net_amount), 0) AS total
                FROM seller_payouts
                WHERE seller_user_id = ? AND status = 'available'
            `).get(user.id)).total || 0);
        }

        return NextResponse.json({
            profile,
            latestApplication,
            stats,
        });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Seller me error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
