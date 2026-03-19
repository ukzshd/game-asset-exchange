import games from '@/data/games.json';
import { getAppUrl } from '@/lib/env';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function sitemap() {
    const baseUrl = getAppUrl();
    const now = new Date();

    const staticRoutes = [
        '',
        '/affiliate',
    ].map((path) => ({
        url: `${baseUrl}${path}`,
        lastModified: now,
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1 : 0.6,
    }));

    const catalogRoutes = games
        .filter((game) => game.active)
        .flatMap((game) => (game.categories || []).map((category) => ({
            url: `${baseUrl}/${game.slug}/${category.slug}`,
            lastModified: now,
            changeFrequency: 'daily',
            priority: game.slug === 'arc-raiders' ? 0.9 : 0.7,
        })));

    const db = await getDb();
    const productRoutes = await db.prepare(`
        SELECT *
        FROM products
        ORDER BY game_slug ASC, id ASC
    `).all().map((product) => ({
        url: `${baseUrl}/${product.game_slug}/product/${product.external_id || product.id}`,
        lastModified: product.updated_at || now,
        changeFrequency: 'daily',
        priority: 0.8,
    }));

    return [...staticRoutes, ...catalogRoutes, ...productRoutes];
}
