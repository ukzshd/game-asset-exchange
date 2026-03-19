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

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const { id } = await params;
        const body = await request.json();
        const input = sanitizeProductInput(body);

        if (!input.gameSlug || !input.category || !input.name) {
            return NextResponse.json({ error: 'gameSlug, category, and name are required' }, { status: 400 });
        }

        if (input.price <= 0) {
            return NextResponse.json({ error: 'price must be greater than 0' }, { status: 400 });
        }

        const db = await getDb();
        const existing = await db.prepare('SELECT id FROM products WHERE id = ?').get(id);
        if (!existing) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        await db.prepare(`
            UPDATE products
            SET external_id = ?,
                game_slug = ?,
                category = ?,
                sub_category = ?,
                name = ?,
                description = ?,
                price = ?,
                original_price = ?,
                discount = ?,
                in_stock = ?,
                image = ?
            WHERE id = ?
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
            input.image,
            id
        );

        const product = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        return NextResponse.json({ product });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Update product error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const { id } = await params;
        const db = await getDb();
        const inOrders = (await db.prepare('SELECT COUNT(*)::int as c FROM order_items WHERE product_id = ?').get(id)).c;

        if (inOrders > 0) {
            return NextResponse.json({ error: 'Cannot delete a product referenced by orders' }, { status: 400 });
        }

        const result = await db.prepare('DELETE FROM products WHERE id = ?').run(id);
        if (result.changes === 0) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Delete product error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
