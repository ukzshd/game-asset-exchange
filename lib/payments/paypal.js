import { assertPayPalConfigured, getPayPalWebhookId } from '@/lib/env';

let cachedAccessToken = null;
let cachedExpiresAt = 0;

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
    return paypalRequest('/v2/checkout/orders', {
        method: 'POST',
        body: {
            intent: 'CAPTURE',
            purchase_units: [
                {
                    reference_id: String(order.id),
                    custom_id: String(order.id),
                    invoice_id: order.order_no,
                    description: `Order ${order.order_no}`,
                    amount: {
                        currency_code: (order.currency || 'USD').toUpperCase(),
                        value: Number(order.total || 0).toFixed(2),
                        breakdown: {
                            item_total: {
                                currency_code: (order.currency || 'USD').toUpperCase(),
                                value: Number(order.total || 0).toFixed(2),
                            },
                        },
                    },
                    items: items.map((item) => ({
                        name: item.product_name,
                        unit_amount: {
                            currency_code: (order.currency || 'USD').toUpperCase(),
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
        body: {},
    });
}

export async function getPayPalOrder(paypalOrderId) {
    return paypalRequest(`/v2/checkout/orders/${paypalOrderId}`);
}

export async function createPayPalRefund(captureId, { note = '' } = {}) {
    return paypalRequest(`/v2/payments/captures/${captureId}/refund`, {
        method: 'POST',
        body: note ? { note_to_payer: note.slice(0, 255) } : {},
    });
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
