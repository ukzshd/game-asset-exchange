import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authHeaders, cleanupIsolatedDb, createUser, setupIsolatedDb } from './helpers/test-env';

describe('admin product management', () => {
    let temp;

    beforeEach(async () => {
        temp = await setupIsolatedDb();
    });

    afterEach(async () => {
        await cleanupIsolatedDb(temp);
    });

    it('lets admins create, update, list, and delete products', async () => {
        const { token } = await createUser({ email: 'admin-products@example.com', username: 'adminproducts', role: 'admin' });
        const { POST, GET } = await import('@/app/api/admin/products/route');
        const { PUT, DELETE } = await import('@/app/api/admin/products/[id]/route');

        const createResponse = await POST(new Request('http://localhost:3000/api/admin/products', {
            method: 'POST',
            headers: {
                ...authHeaders(token),
                Origin: 'http://localhost:3000',
            },
            body: JSON.stringify({
                externalId: 'd4-gold-10m',
                gameSlug: 'diablo-4',
                category: 'Gold',
                subCategory: 'Seasonal',
                name: '10M Diablo 4 Gold',
                description: 'Manual delivery after payment.',
                price: '19.99',
                originalPrice: '24.99',
                discount: '10',
                inStock: true,
            }),
        }));

        expect(createResponse.status).toBe(201);
        const createPayload = await createResponse.json();
        expect(createPayload.product.external_id).toBe('d4-gold-10m');

        const listResponse = await GET(new Request('http://localhost:3000/api/admin/products?search=Diablo', {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }));
        expect(listResponse.status).toBe(200);
        const listPayload = await listResponse.json();
        expect(listPayload.products.some((product) => product.external_id === 'd4-gold-10m')).toBe(true);

        const updateResponse = await PUT(new Request(`http://localhost:3000/api/admin/products/${createPayload.product.id}`, {
            method: 'PUT',
            headers: {
                ...authHeaders(token),
                Origin: 'http://localhost:3000',
            },
            body: JSON.stringify({
                externalId: 'd4-gold-20m',
                gameSlug: 'diablo-4',
                category: 'Gold',
                subCategory: 'Seasonal',
                name: '20M Diablo 4 Gold',
                description: 'Updated stock package.',
                price: '34.99',
                originalPrice: '39.99',
                discount: '12',
                inStock: false,
            }),
        }), {
            params: Promise.resolve({ id: String(createPayload.product.id) }),
        });

        expect(updateResponse.status).toBe(200);
        const updatePayload = await updateResponse.json();
        expect(updatePayload.product.external_id).toBe('d4-gold-20m');
        expect(updatePayload.product.in_stock).toBe(0);

        const deleteResponse = await DELETE(new Request(`http://localhost:3000/api/admin/products/${createPayload.product.id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${token}`,
                Origin: 'http://localhost:3000',
            },
        }), {
            params: Promise.resolve({ id: String(createPayload.product.id) }),
        });

        expect(deleteResponse.status).toBe(200);
        const deletePayload = await deleteResponse.json();
        expect(deletePayload.success).toBe(true);
    });
});
