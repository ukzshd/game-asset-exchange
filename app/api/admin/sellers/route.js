import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request) {
    try {
        await requireAdmin(request);
        const db = await getDb();

        const sellers = await db.prepare(`
            SELECT sp.*, u.username, u.email
            FROM seller_profiles sp
            JOIN users u ON u.id = sp.user_id
            ORDER BY sp.applied_at DESC, sp.id DESC
        `).all();

        return NextResponse.json({ sellers });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Admin sellers error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
