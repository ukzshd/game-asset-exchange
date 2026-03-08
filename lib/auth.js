import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { getDb } from './db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'iggm-secret-key-change-in-production-2026');
const JWT_EXPIRY = '7d';

/**
 * Hash a password with bcrypt
 */
export async function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export async function generateToken(user) {
    const token = await new SignJWT({
        userId: user.id,
        email: user.email,
        role: user.role || 'user',
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY)
        .sign(JWT_SECRET);
    return token;
}

/**
 * Verify a JWT token and return the payload
 */
export async function verifyToken(token) {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload;
    } catch {
        return null;
    }
}

/**
 * Extract the authenticated user from a request.
 * Reads Authorization: Bearer <token> header.
 * Returns user object or null.
 */
export async function getUser(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token);
    if (!payload) return null;

    const db = getDb();
    const user = db.prepare('SELECT id, email, username, embark_id, phone, role, referral_code, created_at FROM users WHERE id = ?').get(payload.userId);
    return user || null;
}

/**
 * Require authentication — returns user or throws a Response
 */
export async function requireAuth(request) {
    const user = await getUser(request);
    if (!user) {
        throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    return user;
}

/**
 * Require admin role
 */
export async function requireAdmin(request) {
    const user = await requireAuth(request);
    if (user.role !== 'admin') {
        throw new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    return user;
}

/**
 * Generate a unique referral code
 */
export function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Generate a unique order number
 */
export function generateOrderNo() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `ORD-${y}${m}${d}${rand}`;
}
