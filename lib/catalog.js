import games from '@/data/games.json';
import { getDb } from '@/lib/db';
import { getCatalogProductDetail } from '@/lib/product-model';
export { getProductIcon, getProductPath } from '@/lib/catalog-shared';

export function getGameBySlug(gameSlug) {
    return games.find((game) => game.slug === gameSlug) || null;
}

export function getGameCategory(gameSlug, categorySlug) {
    const game = getGameBySlug(gameSlug);
    if (!game) return null;
    return game.categories?.find((category) => category.slug === categorySlug) || game.categories?.[0] || null;
}

export async function getProductByGameAndIdentifier(gameSlug, identifier) {
    return getCatalogProductDetail(gameSlug, identifier);
}

export async function getRelatedProducts(gameSlug, productId, category, limit = 6) {
    const db = await getDb();
    return db.prepare(`
        SELECT * FROM products
        WHERE game_slug = ? AND id != ? AND category = ?
        ORDER BY in_stock DESC, price ASC, name ASC
        LIMIT ?
    `).all(gameSlug, productId, category, limit);
}
