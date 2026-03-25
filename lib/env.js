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

export function getPayPalClientId() {
    return process.env.PAYPAL_CLIENT_ID || '';
}

export function getPayPalClientSecret() {
    return process.env.PAYPAL_CLIENT_SECRET || '';
}

export function getPayPalWebhookId() {
    return process.env.PAYPAL_WEBHOOK_ID || '';
}

export function getPayPalBaseUrl() {
    return process.env.PAYPAL_BASE_URL || 'https://api-m.sandbox.paypal.com';
}

export function isPayPalConfigured() {
    return Boolean(getPayPalClientId() && getPayPalClientSecret());
}

export function assertPayPalConfigured() {
    const clientId = getPayPalClientId();
    const clientSecret = getPayPalClientSecret();
    if (!clientId || !clientSecret) {
        throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured');
    }

    return {
        clientId,
        clientSecret,
        webhookId: getPayPalWebhookId(),
        baseUrl: getPayPalBaseUrl(),
    };
}

export function getGoogleClientId() {
    return process.env.GOOGLE_CLIENT_ID || '';
}

export function getGoogleClientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET || '';
}

export function getDiscordClientId() {
    return process.env.DISCORD_CLIENT_ID || '';
}

export function getDiscordClientSecret() {
    return process.env.DISCORD_CLIENT_SECRET || '';
}

export function getSteamApiKey() {
    return process.env.STEAM_API_KEY || '';
}

export function getOAuthProviderConfig(provider) {
    if (provider === 'google') {
        const clientId = getGoogleClientId();
        const clientSecret = getGoogleClientSecret();
        if (!clientId || !clientSecret) {
            throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured');
        }
        return { clientId, clientSecret };
    }

    if (provider === 'discord') {
        const clientId = getDiscordClientId();
        const clientSecret = getDiscordClientSecret();
        if (!clientId || !clientSecret) {
            throw new Error('DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET must be configured');
        }
        return { clientId, clientSecret };
    }

    if (provider === 'steam') {
        return { apiKey: getSteamApiKey() };
    }

    throw new Error(`Unsupported OAuth provider: ${provider}`);
}
