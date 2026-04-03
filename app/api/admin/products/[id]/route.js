import { NextResponse } from 'next/server';
import { getProductWriteValues, validateProductInput } from '@/lib/admin-inputs';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { assertTrustedOrigin } from '@/lib/request-security';
import { normalizeProductInput, syncNormalizedProductModel } from '@/lib/product-model';

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const { id } = await params;
        const body = await request.json();
        const input = normalizeProductInput(body);
        const validationError = validateProductInput(input);

        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        const db = await getDb();
        const existing = await db.prepare('SELECT id FROM products WHERE id = ?').get(id);
        if (!existing) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        const tx = db.transaction(async () => {
            await db.prepare(`
                UPDATE products
                SET external_id = ?,
                    catalog_source = ?,
                    seller_user_id = ?,
                    listing_status = ?,
                    game_slug = ?,
                    category = ?,
                    sub_category = ?,
                    name = ?,
                    description = ?,
                    platform = ?,
                    server_region = ?,
                    rarity = ?,
                    delivery_note = ?,
                    package_label = ?,
                    package_size = ?,
                    package_unit = ?,
                    price = ?,
                    original_price = ?,
                    discount = ?,
                    in_stock = ?,
                    stock_quantity = ?,
                    image = ?
                WHERE id = ?
            `).run(...getProductWriteValues(input), id);

            await syncNormalizedProductModel(db, id, input);
        });
        await tx();

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
        const product = await db.prepare('SELECT id, spu_id, sku_id FROM products WHERE id = ?').get(id);
        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }
        const inOrders = (await db.prepare('SELECT COUNT(*)::int as c FROM order_items WHERE product_id = ?').get(id)).c;

        if (inOrders > 0) {
            return NextResponse.json({ error: 'Cannot delete a product referenced by orders' }, { status: 400 });
        }

        const tx = db.transaction(async () => {
            await db.prepare('DELETE FROM products WHERE id = ?').run(id);
            if (product.sku_id) {
                await db.prepare('DELETE FROM product_skus WHERE id = ?').run(product.sku_id);
            }
            if (product.spu_id) {
                const skuCount = (await db.prepare('SELECT COUNT(*)::int as c FROM product_skus WHERE spu_id = ?').get(product.spu_id)).c;
                if (skuCount === 0) {
                    await db.prepare('DELETE FROM product_spus WHERE id = ?').run(product.spu_id);
                }
            }
        });
        await tx();

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Delete product error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
