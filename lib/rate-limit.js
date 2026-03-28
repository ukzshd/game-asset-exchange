const buckets = new Map();
let requestsSinceSweep = 0;

function now() {
    return Date.now();
}

function getBucket(key, windowMs) {
    const cutoff = now() - windowMs;
    const bucket = buckets.get(key) || { timestamps: [], windowMs };
    const active = bucket.timestamps.filter((timestamp) => timestamp > cutoff);
    if (active.length === 0) {
        buckets.delete(key);
        return { timestamps: [], windowMs };
    }

    const nextBucket = { timestamps: active, windowMs };
    buckets.set(key, nextBucket);
    return nextBucket;
}

function sweepExpiredBuckets() {
    requestsSinceSweep += 1;
    if (requestsSinceSweep < 200) {
        return;
    }

    requestsSinceSweep = 0;
    const current = now();
    for (const [key, bucket] of buckets.entries()) {
        const active = bucket.timestamps.filter((timestamp) => timestamp > (current - bucket.windowMs));
        if (active.length === 0) {
            buckets.delete(key);
        } else {
            buckets.set(key, { timestamps: active, windowMs: bucket.windowMs });
        }
    }
}

export function getClientIp(request) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return request.headers.get('x-real-ip') || '127.0.0.1';
}

export function assertRateLimit(request, scope, { limit, windowMs }) {
    sweepExpiredBuckets();
    const ip = getClientIp(request);
    const key = `${scope}:${ip}`;
    const bucket = getBucket(key, windowMs);

    if (bucket.timestamps.length >= limit) {
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

    bucket.timestamps.push(now());
    buckets.set(key, bucket);
}
