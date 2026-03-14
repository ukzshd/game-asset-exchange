import { getAppUrl } from '@/lib/env';

function parseHost(value) {
    try {
        return new URL(value).host;
    } catch {
        return '';
    }
}

export function assertTrustedOrigin(request) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const trustedHost = parseHost(getAppUrl(request));

    if (!origin && !referer) {
        return;
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
