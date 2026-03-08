import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request, { params }) {
    try {
        const { game } = await params;
        const { searchParams } = new URL(request.url);

        const category = searchParams.get('category') || '';
        const subCategory = searchParams.get('subCategory') || '';
        const search = searchParams.get('search') || '';
        const sort = searchParams.get('sort') || 'name_asc';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '40');
        const offset = (page - 1) * limit;

        const db = getDb();

        let where = 'WHERE game_slug = ?';
        const queryParams = [game];

        if (category) {
            where += ' AND sub_category = ?';
            queryParams.push(category);
        }

        if (search) {
            where += ' AND name LIKE ?';
            queryParams.push(`%${search}%`);
        }

        // Sort
        let orderBy = 'ORDER BY name ASC';
        switch (sort) {
            case 'name_asc': orderBy = 'ORDER BY name ASC'; break;
            case 'name_desc': orderBy = 'ORDER BY name DESC'; break;
            case 'price_asc': orderBy = 'ORDER BY price ASC'; break;
            case 'price_desc': orderBy = 'ORDER BY price DESC'; break;
        }

        // Total count
        const countRow = db.prepare(`SELECT COUNT(*) as total FROM products ${where}`).get(...queryParams);

        // Paginated results
        const products = db.prepare(
            `SELECT * FROM products ${where} ${orderBy} LIMIT ? OFFSET ?`
        ).all(...queryParams, limit, offset);

        // Get available sub-categories for this game
        const subCategories = db.prepare(
            'SELECT DISTINCT sub_category FROM products WHERE game_slug = ? AND sub_category != "" ORDER BY sub_category'
        ).all(game).map(r => r.sub_category);

        return NextResponse.json({
            products,
            total: countRow.total,
            page,
            limit,
            totalPages: Math.ceil(countRow.total / limit),
            subCategories,
        });
    } catch (error) {
        console.error('Products error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
