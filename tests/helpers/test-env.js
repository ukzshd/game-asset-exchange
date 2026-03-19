export async function setupIsolatedDb() {
    process.env.DATABASE_URL = 'pg-mem';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    await resetDbModule();
    return { databaseUrl: 'pg-mem' };
}

export async function resetDbModule() {
    const dbModule = await import('@/lib/db');
    await dbModule.closeDb();
}

export async function cleanupIsolatedDb() {
    await resetDbModule();
    delete process.env.DATABASE_URL;
}

export async function createUser({
    email = 'user@example.com',
    username = 'user',
    password = 'password123',
    role = 'user',
    referredBy = '',
} = {}) {
    const { getDb } = await import('@/lib/db');
    const { hashPassword, generateToken } = await import('@/lib/auth');
    const db = await getDb();
    const passwordHash = await hashPassword(password);
    const referralCode = `${username.slice(0, 4).toUpperCase()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const result = await db.prepare(`
        INSERT INTO users (email, password_hash, username, role, referral_code, referred_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(email, passwordHash, username, role, referralCode, referredBy);
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = await generateToken(user);
    return { user, token, db };
}

export function authHeaders(token) {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Origin: 'http://localhost:3000',
    };
}
