import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request, { params }) {
    try {
        const user = await requireAuth(request);
        const { id } = await params;
        const db = await getDb();

        const order = await db.prepare(`
            SELECT o.*, assignee.username AS assigned_username
            FROM orders o
            LEFT JOIN users assignee ON assignee.id = o.assigned_to
            WHERE o.id = ? AND o.user_id = ?
        `).get(id, user.id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const items = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
        const logs = await db.prepare(`
            SELECT l.*, u.username AS actor_username
            FROM order_status_logs l
            LEFT JOIN users u ON u.id = l.actor_user_id
            WHERE l.order_id = ?
            ORDER BY l.created_at ASC
        `).all(order.id);

        return NextResponse.json({ order: { ...order, items, logs } });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Order detail error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
