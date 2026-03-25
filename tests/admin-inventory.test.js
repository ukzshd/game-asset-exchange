import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authHeaders, cleanupIsolatedDb, createUser, setupIsolatedDb } from './helpers/test-env';

describe('admin inventory management', () => {
    let temp;

    beforeEach(async () => {
        temp = await setupIsolatedDb();
    });

    afterEach(async () => {
        await cleanupIsolatedDb(temp);
    });

    it('lets admins create, update, list, and delete inventory lots', async () => {
        const { token } = await createUser({ email: 'inventory-admin@example.com', username: 'inventoryadmin', role: 'admin' });
        const { POST, GET } = await import('@/app/api/admin/inventory/route');
        const { PUT, DELETE } = await import('@/app/api/admin/inventory/[id]/route');
        const { getDb } = await import('@/lib/db');
        const db = await getDb();

        const createResponse = await POST(new Request('http://localhost:3000/api/admin/inventory', {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({
                productId: 1,
                availableQuantity: 25,
                sourceType: 'supplier',
                sourceRef: 'SUP-001',
                note: 'Fresh batch',
            }),
        }));

        expect(createResponse.status).toBe(201);
        const createPayload = await createResponse.json();
        expect(createPayload.lot.source_ref).toBe('SUP-001');

        const productAfterCreate = await db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(1);
        expect(productAfterCreate.stock_quantity).toBe(1024);

        const listResponse = await GET(new Request('http://localhost:3000/api/admin/inventory?search=SUP-001', {
            headers: { Authorization: `Bearer ${token}` },
        }));
        expect(listResponse.status).toBe(200);
        const listPayload = await listResponse.json();
        expect(listPayload.lots.some((lot) => lot.source_ref === 'SUP-001')).toBe(true);

        const updateResponse = await PUT(new Request(`http://localhost:3000/api/admin/inventory/${createPayload.lot.id}`, {
            method: 'PUT',
            headers: authHeaders(token),
            body: JSON.stringify({
                availableQuantity: 10,
                sourceType: 'supplier',
                sourceRef: 'SUP-001',
                note: 'Adjusted batch',
            }),
        }), {
            params: Promise.resolve({ id: String(createPayload.lot.id) }),
        });

        expect(updateResponse.status).toBe(200);
        const updatedLot = await db.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(createPayload.lot.id);
        expect(updatedLot.available_quantity).toBe(10);
        const productAfterUpdate = await db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(1);
        expect(productAfterUpdate.stock_quantity).toBe(1009);

        const deleteResponse = await DELETE(new Request(`http://localhost:3000/api/admin/inventory/${createPayload.lot.id}`, {
            method: 'DELETE',
            headers: authHeaders(token),
        }), {
            params: Promise.resolve({ id: String(createPayload.lot.id) }),
        });

        expect(deleteResponse.status).toBe(200);
        const productAfterDelete = await db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(1);
        expect(productAfterDelete.stock_quantity).toBe(999);
    });
});
