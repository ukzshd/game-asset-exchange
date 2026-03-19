import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanMultilineText, cleanText, toInteger } from '@/lib/validation';

function sanitizeProductInput(body) {
    const price = Number.parseFloat(body?.price || '0') || 0;
    const originalPrice = Number.parseFloat(body?.originalPrice || '0') || 0;
    const discount = Math.max(0, Math.min(99, toInteger(body?.discount || '0', 0)));

    return {
        externalId: cleanText(body?.externalId, 120),
        gameSlug: cleanText(body?.gameSlug, 64),
        category: cleanText(body?.category, 64),
        subCategory: cleanText(body?.subCategory, 64),
        name: cleanText(body?.name, 180),
        description: cleanMultilineText(body?.description, 2000),
        price: Math.max(0, price),
        originalPrice: Math.max(0, originalPrice),
        discount,
        image: cleanText(body?.image, 255),
        inStock: body?.inStock === false || body?.inStock === 0 || body?.inStock === '0' ? 0 : 1,
    };
}

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
            SELECT *
            FROM products
            ${clause}
            ORDER BY game_slug ASC, name ASC
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
        const input = sanitizeProductInput(body);

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
                price, original_price, discount, in_stock, image
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            input.externalId,
            input.gameSlug,
            input.category,
            input.subCategory,
            input.name,
            input.description,
            input.price,
            input.originalPrice || input.price,
            input.discount,
            input.inStock,
            input.image
        );

        const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json({ product }, { status: 201 });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Create product error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
