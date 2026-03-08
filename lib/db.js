import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'iggm.db');

let _db = null;

export function getDb() {
    if (_db) return _db;

    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');

    initTables(_db);
    seedData(_db);

    return _db;
}

function initTables(db) {
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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_slug TEXT NOT NULL,
      category TEXT NOT NULL,
      sub_category TEXT DEFAULT '',
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      original_price REAL DEFAULT 0,
      discount INTEGER DEFAULT 0,
      in_stock INTEGER DEFAULT 1,
      image TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      total REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'pending',
      embark_id TEXT DEFAULT '',
      character_name TEXT DEFAULT '',
      payment_method TEXT DEFAULT '',
      payment_id TEXT DEFAULT '',
      coupon_code TEXT DEFAULT '',
      discount_amount REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_percent INTEGER NOT NULL,
      active INTEGER DEFAULT 1,
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS affiliate_commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referrer_id INTEGER NOT NULL,
      order_id INTEGER NOT NULL,
      order_amount REAL NOT NULL,
      commission_rate REAL DEFAULT 0.10,
      commission_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (referrer_id) REFERENCES users(id),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_game ON products(game_slug);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(game_slug, category);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_affiliate_referrer ON affiliate_commissions(referrer_id);
  `);
}

function seedData(db) {
    // Only seed if products table is empty
    const count = db.prepare('SELECT COUNT(*) as c FROM products').get();
    if (count.c > 0) return;

    // Seed products from arc-raiders.json
    const arcRaidersPath = path.join(process.cwd(), 'data', 'products', 'arc-raiders.json');
    if (fs.existsSync(arcRaidersPath)) {
        const raw = fs.readFileSync(arcRaidersPath, 'utf-8');
        const data = JSON.parse(raw);
        const items = data.items || data;

        const insert = db.prepare(`
      INSERT INTO products (game_slug, category, sub_category, name, description, price, original_price, discount, in_stock, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

        const tx = db.transaction((items) => {
            for (const item of items) {
                insert.run(
                    'arc-raiders',
                    item.category || 'items',
                    item.subCategory || item.sub_category || '',
                    item.name,
                    item.description || '',
                    item.price,
                    item.originalPrice || item.price,
                    item.discount || 0,
                    item.inStock !== false ? 1 : 0,
                    item.image || ''
                );
            }
        });
        tx(items);
    }

    // Seed default coupons
    const couponCount = db.prepare('SELECT COUNT(*) as c FROM coupons').get();
    if (couponCount.c === 0) {
        db.prepare(`INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)`).run('ARC8', 8, 1, '2027-12-31');
        db.prepare(`INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)`).run('WELCOME10', 10, 1, '2027-12-31');
        db.prepare(`INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)`).run('VIP15', 15, 1, '2027-12-31');
    }
}
