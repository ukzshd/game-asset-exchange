import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupIsolatedDb, createUser, setupIsolatedDb } from './helpers/test-env';

describe('read-only API routes and origin protection', () => {
    let temp;

    beforeEach(async () => {
        temp = await setupIsolatedDb();
        await createUser({ email: 'reader@example.com', username: 'reader' });
    });

    afterEach(async () => {
        await cleanupIsolatedDb(temp);
    });

    it('returns search results for products and games', async () => {
        const { GET } = await import('@/app/api/search/route');
        const response = await GET(new Request('http://localhost:3000/api/search?q=arc&limit=5'));
        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.games.length).toBeGreaterThan(0);
        expect(payload.products.length).toBeGreaterThan(0);
    });

    it('returns product detail with related products', async () => {
        const { GET } = await import('@/app/api/products/[game]/[id]/route');
        const response = await GET(new Request('http://localhost:3000/api/products/arc-raiders/1'), {
            params: Promise.resolve({ game: 'arc-raiders', id: '1' }),
        });
        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.product.id).toBe(1);
        expect(Array.isArray(payload.related)).toBe(true);
    });

    it('returns published articles and detail payloads', async () => {
        const { GET: listArticles } = await import('@/app/api/articles/route');
        const { GET: articleDetail } = await import('@/app/api/articles/[slug]/route');

        const listResponse = await listArticles(new Request('http://localhost:3000/api/articles?game=arc-raiders&limit=2'));
        expect(listResponse.status).toBe(200);
        const listPayload = await listResponse.json();
        expect(listPayload.articles.length).toBeGreaterThan(0);

        const slug = listPayload.articles[0].slug;
        const detailResponse = await articleDetail(new Request(`http://localhost:3000/api/articles/${slug}`), {
            params: Promise.resolve({ slug }),
        });
        expect(detailResponse.status).toBe(200);
        const detailPayload = await detailResponse.json();
        expect(detailPayload.article.slug).toBe(slug);
    });

    it('resolves product detail by external id as well as numeric id', async () => {
        const { GET } = await import('@/app/api/products/[game]/[id]/route');
        const response = await GET(new Request('http://localhost:3000/api/products/arc-raiders/arc-wmm-1-5'), {
            params: Promise.resolve({ game: 'arc-raiders', id: 'arc-wmm-1-5' }),
        });

        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.product.external_id).toBe('arc-wmm-1-5');
    });

    it('rejects cross-site register attempts when origin is untrusted', async () => {
        const { POST } = await import('@/app/api/auth/register/route');
        const response = await POST(new Request('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'https://evil.example.com',
            },
            body: JSON.stringify({
                email: 'new@example.com',
                password: 'password123',
                username: 'newuser',
            }),
        }));

        expect(response.status).toBe(403);
        const payload = await response.json();
        expect(payload.error).toContain('Cross-site request rejected');
    });

    it('rejects state-changing requests that omit origin and referer', async () => {
        const { POST } = await import('@/app/api/auth/register/route');
        const response = await POST(new Request('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: 'missing-origin@example.com',
                password: 'password123',
                username: 'missingorigin',
            }),
        }));

        expect(response.status).toBe(403);
        const payload = await response.json();
        expect(payload.error).toContain('Origin or referer is required');
    });
});
