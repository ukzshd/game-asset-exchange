import games from '@/data/games.json';
import { getDb } from '@/lib/db';
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
    const db = await getDb();
    const numericId = Number.parseInt(String(identifier), 10);

    if (Number.isFinite(numericId) && String(numericId) === String(identifier)) {
        const productById = await db.prepare(`
            SELECT * FROM products
            WHERE game_slug = ? AND id = ?
        `).get(gameSlug, numericId);

        if (productById) return productById;
    }

    return db.prepare(`
        SELECT * FROM products
        WHERE game_slug = ? AND external_id = ?
    `).get(gameSlug, String(identifier));
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
