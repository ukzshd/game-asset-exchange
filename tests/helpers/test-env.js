export async function setupIsolatedDb() {
    const previousEnv = {
        DATABASE_URL: process.env.DATABASE_URL,
        JWT_SECRET: process.env.JWT_SECRET,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
        BCRYPT_ROUNDS: process.env.BCRYPT_ROUNDS,
    };

    process.env.DATABASE_URL = 'pg-mem';
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.BCRYPT_ROUNDS = '4';
    await resetDbModule();
    return { databaseUrl: 'pg-mem', previousEnv };
}

export async function resetDbModule() {
    const dbModule = await import('@/lib/db');
    await dbModule.closeDb();
}

export async function cleanupIsolatedDb(context = {}) {
    await resetDbModule();
    const previousEnv = context.previousEnv || {};

    if (previousEnv.DATABASE_URL === undefined) {
        delete process.env.DATABASE_URL;
    } else {
        process.env.DATABASE_URL = previousEnv.DATABASE_URL;
    }

    if (previousEnv.JWT_SECRET === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = previousEnv.JWT_SECRET;
    }

    if (previousEnv.NEXT_PUBLIC_APP_URL === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
        process.env.NEXT_PUBLIC_APP_URL = previousEnv.NEXT_PUBLIC_APP_URL;
    }

    if (previousEnv.BCRYPT_ROUNDS === undefined) {
        delete process.env.BCRYPT_ROUNDS;
    } else {
        process.env.BCRYPT_ROUNDS = previousEnv.BCRYPT_ROUNDS;
    }
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
