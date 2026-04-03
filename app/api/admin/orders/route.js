import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { finalizeMarketplaceOrdersIfDue, getAllowedTransitions } from '@/lib/orders';

export async function GET(request) {
    try {
        const staffUser = await requireStaff(request);
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
        const status = searchParams.get('status') || '';
        const offset = (page - 1) * limit;

        const db = await getDb();
        await finalizeMarketplaceOrdersIfDue(db);

        const whereParts = [];
        const params = [];
        if (status) {
            whereParts.push('o.status = ?');
            params.push(status);
        }
        if (staffUser.role === 'worker') {
            whereParts.push('o.assigned_to = ?');
            params.push(staffUser.id);
        }

        const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
        const total = (await db.prepare(`SELECT COUNT(*)::int as c FROM orders o ${where}`).get(...params)).c;

        const orders = await db.prepare(`
            SELECT
                o.*, u.email as user_email, u.username,
                seller.username as seller_username,
                COALESCE(sp.display_name, seller.username) AS seller_display_name,
                assignee.username as assigned_username,
                assigner.username as assigned_by_username
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            LEFT JOIN users seller ON seller.id = o.seller_user_id
            LEFT JOIN seller_profiles sp ON sp.user_id = o.seller_user_id
            LEFT JOIN users assignee ON assignee.id = o.assigned_to
            LEFT JOIN users assigner ON assigner.id = o.assigned_by
            ${where}
            ORDER BY o.created_at DESC
            LIMIT ? OFFSET ?
        `).all(...params, limit, offset);

        const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
        const getLogs = db.prepare(`
            SELECT l.*, actor.username AS actor_username
            FROM order_status_logs l
            LEFT JOIN users actor ON actor.id = l.actor_user_id
            WHERE l.order_id = ?
            ORDER BY l.created_at DESC
            LIMIT 10
        `);
        const ordersWithDetails = await Promise.all(orders.map(async (order) => ({
            ...order,
            items: await getItems.all(order.id),
            logs: await getLogs.all(order.id),
            allowedTransitions: getAllowedTransitions(staffUser, order),
        })));

        const staff = staffUser.role === 'worker'
            ? []
            : await db.prepare(`
                SELECT id, username, role
                FROM users
                WHERE role IN ('support', 'worker')
                ORDER BY role ASC, username ASC
            `).all();

        return NextResponse.json({
            orders: ordersWithDetails,
            staff,
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
