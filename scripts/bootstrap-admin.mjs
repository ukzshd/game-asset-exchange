import bcrypt from 'bcryptjs';
import { Pool } from 'pg';

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
const email = (args.email || '').trim().toLowerCase();
const username = (args.username || 'admin').trim();
const password = args.password || '';
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

if (!email || !password) {
  console.error('Usage: npm run bootstrap:admin -- --email admin@example.com --password StrongPassword123 --username admin');
  process.exit(1);
}

if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      username TEXT NOT NULL,
      embark_id TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      role TEXT DEFAULT 'user',
      referral_code TEXT UNIQUE,
      referred_by TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  const existing = (await pool.query('SELECT id FROM users WHERE email = $1', [email])).rows[0];
  const passwordHash = await bcrypt.hash(password, 12);
  const referralCode = `ADMIN${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

  if (existing) {
    await pool.query(
      'UPDATE users SET username = $1, password_hash = $2, role = $3, is_active = 1 WHERE id = $4',
      [username, passwordHash, 'admin', existing.id]
    );
    console.log(`Updated existing user ${email} to admin.`);
  } else {
    await pool.query(`
      INSERT INTO users (email, password_hash, username, role, referral_code, is_active)
      VALUES ($1, $2, $3, 'admin', $4, 1)
    `, [email, passwordHash, username, referralCode]);
    console.log(`Created admin user ${email}.`);
  }
} finally {
  await pool.end();
}
