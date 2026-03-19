import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanMultilineText, cleanText } from '@/lib/validation';

function sanitizeArticleInput(body) {
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

export async function GET(request) {
    try {
        await requireAdmin(request);
        const db = await getDb();
        const articles = await db.prepare(`
            SELECT *
            FROM content_articles
            ORDER BY published_at DESC, created_at DESC
        `).all();
        return NextResponse.json({ articles });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Admin articles error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const body = await request.json();
        const input = sanitizeArticleInput(body);

        if (!input.slug || !input.title || !input.content) {
            return NextResponse.json({ error: 'slug, title, and content are required' }, { status: 400 });
        }

        const db = await getDb();
        const result = await db.prepare(`
            INSERT INTO content_articles (slug, title, excerpt, content, cover_image, category, game_slug, published, published_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
        `).run(input.slug, input.title, input.excerpt, input.content, input.coverImage, input.category, input.gameSlug, input.published);
        const article = await db.prepare('SELECT * FROM content_articles WHERE id = ?').get(result.lastInsertRowid);
        return NextResponse.json({ article }, { status: 201 });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Create article error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
