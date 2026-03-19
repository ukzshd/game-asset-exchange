import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request) {
    try {
        await requireAdmin(request);
        const { searchParams } = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
        const offset = (page - 1) * limit;

        const db = await getDb();
        const total = (await db.prepare('SELECT COUNT(*)::int as c FROM users').get()).c;
        const users = await db.prepare(`
            SELECT id, email, username, embark_id, phone, role, referral_code, referred_by, is_active, created_at
            FROM users
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `).all(limit, offset);

        const getOrderCount = db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ?');
        const usersWithStats = await Promise.all(users.map(async (user) => ({
            ...user,
            order_count: (await getOrderCount.get(user.id)).c,
        })));

        return NextResponse.json({
            users: usersWithStats,
            total,
            page,
            totalPages: Math.ceil(total / limit),
        });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Admin users error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
