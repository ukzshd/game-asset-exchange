import { DISPUTE_STATUS, MARKETPLACE_AUTO_COMPLETE_HOURS, SETTLEMENT_STATUS } from '@/lib/marketplace';

export const ORDER_STATUS = Object.freeze({
    PENDING_PAYMENT: 'pending_payment',
    PAID: 'paid',
    ASSIGNED: 'assigned',
    DELIVERING: 'delivering',
    DELIVERED: 'delivered',
    COMPLETED: 'completed',
    DISPUTED: 'disputed',
    PAYMENT_FAILED: 'payment_failed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded',
});

export const STAFF_ROLES = new Set(['admin', 'support', 'worker']);

const LEGACY_STATUS_TRANSITIONS = {
    [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED, ORDER_STATUS.PAYMENT_FAILED],
    [ORDER_STATUS.PAYMENT_FAILED]: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PAID]: [ORDER_STATUS.ASSIGNED, ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.ASSIGNED]: [ORDER_STATUS.DELIVERING, ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.DISPUTED]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUNDED],
    [ORDER_STATUS.COMPLETED]: [],
    [ORDER_STATUS.CANCELLED]: [],
    [ORDER_STATUS.REFUNDED]: [],
};

const MARKETPLACE_STATUS_TRANSITIONS = {
    [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED, ORDER_STATUS.PAYMENT_FAILED],
    [ORDER_STATUS.PAYMENT_FAILED]: [ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.CANCELLED],
    [ORDER_STATUS.PAID]: [ORDER_STATUS.DELIVERING, ORDER_STATUS.REFUNDED, ORDER_STATUS.DISPUTED],
    [ORDER_STATUS.DELIVERING]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.REFUNDED, ORDER_STATUS.DISPUTED],
    [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUNDED, ORDER_STATUS.DISPUTED],
    [ORDER_STATUS.DISPUTED]: [ORDER_STATUS.COMPLETED, ORDER_STATUS.REFUNDED, ORDER_STATUS.DELIVERING],
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

export function canAssignOrders(user) {
    return user?.role === 'admin' || user?.role === 'support';
}

export function isMarketplaceOrder(order) {
    return order?.order_source === 'marketplace';
}

export function canOperateOrder(user, order) {
    if (!user || !order || !isStaffRole(user.role)) return false;
    if (user.role === 'admin' || user.role === 'support') return true;
    return order.assigned_to === user.id;
}

