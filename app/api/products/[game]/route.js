import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { cleanText, toInteger } from '@/lib/validation';

export async function GET(request, { params }) {
    try {
        const { game } = await params;
        const { searchParams } = new URL(request.url);

        const category = cleanText(searchParams.get('category') || '', 64);
        const subCategory = cleanText(searchParams.get('subCategory') || '', 64);
        const search = cleanText(searchParams.get('search') || '', 120);
        const sort = cleanText(searchParams.get('sort') || 'name_asc', 32);
        const page = Math.max(1, toInteger(searchParams.get('page') || '1', 1));
        const limit = Math.min(100, Math.max(1, toInteger(searchParams.get('limit') || '40', 40)));
        const minPrice = Math.max(0, Number.parseFloat(searchParams.get('minPrice') || '0') || 0);
        const maxPriceRaw = Number.parseFloat(searchParams.get('maxPrice') || '0') || 0;
        const hasMaxPrice = maxPriceRaw > 0;
        const offset = (page - 1) * limit;

        const db = getDb();

        let where = 'WHERE game_slug = ?';
        const queryParams = [game];

        if (category) {
            where += ' AND category = ?';
            queryParams.push(category);
        }

        if (subCategory) {
            where += ' AND sub_category = ?';
            queryParams.push(subCategory);
        }

        if (search) {
            where += ' AND (name LIKE ? OR description LIKE ?)';
            queryParams.push(`%${search}%`, `%${search}%`);
        }

        if (minPrice > 0) {
            where += ' AND price >= ?';
            queryParams.push(minPrice);
        }

        if (hasMaxPrice) {
            where += ' AND price <= ?';
            queryParams.push(maxPriceRaw);
        }

        let orderBy = 'ORDER BY name ASC';
        switch (sort) {
            case 'name_desc':
                orderBy = 'ORDER BY name DESC';
                break;
            case 'price_asc':
                orderBy = 'ORDER BY price ASC';
                break;
            case 'price_desc':
                orderBy = 'ORDER BY price DESC';
                break;
            case 'created_desc':
                orderBy = 'ORDER BY created_at DESC';
                break;
            default:
                orderBy = 'ORDER BY name ASC';
                break;
        }

        const countRow = db.prepare(`SELECT COUNT(*) as total FROM products ${where}`).get(...queryParams);
        const products = db.prepare(`SELECT * FROM products ${where} ${orderBy} LIMIT ? OFFSET ?`).all(...queryParams, limit, offset);
        const categories = db.prepare('SELECT DISTINCT category FROM products WHERE game_slug = ? ORDER BY category').all(game).map((row) => row.category);
        const subCategories = db.prepare('SELECT DISTINCT sub_category FROM products WHERE game_slug = ? AND sub_category != "" ORDER BY sub_category').all(game).map((row) => row.sub_category);

        return NextResponse.json({
            products,
            total: countRow.total,
            page,
            limit,
            totalPages: Math.ceil(countRow.total / limit),
            categories,
            subCategories,
        });
    } catch (error) {
        console.error('Products error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
