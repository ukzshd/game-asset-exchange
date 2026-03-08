import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET - Order detail
export async function GET(request, { params }) {
    try {
        const user = await requireAuth(request);
        const { id } = await params;
        const db = getDb();

        const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, user.id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

        return NextResponse.json({ order: { ...order, items } });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Order detail error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
