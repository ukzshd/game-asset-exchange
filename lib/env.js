const isProduction = process.env.NODE_ENV === 'production';

export function getAppUrl(request) {
    const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
    if (configured) {
        return configured.replace(/\/$/, '');
    }

    if (request) {
        const forwardedProto = request.headers.get('x-forwarded-proto');
        const forwardedHost = request.headers.get('x-forwarded-host');
        const host = forwardedHost || request.headers.get('host');
        if (host) {
            return `${forwardedProto || 'http'}://${host}`;
        }
    }

    return 'http://localhost:3000';
}

export function getJwtSecret() {
    const secret = process.env.JWT_SECRET;
    if (secret) return secret;

    if (isProduction) {
        console.warn('JWT_SECRET is not configured. Using an insecure fallback secret; set JWT_SECRET before deploying.');
    }

    return 'dev-only-jwt-secret-change-me';
}

export function getStripeSecretKey() {
    return process.env.STRIPE_SECRET_KEY || '';
}

export function getStripeWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET || '';
}

export function isStripeConfigured() {
    return Boolean(getStripeSecretKey() && getStripeWebhookSecret());
}

export function assertStripeConfigured() {
    const secretKey = getStripeSecretKey();
    if (!secretKey) {
        throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    return secretKey;
}
