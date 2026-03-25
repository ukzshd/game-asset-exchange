import { getDb } from '@/lib/db';
import { generateVerificationCode, hashOpaqueToken, sendEmail } from '@/lib/email';
import { normalizeEmail } from '@/lib/validation';

const CODE_TTL_MINUTES = 10;
const PURPOSES = new Set(['login', 'register']);

function assertPurpose(purpose) {
    if (!PURPOSES.has(purpose)) {
        throw new Error(`Unsupported verification purpose: ${purpose}`);
    }
}

export async function issueEmailVerificationCode({ email, purpose }) {
    const normalizedEmail = normalizeEmail(email);
    assertPurpose(purpose);
    const db = await getDb();

    const recent = await db.prepare(`
        SELECT id, created_at
        FROM email_verification_codes
        WHERE email = ? AND purpose = ?
        ORDER BY created_at DESC
        LIMIT 1
    `).get(normalizedEmail, purpose);

    if (recent) {
        const elapsed = Date.now() - new Date(recent.created_at).getTime();
        if (elapsed < 60_000) {
            throw new Error('Please wait before requesting another verification code');
        }
    }

    const code = generateVerificationCode();
    await db.prepare(`
        INSERT INTO email_verification_codes (email, purpose, code_hash, expires_at)
        VALUES (?, ?, ?, NOW() + INTERVAL '${CODE_TTL_MINUTES} minutes')
    `).run(normalizedEmail, purpose, hashOpaqueToken(code));

    await sendEmail({
        to: normalizedEmail,
        subject: `Your ${purpose} verification code`,
        text: `Your verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.`,
    });

    return { success: true };
}

export async function verifyEmailCode({ email, purpose, code }) {
    const normalizedEmail = normalizeEmail(email);
    assertPurpose(purpose);
    const db = await getDb();

    const record = await db.prepare(`
        SELECT id
        FROM email_verification_codes
        WHERE email = ?
          AND purpose = ?
          AND code_hash = ?
          AND used_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
    `).get(normalizedEmail, purpose, hashOpaqueToken(code));

    if (!record) {
        return false;
    }

    await db.prepare('UPDATE email_verification_codes SET used_at = NOW() WHERE id = ?').run(record.id);
    return true;
}
