export async function recomputeProductStock(db, productId) {
    const aggregate = await db.prepare(`
        SELECT
            COALESCE(SUM(il.available_quantity - il.reserved_quantity), 0)::int AS available
        FROM products p
        LEFT JOIN inventory_lots il ON il.sku_id = p.sku_id
        WHERE p.id = ?
    `).get(productId);

    const nextStock = Math.max(0, aggregate?.available || 0);
    await db.prepare(`
        UPDATE products
        SET stock_quantity = ?, in_stock = CASE WHEN ? > 0 THEN 1 ELSE 0 END, updated_at = NOW()
        WHERE id = ?
    `).run(nextStock, nextStock, productId);

    return nextStock;
}

export async function recomputeInventoryAggregates(db, skuId, productId) {
    const skuStock = await db.prepare(`
        SELECT COALESCE(SUM(available_quantity - reserved_quantity), 0)::int AS available
        FROM inventory_lots
        WHERE sku_id = ?
    `).get(skuId);
    const nextSkuStock = Math.max(0, skuStock?.available || 0);

    await db.prepare(`
        UPDATE product_skus
        SET stock_quantity = ?, in_stock = CASE WHEN ? > 0 THEN 1 ELSE 0 END, updated_at = NOW()
        WHERE id = ?
    `).run(nextSkuStock, nextSkuStock, skuId);

    await recomputeProductStock(db, productId);
    return nextSkuStock;
}

export async function decrementInventoryForOrder(db, orderId) {
    const items = await db.prepare(`
        SELECT oi.product_id, oi.quantity, p.sku_id
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
    `).all(orderId);

    for (const item of items) {
        if (!item.sku_id) continue;
        const lot = await db.prepare(`
            SELECT id, available_quantity, reserved_quantity
            FROM inventory_lots
            WHERE sku_id = ?
            ORDER BY id ASC
            LIMIT 1
        `).get(item.sku_id);
        if (!lot) continue;

        const nextAvailable = Math.max(0, (lot.available_quantity || 0) - item.quantity);
        await db.prepare(`
            UPDATE inventory_lots
            SET available_quantity = ?, updated_at = NOW()
            WHERE id = ?
        `).run(nextAvailable, lot.id);

        await recomputeInventoryAggregates(db, item.sku_id, item.product_id);
    }
}

export async function restockInventoryForOrder(db, orderId) {
    const items = await db.prepare(`
        SELECT oi.product_id, oi.quantity, p.sku_id
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
    `).all(orderId);

    for (const item of items) {
        if (!item.sku_id) continue;
        const lot = await db.prepare(`
            SELECT id, available_quantity
            FROM inventory_lots
            WHERE sku_id = ?
            ORDER BY id ASC
            LIMIT 1
        `).get(item.sku_id);

        if (lot) {
            await db.prepare(`
                UPDATE inventory_lots
                SET available_quantity = ?, updated_at = NOW()
                WHERE id = ?
            `).run((lot.available_quantity || 0) + item.quantity, lot.id);
        } else {
            await db.prepare(`
                INSERT INTO inventory_lots (sku_id, source_type, source_ref, available_quantity, reserved_quantity, unit_cost, note)
                VALUES (?, 'restock', ?, ?, 0, 0, 'Auto-restocked from refunded order')
            `).run(item.sku_id, `order:${orderId}`, item.quantity);
        }

        await recomputeInventoryAggregates(db, item.sku_id, item.product_id);
    }
}
