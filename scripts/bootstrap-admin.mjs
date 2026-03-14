import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    args[key] = value;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const dbPath = process.env.IGGM_DB_PATH || process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'iggm.db');
const email = (args.email || '').trim().toLowerCase();
const username = (args.username || 'admin').trim();
const password = args.password || '';

if (!email || !password) {
  console.error('Usage: npm run bootstrap:admin -- --email admin@example.com --password StrongPassword123 --username admin');
  process.exit(1);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    username TEXT NOT NULL,
    embark_id TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    role TEXT DEFAULT 'user',
    referral_code TEXT UNIQUE,
    referred_by TEXT DEFAULT '',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
const passwordHash = await bcrypt.hash(password, 12);
const referralCode = `ADMIN${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

if (existing) {
  db.prepare('UPDATE users SET username = ?, password_hash = ?, role = ?, is_active = 1 WHERE id = ?')
    .run(username, passwordHash, 'admin', existing.id);
  console.log(`Updated existing user ${email} to admin.`);
} else {
  db.prepare(`
    INSERT INTO users (email, password_hash, username, role, referral_code, is_active)
    VALUES (?, ?, ?, 'admin', ?, 1)
  `).run(email, passwordHash, username, referralCode);
  console.log(`Created admin user ${email}.`);
}

db.close();
