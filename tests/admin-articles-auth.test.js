import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authHeaders, cleanupIsolatedDb, createUser, setupIsolatedDb } from './helpers/test-env';

vi.mock('@/lib/email', () => ({
    generateOpaqueToken: () => 'reset-token-123',
    hashOpaqueToken: (token) => `hashed:${token}`,
    sendEmail: vi.fn(async () => ({ skipped: false })),
}));

describe('admin articles and password reset flows', () => {
    let temp;

    beforeEach(async () => {
        temp = await setupIsolatedDb();
    });

    afterEach(async () => {
        await cleanupIsolatedDb(temp);
    });

    it('lets admins create, update, list, and delete articles', async () => {
        const { token } = await createUser({ email: 'admin-articles@example.com', username: 'adminarticles', role: 'admin' });
        const { POST, GET } = await import('@/app/api/admin/articles/route');
        const { PUT, DELETE } = await import('@/app/api/admin/articles/[id]/route');

        const createResponse = await POST(new Request('http://localhost:3000/api/admin/articles', {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({
                slug: 'arc-raiders-reset-guide',
                title: 'ARC Raiders Reset Guide',
                excerpt: 'How to safely trade after a reset.',
                content: 'Paragraph one.\nParagraph two.',
                category: 'guides',
                gameSlug: 'arc-raiders',
                published: true,
            }),
        }));

        expect(createResponse.status).toBe(201);
        const createPayload = await createResponse.json();
        expect(createPayload.article.slug).toBe('arc-raiders-reset-guide');

        const listResponse = await GET(new Request('http://localhost:3000/api/admin/articles', {
            headers: { Authorization: `Bearer ${token}` },
        }));
        expect(listResponse.status).toBe(200);
        const listPayload = await listResponse.json();
        expect(listPayload.articles.some((article) => article.slug === 'arc-raiders-reset-guide')).toBe(true);

        const updateResponse = await PUT(new Request(`http://localhost:3000/api/admin/articles/${createPayload.article.id}`, {
            method: 'PUT',
            headers: authHeaders(token),
            body: JSON.stringify({
                slug: 'arc-raiders-reset-guide',
                title: 'ARC Raiders Reset Guide Updated',
                excerpt: 'Updated excerpt.',
                content: 'Updated content.',
                category: 'news',
                gameSlug: 'arc-raiders',
                published: false,
            }),
        }), {
            params: Promise.resolve({ id: String(createPayload.article.id) }),
        });

        expect(updateResponse.status).toBe(200);
        const updatePayload = await updateResponse.json();
        expect(updatePayload.article.title).toContain('Updated');
        expect(updatePayload.article.published).toBe(0);

        const deleteResponse = await DELETE(new Request(`http://localhost:3000/api/admin/articles/${createPayload.article.id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                Origin: 'http://localhost:3000',
            },
        }), {
            params: Promise.resolve({ id: String(createPayload.article.id) }),
        });

        expect(deleteResponse.status).toBe(200);
        const deletePayload = await deleteResponse.json();
        expect(deletePayload.success).toBe(true);
    });

    it('creates and consumes password reset tokens', async () => {
        const { user } = await createUser({ email: 'reset@example.com', username: 'resetuser' });
        const { POST: requestReset } = await import('@/app/api/auth/password-reset/request/route');
        const { POST: confirmReset } = await import('@/app/api/auth/password-reset/confirm/route');
        const { getDb } = await import('@/lib/db');
        const { verifyPassword } = await import('@/lib/auth');

        const requestResponse = await requestReset(new Request('http://localhost:3000/api/auth/password-reset/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'http://localhost:3000',
            },
            body: JSON.stringify({ email: user.email }),
        }));

        expect(requestResponse.status).toBe(200);

        const confirmResponse = await confirmReset(new Request('http://localhost:3000/api/auth/password-reset/confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'http://localhost:3000',
            },
            body: JSON.stringify({
                email: user.email,
                token: 'reset-token-123',
                password: 'newpassword123',
            }),
        }));

        expect(confirmResponse.status).toBe(200);

        const db = await getDb();
        const updatedUser = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);
        expect(await verifyPassword('newpassword123', updatedUser.password_hash)).toBe(true);

        const tokenRow = await db.prepare('SELECT used_at, token_hash FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(user.id);
        expect(tokenRow.token_hash).toBe('hashed:reset-token-123');
        expect(tokenRow.used_at).toBeTruthy();
    });
});
