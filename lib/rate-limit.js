const buckets = new Map();

function now() {
    return Date.now();
}

function getBucket(key, windowMs) {
    const cutoff = now() - windowMs;
    const bucket = buckets.get(key) || [];
    const active = bucket.filter((timestamp) => timestamp > cutoff);
    buckets.set(key, active);
    return active;
}

export function getClientIp(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return request.headers.get('x-real-ip') || '127.0.0.1';
}

export function assertRateLimit(request, scope, { limit, windowMs }) {
    const ip = getClientIp(request);
    const key = `${scope}:${ip}`;
    const bucket = getBucket(key, windowMs);

    if (bucket.length >= limit) {
        throw new Response(JSON.stringify({
            error: 'Too many requests. Please try again later.',
            retryAfterSeconds: Math.ceil(windowMs / 1000),
        }), {
            status: 429,
            headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(Math.ceil(windowMs / 1000)),
            },
        });
    }

    bucket.push(now());
    buckets.set(key, bucket);
}
