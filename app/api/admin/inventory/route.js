import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanMultilineText, cleanText } from '@/lib/validation';
import { recomputeInventoryAggregates } from '@/lib/inventory';

function sanitizeLotInput(body) {
    const productId = Number.parseInt(String(body?.productId || 0), 10);
    const availableQuantity = Math.max(0, Number.parseInt(String(body?.availableQuantity || 0), 10) || 0);
    const sourceType = cleanText(body?.sourceType || 'manual', 32) || 'manual';
    const sourceRef = cleanText(body?.sourceRef || '', 120);
    const note = cleanMultilineText(body?.note, 500);

    return {
        productId,
        availableQuantity,
        sourceType,
        sourceRef,
        note,
    };
}

export async function GET(request) {
    try {
        await requireAdmin(request);
        const { searchParams } = new URL(request.url);
        const search = cleanText(searchParams.get('search') || '', 120);
        const gameSlug = cleanText(searchParams.get('game') || '', 64);
        const db = await getDb();

        const where = [];
        const params = [];
        if (gameSlug) {
            where.push('p.game_slug = ?');
            params.push(gameSlug);
        }
        if (search) {
            where.push('(p.name LIKE ? OR p.external_id LIKE ? OR il.source_ref LIKE ? OR il.note LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
        }

        const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const lots = await db.prepare(`
            SELECT
                il.*,
                p.id AS product_id,
                p.name AS product_name,
                p.game_slug,
                p.external_id,
                p.stock_quantity AS product_stock_quantity,
                sku.package_label,
                sku.package_size,
                sku.package_unit
            FROM inventory_lots il
            JOIN product_skus sku ON sku.id = il.sku_id
            JOIN products p ON p.sku_id = sku.id
            ${clause}
            ORDER BY p.game_slug ASC, p.name ASC, il.id ASC
        `).all(...params);

        return NextResponse.json({ lots });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Inventory list error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const input = sanitizeLotInput(await request.json());
        if (!input.productId) {
            return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }

        const db = await getDb();
        const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(input.productId);
        if (!product || !product.sku_id) {
            return NextResponse.json({ error: 'Product or SKU not found' }, { status: 404 });
        }

        const result = await db.prepare(`
            INSERT INTO inventory_lots (sku_id, source_type, source_ref, available_quantity, reserved_quantity, unit_cost, note)
            VALUES (?, ?, ?, ?, 0, 0, ?)
        `).run(product.sku_id, input.sourceType, input.sourceRef, input.availableQuantity, input.note);

        await recomputeInventoryAggregates(db, product.sku_id, product.id);

        const lot = await db.prepare('SELECT * FROM inventory_lots WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json({ lot }, { status: 201 });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Inventory create error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
