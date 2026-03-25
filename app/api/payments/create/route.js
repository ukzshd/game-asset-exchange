import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getAppUrl } from '@/lib/env';
import { assertRateLimit } from '@/lib/rate-limit';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanText } from '@/lib/validation';
import { ORDER_STATUS, createOrderLog } from '@/lib/orders';
import { getStripeClient } from '@/lib/payments/stripe';
import { createPayPalOrder } from '@/lib/payments/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        assertRateLimit(request, 'payments-create', { limit: 20, windowMs: 15 * 60 * 1000 });

        const user = await requireAuth(request);
        const body = await request.json();
        const orderId = Number.parseInt(String(body?.orderId || 0), 10);
        const paymentMethod = cleanText(body?.paymentMethod || 'stripe', 32).toLowerCase();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }
        if (!['stripe', 'paypal'].includes(paymentMethod)) {
            return NextResponse.json({ error: 'Unsupported payment method' }, { status: 400 });
        }

        const db = await getDb();
        const order = await db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(orderId, user.id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }
        if (![ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PAYMENT_FAILED].includes(order.status)) {
            return NextResponse.json({ error: `Order cannot be paid in status ${order.status}` }, { status: 400 });
        }

        const items = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
        if (items.length === 0) {
            return NextResponse.json({ error: 'Order has no items' }, { status: 400 });
        }

        const appUrl = getAppUrl(request);
        let paymentId = '';
        let checkoutUrl = '';
        let sessionId = '';
        let paymentStatus = 'pending';
        let eventMessage = '';
        let eventMetadata = {};

        if (paymentMethod === 'stripe') {
            const stripe = getStripeClient();
            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                customer_email: order.delivery_email || user.email,
                success_url: `${appUrl}/checkout?orderId=${order.id}&payment=success&provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${appUrl}/checkout?orderId=${order.id}&payment=cancelled&provider=stripe`,
                line_items: items.map((item) => ({
                    quantity: item.quantity,
                    price_data: {
                        currency: (order.currency || 'USD').toLowerCase(),
                        unit_amount: Math.round(item.unit_price * 100),
                        product_data: {
                            name: item.product_name,
                        },
                    },
                })),
                metadata: {
                    order_id: String(order.id),
                    order_no: order.order_no,
                    user_id: String(user.id),
                },
            });

            paymentId = session.payment_intent || session.id;
            checkoutUrl = session.url;
            sessionId = session.id;
            paymentStatus = session.payment_status || 'unpaid';
            eventMessage = 'Stripe Checkout session created';
            eventMetadata = { sessionId: session.id };
        } else {
            const paypalOrder = await createPayPalOrder({ order, items, user, appUrl });
            paymentId = paypalOrder.id;
            sessionId = paypalOrder.id;
            checkoutUrl = paypalOrder.links?.find((link) => link.rel === 'approve')?.href || '';
            paymentStatus = paypalOrder.status || 'CREATED';
            eventMessage = 'PayPal order created';
            eventMetadata = { paypalOrderId: paypalOrder.id };

            if (!checkoutUrl) {
                throw new Error('Missing PayPal approval URL');
            }
        }

        await db.prepare(`
            UPDATE orders
            SET payment_provider = ?,
                payment_method = ?,
                payment_status = 'pending',
                payment_session_id = ?,
                updated_at = NOW()
            WHERE id = ?
        `).run(paymentMethod, paymentMethod, sessionId, order.id);

        await createOrderLog(db, {
            orderId: order.id,
            actorUserId: user.id,
            actorRole: user.role,
            eventType: 'payment_session_created',
            fromStatus: order.status,
            toStatus: order.status,
            message: eventMessage,
            metadata: eventMetadata,
        });

        return NextResponse.json({
            paymentId,
            checkoutUrl,
            sessionId,
            status: paymentStatus,
            paymentMethod,
        });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Create payment error:', error);
        return NextResponse.json({ error: 'Failed to initialize payment checkout' }, { status: 500 });
    }
}
