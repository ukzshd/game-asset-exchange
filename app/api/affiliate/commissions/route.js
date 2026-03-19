import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET - Commission history
export async function GET(request) {
    try {
        const user = await requireAuth(request);
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        const db = await getDb();

        const total = (await db.prepare('SELECT COUNT(*)::int as c FROM affiliate_commissions WHERE referrer_id = ?').get(user.id)).c;

        const commissions = await db.prepare(`
      SELECT ac.*, o.order_no
      FROM affiliate_commissions ac
      LEFT JOIN orders o ON ac.order_id = o.id
      WHERE ac.referrer_id = ?
      ORDER BY ac.created_at DESC
      LIMIT ? OFFSET ?
    `).all(user.id, limit, offset);

        return NextResponse.json({
            commissions,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Commission history error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
