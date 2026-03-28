import crypto from 'crypto';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { getDb } from './db';
import { getJwtSecret } from './env';
import { isStaffRole } from './orders';

const JWT_EXPIRY = '7d';

function getJwtKey() {
    return new TextEncoder().encode(getJwtSecret());
}

function getPasswordHashRounds() {
    const configured = Number.parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
    return Number.isFinite(configured) && configured >= 4 ? configured : 12;
}

export async function hashPassword(password) {
    return bcrypt.hash(password, getPasswordHashRounds());
}

export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

export async function generateToken(user) {
    return new SignJWT({
        userId: user.id,
        email: user.email,
        role: user.role || 'user',
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(JWT_EXPIRY)
        .sign(getJwtKey());
}

export async function verifyToken(token) {
    try {
        const { payload } = await jwtVerify(token, getJwtKey());
        return payload;
    } catch {
        return null;
    }
}

async function getPublicUserById(id) {
    const db = await getDb();
    return db.prepare(`
        SELECT id, email, username, avatar_url, google_id, discord_id, steam_id, embark_id, phone, role, referral_code, referred_by, is_active, created_at
        FROM users
        WHERE id = ?
    `).get(id);
}

export async function getUser(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token);
    if (!payload) return null;

    const user = await getPublicUserById(payload.userId);
    if (!user || user.is_active === 0) return null;
    return user;
}

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

export async function requireStaff(request) {
    const user = await requireAuth(request);
    if (!isStaffRole(user.role)) {
        throw new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        });
    }
    return user;
}

export function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i += 1) {
        code += chars.charAt(crypto.randomInt(0, chars.length));
    }
    return code;
}

export function generateOrderNo() {
    const date = new Date();
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    return `ORD-${y}${m}${d}${suffix}`;
}
