import { assertPayPalConfigured, getPayPalWebhookId } from '@/lib/env';

let cachedAccessToken = null;
let cachedExpiresAt = 0;

function toMinorUnits(value) {
    return Math.round(Number(value || 0) * 100);
}

function formatMinorUnits(value) {
    return (value / 100).toFixed(2);
}

function normalizeCurrencyCode(value) {
    return String(value || 'USD').toUpperCase();
}

function buildPayPalRequestId(scope, identifier) {
    return `iggm-${scope}-${String(identifier || '').replace(/[^a-zA-Z0-9_-]+/g, '-')}`.slice(0, 127);
}

async function getAccessToken() {
    const now = Date.now();
    if (cachedAccessToken && cachedExpiresAt > now + 30_000) {
        return cachedAccessToken;
    }

    const { clientId, clientSecret, baseUrl } = assertPayPalConfigured();
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`PayPal auth failed with status ${response.status}`);
    }

    const payload = await response.json();
    cachedAccessToken = payload.access_token;
    cachedExpiresAt = now + ((payload.expires_in || 300) * 1000);
    return cachedAccessToken;
}

async function paypalRequest(path, { method = 'GET', body, headers = {} } = {}) {
    const token = await getAccessToken();
    const { baseUrl } = assertPayPalConfigured();
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const issue = payload?.details?.[0]?.issue || payload?.message || `PayPal request failed with status ${response.status}`;
        throw new Error(issue);
    }

    return payload;
}

export async function createPayPalOrder({ order, items, user, appUrl }) {
    const currencyCode = normalizeCurrencyCode(order.currency);
    const orderTotalMinorUnits = toMinorUnits(order.total);
    const itemTotalMinorUnits = items.reduce(
        (sum, item) => sum + (toMinorUnits(item.unit_price) * Number(item.quantity || 0)),
        0
    );
    const discountMinorUnits = Math.max(0, itemTotalMinorUnits - orderTotalMinorUnits);
    const breakdown = {
        item_total: {
            currency_code: currencyCode,
            value: formatMinorUnits(itemTotalMinorUnits),
        },
    };

    if (discountMinorUnits > 0) {
        breakdown.discount = {
            currency_code: currencyCode,
            value: formatMinorUnits(discountMinorUnits),
        };
    }

    return paypalRequest('/v2/checkout/orders', {
        method: 'POST',
        headers: {
            'PayPal-Request-Id': buildPayPalRequestId('order', order.id || order.order_no),
        },
        body: {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: String(order.id),
                    custom_id: String(order.id),
                    invoice_id: order.order_no,
                    description: `Order ${order.order_no}`,
                    amount: {
                        currency_code: currencyCode,
                        value: formatMinorUnits(orderTotalMinorUnits),
                        breakdown,
                    },
                    items: items.map((item) => ({
                        name: item.product_name,
                        unit_amount: {
                            currency_code: currencyCode,
                            value: Number(item.unit_price || 0).toFixed(2),
                        },
                        quantity: String(item.quantity),
                        category: 'DIGITAL_GOODS',
                    })),
                },
            ],
            payer: {
                email_address: order.delivery_email || user.email,
            },
            application_context: {
                brand_name: 'IGGM',
                landing_page: 'LOGIN',
                user_action: 'PAY_NOW',
                return_url: `${appUrl}/checkout?orderId=${order.id}&payment=success&provider=paypal`,
                cancel_url: `${appUrl}/checkout?orderId=${order.id}&payment=cancelled&provider=paypal`,
            },
        },
    });
}

export async function capturePayPalOrder(paypalOrderId) {
    return paypalRequest(`/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: 'POST',
        headers: {
            'PayPal-Request-Id': buildPayPalRequestId('capture', paypalOrderId),
        },
        body: {},
    });
}

export async function getPayPalOrder(paypalOrderId) {
    return paypalRequest(`/v2/checkout/orders/${paypalOrderId}`);
}

export async function createPayPalRefund(captureId, { note = '', requestId = '' } = {}) {
    return paypalRequest(`/v2/payments/captures/${captureId}/refund`, {
        method: 'POST',
        headers: {
            'PayPal-Request-Id': requestId || buildPayPalRequestId('refund', captureId),
        },
        body: note ? { note_to_payer: note.slice(0, 255) } : {},
    });
}

export function getPayPalOrderPaymentAmount(paypalOrder) {
    const purchaseUnit = paypalOrder?.purchase_units?.[0];
    return purchaseUnit?.payments?.captures?.[0]?.amount || purchaseUnit?.amount || null;
}

export function isPayPalAmountValidForOrder(order, amount) {
    if (!amount) {
        return false;
    }

    return normalizeCurrencyCode(amount.currency_code) === normalizeCurrencyCode(order.currency)
        && toMinorUnits(amount.value) === toMinorUnits(order.total);
}

export async function verifyPayPalWebhookEvent({ headers, body, webhookEvent }) {
    const webhookId = getPayPalWebhookId();
    if (!webhookId) {
        throw new Error('PAYPAL_WEBHOOK_ID is not configured');
    }

    const verification = await paypalRequest('/v1/notifications/verify-webhook-signature', {
        method: 'POST',
        body: {
            auth_algo: headers.get('paypal-auth-algo'),
            cert_url: headers.get('paypal-cert-url'),
            transmission_id: headers.get('paypal-transmission-id'),
            transmission_sig: headers.get('paypal-transmission-sig'),
            transmission_time: headers.get('paypal-transmission-time'),
            webhook_id: webhookId,
            webhook_event: webhookEvent || JSON.parse(body),
        },
    });

    return verification.verification_status === 'SUCCESS';
}
