import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { authHeaders, cleanupIsolatedDb, createUser, setupIsolatedDb } from './helpers/test-env';

const stripeState = vi.hoisted(() => ({
    createdSession: null,
    retrievedSession: null,
    refund: null,
}));

vi.mock('@/lib/payments/stripe', () => ({
    getStripeClient: () => ({
        checkout: {
            sessions: {
                create: vi.fn(async () => stripeState.createdSession),
                retrieve: vi.fn(async () => stripeState.retrievedSession),
            },
        },
    }),
    constructStripeWebhookEvent: vi.fn(),
    createStripeRefund: vi.fn(async () => stripeState.refund),
}));

describe('order and payment flow', () => {
    let temp;

    beforeEach(async () => {
        vi.resetModules();
        stripeState.createdSession = {
            id: 'cs_test_123',
            url: 'https://checkout.stripe.test/session/cs_test_123',
            payment_status: 'unpaid',
            payment_intent: 'pi_test_123',
        };
        stripeState.retrievedSession = {
            id: 'cs_test_123',
            payment_status: 'paid',
            payment_intent: 'pi_test_123',
            metadata: { order_id: '1' },
        };
        stripeState.refund = { id: 're_test_123', status: 'succeeded' };
        temp = await setupIsolatedDb();
    });

    afterEach(async () => {
        await cleanupIsolatedDb(temp);
    });

    it('creates an order and starts a Stripe checkout session', async () => {
        const { token } = await createUser();
        const { POST: createOrder } = await import('@/app/api/orders/route');
        const { POST: createPayment } = await import('@/app/api/payments/create/route');
        const { getDb } = await import('@/lib/db');

        const orderResponse = await createOrder(new Request('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({
                items: [{ productId: 1, quantity: 2, name: 'Bundle' }],
                embarkId: 'embark#1234',
                characterName: 'RaiderOne',
                email: 'buyer@example.com',
                paymentMethod: 'stripe',
                notes: 'Handle with care',
                currency: 'USD',
            }),
        }));

        expect(orderResponse.status).toBe(201);
        const orderPayload = await orderResponse.json();
        expect(orderPayload.order.status).toBe('pending_payment');
        expect(orderPayload.order.payment_status).toBe('unpaid');
        expect(orderPayload.order.delivery_email).toBe('buyer@example.com');

        stripeState.retrievedSession.metadata.order_id = String(orderPayload.order.id);

        const paymentResponse = await createPayment(new Request('http://localhost:3000/api/payments/create', {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({ orderId: orderPayload.order.id, paymentMethod: 'stripe' }),
        }));

        expect(paymentResponse.status).toBe(200);
        const paymentPayload = await paymentResponse.json();
        expect(paymentPayload.checkoutUrl).toBe('https://checkout.stripe.test/session/cs_test_123');

        const db = await getDb();
        const savedOrder = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderPayload.order.id);
        expect(savedOrder.payment_session_id).toBe('cs_test_123');
        expect(savedOrder.payment_provider).toBe('stripe');

        const logs = await db.prepare('SELECT event_type FROM order_status_logs WHERE order_id = ? ORDER BY id ASC').all(orderPayload.order.id);
        expect(logs.map((entry) => entry.event_type)).toEqual(['created', 'payment_session_created']);
    });

    it('confirms payment, assigns an order, and progresses workflow statuses', async () => {
        const { token: userToken } = await createUser({ email: 'buyer2@example.com', username: 'buyer2' });
        const { user: supportUser, token: supportToken } = await createUser({ email: 'support@example.com', username: 'support', role: 'support' });
        const { user: workerUser, token: workerToken } = await createUser({ email: 'worker@example.com', username: 'worker', role: 'worker' });
        const { token: adminToken } = await createUser({ email: 'admin@example.com', username: 'admin', role: 'admin' });

        const { POST: createOrder } = await import('@/app/api/orders/route');
        const { POST: confirmPayment } = await import('@/app/api/payments/confirm/route');
        const { PUT: assignOrder } = await import('@/app/api/admin/orders/[id]/assign/route');
        const { PUT: updateStatus } = await import('@/app/api/orders/[id]/status/route');
        const { getDb } = await import('@/lib/db');

        const orderResponse = await createOrder(new Request('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: authHeaders(userToken),
            body: JSON.stringify({
                items: [{ productId: 1, quantity: 1, name: 'Bundle' }],
                embarkId: 'embark#5678',
                characterName: 'BuyerTwo',
                email: 'buyer2@example.com',
                paymentMethod: 'stripe',
                currency: 'USD',
            }),
        }));
        const orderPayload = await orderResponse.json();
        const orderId = orderPayload.order.id;

        stripeState.retrievedSession.metadata.order_id = String(orderId);

        const confirmResponse = await confirmPayment(new Request('http://localhost:3000/api/payments/confirm', {
            method: 'POST',
            headers: authHeaders(userToken),
            body: JSON.stringify({ orderId, sessionId: 'cs_test_123' }),
        }));
        expect(confirmResponse.status).toBe(200);

        const assignResponse = await assignOrder(
            new Request(`http://localhost:3000/api/admin/orders/${orderId}/assign`, {
                method: 'PUT',
                headers: authHeaders(supportToken),
                body: JSON.stringify({ assigneeId: workerUser.id }),
            }),
            { params: Promise.resolve({ id: String(orderId) }) }
        );
        expect(assignResponse.status).toBe(200);
        const assignedPayload = await assignResponse.json();
        expect(assignedPayload.order.status).toBe('assigned');
        expect(assignedPayload.order.assigned_to).toBe(workerUser.id);

        const deliveringResponse = await updateStatus(
            new Request(`http://localhost:3000/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: authHeaders(workerToken),
                body: JSON.stringify({ status: 'delivering' }),
            }),
            { params: Promise.resolve({ id: String(orderId) }) }
        );
        expect(deliveringResponse.status).toBe(200);

        const deliveredResponse = await updateStatus(
            new Request(`http://localhost:3000/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: authHeaders(workerToken),
                body: JSON.stringify({ status: 'delivered' }),
            }),
            { params: Promise.resolve({ id: String(orderId) }) }
        );
        expect(deliveredResponse.status).toBe(200);

        const completedResponse = await updateStatus(
            new Request(`http://localhost:3000/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: authHeaders(adminToken),
                body: JSON.stringify({ status: 'completed' }),
            }),
            { params: Promise.resolve({ id: String(orderId) }) }
        );
        expect(completedResponse.status).toBe(200);

        const db = await getDb();
        const finalOrder = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        expect(finalOrder.status).toBe('completed');
        expect(finalOrder.delivered_at).toBeTruthy();
        expect(finalOrder.completed_at).toBeTruthy();

        const logs = await db.prepare('SELECT event_type, to_status FROM order_status_logs WHERE order_id = ? ORDER BY id ASC').all(orderId);
        expect(logs.map((entry) => `${entry.event_type}:${entry.to_status || ''}`)).toContain('assigned:assigned');
        expect(logs.map((entry) => `${entry.event_type}:${entry.to_status || ''}`)).toContain('status_changed:completed');
        expect(supportUser.role).toBe('support');
    });

    it('creates a real refund transition for Stripe-backed orders', async () => {
        const { token: buyerToken } = await createUser({ email: 'buyer3@example.com', username: 'buyer3' });
        const { token: adminToken } = await createUser({ email: 'admin2@example.com', username: 'admin2', role: 'admin' });
        const { POST: createOrder } = await import('@/app/api/orders/route');
        const { PUT: updateStatus } = await import('@/app/api/orders/[id]/status/route');
        const { getDb } = await import('@/lib/db');

        const orderResponse = await createOrder(new Request('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: authHeaders(buyerToken),
            body: JSON.stringify({
                items: [{ productId: 1, quantity: 1, name: 'Bundle' }],
                embarkId: 'embark#9999',
                characterName: 'BuyerThree',
                email: 'buyer3@example.com',
                paymentMethod: 'stripe',
            }),
        }));
        const { order } = await orderResponse.json();

        const db = await getDb();
        await db.prepare(`
            UPDATE orders
            SET status = 'paid', payment_provider = 'stripe', payment_id = 'pi_paid_refund', payment_status = 'paid'
            WHERE id = ?
        `).run(order.id);

        const refundResponse = await updateStatus(
            new Request(`http://localhost:3000/api/orders/${order.id}/status`, {
                method: 'PUT',
                headers: authHeaders(adminToken),
                body: JSON.stringify({ status: 'refunded', note: 'Customer requested refund' }),
            }),
            { params: Promise.resolve({ id: String(order.id) }) }
        );

        expect(refundResponse.status).toBe(200);
        const updatedOrder = await db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
        expect(updatedOrder.status).toBe('refunded');
        expect(updatedOrder.payment_status).toBe('refunded');
        expect(updatedOrder.payment_reference).toBe('re_test_123');
    });
});
