import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { sanitizeArticleInput } from '@/lib/admin-inputs';
import { assertTrustedOrigin } from '@/lib/request-security';

export async function PUT(request, { params }) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const { id } = await params;
        const body = await request.json();
        const input = sanitizeArticleInput(body);
        const db = await getDb();

        const existing = await db.prepare('SELECT id FROM content_articles WHERE id = ?').get(id);
        if (!existing) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }

        await db.prepare(`
            UPDATE content_articles
            SET slug = ?, title = ?, excerpt = ?, content = ?, cover_image = ?, category = ?, game_slug = ?, published = ?, updated_at = NOW()
            WHERE id = ?
        `).run(input.slug, input.title, input.excerpt, input.content, input.coverImage, input.category, input.gameSlug, input.published, id);
        const article = await db.prepare('SELECT * FROM content_articles WHERE id = ?').get(id);
        return NextResponse.json({ article });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Update article error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request, { params }) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const { id } = await params;
        const db = await getDb();
        const result = await db.prepare('DELETE FROM content_articles WHERE id = ?').run(id);
        if (!result.changes) {
            return NextResponse.json({ error: 'Article not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Delete article error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
