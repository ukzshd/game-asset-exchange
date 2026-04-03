import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import games from '@/data/games.json';
import { getCatalogVisibilityWhereClause } from '@/lib/marketplace';
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
            SELECT p.id, p.external_id, p.game_slug, p.category, p.sub_category, p.name, p.description, p.price, p.in_stock,
                   p.catalog_source, p.seller_user_id, COALESCE(sp.display_name, seller.username) AS seller_display_name
            FROM products p
            LEFT JOIN users seller ON seller.id = p.seller_user_id
            LEFT JOIN seller_profiles sp ON sp.user_id = p.seller_user_id
            WHERE ${getCatalogVisibilityWhereClause('p')} AND (p.name LIKE ? OR p.description LIKE ?)
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
