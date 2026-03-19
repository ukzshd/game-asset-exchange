import { getDb } from '@/lib/db';

function getClientIp(request) {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || '127.0.0.1';
}

function getUserAgent(request) {
    return request.headers.get('user-agent') || '';
}

export function evaluateRisk({ total = 0, itemCount = 0, paymentMethod = '', hasReferral = false }) {
    let score = 0;
    const reasons = [];

    if (total >= 100) {
        score += 35;
        reasons.push('high_order_value');
    }

    if (itemCount >= 10) {
        score += 15;
        reasons.push('large_item_count');
    }

    if (!paymentMethod) {
        score += 20;
        reasons.push('missing_payment_method');
    }

    if (hasReferral) {
        score += 5;
        reasons.push('referred_order');
    }

    const severity = score >= 50 ? 'high' : score >= 20 ? 'medium' : 'info';
    return { score, severity, reasons };
}

export async function recordRiskEvent({
    request,
    userId = null,
    orderId = null,
    eventType,
    severity = 'info',
    score = 0,
    metadata = {},
}) {
    const db = await getDb();
    await db.prepare(`
        INSERT INTO risk_events (user_id, order_id, event_type, severity, score, ip_address, user_agent, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        userId,
        orderId,
        eventType,
        severity,
        score,
        request ? getClientIp(request) : '',
        request ? getUserAgent(request) : '',
        JSON.stringify(metadata || {})
    );
}
