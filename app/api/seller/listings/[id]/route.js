import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateProductInput } from '@/lib/admin-inputs';
import { assertApprovedSeller, CATALOG_SOURCE, LISTING_STATUS } from '@/lib/marketplace';
import { normalizeProductInput, syncNormalizedProductModel } from '@/lib/product-model';
import { assertTrustedOrigin } from '@/lib/request-security';

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        const user = await requireAuth(request);
        const { id } = await params;
        const db = await getDb();
        await assertApprovedSeller(db, user.id);

        const existing = await db.prepare(`
            SELECT *
            FROM products
            WHERE id = ? AND catalog_source = 'marketplace' AND seller_user_id = ?
        `).get(id, user.id);
        if (!existing) {
            return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
        }

        const body = await request.json();
        const requestedStatus = String(body?.listingStatus || '').trim();
        const nextListingStatus = requestedStatus === LISTING_STATUS.DRAFT
            ? LISTING_STATUS.DRAFT
            : requestedStatus === LISTING_STATUS.ARCHIVED
                ? LISTING_STATUS.ARCHIVED
                : LISTING_STATUS.PENDING_REVIEW;

        const input = {
            ...normalizeProductInput(body),
            catalogSource: CATALOG_SOURCE.MARKETPLACE,
            sellerUserId: user.id,
            listingStatus: nextListingStatus,
        };
        const validationError = validateProductInput(input);
        if (validationError) {
            return NextResponse.json({ error: validationError }, { status: 400 });
        }

        const tx = db.transaction(async () => {
            await db.prepare(`
                UPDATE products
                SET external_id = ?, catalog_source = ?, seller_user_id = ?, listing_status = ?,
                    game_slug = ?, category = ?, sub_category = ?, name = ?, description = ?,
                    platform = ?, server_region = ?, rarity = ?, delivery_note = ?,
                    package_label = ?, package_size = ?, package_unit = ?,
                    price = ?, original_price = ?, discount = ?, in_stock = ?, stock_quantity = ?, image = ?,
                    updated_at = NOW()
                WHERE id = ?
            `).run(
                input.externalId,
                input.catalogSource,
                input.sellerUserId,
                input.listingStatus,
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
                input.image,
                id
            );

            await syncNormalizedProductModel(db, id, input);
        });
        await tx();

        const listing = await db.prepare('SELECT * FROM products WHERE id = ?').get(id);
        return NextResponse.json({ listing });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Update seller listing error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
