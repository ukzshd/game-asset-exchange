import { getDb } from '@/lib/db';
import { recomputeInventoryAggregates } from '@/lib/inventory';

function normalizePackageSize(value) {
    const size = Number.parseInt(String(value || '1'), 10);
    return Number.isFinite(size) && size > 0 ? size : 1;
}

function normalizeStockQuantity(value, inStock) {
    const quantity = Number.parseInt(String(value ?? ''), 10);
    if (Number.isFinite(quantity) && quantity >= 0) {
        return quantity;
    }
    return inStock ? 999 : 0;
}

export function normalizeProductInput(body) {
    const price = Number.parseFloat(body?.price || '0') || 0;
    const originalPrice = Number.parseFloat(body?.originalPrice || '0') || 0;
    const discount = Math.max(0, Math.min(99, Number.parseInt(String(body?.discount || '0'), 10) || 0));
    const inStock = !(body?.inStock === false || body?.inStock === 0 || body?.inStock === '0');
    const stockQuantity = normalizeStockQuantity(body?.stockQuantity, inStock);

    return {
        externalId: String(body?.externalId || '').trim().slice(0, 120),
        gameSlug: String(body?.gameSlug || '').trim().slice(0, 64),
        category: String(body?.category || '').trim().slice(0, 64),
        subCategory: String(body?.subCategory || '').trim().slice(0, 64),
        name: String(body?.name || '').trim().slice(0, 180),
        description: String(body?.description || '').trim().slice(0, 2000),
        price: Math.max(0, price),
        originalPrice: Math.max(0, originalPrice),
        discount,
        image: String(body?.image || '').trim().slice(0, 255),
        inStock,
        platform: String(body?.platform || '').trim().slice(0, 32),
        serverRegion: String(body?.serverRegion || '').trim().slice(0, 64),
        rarity: String(body?.rarity || '').trim().slice(0, 32),
        deliveryNote: String(body?.deliveryNote || '').trim().slice(0, 1000),
        packageLabel: String(body?.packageLabel || '').trim().slice(0, 120),
        packageSize: normalizePackageSize(body?.packageSize),
        packageUnit: String(body?.packageUnit || 'bundle').trim().slice(0, 32) || 'bundle',
        stockQuantity,
    };
}

export async function syncNormalizedProductModel(db, productId, input) {
    const active = input.inStock ? 1 : 0;
    const stockQuantity = input.stockQuantity;
    const packageLabel = input.packageLabel || input.name;
    const attributesJson = JSON.stringify({
        platform: input.platform || '',
        serverRegion: input.serverRegion || '',
        rarity: input.rarity || '',
    });

    const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) {
        throw new Error('Product not found');
    }

    let spuId = product.spu_id;
    if (!spuId) {
        const spuInsert = await db.prepare(`
            INSERT INTO product_spus (
                game_slug, category, sub_category, name, description, image,
                platform, server_region, rarity, delivery_note, active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            input.gameSlug,
            input.category,
            input.subCategory,
            input.name,
            input.description,
            input.image,
            input.platform,
            input.serverRegion,
            input.rarity,
            input.deliveryNote,
            active
        );
        spuId = spuInsert.lastInsertRowid;
    } else {
        await db.prepare(`
            UPDATE product_spus
            SET game_slug = ?, category = ?, sub_category = ?, name = ?, description = ?, image = ?,
                platform = ?, server_region = ?, rarity = ?, delivery_note = ?, active = ?, updated_at = NOW()
            WHERE id = ?
        `).run(
            input.gameSlug,
            input.category,
            input.subCategory,
            input.name,
            input.description,
            input.image,
            input.platform,
            input.serverRegion,
            input.rarity,
            input.deliveryNote,
            active,
            spuId
        );
    }

    let skuId = product.sku_id;
    if (!skuId) {
        const skuInsert = await db.prepare(`
            INSERT INTO product_skus (
                spu_id, legacy_product_id, external_id, sku_code, package_label,
                package_size, package_unit, price, original_price, discount,
                in_stock, stock_quantity, attributes_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            spuId,
            productId,
            input.externalId,
            `SKU-${productId}`,
            packageLabel,
            input.packageSize,
            input.packageUnit,
            input.price,
            input.originalPrice || input.price,
            input.discount,
            active,
            stockQuantity,
            attributesJson
        );
        skuId = skuInsert.lastInsertRowid;
    } else {
        await db.prepare(`
            UPDATE product_skus
            SET spu_id = ?, legacy_product_id = ?, external_id = ?, package_label = ?,
                package_size = ?, package_unit = ?, price = ?, original_price = ?, discount = ?,
                in_stock = ?, stock_quantity = ?, attributes_json = ?, updated_at = NOW()
            WHERE id = ?
        `).run(
            spuId,
            productId,
            input.externalId,
            packageLabel,
            input.packageSize,
            input.packageUnit,
            input.price,
            input.originalPrice || input.price,
            input.discount,
            active,
            stockQuantity,
            attributesJson,
            skuId
        );
    }

    const lots = await db.prepare(`
        SELECT id, source_ref, available_quantity
        FROM inventory_lots
        WHERE sku_id = ?
        ORDER BY id ASC
    `).all(skuId);

    let nextStockQuantity = stockQuantity;
    if (lots.length === 0) {
        await db.prepare(`
            INSERT INTO inventory_lots (sku_id, source_type, source_ref, available_quantity, reserved_quantity, unit_cost, note)
            VALUES (?, 'manual', ?, ?, 0, 0, 'Primary inventory lot')
        `).run(skuId, `product:${productId}`, stockQuantity);
    } else if (lots.length === 1) {
        await db.prepare(`
            UPDATE inventory_lots
            SET available_quantity = ?, updated_at = NOW()
            WHERE id = ?
        `).run(stockQuantity, lots[0].id);
    } else {
        nextStockQuantity = await recomputeInventoryAggregates(db, skuId, productId);
    }

    await db.prepare(`
        UPDATE product_skus
        SET stock_quantity = ?, in_stock = ?, updated_at = NOW()
        WHERE id = ?
    `).run(nextStockQuantity, active, skuId);

    await db.prepare(`
        UPDATE products
        SET spu_id = ?, sku_id = ?, stock_quantity = ?, in_stock = ?, updated_at = NOW()
        WHERE id = ?
    `).run(spuId, skuId, nextStockQuantity, active, productId);

    return { spuId, skuId, stockQuantity: nextStockQuantity };
}

export async function getCatalogProductDetail(gameSlug, identifier) {
    const db = await getDb();
    const numericId = Number.parseInt(String(identifier), 10);

    let product = null;
    if (Number.isFinite(numericId) && String(numericId) === String(identifier)) {
        product = await db.prepare(`
            SELECT p.*, spu.delivery_note, sku.package_label, sku.package_size, sku.package_unit,
                   sku.stock_quantity, sku.attributes_json
            FROM products p
            LEFT JOIN product_spus spu ON spu.id = p.spu_id
            LEFT JOIN product_skus sku ON sku.id = p.sku_id
            WHERE p.game_slug = ? AND p.id = ?
        `).get(gameSlug, numericId);
    }

    if (!product) {
        product = await db.prepare(`
            SELECT p.*, spu.delivery_note, sku.package_label, sku.package_size, sku.package_unit,
                   sku.stock_quantity, sku.attributes_json
            FROM products p
            LEFT JOIN product_spus spu ON spu.id = p.spu_id
            LEFT JOIN product_skus sku ON sku.id = p.sku_id
            WHERE p.game_slug = ? AND p.external_id = ?
        `).get(gameSlug, String(identifier));
    }

    return product;
}
