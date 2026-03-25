import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { authHeaders, cleanupIsolatedDb, createUser, setupIsolatedDb } from './helpers/test-env';

const stripeState = vi.hoisted(() => ({
    createdSession: null,
    retrievedSession: null,
    refund: null,
}));

const paypalState = vi.hoisted(() => ({
    createdOrder: null,
    retrievedOrder: null,
    capturedOrder: null,
    refund: null,
    webhookVerified: true,
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

vi.mock('@/lib/payments/paypal', () => ({
    createPayPalOrder: vi.fn(async () => paypalState.createdOrder),
    getPayPalOrder: vi.fn(async () => paypalState.retrievedOrder),
    capturePayPalOrder: vi.fn(async () => paypalState.capturedOrder),
    createPayPalRefund: vi.fn(async () => paypalState.refund),
    verifyPayPalWebhookEvent: vi.fn(async () => paypalState.webhookVerified),
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
        paypalState.createdOrder = {
            id: 'PAYPAL-ORDER-123',
            status: 'CREATED',
            links: [{ rel: 'approve', href: 'https://paypal.test/checkout/PAYPAL-ORDER-123' }],
        };
        paypalState.retrievedOrder = {
            id: 'PAYPAL-ORDER-123',
            status: 'APPROVED',
            purchase_units: [{ custom_id: '1', reference_id: '1' }],
        };
        paypalState.capturedOrder = {
            id: 'PAYPAL-ORDER-123',
            status: 'COMPLETED',
            purchase_units: [{
                reference_id: '1',
                custom_id: '1',
                payments: {
                    captures: [{ id: 'CAPTURE-123', status: 'COMPLETED' }],
                },
            }],
        };
        paypalState.refund = { id: 'R-123', status: 'COMPLETED' };
        paypalState.webhookVerified = true;
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
        const db = await getDb();
        const initialLot = await db.prepare('SELECT available_quantity, reserved_quantity FROM inventory_lots WHERE sku_id = ? ORDER BY id ASC LIMIT 1').get(1);
        const initialProduct = await db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(1);

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

        const savedOrder = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderPayload.order.id);
        expect(savedOrder.payment_session_id).toBe('cs_test_123');
        expect(savedOrder.payment_provider).toBe('stripe');
        const reservedLots = await db.prepare(`
            SELECT lot_id, quantity
            FROM order_inventory_reservations
            WHERE order_id = ?
            ORDER BY id ASC
        `).all(orderPayload.order.id);
        expect(reservedLots.map((entry) => entry.quantity)).toEqual([2]);

        const reservedLot = await db.prepare('SELECT available_quantity, reserved_quantity FROM inventory_lots WHERE sku_id = ? ORDER BY id ASC LIMIT 1').get(1);
        expect(reservedLot.available_quantity).toBe(initialLot.available_quantity);
        expect(reservedLot.reserved_quantity).toBe(2);

        const reservedProduct = await db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(1);
        expect(reservedProduct.stock_quantity).toBe(initialProduct.stock_quantity - 2);

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

        const stockedProduct = await db.prepare('SELECT stock_quantity FROM products WHERE id = 1').get();
        expect(stockedProduct.stock_quantity).toBe(998);
        const paidLot = await db.prepare('SELECT available_quantity, reserved_quantity FROM inventory_lots WHERE sku_id = ? ORDER BY id ASC LIMIT 1').get(1);
        expect(paidLot.available_quantity).toBe(998);
        expect(paidLot.reserved_quantity).toBe(0);

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

        const refundedProduct = await db.prepare('SELECT stock_quantity FROM products WHERE id = 1').get();
        expect(refundedProduct.stock_quantity).toBeGreaterThanOrEqual(1000);
    });

    it('creates and confirms a PayPal order and supports PayPal refunds', async () => {
        const { token: buyerToken } = await createUser({ email: 'paypalbuyer@example.com', username: 'paypalbuyer' });
        const { token: adminToken } = await createUser({ email: 'paypaladmin@example.com', username: 'paypaladmin', role: 'admin' });
        const { POST: createOrder } = await import('@/app/api/orders/route');
        const { POST: createPayment } = await import('@/app/api/payments/create/route');
        const { POST: confirmPayment } = await import('@/app/api/payments/confirm/route');
        const { PUT: updateStatus } = await import('@/app/api/orders/[id]/status/route');
        const { getDb } = await import('@/lib/db');

        const orderResponse = await createOrder(new Request('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: authHeaders(buyerToken),
            body: JSON.stringify({
                items: [{ productId: 1, quantity: 1, name: 'Bundle' }],
                embarkId: 'paypal#1111',
                characterName: 'PayPalBuyer',
                email: 'paypalbuyer@example.com',
                paymentMethod: 'paypal',
                currency: 'USD',
            }),
        }));
        const { order } = await orderResponse.json();

        paypalState.retrievedOrder.purchase_units[0].custom_id = String(order.id);
        paypalState.retrievedOrder.purchase_units[0].reference_id = String(order.id);
        paypalState.capturedOrder.purchase_units[0].custom_id = String(order.id);
        paypalState.capturedOrder.purchase_units[0].reference_id = String(order.id);

        const paymentResponse = await createPayment(new Request('http://localhost:3000/api/payments/create', {
            method: 'POST',
            headers: authHeaders(buyerToken),
            body: JSON.stringify({ orderId: order.id, paymentMethod: 'paypal' }),
        }));
        expect(paymentResponse.status).toBe(200);
        const paymentPayload = await paymentResponse.json();
        expect(paymentPayload.checkoutUrl).toBe('https://paypal.test/checkout/PAYPAL-ORDER-123');
        expect(paymentPayload.paymentMethod).toBe('paypal');

        const confirmResponse = await confirmPayment(new Request('http://localhost:3000/api/payments/confirm', {
            method: 'POST',
            headers: authHeaders(buyerToken),
            body: JSON.stringify({ orderId: order.id, sessionId: 'PAYPAL-ORDER-123', paymentMethod: 'paypal' }),
        }));
        expect(confirmResponse.status).toBe(200);
        const confirmPayload = await confirmResponse.json();
        expect(confirmPayload.order.status).toBe('paid');
        expect(confirmPayload.payment.paymentMethod).toBe('paypal');
        expect(confirmPayload.payment.paymentId).toBe('CAPTURE-123');

        const db = await getDb();
        const paidOrder = await db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
        expect(paidOrder.payment_provider).toBe('paypal');
        expect(paidOrder.payment_id).toBe('CAPTURE-123');

        const refundResponse = await updateStatus(
            new Request(`http://localhost:3000/api/orders/${order.id}/status`, {
                method: 'PUT',
                headers: authHeaders(adminToken),
                body: JSON.stringify({ status: 'refunded', note: 'PayPal refund requested' }),
            }),
            { params: Promise.resolve({ id: String(order.id) }) }
        );
        expect(refundResponse.status).toBe(200);

        const refundedOrder = await db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
        expect(refundedOrder.status).toBe('refunded');
        expect(refundedOrder.payment_reference).toBe('R-123');
    });

    it('allocates inventory across multiple lots and restores the same lots on refund', async () => {
        const { token: buyerToken } = await createUser({ email: 'lotbuyer@example.com', username: 'lotbuyer' });
        const { token: adminToken } = await createUser({ email: 'lotadmin@example.com', username: 'lotadmin', role: 'admin' });
        const { POST: createOrder } = await import('@/app/api/orders/route');
        const { POST: confirmPayment } = await import('@/app/api/payments/confirm/route');
        const { PUT: updateStatus } = await import('@/app/api/orders/[id]/status/route');
        const { getDb } = await import('@/lib/db');

        const db = await getDb();
        await db.prepare('UPDATE inventory_lots SET available_quantity = 3 WHERE sku_id = ?').run(1);
        await db.prepare(`
            INSERT INTO inventory_lots (sku_id, source_type, source_ref, available_quantity, reserved_quantity, unit_cost, note)
            VALUES (1, 'supplier', 'LOT-B', 4, 0, 0, 'Second lot')
        `).run();

        const orderResponse = await createOrder(new Request('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: authHeaders(buyerToken),
            body: JSON.stringify({
                items: [{ productId: 1, quantity: 5, name: 'Bundle' }],
                embarkId: 'embark#lot',
                characterName: 'LotBuyer',
                email: 'lotbuyer@example.com',
                paymentMethod: 'stripe',
                currency: 'USD',
            }),
        }));
        const { order } = await orderResponse.json();
        stripeState.retrievedSession.metadata.order_id = String(order.id);

        const confirmResponse = await confirmPayment(new Request('http://localhost:3000/api/payments/confirm', {
            method: 'POST',
            headers: authHeaders(buyerToken),
            body: JSON.stringify({ orderId: order.id, sessionId: 'cs_test_123' }),
        }));
        expect(confirmResponse.status).toBe(200);

        const paidLots = await db.prepare('SELECT id, available_quantity FROM inventory_lots WHERE sku_id = ? ORDER BY id ASC').all(1);
        expect(paidLots.map((lot) => lot.available_quantity)).toEqual([0, 2]);

        const allocations = await db.prepare(`
            SELECT lot_id, quantity
            FROM order_inventory_allocations
            WHERE order_id = ?
            ORDER BY id ASC
        `).all(order.id);
        expect(allocations.map((allocation) => allocation.quantity)).toEqual([3, 2]);

        const refundResponse = await updateStatus(
            new Request(`http://localhost:3000/api/orders/${order.id}/status`, {
                method: 'PUT',
                headers: authHeaders(adminToken),
                body: JSON.stringify({ status: 'refunded', note: 'Restore lots' }),
            }),
            { params: Promise.resolve({ id: String(order.id) }) }
        );
        expect(refundResponse.status).toBe(200);

        const refundedLots = await db.prepare('SELECT id, available_quantity FROM inventory_lots WHERE sku_id = ? ORDER BY id ASC').all(1);
        expect(refundedLots.map((lot) => lot.available_quantity)).toEqual([3, 4]);

        const remainingAllocations = await db.prepare('SELECT COUNT(*)::int AS c FROM order_inventory_allocations WHERE order_id = ?').get(order.id);
        expect(remainingAllocations.c).toBe(0);
    });

    it('releases reserved inventory when Stripe checkout expires or fails', async () => {
        const { token } = await createUser({ email: 'reservefail@example.com', username: 'reservefail' });
        const { POST: createOrder } = await import('@/app/api/orders/route');
        const { POST: createPayment } = await import('@/app/api/payments/create/route');
        const { POST: stripeWebhook } = await import('@/app/api/payments/webhook/route');
        const { getDb } = await import('@/lib/db');
        const stripeLib = await import('@/lib/payments/stripe');
        const db = await getDb();
        const initialLot = await db.prepare('SELECT available_quantity, reserved_quantity FROM inventory_lots WHERE sku_id = ? ORDER BY id ASC LIMIT 1').get(1);
        const initialProduct = await db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(1);

        const orderResponse = await createOrder(new Request('http://localhost:3000/api/orders', {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({
                items: [{ productId: 1, quantity: 3, name: 'Bundle' }],
                embarkId: 'embark#reserve',
                characterName: 'ReserveFail',
                email: 'reservefail@example.com',
                paymentMethod: 'stripe',
            }),
        }));
        const { order } = await orderResponse.json();

        const paymentResponse = await createPayment(new Request('http://localhost:3000/api/payments/create', {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({ orderId: order.id, paymentMethod: 'stripe' }),
        }));
        expect(paymentResponse.status).toBe(200);

        stripeLib.constructStripeWebhookEvent.mockReturnValue({
            type: 'checkout.session.expired',
            data: {
                object: {
                    id: 'cs_test_123',
                    payment_intent: 'pi_test_123',
                    metadata: { order_id: String(order.id) },
                },
            },
        });

        const webhookResponse = await stripeWebhook(new Request('http://localhost:3000/api/payments/webhook', {
            method: 'POST',
            headers: { 'stripe-signature': 'sig_test' },
            body: '{}',
        }));
        expect(webhookResponse.status).toBe(200);

        const updatedOrder = await db.prepare('SELECT status, payment_status FROM orders WHERE id = ?').get(order.id);
        expect(updatedOrder.status).toBe('payment_failed');
        expect(updatedOrder.payment_status).toBe('failed');

        const lot = await db.prepare('SELECT available_quantity, reserved_quantity FROM inventory_lots WHERE sku_id = ? ORDER BY id ASC LIMIT 1').get(1);
        expect(lot.available_quantity).toBe(initialLot.available_quantity);
        expect(lot.reserved_quantity).toBe(0);

        const reservationCount = await db.prepare('SELECT COUNT(*)::int AS c FROM order_inventory_reservations WHERE order_id = ?').get(order.id);
        expect(reservationCount.c).toBe(0);

        const product = await db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(1);
        expect(product.stock_quantity).toBe(initialProduct.stock_quantity);
    });
});
