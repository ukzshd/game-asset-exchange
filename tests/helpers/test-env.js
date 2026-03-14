import fs from 'fs';
import os from 'os';
import path from 'path';

export function createTempDbPath() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'iggm-test-'));
    return {
        dir,
        dbPath: path.join(dir, 'iggm-test.db'),
    };
}

export async function setupIsolatedDb() {
    const temp = createTempDbPath();
    process.env.IGGM_DB_PATH = temp.dbPath;
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    await resetDbModule();
    return temp;
}

export async function resetDbModule() {
    const dbModule = await import('@/lib/db');
    dbModule.closeDb();
}

export async function cleanupIsolatedDb(temp) {
    await resetDbModule();
    if (temp?.dir) {
        fs.rmSync(temp.dir, { recursive: true, force: true });
    }
    delete process.env.IGGM_DB_PATH;
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
    const db = getDb();
    const passwordHash = await hashPassword(password);
    const referralCode = `${username.slice(0, 4).toUpperCase()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const result = db.prepare(`
        INSERT INTO users (email, password_hash, username, role, referral_code, referred_by)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(email, passwordHash, username, role, referralCode, referredBy);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    const token = await generateToken(user);
    return { user, token, db };
}

export function authHeaders(token) {
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
    };
}
