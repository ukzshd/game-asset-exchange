import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { assertApprovedSeller } from '@/lib/marketplace';
import { ORDER_STATUS, setOrderStatus } from '@/lib/orders';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanMultilineText } from '@/lib/validation';

const SELLER_ALLOWED_TRANSITIONS = {
    [ORDER_STATUS.PAID]: [ORDER_STATUS.DELIVERING],
    [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.DELIVERED],
};

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        const user = await requireAuth(request);
        const { id } = await params;
        const body = await request.json();
        const nextStatus = String(body?.status || '');
        const note = cleanMultilineText(body?.note, 500);

        const db = await getDb();
        await assertApprovedSeller(db, user.id);

        const order = await db.prepare(`
            SELECT *
            FROM orders
            WHERE id = ? AND order_source = 'marketplace' AND seller_user_id = ?
        `).get(id, user.id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const allowed = SELLER_ALLOWED_TRANSITIONS[order.status] || [];
        if (!allowed.includes(nextStatus)) {
            return NextResponse.json({ error: `Invalid transition from ${order.status} to ${nextStatus}` }, { status: 400 });
        }

        const tx = db.transaction(async () => {
            await setOrderStatus(db, {
                orderId: order.id,
                currentStatus: order.status,
                nextStatus,
                actorUserId: user.id,
                actorRole: 'seller',
                message: note || `Seller updated status to ${nextStatus}`,
            });
        });
        await tx();

        const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
        return NextResponse.json({ order: updated });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Seller update order status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
