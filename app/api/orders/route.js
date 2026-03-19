import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth, generateOrderNo } from '@/lib/auth';
import { assertRateLimit } from '@/lib/rate-limit';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanText, cleanMultilineText, normalizeEmail, isValidEmail, sanitizeOrderItems } from '@/lib/validation';
import { ORDER_STATUS, createOrderLog } from '@/lib/orders';

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        assertRateLimit(request, 'orders-create', { limit: 15, windowMs: 15 * 60 * 1000 });

        const user = await requireAuth(request);
        const body = await request.json();
        const items = sanitizeOrderItems(body?.items);
        const embarkId = cleanText(body?.embarkId, 64);
        const characterName = cleanText(body?.characterName, 64);
        const deliveryEmail = normalizeEmail(body?.email || user.email);
        const deliveryContact = cleanText(body?.deliveryContact || body?.email || user.email, 128);
        const deliveryPlatform = cleanText(body?.deliveryPlatform, 32);
        const deliveryServer = cleanText(body?.deliveryServer, 64);
        const paymentMethod = cleanText(body?.paymentMethod || 'stripe', 32).toLowerCase();
        const couponCode = cleanText(body?.couponCode, 32).toUpperCase();
        const notes = cleanMultilineText(body?.notes, 1200);
        const currency = cleanText(body?.currency || 'USD', 8).toUpperCase();

        if (items.length === 0) {
            return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
        }
        if (!embarkId) {
            return NextResponse.json({ error: 'Embark ID is required' }, { status: 400 });
        }
        if (!deliveryEmail || !isValidEmail(deliveryEmail)) {
            return NextResponse.json({ error: 'A valid delivery email is required' }, { status: 400 });
        }

        const db = await getDb();
        let subtotal = 0;
        const validatedItems = [];

        for (const item of items) {
            const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId);
            if (!product) {
                return NextResponse.json({ error: `Product not found: ${item.name || item.productId}` }, { status: 400 });
            }
            if (!product.in_stock) {
                return NextResponse.json({ error: `Product out of stock: ${product.name}` }, { status: 400 });
            }

            subtotal += product.price * item.quantity;
            validatedItems.push({ product, quantity: item.quantity });
        }

        let discountAmount = 0;
        if (couponCode) {
            const coupon = await db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(couponCode);
            if (coupon && (!coupon.expires_at || new Date(coupon.expires_at) > new Date())) {
                discountAmount = subtotal * (coupon.discount_percent / 100);
            }
        }

        const total = subtotal - discountAmount;
        const orderNo = generateOrderNo();

        const createOrder = db.transaction(async () => {
            const result = await db.prepare(`
                INSERT INTO orders (
                    order_no, user_id, total, currency, status, embark_id, character_name,
                    delivery_email, delivery_contact, delivery_platform, delivery_server,
                    payment_method, payment_provider, payment_status,
                    coupon_code, discount_amount, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                orderNo,
                user.id,
                total,
                currency || 'USD',
                ORDER_STATUS.PENDING_PAYMENT,
                embarkId,
                characterName,
                deliveryEmail,
                deliveryContact,
                deliveryPlatform,
                deliveryServer,
                paymentMethod,
                paymentMethod === 'stripe' ? 'stripe' : paymentMethod,
                'unpaid',
                couponCode,
                discountAmount,
                notes
            );

            const orderId = result.lastInsertRowid;
            const insertItem = db.prepare(
                'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)'
            );
            for (const { product, quantity } of validatedItems) {
                await insertItem.run(orderId, product.id, product.name, quantity, product.price);
            }

            if (user.referred_by) {
                const referrer = await db.prepare('SELECT id FROM users WHERE referral_code = ?').get(user.referred_by);
                if (referrer) {
                    const commissionRate = 0.10;
                    const commissionAmount = total * commissionRate;
                    await db.prepare(
                        'INSERT INTO affiliate_commissions (referrer_id, order_id, order_amount, commission_rate, commission_amount) VALUES (?, ?, ?, ?, ?)'
                    ).run(referrer.id, orderId, total, commissionRate, commissionAmount);
                }
            }

            await createOrderLog(db, {
                orderId,
                actorUserId: user.id,
                actorRole: user.role,
                eventType: 'created',
                toStatus: ORDER_STATUS.PENDING_PAYMENT,
                message: 'Order created and awaiting payment',
                metadata: { paymentMethod, currency },
            });

            return orderId;
        });

        const orderId = await createOrder();
        const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        const orderItems = await db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

        return NextResponse.json({ order: { ...order, items: orderItems } }, { status: 201 });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Create order error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(request) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
        const offset = (page - 1) * limit;

        const db = await getDb();
        const total = (await db.prepare('SELECT COUNT(*)::int as c FROM orders WHERE user_id = ?').get(user.id)).c;
        const orders = await db.prepare(`
            SELECT o.*, assignee.username AS assigned_username
            FROM orders o
            LEFT JOIN users assignee ON assignee.id = o.assigned_to
            WHERE o.user_id = ?
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `).all(user.id, limit, offset);

        const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
        const ordersWithItems = await Promise.all(orders.map(async (order) => ({
            ...order,
            items: await getItems.all(order.id),
        })));

        return NextResponse.json({
            orders: ordersWithItems,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('List orders error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
