import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET /api/admin/users - All users (admin)
export async function GET(request) {
    try {
        await requireAdmin(request);
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = (page - 1) * limit;

        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;

        const users = db.prepare(`
      SELECT id, email, username, embark_id, phone, role, referral_code, created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

        // Attach order count for each user
        const getOrderCount = db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ?');
        const usersWithStats = users.map(user => ({
            ...user,
            order_count: getOrderCount.get(user.id).c,
        }));

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
