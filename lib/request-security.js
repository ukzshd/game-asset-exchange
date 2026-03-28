import { getAppUrl } from '@/lib/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function parseHost(value) {
    try {
        return new URL(value).host;
    } catch {
        return '';
    }
}

export function assertTrustedOrigin(request) {
    const method = String(request.method || 'GET').toUpperCase();
    if (SAFE_METHODS.has(method)) {
        return;
    }

    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const trustedHost = parseHost(getAppUrl(request));

    if (!origin && !referer) {
        throw new Response(JSON.stringify({ error: 'Origin or referer is required for state-changing requests' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const originHost = origin ? parseHost(origin) : '';
    const refererHost = referer ? parseHost(referer) : '';
    const requestHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';

    const allowedHosts = new Set([trustedHost, requestHost].filter(Boolean));
    if (originHost && allowedHosts.has(originHost)) return;
    if (!originHost && refererHost && allowedHosts.has(refererHost)) return;

    throw new Response(JSON.stringify({ error: 'Cross-site request rejected' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
    });
}
