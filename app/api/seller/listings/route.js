import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getProductWriteValues, validateProductInput } from '@/lib/admin-inputs';
import { assertApprovedSeller, CATALOG_SOURCE, LISTING_STATUS } from '@/lib/marketplace';
import { normalizeProductInput, syncNormalizedProductModel } from '@/lib/product-model';
import { assertTrustedOrigin } from '@/lib/request-security';

export async function GET(request) {
    try {
        const user = await requireAuth(request);
        const db = await getDb();

        const listings = await db.prepare(`
            SELECT p.*, seller.username AS seller_username, COALESCE(sp.display_name, seller.username) AS seller_display_name
            FROM products p
            LEFT JOIN users seller ON seller.id = p.seller_user_id
            LEFT JOIN seller_profiles sp ON sp.user_id = p.seller_user_id
            WHERE p.catalog_source = 'marketplace' AND p.seller_user_id = ?
            ORDER BY p.created_at DESC, p.id DESC
        `).all(user.id);

        return NextResponse.json({ listings });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Seller listings error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        const user = await requireAuth(request);
        const db = await getDb();
        await assertApprovedSeller(db, user.id);

        const body = await request.json();
        const input = {
            ...normalizeProductInput(body),
            catalogSource: CATALOG_SOURCE.MARKETPLACE,
            sellerUserId: user.id,
            listingStatus: body?.listingStatus === LISTING_STATUS.DRAFT ? LISTING_STATUS.DRAFT : LISTING_STATUS.PENDING_REVIEW,
        };
        const validationError = validateProductInput(input);
        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

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

        const listingId = await tx();
        const listing = await db.prepare('SELECT * FROM products WHERE id = ?').get(listingId);
        return NextResponse.json({ listing }, { status: 201 });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Create seller listing error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
