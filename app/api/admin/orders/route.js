import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/orders - All orders (admin)
export async function GET(request) {
    try {
        await requireAdmin(request);
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const status = searchParams.get('status') || '';
        const offset = (page - 1) * limit;

        const db = getDb();

        let where = '';
        const params = [];
        if (status) {
            where = 'WHERE o.status = ?';
            params.push(status);
        }

        const total = db.prepare(`SELECT COUNT(*) as c FROM orders o ${where}`).get(...params).c;

        const orders = db.prepare(`
      SELECT o.*, u.email as user_email, u.username
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      ${where}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset);

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
        console.error('Admin orders error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
