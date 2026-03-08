import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// PUT - Admin update order status
export async function PUT(request, { params }) {
    try {
        await requireAdmin(request);
        const { id } = await params;
        const { status } = await request.json();

        const validStatuses = ['pending', 'paid', 'processing', 'delivered', 'completed', 'refunded', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
        }

        const db = getDb();
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);

        // If refunded, update affiliate commission status
        if (status === 'refunded') {
            db.prepare("UPDATE affiliate_commissions SET status = 'cancelled' WHERE order_id = ?").run(id);
        }
        // If completed, mark affiliate commission as paid
        if (status === 'completed') {
            db.prepare("UPDATE affiliate_commissions SET status = 'paid' WHERE order_id = ?").run(id);
        }

        const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        return NextResponse.json({ order: updated });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Update order status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
