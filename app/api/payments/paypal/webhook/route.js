import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { ORDER_STATUS, setOrderStatus } from '@/lib/orders';
import { sendOpsNotification } from '@/lib/notifications';
import { isPayPalAmountValidForOrder, verifyPayPalWebhookEvent } from '@/lib/payments/paypal';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const rawBody = await request.text();
        const event = JSON.parse(rawBody);
        const verified = await verifyPayPalWebhookEvent({
            headers: request.headers,
            body: rawBody,
            webhookEvent: event,
        });

        if (!verified) {
            return NextResponse.json({ error: 'Invalid PayPal webhook signature' }, { status: 400 });
        }

        const eventType = event.event_type || '';
        if (!['PAYMENT.CAPTURE.COMPLETED', 'PAYMENT.CAPTURE.DENIED', 'CHECKOUT.ORDER.APPROVED'].includes(eventType)) {
            return NextResponse.json({ received: true, ignored: true });
        }

        const resource = event.resource || {};
        const customId = resource.custom_id || resource.supplementary_data?.related_ids?.order_id || '';
        const invoiceId = resource.invoice_id || '';
        const db = await getDb();

        let order = null;
        if (customId) {
            order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(Number.parseInt(customId, 10));
        }
        if (!order && invoiceId) {
            order = await db.prepare('SELECT * FROM orders WHERE order_no = ?').get(invoiceId);
        }
        if (!order) {
            return NextResponse.json({ received: true, ignored: true });
        }

        if (eventType === 'PAYMENT.CAPTURE.COMPLETED' && order.status === ORDER_STATUS.PENDING_PAYMENT) {
            if (!isPayPalAmountValidForOrder(order, resource.amount)) {
                console.warn(`PayPal webhook amount mismatch for order ${order.id}`);
                return NextResponse.json({ received: true, ignored: true, amountMismatch: true });
            }

            const captureId = resource.id || '';
            const sessionId = resource.supplementary_data?.related_ids?.order_id || order.payment_session_id || '';

            const tx = db.transaction(async () => {
                await setOrderStatus(db, {
                    orderId: order.id,
                    currentStatus: order.status,
                    nextStatus: ORDER_STATUS.PAID,
                    actorRole: 'system',
                    paymentReference: captureId,
                    message: 'PayPal webhook confirmed payment',
                });
                await db.prepare(`
                    UPDATE orders
                    SET payment_id = ?, payment_provider = 'paypal', payment_session_id = ?, payment_status = 'paid'
                    WHERE id = ?
                `).run(captureId, sessionId, order.id);
            });
            await tx();

            try {
                await sendOpsNotification({
                    event: 'order.paid',
                    orderId: order.id,
                    orderNo: order.order_no,
                    paymentReference: captureId,
                });
            } catch (notifyError) {
                console.warn('Ops notification failed:', notifyError);
            }
        }

        if (eventType === 'PAYMENT.CAPTURE.DENIED' && order.status === ORDER_STATUS.PENDING_PAYMENT) {
            const tx = db.transaction(async () => {
                await setOrderStatus(db, {
                    orderId: order.id,
                    currentStatus: order.status,
                    nextStatus: ORDER_STATUS.PAYMENT_FAILED,
                    actorRole: 'system',
                    paymentReference: resource.id || '',
                    message: 'PayPal webhook reported capture denied',
                });
            });
            await tx();
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('PayPal webhook error:', error);
        return NextResponse.json({ error: 'Webhook handling failed' }, { status: 400 });
    }
}
