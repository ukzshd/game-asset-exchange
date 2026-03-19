import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { canAssignOrders, assignOrder, ORDER_STATUS } from '@/lib/orders';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanMultilineText, toInteger } from '@/lib/validation';

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        const actor = await requireStaff(request);
        if (!canAssignOrders(actor)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();
        const assigneeId = toInteger(body?.assigneeId, 0);
        const note = cleanMultilineText(body?.note, 500);

        if (!assigneeId) {
            return NextResponse.json({ error: 'assigneeId is required' }, { status: 400 });
        }

        const db = await getDb();
        const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }
        if (![ORDER_STATUS.PAID, ORDER_STATUS.ASSIGNED, ORDER_STATUS.DELIVERING].includes(order.status)) {
            return NextResponse.json({ error: `Order cannot be assigned while in status ${order.status}` }, { status: 400 });
        }

        const assignee = await db.prepare('SELECT id, username, role FROM users WHERE id = ? AND role IN (?, ?)').get(assigneeId, 'support', 'worker');
        if (!assignee) {
            return NextResponse.json({ error: 'Assignee must be a support or worker user' }, { status: 400 });
        }

        const tx = db.transaction(async () => {
            await assignOrder(db, { order, assignee, actor, note });
        });
        await tx();

        const updated = await db.prepare(`
            SELECT o.*, assignee.username AS assigned_username
            FROM orders o
            LEFT JOIN users assignee ON assignee.id = o.assigned_to
            WHERE o.id = ?
        `).get(id);
        return NextResponse.json({ order: updated });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Assign order error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
