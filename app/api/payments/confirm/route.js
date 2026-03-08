import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// POST - Confirm payment (simulated)
export async function POST(request) {
    try {
        const user = await requireAuth(request);
        const { orderId, paymentId } = await request.json();

        if (!orderId || !paymentId) {
            return NextResponse.json({ error: 'Order ID and Payment ID are required' }, { status: 400 });
        }

        const db = getDb();
        const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, user.id);

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        if (order.status !== 'pending') {
            return NextResponse.json({ error: 'Order is not pending payment' }, { status: 400 });
        }

        // Simulate payment success → update order to paid
        db.prepare("UPDATE orders SET status = 'paid', payment_id = ?, updated_at = datetime('now') WHERE id = ?")
            .run(paymentId, orderId);

        const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

        return NextResponse.json({
            order: { ...updated, items },
            payment: { status: 'succeeded', paymentId },
        });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Confirm payment error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
