export const CATALOG_SOURCE = Object.freeze({
    PLATFORM: 'platform',
    MARKETPLACE: 'marketplace',
});

export const LISTING_STATUS = Object.freeze({
    DRAFT: 'draft',
    PENDING_REVIEW: 'pending_review',
    PUBLISHED: 'published',
    REJECTED: 'rejected',
    ARCHIVED: 'archived',
});

export const SELLER_STATUS = Object.freeze({
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    SUSPENDED: 'suspended',
});

export const SETTLEMENT_STATUS = Object.freeze({
    NONE: '',
    PENDING: 'pending',
    AVAILABLE: 'available',
    PAID: 'paid',
    BLOCKED: 'blocked',
    CANCELLED: 'cancelled',
});

export const DISPUTE_STATUS = Object.freeze({
    NONE: '',
    OPEN: 'open',
    RESOLVED: 'resolved',
});

export const MARKETPLACE_PLATFORM_FEE_RATE = 0.10;
export const MARKETPLACE_AUTO_COMPLETE_HOURS = 72;

export function isMarketplaceProduct(product) {
    return product?.catalog_source === CATALOG_SOURCE.MARKETPLACE;
}

export function isPublishedProduct(product) {
    return !isMarketplaceProduct(product) || product?.listing_status === LISTING_STATUS.PUBLISHED;
}

export function getCatalogVisibilityWhereClause(alias = 'p') {
    return `(${alias}.catalog_source = '${CATALOG_SOURCE.PLATFORM}' OR (${alias}.catalog_source = '${CATALOG_SOURCE.MARKETPLACE}' AND ${alias}.listing_status = '${LISTING_STATUS.PUBLISHED}'))`;
}

export function buildSellerSummary(record) {
    if (!record?.seller_user_id) {
        return null;
    }

    return {
        sellerId: record.seller_user_id,
        displayName: record.seller_display_name || record.seller_username || `Seller #${record.seller_user_id}`,
        status: record.seller_status || SELLER_STATUS.APPROVED,
        badge: record.catalog_source === CATALOG_SOURCE.MARKETPLACE ? 'Marketplace Seller' : 'Platform',
    };
}

export function withMarketplacePresentation(record) {
    if (!record) return record;

    return {
        ...record,
        catalogSource: record.catalog_source || CATALOG_SOURCE.PLATFORM,
        sellerSummary: buildSellerSummary(record),
    };
}

export async function getSellerProfileByUserId(db, userId) {
    return db.prepare(`
        SELECT sp.*, u.username, u.email
        FROM seller_profiles sp
        JOIN users u ON u.id = sp.user_id
        WHERE sp.user_id = ?
    `).get(userId);
}

export async function assertApprovedSeller(db, userId) {
    const profile = await getSellerProfileByUserId(db, userId);
    if (!profile || profile.status !== SELLER_STATUS.APPROVED) {
        throw new Response(JSON.stringify({ error: 'Seller approval required' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    return profile;
}
