import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanText } from '@/lib/validation';
import { normalizeProductInput, syncNormalizedProductModel } from '@/lib/product-model';

export async function GET(request) {
    try {
        await requireAdmin(request);
        const { searchParams } = new URL(request.url);
        const search = cleanText(searchParams.get('search') || '', 120);
        const gameSlug = cleanText(searchParams.get('game') || '', 64);

        const db = await getDb();
        const params = [];
        const where = [];

        if (gameSlug) {
            where.push('game_slug = ?');
            params.push(gameSlug);
        }

        if (search) {
            where.push('(name LIKE ? OR description LIKE ? OR external_id LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const products = await db.prepare(`
            SELECT p.*, spu.delivery_note, sku.package_label, sku.package_size, sku.package_unit, sku.stock_quantity
            FROM products p
            LEFT JOIN product_spus spu ON spu.id = p.spu_id
            LEFT JOIN product_skus sku ON sku.id = p.sku_id
            ${clause.replaceAll('game_slug', 'p.game_slug').replaceAll('name', 'p.name').replaceAll('description', 'p.description').replaceAll('external_id', 'p.external_id')}
            ORDER BY p.game_slug ASC, p.name ASC
        `).all(...params);

        return NextResponse.json({ products });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Admin products error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const body = await request.json();
        const input = normalizeProductInput(body);

        if (!input.gameSlug || !input.category || !input.name) {
            return NextResponse.json({ error: 'gameSlug, category, and name are required' }, { status: 400 });
        }

        if (input.price <= 0) {
            return NextResponse.json({ error: 'price must be greater than 0' }, { status: 400 });
        }

        const db = await getDb();
        const result = await db.prepare(`
            INSERT INTO products (
                external_id, game_slug, category, sub_category, name, description,
                platform, server_region, rarity, delivery_note, package_label, package_size, package_unit,
                price, original_price, discount, in_stock, stock_quantity, image
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            input.externalId,
            input.gameSlug,
            input.category,
            input.subCategory,
            input.name,
            input.description,
            input.platform,
            input.serverRegion,
            input.rarity,
            input.deliveryNote,
            input.packageLabel || input.name,
            input.packageSize,
            input.packageUnit,
            input.price,
            input.originalPrice || input.price,
            input.discount,
            input.inStock ? 1 : 0,
            input.stockQuantity,
            input.image
        );

        await syncNormalizedProductModel(db, result.lastInsertRowid, input);

        const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json({ product }, { status: 201 });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Create product error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
