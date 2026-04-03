import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { SELLER_STATUS } from '@/lib/marketplace';
import { assertTrustedOrigin } from '@/lib/request-security';
import { cleanMultilineText, cleanText, normalizeEmail } from '@/lib/validation';

function sanitizeApplication(body, user) {
    return {
        displayName: cleanText(body?.displayName || user.username, 120),
        contactEmail: normalizeEmail(body?.contactEmail || user.email),
        contactHandle: cleanText(body?.contactHandle || '', 120),
        payoutMethod: cleanText(body?.payoutMethod || 'manual', 64),
        payoutDetails: cleanMultilineText(body?.payoutDetails || '', 1000),
        bio: cleanMultilineText(body?.bio || '', 1200),
        note: cleanMultilineText(body?.note || '', 500),
    };
}

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        const user = await requireAuth(request);
        const payload = sanitizeApplication(await request.json(), user);
        const db = await getDb();

        const tx = db.transaction(async () => {
            const existing = await db.prepare('SELECT * FROM seller_profiles WHERE user_id = ?').get(user.id);
            const nextStatus = existing?.status === SELLER_STATUS.APPROVED
                ? SELLER_STATUS.APPROVED
                : SELLER_STATUS.PENDING;

            if (existing) {
                await db.prepare(`
                    UPDATE seller_profiles
                    SET status = ?, display_name = ?, contact_email = ?, contact_handle = ?,
                        payout_method = ?, payout_details = ?, bio = ?, applied_at = NOW(), updated_at = NOW(),
                        review_note = CASE WHEN ? = ? THEN review_note ELSE '' END,
                        reviewed_at = CASE WHEN ? = ? THEN reviewed_at ELSE NULL END,
                        reviewed_by = CASE WHEN ? = ? THEN reviewed_by ELSE NULL END
                    WHERE user_id = ?
                `).run(
                    nextStatus,
                    payload.displayName,
                    payload.contactEmail,
                    payload.contactHandle,
                    payload.payoutMethod,
                    payload.payoutDetails,
                    payload.bio,
                    nextStatus,
                    SELLER_STATUS.APPROVED,
                    nextStatus,
                    SELLER_STATUS.APPROVED,
                    nextStatus,
                    SELLER_STATUS.APPROVED,
                    user.id
                );
            } else {
                await db.prepare(`
                    INSERT INTO seller_profiles (
                        user_id, status, display_name, contact_email, contact_handle, payout_method, payout_details, bio,
                        applied_at, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())
                `).run(
                    user.id,
                    SELLER_STATUS.PENDING,
                    payload.displayName,
                    payload.contactEmail,
                    payload.contactHandle,
                    payload.payoutMethod,
                    payload.payoutDetails,
                    payload.bio
                );
            }

            await db.prepare(`
                INSERT INTO seller_applications (
                    user_id, status, display_name, contact_email, contact_handle, payout_method, payout_details, bio, note, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            `).run(
                user.id,
                SELLER_STATUS.PENDING,
                payload.displayName,
                payload.contactEmail,
                payload.contactHandle,
                payload.payoutMethod,
                payload.payoutDetails,
                payload.bio,
                payload.note
            );
        });
        await tx();

        const profile = await db.prepare('SELECT * FROM seller_profiles WHERE user_id = ?').get(user.id);
        return NextResponse.json({ profile }, { status: 201 });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Seller application error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
