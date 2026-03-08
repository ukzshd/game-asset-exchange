import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth, generateOrderNo } from '@/lib/auth';

// POST - Create a new order
export async function POST(request) {
    try {
        const user = await requireAuth(request);
        const { items, embarkId, characterName, paymentMethod, couponCode, notes, currency } = await request.json();

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
        }

        if (!embarkId) {
            return NextResponse.json({ error: 'Embark ID is required' }, { status: 400 });
        }

        const db = getDb();

        // Validate products and calculate total
        let subtotal = 0;
        const validatedItems = [];

        for (const item of items) {
            const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.productId || item.id);
            if (!product) {
                return NextResponse.json({ error: `Product not found: ${item.name || item.productId}` }, { status: 400 });
            }
            if (!product.in_stock) {
                return NextResponse.json({ error: `Product out of stock: ${product.name}` }, { status: 400 });
            }
            const qty = item.quantity || 1;
            subtotal += product.price * qty;
            validatedItems.push({ product, quantity: qty });
        }

        // Apply coupon
        let discountAmount = 0;
        if (couponCode) {
            const coupon = db.prepare('SELECT * FROM coupons WHERE code = ? AND active = 1').get(couponCode.toUpperCase());
            if (coupon) {
                if (!coupon.expires_at || new Date(coupon.expires_at) > new Date()) {
                    discountAmount = subtotal * (coupon.discount_percent / 100);
                }
            }
        }

        const total = subtotal - discountAmount;
        const orderNo = generateOrderNo();

        // Create order in a transaction
        const createOrder = db.transaction(() => {
            const result = db.prepare(
                `INSERT INTO orders (order_no, user_id, total, currency, status, embark_id, character_name, payment_method, coupon_code, discount_amount, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).run(orderNo, user.id, total, currency || 'USD', 'pending', embarkId, characterName || '', paymentMethod || '', couponCode || '', discountAmount, notes || '');

            const orderId = result.lastInsertRowid;

            // Insert order items
            const insertItem = db.prepare(
                'INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?)'
            );
            for (const { product, quantity } of validatedItems) {
                insertItem.run(orderId, product.id, product.name, quantity, product.price);
            }

            // Handle affiliate commission
            if (user.referred_by) {
                const referrer = db.prepare('SELECT id FROM users WHERE referral_code = ?').get(user.referred_by);
                if (referrer) {
                    const commissionRate = 0.10;
                    const commissionAmount = total * commissionRate;
                    db.prepare(
                        'INSERT INTO affiliate_commissions (referrer_id, order_id, order_amount, commission_rate, commission_amount) VALUES (?, ?, ?, ?, ?)'
                    ).run(referrer.id, orderId, total, commissionRate, commissionAmount);
                }
            }

            return orderId;
        });

        const orderId = createOrder();

        const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
        const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

        return NextResponse.json({ order: { ...order, items: orderItems } }, { status: 201 });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Create order error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET - List current user's orders
export async function GET(request) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ?').get(user.id).c;
        const orders = db.prepare(
            'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
        ).all(user.id, limit, offset);

        // Attach items to each order
        const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
        const ordersWithItems = orders.map(order => ({
            ...order,
            items: getItems.all(order.id),
        }));

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
