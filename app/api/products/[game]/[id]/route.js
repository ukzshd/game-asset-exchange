import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(_request, { params }) {
    try {
        const { game, id } = await params;
        const db = getDb();
        const product = db.prepare('SELECT * FROM products WHERE game_slug = ? AND id = ?').get(game, id);

        if (!product) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }

        const related = db.prepare(`
            SELECT * FROM products
            WHERE game_slug = ? AND id != ? AND category = ?
            ORDER BY price ASC
            LIMIT 6
        `).all(game, id, product.category);

        return NextResponse.json({ product, related });
    } catch (error) {
        console.error('Product detail error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
