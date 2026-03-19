import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireStaff } from '@/lib/auth';

export async function GET(request) {
    try {
        await requireStaff(request);
        const db = await getDb();
        const events = await db.prepare(`
            SELECT r.*, u.username, o.order_no
            FROM risk_events r
            LEFT JOIN users u ON u.id = r.user_id
            LEFT JOIN orders o ON o.id = r.order_id
            ORDER BY r.created_at DESC
            LIMIT 100
        `).all();
        return NextResponse.json({ events });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Risk events error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
