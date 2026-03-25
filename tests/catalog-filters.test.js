import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanupIsolatedDb, setupIsolatedDb } from './helpers/test-env';

describe('catalog filters', () => {
    let temp;

    beforeEach(async () => {
        temp = await setupIsolatedDb();
    });

    afterEach(async () => {
        await cleanupIsolatedDb(temp);
    });

    it('filters products by platform, server region, rarity, and stock', async () => {
        const { getDb } = await import('@/lib/db');
        const { GET } = await import('@/app/api/products/[game]/route');
        const db = await getDb();

        await db.prepare(`
            INSERT INTO products (
                external_id, game_slug, category, sub_category, name, description,
                platform, server_region, rarity, package_label, package_size, package_unit,
                price, original_price, discount, in_stock, stock_quantity, image
            ) VALUES
            ('arc-eu-legend', 'arc-raiders', 'Items', 'Weapons', 'EU Legendary Rifle', 'High tier rifle', 'PC', 'EU', 'Legendary', '1 Rifle', 1, 'bundle', 39.99, 49.99, 10, 1, 4, ''),
            ('arc-us-rare', 'arc-raiders', 'Items', 'Materials', 'US Rare Alloy', 'Rare alloy bundle', 'PC', 'US', 'Rare', '5 Alloy', 5, 'bundle', 14.99, 19.99, 0, 0, 0, '')
        `).run();

        const filteredResponse = await GET(
            new Request('http://localhost:3000/api/products/arc-raiders?platform=PC&serverRegion=EU&rarity=Legendary&stock=in_stock'),
            { params: Promise.resolve({ game: 'arc-raiders' }) }
        );
        expect(filteredResponse.status).toBe(200);
        const filteredPayload = await filteredResponse.json();
        expect(filteredPayload.products).toHaveLength(1);
        expect(filteredPayload.products[0].external_id).toBe('arc-eu-legend');

        const outOfStockResponse = await GET(
            new Request('http://localhost:3000/api/products/arc-raiders?stock=out_of_stock&search=Alloy'),
            { params: Promise.resolve({ game: 'arc-raiders' }) }
        );
        expect(outOfStockResponse.status).toBe(200);
        const outOfStockPayload = await outOfStockResponse.json();
        expect(outOfStockPayload.products).toHaveLength(1);
        expect(outOfStockPayload.products[0].external_id).toBe('arc-us-rare');

        expect(outOfStockPayload.platforms).toContain('PC');
        expect(outOfStockPayload.serverRegions).toContain('EU');
        expect(outOfStockPayload.serverRegions).toContain('US');
        expect(outOfStockPayload.rarities).toContain('Legendary');
        expect(outOfStockPayload.rarities).toContain('Rare');
    });
});
