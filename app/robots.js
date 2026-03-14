import { getAppUrl } from '@/lib/env';

export default function robots() {
    const baseUrl = getAppUrl();

    return {
        rules: {
            userAgent: '*',
            allow: ['/', '/api/products/', '/api/search'],
            disallow: ['/admin', '/dashboard', '/checkout', '/api/auth/', '/api/orders', '/api/admin/', '/api/payments/'],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    };
}
