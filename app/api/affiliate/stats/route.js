import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET - Affiliate stats
export async function GET(request) {
    try {
        const user = await requireAuth(request);
        const db = await getDb();

        const stats = await db.prepare(`
      SELECT
        COUNT(*)::int as total_referrals,
        COALESCE(SUM(commission_amount), 0) as total_earnings,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as pending_earnings,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0) as paid_earnings
      FROM affiliate_commissions
      WHERE referrer_id = ?
    `).get(user.id);

        return NextResponse.json({
            stats: {
                ...stats,
                commission_rate: 0.10,
                referral_code: user.referral_code,
                referral_link: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://iggm.com'}/?ref=${user.referral_code}`,
            },
        });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Affiliate stats error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
