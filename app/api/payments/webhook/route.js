import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { constructStripeWebhookEvent } from '@/lib/payments/stripe';
import { ORDER_STATUS, setOrderStatus } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
    const signature = request.headers.get('stripe-signature');
    if (!signature) {
        return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    try {
        const payload = await request.text();
        const event = constructStripeWebhookEvent(payload, signature);
        const db = await getDb();

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const orderId = Number.parseInt(session.metadata?.order_id || '0', 10);
            if (orderId) {
                const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
                if (order && order.status === ORDER_STATUS.PENDING_PAYMENT) {
                    const tx = db.transaction(async () => {
                        await setOrderStatus(db, {
                            orderId,
                            currentStatus: order.status,
                            nextStatus: ORDER_STATUS.PAID,
                            actorRole: 'system',
                            paymentReference: session.payment_intent || session.id,
                            message: 'Stripe webhook confirmed payment',
                        });
                        await db.prepare(`
                            UPDATE orders
                            SET payment_id = ?, payment_provider = 'stripe', payment_session_id = ?, payment_status = 'paid'
                            WHERE id = ?
                        `).run(session.payment_intent || session.id, session.id, orderId);
                    });
                    await tx();
                }
            }
        }

        if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
            const session = event.data.object;
            const orderId = Number.parseInt(session.metadata?.order_id || '0', 10);
            if (orderId) {
                const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
                if (order && order.status === ORDER_STATUS.PENDING_PAYMENT) {
                    const tx = db.transaction(async () => {
                        await setOrderStatus(db, {
                            orderId,
                            currentStatus: order.status,
                            nextStatus: ORDER_STATUS.PAYMENT_FAILED,
                            actorRole: 'system',
                            paymentReference: session.payment_intent || session.id,
                            message: `Stripe webhook reported ${event.type}`,
                        });
                    });
                    await tx();
                }
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Stripe webhook error:', error);
        return NextResponse.json({ error: 'Webhook handling failed' }, { status: 400 });
    }
}
