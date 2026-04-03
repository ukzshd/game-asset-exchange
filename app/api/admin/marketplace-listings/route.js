import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request) {
    try {
        await requireAdmin(request);
        const db = await getDb();

        const listings = await db.prepare(`
            SELECT p.*, seller.username AS seller_username, COALESCE(sp.display_name, seller.username) AS seller_display_name,
                   sp.status AS seller_status
            FROM products p
            LEFT JOIN users seller ON seller.id = p.seller_user_id
            LEFT JOIN seller_profiles sp ON sp.user_id = p.seller_user_id
            WHERE p.catalog_source = 'marketplace'
            ORDER BY p.updated_at DESC, p.id DESC
        `).all();

        return NextResponse.json({ listings });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Admin marketplace listings error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
