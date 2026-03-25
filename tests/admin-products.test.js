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
        const { getDb } = await import('@/lib/db');

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
                platform: 'PC',
                serverRegion: 'US',
                rarity: 'Legendary',
                name: '10M Diablo 4 Gold',
                description: 'Manual delivery after payment.',
                deliveryNote: 'Meet in Kyovashad.',
                packageLabel: '10M Gold',
                packageSize: '10',
                packageUnit: 'million',
                price: '19.99',
                originalPrice: '24.99',
                discount: '10',
                stockQuantity: '25',
                inStock: true,
            }),
        }));

        expect(createResponse.status).toBe(201);
        const createPayload = await createResponse.json();
        expect(createPayload.product.external_id).toBe('d4-gold-10m');
        expect(createPayload.product.stock_quantity).toBe(25);

        const db = await getDb();
        const sku = await db.prepare('SELECT * FROM product_skus WHERE legacy_product_id = ?').get(createPayload.product.id);
        const spu = await db.prepare('SELECT * FROM product_spus WHERE id = ?').get(createPayload.product.spu_id);
        const lot = await db.prepare('SELECT * FROM inventory_lots WHERE sku_id = ?').get(createPayload.product.sku_id);
        expect(spu.platform).toBe('PC');
        expect(sku.package_label).toBe('10M Gold');
        expect(lot.available_quantity).toBe(25);

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
                platform: 'PC',
                serverRegion: 'EU',
                rarity: 'Epic',
                name: '20M Diablo 4 Gold',
                description: 'Updated stock package.',
                deliveryNote: 'Updated route.',
                packageLabel: '20M Gold',
                packageSize: '20',
                packageUnit: 'million',
                price: '34.99',
                originalPrice: '39.99',
                discount: '12',
                stockQuantity: '8',
                inStock: false,
            }),
        }), {
            params: Promise.resolve({ id: String(createPayload.product.id) }),
        });

        expect(updateResponse.status).toBe(200);
        const updatePayload = await updateResponse.json();
        expect(updatePayload.product.external_id).toBe('d4-gold-20m');
        expect(updatePayload.product.in_stock).toBe(0);

        const updatedSku = await db.prepare('SELECT * FROM product_skus WHERE legacy_product_id = ?').get(createPayload.product.id);
        const updatedSpu = await db.prepare('SELECT * FROM product_spus WHERE id = ?').get(updatePayload.product.spu_id);
        expect(updatedSku.stock_quantity).toBe(8);
        expect(updatedSpu.server_region).toBe('EU');

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

    it('does not overwrite multi-lot inventory when editing non-inventory product fields', async () => {
        const { token } = await createUser({ email: 'admin-multilot@example.com', username: 'adminmultilot', role: 'admin' });
        const { POST } = await import('@/app/api/admin/products/route');
        const { PUT } = await import('@/app/api/admin/products/[id]/route');
        const { getDb } = await import('@/lib/db');

        const createResponse = await POST(new Request('http://localhost:3000/api/admin/products', {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({
                externalId: 'arc-multi-lot',
                gameSlug: 'arc-raiders',
                category: 'Items',
                subCategory: 'Materials',
                platform: 'PC',
                serverRegion: 'US',
                rarity: 'Rare',
                name: 'Multi Lot Bundle',
                description: 'Primary product',
                deliveryNote: 'Original note',
                packageLabel: 'Bundle',
                packageSize: '1',
                packageUnit: 'bundle',
                price: '10.00',
                originalPrice: '12.00',
                discount: '0',
                stockQuantity: '5',
                inStock: true,
            }),
        }));
        expect(createResponse.status).toBe(201);
        const { product } = await createResponse.json();

        const db = await getDb();
        await db.prepare(`
            INSERT INTO inventory_lots (sku_id, source_type, source_ref, available_quantity, reserved_quantity, unit_cost, note)
            VALUES (?, 'supplier', 'LOT-SECOND', 4, 0, 0, 'Second lot')
        `).run(product.sku_id);
        const { recomputeInventoryAggregates } = await import('@/lib/inventory');
        await recomputeInventoryAggregates(db, product.sku_id, product.id);

        const updateResponse = await PUT(new Request(`http://localhost:3000/api/admin/products/${product.id}`, {
            method: 'PUT',
            headers: authHeaders(token),
            body: JSON.stringify({
                externalId: 'arc-multi-lot',
                gameSlug: 'arc-raiders',
                category: 'Items',
                subCategory: 'Materials',
                platform: 'PC',
                serverRegion: 'EU',
                rarity: 'Epic',
                name: 'Multi Lot Bundle Updated',
                description: 'Updated non-inventory fields',
                deliveryNote: 'Updated note',
                packageLabel: 'Bundle Updated',
                packageSize: '1',
                packageUnit: 'bundle',
                price: '15.00',
                originalPrice: '17.00',
                discount: '5',
                stockQuantity: '99',
                inStock: true,
            }),
        }), {
            params: Promise.resolve({ id: String(product.id) }),
        });

        expect(updateResponse.status).toBe(200);
        const lots = await db.prepare(`
            SELECT available_quantity
            FROM inventory_lots
            WHERE sku_id = ?
            ORDER BY id ASC
        `).all(product.sku_id);
        expect(lots.map((lot) => lot.available_quantity)).toEqual([5, 4]);

        const updatedProduct = await db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(product.id);
        const updatedSku = await db.prepare('SELECT stock_quantity FROM product_skus WHERE id = ?').get(product.sku_id);
        expect(updatedProduct.stock_quantity).toBe(9);
        expect(updatedSku.stock_quantity).toBe(9);
    });
});
