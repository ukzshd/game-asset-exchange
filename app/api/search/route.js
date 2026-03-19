import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import games from '@/data/games.json';
import { cleanText, toInteger } from '@/lib/validation';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = cleanText(searchParams.get('q') || '', 120);
        const limit = Math.min(20, Math.max(1, toInteger(searchParams.get('limit') || '10', 10)));

        if (!query) {
            return NextResponse.json({ query: '', products: [], games: [] });
        }

        const db = await getDb();
        const like = `%${query}%`;
        const products = await db.prepare(`
            SELECT id, external_id, game_slug, category, sub_category, name, description, price, in_stock
            FROM products
            WHERE name LIKE ? OR description LIKE ?
            ORDER BY in_stock DESC, price ASC, name ASC
            LIMIT ?
        `).all(like, like, limit);

        const normalized = query.toLowerCase();
        const matchedGames = games
            .filter((game) => game.active && (
                game.name.toLowerCase().includes(normalized) ||
                game.shortName?.toLowerCase().includes(normalized) ||
                game.slug.toLowerCase().includes(normalized)
            ))
            .slice(0, limit)
            .map((game) => ({
                slug: game.slug,
                name: game.name,
                shortName: game.shortName,
                icon: game.icon,
                primaryCategory: game.categories?.[0]?.slug || 'items',
            }));

        return NextResponse.json({
            query,
            products,
            games: matchedGames,
        });
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
