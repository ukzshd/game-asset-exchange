import Stripe from 'stripe';
import { assertStripeConfigured, getStripeWebhookSecret } from '@/lib/env';

let stripeClient = null;

export function getStripeClient() {
    if (!stripeClient) {
        stripeClient = new Stripe(assertStripeConfigured());
    }
    return stripeClient;
}

export function constructStripeWebhookEvent(payload, signature) {
    const webhookSecret = getStripeWebhookSecret();
    if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return getStripeClient().webhooks.constructEvent(payload, signature, webhookSecret);
}

export async function createStripeRefund(paymentIntentId, metadata = {}) {
    return getStripeClient().refunds.create({
        payment_intent: paymentIntentId,
        metadata,
    });
}
