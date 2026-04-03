import { cleanMultilineText, cleanText } from '@/lib/validation';

export function sanitizeArticleInput(body) {
    const published = body?.published === false || body?.published === 0 || body?.published === '0' ? 0 : 1;
    return {
        slug: cleanText(body?.slug, 140),
        title: cleanText(body?.title, 180),
        excerpt: cleanText(body?.excerpt, 320),
        content: cleanMultilineText(body?.content, 12000),
        coverImage: cleanText(body?.coverImage, 255),
        category: cleanText(body?.category || 'guides', 64),
        gameSlug: cleanText(body?.gameSlug, 64),
        published,
    };
}

export function sanitizeInventoryLotInput(body, { includeProductId = false } = {}) {
    const input = {
        availableQuantity: Math.max(0, Number.parseInt(String(body?.availableQuantity || 0), 10) || 0),
        sourceType: cleanText(body?.sourceType || 'manual', 32) || 'manual',
        sourceRef: cleanText(body?.sourceRef || '', 120),
        note: cleanMultilineText(body?.note, 500),
    };

    if (includeProductId) {
        input.productId = Number.parseInt(String(body?.productId || 0), 10);
    }

    return input;
}

export function validateProductInput(input) {
    if (!input.gameSlug || !input.category || !input.name) {
        return 'gameSlug, category, and name are required';
    }

    if (input.price <= 0) {
        return 'price must be greater than 0';
    }

    return '';
}

export function getProductWriteValues(input) {
    return [
        input.externalId,
        input.catalogSource || 'platform',
        input.sellerUserId || null,
        input.listingStatus || 'published',
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
    ];
}
