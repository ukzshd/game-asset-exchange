export const ORDER_STATUS = Object.freeze({
    PENDING_PAYMENT: 'pending_payment',
    PAID: 'paid',
    ASSIGNED: 'assigned',
    DELIVERING: 'delivering',
    DELIVERED: 'delivered',
    COMPLETED: 'completed',
    PAYMENT_FAILED: 'payment_failed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
});

export const STAFF_ROLES = new Set(['admin', 'support', 'worker']);

const STATUS_TRANSITIONS = {
    [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED, ORDER_STATUS.PAYMENT_FAILED],
    [ORDER_STATUS.PAYMENT_FAILED]: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PAID]: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.ASSIGNED]: [ORDER_STATUS.DELIVERING, ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.COMPLETED]: [],
    [ORDER_STATUS.CANCELLED]: [],
    [ORDER_STATUS.REFUNDED]: [],
};

const WORKER_TRANSITIONS = new Set([
    `${ORDER_STATUS.ASSIGNED}:${ORDER_STATUS.DELIVERING}`,
    `${ORDER_STATUS.DELIVERING}:${ORDER_STATUS.DELIVERED}`,
]);

export function isStaffRole(role) {
    return STAFF_ROLES.has(role);
}

export function canManageUsers(user) {
    return user?.role === 'admin';
}

export function canAssignOrders(user) {
    return user?.role === 'admin' || user?.role === 'support';
}

export function canOperateOrder(user, order) {
    if (!user || !order || !isStaffRole(user.role)) return false;
    if (user.role === 'admin' || user.role === 'support') return true;
    return order.assigned_to === user.id;
}

export function assertValidStatus(status) {
    if (!Object.values(ORDER_STATUS).includes(status)) {
        throw new Response(JSON.stringify({ error: `Invalid status: ${status}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

export function assertAllowedTransition(user, order, nextStatus) {
    assertValidStatus(nextStatus);

    if (!canOperateOrder(user, order)) {
        throw new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const allowed = STATUS_TRANSITIONS[order.status] || [];
    if (!allowed.includes(nextStatus)) {
        throw new Response(JSON.stringify({
            error: `Invalid transition from ${order.status} to ${nextStatus}`,
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (user.role === 'worker') {
        const transitionKey = `${order.status}:${nextStatus}`;
        if (!WORKER_TRANSITIONS.has(transitionKey)) {
            throw new Response(JSON.stringify({ error: 'Workers cannot perform this transition' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
            });
        }
    }
}

export function getAllowedTransitions(user, order) {
    if (!canOperateOrder(user, order)) return [];
    const allowed = STATUS_TRANSITIONS[order.status] || [];
    if (user.role !== 'worker') return allowed;
    return allowed.filter((status) => WORKER_TRANSITIONS.has(`${order.status}:${status}`));
}

export async function createOrderLog(db, {
    orderId,
    actorUserId = null,
    actorRole = 'system',
    eventType,
    fromStatus = null,
    toStatus = null,
    message = '',
    metadata = null,
}) {
    await db.prepare(`
        INSERT INTO order_status_logs (
            order_id, actor_user_id, actor_role, event_type, from_status, to_status, message, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        orderId,
        actorUserId,
        actorRole,
        eventType,
        fromStatus,
        toStatus,
        message,
        metadata ? JSON.stringify(metadata) : null
    );
}

export async function updateAffiliateStatusForOrder(db, orderId, status) {
    if (status === ORDER_STATUS.REFUNDED) {
        await db.prepare("UPDATE affiliate_commissions SET status = 'cancelled' WHERE order_id = ?").run(orderId);
    }

    if (status === ORDER_STATUS.COMPLETED) {
        await db.prepare("UPDATE affiliate_commissions SET status = 'paid' WHERE order_id = ?").run(orderId);
    }
}

export async function setOrderStatus(db, {
    orderId,
    currentStatus,
    nextStatus,
    actorUserId = null,
    actorRole = 'system',
    paymentReference = '',
    message = '',
}) {
    let paymentStatus = null;
    if (nextStatus === ORDER_STATUS.PAID) paymentStatus = 'paid';
    if (nextStatus === ORDER_STATUS.PAYMENT_FAILED) paymentStatus = 'failed';
    if (nextStatus === ORDER_STATUS.REFUNDED) paymentStatus = 'refunded';

    await db.prepare(`
        UPDATE orders
        SET status = ?,
            updated_at = NOW(),
            last_status_changed_at = NOW(),
            delivered_at = CASE WHEN ? = ? THEN NOW() ELSE delivered_at END,
            completed_at = CASE WHEN ? = ? THEN NOW() ELSE completed_at END,
            payment_status = COALESCE(?, payment_status),
            payment_reference = CASE WHEN ? != '' THEN ? ELSE payment_reference END
        WHERE id = ?
    `).run(
        nextStatus,
        nextStatus,
        ORDER_STATUS.DELIVERED,
        nextStatus,
        ORDER_STATUS.COMPLETED,
        paymentStatus,
        paymentReference,
        paymentReference,
        orderId
    );
    await updateAffiliateStatusForOrder(db, orderId, nextStatus);
    await createOrderLog(db, {
        orderId,
        actorUserId,
        actorRole,
        eventType: 'status_changed',
        fromStatus: currentStatus,
        toStatus: nextStatus,
        message,
        metadata: paymentReference ? { paymentReference } : null,
    });
}

export async function assignOrder(db, {
    order,
    assignee,
    actor,
    note = '',
}) {
    const shouldAdvanceStatus = order.status === ORDER_STATUS.PAID;
    const nextStatus = shouldAdvanceStatus ? ORDER_STATUS.ASSIGNED : order.status;

    await db.prepare(`
        UPDATE orders
        SET assigned_to = ?,
            assigned_at = NOW(),
            assigned_by = ?,
            status = ?,
            updated_at = NOW(),
            last_status_changed_at = CASE WHEN ? != status THEN NOW() ELSE last_status_changed_at END
        WHERE id = ?
    `).run(assignee.id, actor.id, nextStatus, nextStatus, order.id);

    await createOrderLog(db, {
        orderId: order.id,
        actorUserId: actor.id,
        actorRole: actor.role,
        eventType: 'assigned',
        fromStatus: order.status,
        toStatus: nextStatus,
        message: note || `Assigned to ${assignee.username}`,
        metadata: {
            assigneeId: assignee.id,
            assigneeRole: assignee.role,
        },
    });
}

export const ORDER_STATUSES = Object.values(ORDER_STATUS);