function getTransitionsForOrder(order) {
    return isMarketplaceOrder(order) ? MARKETPLACE_STATUS_TRANSITIONS : LEGACY_STATUS_TRANSITIONS;
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

    const allowed = (getTransitionsForOrder(order)[order.status]) || [];
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
    const allowed = (getTransitionsForOrder(order)[order.status]) || [];
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

async function syncSellerPayoutForOrder(db, order, status, actorUserId = null) {
    if (!isMarketplaceOrder(order) || !order?.seller_user_id) {
        return;
    }

    if (status === ORDER_STATUS.COMPLETED) {
        const existing = await db.prepare('SELECT id, available_at FROM seller_payouts WHERE order_id = ?').get(order.id);
        if (existing) {
            await db.prepare(`
                UPDATE seller_payouts
                SET seller_user_id = ?,
                    gross_amount = ?,
                    platform_fee_amount = ?,
                    net_amount = ?,
                    status = 'available',
                    available_at = COALESCE(available_at, NOW()),
                    updated_at = NOW()
                WHERE id = ?
            `).run(
                order.seller_user_id,
                order.seller_gross_amount || order.total || 0,
                order.platform_fee_amount || 0,
                order.seller_net_amount || 0,
                existing.id
            );
        } else {
            await db.prepare(`
                INSERT INTO seller_payouts (
                    order_id, seller_user_id, gross_amount, platform_fee_amount, net_amount, status, available_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 'available', NOW(), NOW(), NOW())
            `).run(
                order.id,
                order.seller_user_id,
                order.seller_gross_amount || order.total || 0,
                order.platform_fee_amount || 0,
                order.seller_net_amount || 0
            );
        }
    }

    if (status === ORDER_STATUS.REFUNDED) {
        await db.prepare(`
            UPDATE seller_payouts
            SET status = 'cancelled',
                updated_at = NOW(),
                paid_by = COALESCE(paid_by, ?)
            WHERE order_id = ?
        `).run(actorUserId, order.id);
    }
}

export async function finalizeMarketplaceOrdersIfDue(db) {
    const dueOrders = await db.prepare(`
        SELECT *
        FROM orders
        WHERE order_source = 'marketplace'
          AND status = ?
          AND (dispute_status IS NULL OR dispute_status = '')
          AND auto_complete_at IS NOT NULL
          AND auto_complete_at <= NOW()
    `).all(ORDER_STATUS.DELIVERED);

    for (const order of dueOrders) {
        await setOrderStatus(db, {
            orderId: order.id,
            currentStatus: order.status,
            nextStatus: ORDER_STATUS.COMPLETED,
            actorRole: 'system',
            message: `Marketplace order auto-completed after ${MARKETPLACE_AUTO_COMPLETE_HOURS} hours`,
        });
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
    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const effectiveOrder = order || { id: orderId, status: currentStatus };
    const marketplaceOrder = isMarketplaceOrder(effectiveOrder);

    if (nextStatus === ORDER_STATUS.PAID) {
        const { decrementInventoryForOrder } = await import('@/lib/inventory');
        await decrementInventoryForOrder(db, orderId);
    }
    if (nextStatus === ORDER_STATUS.PAYMENT_FAILED || nextStatus === ORDER_STATUS.CANCELLED) {
        const { releaseReservedInventoryForOrder } = await import('@/lib/inventory');
        await releaseReservedInventoryForOrder(db, orderId);
    }
    if (nextStatus === ORDER_STATUS.REFUNDED) {
        const { restockInventoryForOrder } = await import('@/lib/inventory');
        await restockInventoryForOrder(db, orderId);
    }

    let paymentStatus = null;
    if (nextStatus === ORDER_STATUS.PAID) paymentStatus = 'paid';
    if (nextStatus === ORDER_STATUS.PAYMENT_FAILED) paymentStatus = 'failed';
    if (nextStatus === ORDER_STATUS.REFUNDED) paymentStatus = 'refunded';

    const assignments = [
        'status = ?',
        'updated_at = NOW()',
        'last_status_changed_at = NOW()',
    ];
    const params = [nextStatus];

    if (nextStatus === ORDER_STATUS.DELIVERED) {
        assignments.push('delivered_at = NOW()');
        if (marketplaceOrder) {
            assignments.push('delivered_by_seller_at = NOW()');
            assignments.push(`auto_complete_at = NOW() + INTERVAL '${MARKETPLACE_AUTO_COMPLETE_HOURS} hours'`);
        }
    }

    if (nextStatus === ORDER_STATUS.COMPLETED) {
        assignments.push('completed_at = NOW()');
        if (marketplaceOrder && actorRole === 'user') {
            assignments.push('buyer_confirmed_at = NOW()');
        }
    }

    if (marketplaceOrder) {
        if (nextStatus === ORDER_STATUS.PAID) {
            assignments.push('settlement_status = ?');
            params.push(SETTLEMENT_STATUS.PENDING);
        }
        if (nextStatus === ORDER_STATUS.DISPUTED) {
            assignments.push('settlement_status = ?');
            assignments.push('dispute_status = ?');
            assignments.push('dispute_opened_at = NOW()');
            params.push(SETTLEMENT_STATUS.BLOCKED, DISPUTE_STATUS.OPEN);
        }
        if (nextStatus === ORDER_STATUS.COMPLETED) {
            assignments.push('settlement_status = ?');
            params.push(SETTLEMENT_STATUS.AVAILABLE);
            if (effectiveOrder.dispute_status === DISPUTE_STATUS.OPEN) {
                assignments.push('dispute_status = ?');
                assignments.push('dispute_resolved_at = NOW()');
                params.push(DISPUTE_STATUS.RESOLVED);
            }
        }
        if (nextStatus === ORDER_STATUS.REFUNDED) {
            assignments.push('settlement_status = ?');
            params.push(SETTLEMENT_STATUS.CANCELLED);
            if (effectiveOrder.dispute_status === DISPUTE_STATUS.OPEN) {
                assignments.push('dispute_status = ?');
                assignments.push('dispute_resolved_at = NOW()');
                params.push(DISPUTE_STATUS.RESOLVED);
            }
        }
    }

    if (paymentStatus) {
        assignments.push('payment_status = ?');
        params.push(paymentStatus);
    }

    if (paymentReference) {
        assignments.push('payment_reference = ?');
        params.push(paymentReference);
    }

    params.push(orderId);
    await db.prepare(`
        UPDATE orders
        SET ${assignments.join(', ')}
        WHERE id = ?
    `).run(...params);
    await updateAffiliateStatusForOrder(db, orderId, nextStatus);
    await syncSellerPayoutForOrder(db, effectiveOrder, nextStatus, actorUserId);
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
