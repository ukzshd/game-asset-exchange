import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cleanText } from '@/lib/validation';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const game = cleanText(searchParams.get('game') || '', 64);
        const category = cleanText(searchParams.get('category') || '', 64);
        const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get('limit') || '20', 10) || 20));
        const db = await getDb();

        const where = ['published = 1'];
        const params = [];
        if (game) {
            where.push('game_slug = ?');
            params.push(game);
        }
        if (category) {
            where.push('category = ?');
            params.push(category);
        }

        const articles = await db.prepare(`
            SELECT id, slug, title, excerpt, cover_image, category, game_slug, published_at, updated_at
            FROM content_articles
            WHERE ${where.join(' AND ')}
            ORDER BY published_at DESC, created_at DESC
            LIMIT ?
        `).all(...params, limit);

        return NextResponse.json({ articles });
    } catch (error) {
        console.error('Articles list error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
