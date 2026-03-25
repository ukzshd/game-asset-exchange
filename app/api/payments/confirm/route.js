import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { ORDER_STATUS, setOrderStatus } from '@/lib/orders';
import { getStripeClient } from '@/lib/payments/stripe';
import { capturePayPalOrder, getPayPalOrder } from '@/lib/payments/paypal';
import { assertTrustedOrigin } from '@/lib/request-security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        const user = await requireAuth(request);
        const body = await request.json();
        const orderId = Number.parseInt(String(body?.orderId || 0), 10);
        const sessionId = body?.sessionId || body?.paymentId || '';
        const paymentMethod = String(body?.paymentMethod || '').toLowerCase();

        if (!orderId || !sessionId) {
            return NextResponse.json({ error: 'Order ID and session ID are required' }, { status: 400 });
        }

        const db = await getDb();
        const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, user.id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        const provider = paymentMethod || order.payment_provider || 'stripe';
        let payment = null;

        if (provider === 'paypal') {
            const paypalOrder = await getPayPalOrder(sessionId);
            const purchaseUnit = paypalOrder.purchase_units?.[0];
            const referenceOrderId = purchaseUnit?.custom_id || purchaseUnit?.reference_id || '';
            if (referenceOrderId !== String(order.id)) {
                return NextResponse.json({ error: 'PayPal order does not match this order' }, { status: 400 });
            }

            const captureResult = paypalOrder.status === 'COMPLETED' ? paypalOrder : await capturePayPalOrder(sessionId);
            const capture = captureResult.purchase_units?.[0]?.payments?.captures?.[0];
            const isPaid = capture?.status === 'COMPLETED' || captureResult.status === 'COMPLETED';

            if (isPaid && order.status === ORDER_STATUS.PENDING_PAYMENT) {
                const tx = db.transaction(async () => {
                    await setOrderStatus(db, {
                        orderId: order.id,
                        currentStatus: order.status,
                        nextStatus: ORDER_STATUS.PAID,
                        actorUserId: user.id,
                        actorRole: 'system',
                        paymentReference: capture?.id || captureResult.id || sessionId,
                        message: 'Payment confirmed via PayPal order capture',
                    });
                    await db.prepare(`
                        UPDATE orders
                        SET payment_id = ?, payment_provider = 'paypal', payment_session_id = ?, payment_status = 'paid'
                        WHERE id = ?
                    `).run(capture?.id || captureResult.id || sessionId, sessionId, order.id);
                });
                await tx();
            }

            payment = {
                status: capture?.status || captureResult.status,
                paymentId: capture?.id || captureResult.id || sessionId,
                sessionId,
                paymentMethod: 'paypal',
            };
        } else {
            const stripe = getStripeClient();
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (!session || session.metadata?.order_id !== String(order.id)) {
                return NextResponse.json({ error: 'Payment session does not match this order' }, { status: 400 });
            }

            if (session.payment_status === 'paid' && order.status === ORDER_STATUS.PENDING_PAYMENT) {
                const tx = db.transaction(async () => {
                    await setOrderStatus(db, {
                        orderId: order.id,
                        currentStatus: order.status,
                        nextStatus: ORDER_STATUS.PAID,
                        actorUserId: user.id,
                        actorRole: 'system',
                        paymentReference: session.payment_intent || session.id,
                        message: 'Payment confirmed via Stripe session reconciliation',
                    });
                    await db.prepare(`
                        UPDATE orders
                        SET payment_id = ?, payment_provider = 'stripe', payment_session_id = ?, payment_status = 'paid'
                        WHERE id = ?
                    `).run(session.payment_intent || session.id, session.id, order.id);
                });
                await tx();
            }

            payment = {
                status: session.payment_status,
                paymentId: session.payment_intent || session.id,
                sessionId: session.id,
                paymentMethod: 'stripe',
            };
        }

        const updated = await db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
        const items = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);

        return NextResponse.json({
            order: { ...updated, items },
            payment,
        });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Confirm payment error:', error);
        return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 });
    }
}
