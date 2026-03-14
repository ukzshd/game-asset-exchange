import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { assertAllowedTransition, setOrderStatus } from '@/lib/orders';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanMultilineText } from '@/lib/validation';
import { createStripeRefund } from '@/lib/payments/stripe';

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        const staffUser = await requireStaff(request);
        const { id } = await params;
        const body = await request.json();
        const nextStatus = body?.status;
        const note = cleanMultilineText(body?.note, 500);

        const db = getDb();
        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        assertAllowedTransition(staffUser, order, nextStatus);

        let refundReference = '';
        if (nextStatus === 'refunded' && order.payment_provider === 'stripe' && order.payment_id) {
            try {
                const refund = await createStripeRefund(order.payment_id, {
                    order_id: String(order.id),
                    order_no: order.order_no,
                    actor_user_id: String(staffUser.id),
                });
                refundReference = refund.id || '';
            } catch (refundError) {
                console.error('Stripe refund failed:', refundError);
                return NextResponse.json({ error: 'Stripe refund failed. Order status was not changed.' }, { status: 502 });
            }
        }

        const tx = db.transaction(() => {
            setOrderStatus(db, {
                orderId: order.id,
                currentStatus: order.status,
                nextStatus,
                actorUserId: staffUser.id,
                actorRole: staffUser.role,
                paymentReference: refundReference,
                message: note || `Status changed to ${nextStatus}`,
            });
        });
        tx();

        const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        return NextResponse.json({ order: updated });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Update order status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
