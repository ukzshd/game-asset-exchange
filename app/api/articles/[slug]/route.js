import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_request, { params }) {
    try {
        const { slug } = await params;
        const db = await getDb();
        const article = await db.prepare(`
            SELECT *
            FROM content_articles
            WHERE slug = ? AND published = 1
        `).get(slug);

        if (!article) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }

        const related = await db.prepare(`
            SELECT id, slug, title, excerpt, category, game_slug, published_at
            FROM content_articles
            WHERE published = 1 AND id != ? AND (game_slug = ? OR category = ?)
            ORDER BY published_at DESC
            LIMIT 4
        `).all(article.id, article.game_slug || '', article.category || '');

        return NextResponse.json({ article, related });
    } catch (error) {
        console.error('Article detail error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
