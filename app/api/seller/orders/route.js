import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { finalizeMarketplaceOrdersIfDue } from '@/lib/orders';

export async function GET(request) {
    try {
        const user = await requireAuth(request);
        const db = await getDb();
        await finalizeMarketplaceOrdersIfDue(db);

        const orders = await db.prepare(`
            SELECT o.*, buyer.email AS buyer_email, buyer.username AS buyer_username
            FROM orders o
            JOIN users buyer ON buyer.id = o.user_id
            WHERE o.order_source = 'marketplace' AND o.seller_user_id = ?
            ORDER BY o.created_at DESC, o.id DESC
        `).all(user.id);

        const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
        const getLogs = db.prepare(`
            SELECT l.*, actor.username AS actor_username
            FROM order_status_logs l
            LEFT JOIN users actor ON actor.id = l.actor_user_id
            WHERE l.order_id = ?
            ORDER BY l.created_at ASC
        `);

        const ordersWithDetails = await Promise.all(orders.map(async (order) => ({
            ...order,
            items: await getItems.all(order.id),
            logs: await getLogs.all(order.id),
        })));

        return NextResponse.json({ orders: ordersWithDetails });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Seller orders error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
