import { NextResponse } from 'next/server';
import { assertRateLimit } from '@/lib/rate-limit';
import { assertTrustedOrigin } from '@/lib/request-security';
import { issueEmailVerificationCode } from '@/lib/email-verification';
import { isValidEmail, normalizeEmail } from '@/lib/validation';

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        assertRateLimit(request, 'auth-verification-code', { limit: 10, windowMs: 15 * 60 * 1000 });

        const body = await request.json();
        const email = normalizeEmail(body?.email || '');
        const purpose = String(body?.purpose || 'login').toLowerCase();

        if (!email || !isValidEmail(email)) {
            return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
        }

        await issueEmailVerificationCode({ email, purpose });
        return NextResponse.json({ success: true, message: 'Verification code sent.' });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Verification code error:', error);
        return NextResponse.json({ error: error.message || 'Failed to send verification code' }, { status: 400 });
    }
}
