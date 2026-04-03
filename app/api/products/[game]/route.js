import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getCatalogVisibilityWhereClause, withMarketplacePresentation } from '@/lib/marketplace';
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
        const platform = cleanText(searchParams.get('platform') || '', 64);
        const serverRegion = cleanText(searchParams.get('serverRegion') || '', 64);
        const rarity = cleanText(searchParams.get('rarity') || '', 64);
        const stock = cleanText(searchParams.get('stock') || '', 24);
        const hasMaxPrice = maxPriceRaw > 0;
        const offset = (page - 1) * limit;

        const db = await getDb();

        let where = `WHERE p.game_slug = ? AND ${getCatalogVisibilityWhereClause('p')}`;
        const queryParams = [game];

        if (category) {
            where += ' AND p.category = ?';
            queryParams.push(category);
        }

        if (subCategory) {
            where += ' AND p.sub_category = ?';
            queryParams.push(subCategory);
        }

        if (search) {
            where += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.package_label LIKE ?)';
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (minPrice > 0) {
            where += ' AND p.price >= ?';
            queryParams.push(minPrice);
        }

        if (hasMaxPrice) {
            where += ' AND p.price <= ?';
            queryParams.push(maxPriceRaw);
        }

        if (platform) {
            where += ' AND p.platform = ?';
            queryParams.push(platform);
        }

        if (serverRegion) {
            where += ' AND p.server_region = ?';
            queryParams.push(serverRegion);
        }

        if (rarity) {
            where += ' AND p.rarity = ?';
            queryParams.push(rarity);
        }

        if (stock === 'in_stock') {
            where += ' AND p.in_stock = 1';
        } else if (stock === 'out_of_stock') {
            where += ' AND p.in_stock = 0';
        }

        let orderBy = 'ORDER BY p.name ASC';
        switch (sort) {
            case 'name_desc':
                orderBy = 'ORDER BY p.name DESC';
                break;
            case 'price_asc':
                orderBy = 'ORDER BY p.price ASC';
                break;
            case 'price_desc':
                orderBy = 'ORDER BY p.price DESC';
                break;
            case 'created_desc':
                orderBy = 'ORDER BY p.created_at DESC';
                break;
            default:
                orderBy = 'ORDER BY p.name ASC';
                break;
        }

        const countRow = await db.prepare(`SELECT COUNT(*)::int as total FROM products p ${where}`).get(...queryParams);
        const products = await db.prepare(`
            SELECT p.*, seller.username AS seller_username, COALESCE(sp.display_name, seller.username) AS seller_display_name, sp.status AS seller_status
            FROM products p
            LEFT JOIN users seller ON seller.id = p.seller_user_id
            LEFT JOIN seller_profiles sp ON sp.user_id = p.seller_user_id
            ${where}
            ${orderBy}
            LIMIT ? OFFSET ?
        `).all(...queryParams, limit, offset);
        const categories = (await db.prepare('SELECT DISTINCT category FROM products WHERE game_slug = ? ORDER BY category').all(game)).map((row) => row.category);
        const subCategories = (await db.prepare("SELECT DISTINCT sub_category FROM products WHERE game_slug = ? AND sub_category != '' ORDER BY sub_category").all(game)).map((row) => row.sub_category);
        const platforms = (await db.prepare("SELECT DISTINCT platform FROM products WHERE game_slug = ? AND platform != '' ORDER BY platform").all(game)).map((row) => row.platform);
        const serverRegions = (await db.prepare("SELECT DISTINCT server_region FROM products WHERE game_slug = ? AND server_region != '' ORDER BY server_region").all(game)).map((row) => row.server_region);
        const rarities = (await db.prepare("SELECT DISTINCT rarity FROM products WHERE game_slug = ? AND rarity != '' ORDER BY rarity").all(game)).map((row) => row.rarity);

        return NextResponse.json({
            products: (products || []).map(withMarketplacePresentation),
            total: countRow.total,
            page,
            limit,
            totalPages: Math.ceil(countRow.total / limit),
            categories,
            subCategories,
            platforms,
            serverRegions,
            rarities,
        });
    } catch (error) {
        console.error('Products error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
