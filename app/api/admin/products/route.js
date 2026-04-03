import { NextResponse } from 'next/server';
import { getProductWriteValues, validateProductInput } from '@/lib/admin-inputs';
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
            where.push('p.game_slug = ?');
            params.push(gameSlug);
        }

        if (search) {
            where.push('(p.name LIKE ? OR p.description LIKE ? OR p.external_id LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const products = await db.prepare(`
            SELECT p.*, spu.delivery_note, sku.package_label, sku.package_size, sku.package_unit, sku.stock_quantity
            FROM products p
            LEFT JOIN product_spus spu ON spu.id = p.spu_id
            LEFT JOIN product_skus sku ON sku.id = p.sku_id
            ${clause}
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
        const validationError = validateProductInput(input);

        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        const db = await getDb();
        const tx = db.transaction(async () => {
            const result = await db.prepare(`
                INSERT INTO products (
                    external_id, catalog_source, seller_user_id, listing_status, game_slug, category, sub_category, name, description,
                    platform, server_region, rarity, delivery_note, package_label, package_size, package_unit,
                    price, original_price, discount, in_stock, stock_quantity, image
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(...getProductWriteValues(input));

            await syncNormalizedProductModel(db, result.lastInsertRowid, input);
            return result.lastInsertRowid;
        });
        const productId = await tx();
        const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
        return NextResponse.json({ product }, { status: 201 });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Create product error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
