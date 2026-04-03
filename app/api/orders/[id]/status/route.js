import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getUser, requireStaff } from '@/lib/auth';
import { assertAllowedTransition, isMarketplaceOrder, isStaffRole, ORDER_STATUS, setOrderStatus } from '@/lib/orders';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanMultilineText } from '@/lib/validation';
import { createStripeRefund } from '@/lib/payments/stripe';
import { createPayPalRefund } from '@/lib/payments/paypal';

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        const actor = await getUser(request);
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const body = await request.json();
        const nextStatus = body?.status;
        const note = cleanMultilineText(body?.note, 500);

        const db = await getDb();
        const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const isStaffActor = isStaffRole(actor.role);
        if (isStaffActor) {
            await requireStaff(request);
            assertAllowedTransition(actor, order, nextStatus);
        } else {
            const buyerCanComplete = actor.id === order.user_id
                && isMarketplaceOrder(order)
                && order.status === ORDER_STATUS.DELIVERED
                && nextStatus === ORDER_STATUS.COMPLETED;
            const buyerCanDispute = actor.id === order.user_id
                && isMarketplaceOrder(order)
                && [ORDER_STATUS.PAID, ORDER_STATUS.DELIVERING, ORDER_STATUS.DELIVERED].includes(order.status)
                && nextStatus === ORDER_STATUS.DISPUTED
                && !order.dispute_status;

            if (!buyerCanComplete && !buyerCanDispute) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }

        let refundReference = '';
        if (isStaffActor && nextStatus === 'refunded' && order.payment_provider === 'stripe' && order.payment_id) {
            try {
                const refund = await createStripeRefund(order.payment_id, {
                    metadata: {
                        order_id: String(order.id),
                        order_no: order.order_no,
                        actor_user_id: String(actor.id),
                    },
                    idempotencyKey: `refund-order-${order.id}`,
                });
                refundReference = refund.id || '';
            } catch (refundError) {
                console.error('Stripe refund failed:', refundError);
                return NextResponse.json({ error: 'Stripe refund failed. Order status was not changed.' }, { status: 502 });
            }
        }
        if (isStaffActor && nextStatus === 'refunded' && order.payment_provider === 'paypal' && order.payment_id) {
            try {
                const refund = await createPayPalRefund(order.payment_id, {
                    note,
                    requestId: `iggm-refund-order-${order.id}`,
                });
                refundReference = refund.id || '';
            } catch (refundError) {
                console.error('PayPal refund failed:', refundError);
                return NextResponse.json({ error: 'PayPal refund failed. Order status was not changed.' }, { status: 502 });
            }
        }

        const tx = db.transaction(async () => {
            await setOrderStatus(db, {
                orderId: order.id,
                currentStatus: order.status,
                nextStatus,
                actorUserId: actor.id,
                actorRole: actor.role,
                paymentReference: refundReference,
                message: note || `Status changed to ${nextStatus}`,
            });
        });
        await tx();

        const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        return NextResponse.json({ order: updated });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Update order status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
