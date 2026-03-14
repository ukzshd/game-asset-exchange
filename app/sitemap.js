import games from '@/data/games.json';
import { getAppUrl } from '@/lib/env';

export default function sitemap() {
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

    return [...staticRoutes, ...catalogRoutes];
}
