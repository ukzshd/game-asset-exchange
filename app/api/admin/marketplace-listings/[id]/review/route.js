import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanMultilineText, cleanText } from '@/lib/validation';

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const { id } = await params;
        const body = await request.json();
        const listingStatus = cleanText(body?.listingStatus || '', 32);
        const reviewNote = cleanMultilineText(body?.reviewNote, 500);

        const db = await getDb();
        const product = await db.prepare(`
            SELECT *
            FROM products
            WHERE id = ? AND catalog_source = 'marketplace'
        `).get(id);
        if (!product) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
        }

        await db.prepare(`
            UPDATE products
            SET listing_status = ?, updated_at = NOW()
            WHERE id = ?
        `).run(listingStatus, id);
        if (product.spu_id) {
            await db.prepare('UPDATE product_spus SET listing_status = ?, updated_at = NOW() WHERE id = ?').run(listingStatus, product.spu_id);
        }
        if (product.sku_id) {
            await db.prepare('UPDATE product_skus SET listing_status = ?, updated_at = NOW() WHERE id = ?').run(listingStatus, product.sku_id);
        }

        if (reviewNote) {
            await db.prepare(`
                UPDATE seller_profiles
                SET review_note = ?, updated_at = NOW()
                WHERE user_id = ?
            `).run(reviewNote, product.seller_user_id);
        }

        const updated = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        return NextResponse.json({ listing: updated });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Review marketplace listing error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
