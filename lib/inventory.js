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
    const existingAllocations = (await db.prepare('SELECT COUNT(*)::int AS c FROM order_inventory_allocations WHERE order_id = ?').get(orderId)).c;
    if (existingAllocations > 0) {
        return;
    }

    const items = await db.prepare(`
        SELECT oi.id AS order_item_id, oi.product_id, oi.quantity, p.sku_id
        FROM order_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ?
    `).all(orderId);

    const touched = new Map();

    for (const item of items) {
        if (!item.sku_id) continue;

        let remaining = item.quantity;
        const lots = await db.prepare(`
            SELECT id, available_quantity, reserved_quantity
            FROM inventory_lots
            WHERE sku_id = ?
              AND (available_quantity - reserved_quantity) > 0
            ORDER BY id ASC
        `).all(item.sku_id);

        const totalAvailable = lots.reduce((sum, lot) => sum + Math.max(0, (lot.available_quantity || 0) - (lot.reserved_quantity || 0)), 0);
        if (totalAvailable < item.quantity) {
            throw new Error(`Insufficient inventory lots for product ${item.product_id}`);
        }

        for (const lot of lots) {
            if (remaining <= 0) break;
            const available = Math.max(0, (lot.available_quantity || 0) - (lot.reserved_quantity || 0));
            if (available <= 0) continue;

            const allocated = Math.min(available, remaining);
            await db.prepare(`
                UPDATE inventory_lots
                SET available_quantity = ?, updated_at = NOW()
                WHERE id = ?
            `).run((lot.available_quantity || 0) - allocated, lot.id);

            await db.prepare(`
                INSERT INTO order_inventory_allocations (order_id, order_item_id, product_id, sku_id, lot_id, quantity)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(orderId, item.order_item_id, item.product_id, item.sku_id, lot.id, allocated);

            remaining -= allocated;
        }

        touched.set(`${item.sku_id}:${item.product_id}`, { skuId: item.sku_id, productId: item.product_id });
    }

    for (const { skuId, productId } of touched.values()) {
        await recomputeInventoryAggregates(db, skuId, productId);
    }
}

export async function restockInventoryForOrder(db, orderId) {
    const allocations = await db.prepare(`
        SELECT *
        FROM order_inventory_allocations
        WHERE order_id = ?
    `).all(orderId);

    const touched = new Map();

    if (allocations.length > 0) {
        for (const allocation of allocations) {
            const lot = await db.prepare(`
                SELECT id, available_quantity
                FROM inventory_lots
                WHERE id = ?
            `).get(allocation.lot_id);

            if (lot) {
                await db.prepare(`
                    UPDATE inventory_lots
                    SET available_quantity = ?, updated_at = NOW()
                    WHERE id = ?
                `).run((lot.available_quantity || 0) + allocation.quantity, lot.id);
            } else {
                await db.prepare(`
                    INSERT INTO inventory_lots (sku_id, source_type, source_ref, available_quantity, reserved_quantity, unit_cost, note)
                    VALUES (?, 'restock', ?, ?, 0, 0, 'Auto-restocked from refunded order')
                `).run(allocation.sku_id, `order:${orderId}`, allocation.quantity);
            }

            touched.set(`${allocation.sku_id}:${allocation.product_id}`, {
                skuId: allocation.sku_id,
                productId: allocation.product_id,
            });
        }

        await db.prepare('DELETE FROM order_inventory_allocations WHERE order_id = ?').run(orderId);
    } else {
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

            touched.set(`${item.sku_id}:${item.product_id}`, { skuId: item.sku_id, productId: item.product_id });
        }
    }

    for (const { skuId, productId } of touched.values()) {
        await recomputeInventoryAggregates(db, skuId, productId);
    }
}
