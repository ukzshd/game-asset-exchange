import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { ORDER_STATUS } from '@/lib/orders';

function resolveDbPath() {
    return process.env.IGGM_DB_PATH || process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'iggm.db');
}

let _db = null;

export function getDb() {
    if (_db) return _db;

    _db = new Database(resolveDbPath());
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');

    initTables(_db);
    migrateSchema(_db);
    seedData(_db);

    return _db;
}

export function closeDb() {
    if (_db) {
        _db.close();
        _db = null;
    }
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
      is_active INTEGER DEFAULT 1,
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
      status TEXT DEFAULT '${ORDER_STATUS.PENDING_PAYMENT}',
      embark_id TEXT DEFAULT '',
      character_name TEXT DEFAULT '',
      delivery_email TEXT DEFAULT '',
      delivery_contact TEXT DEFAULT '',
      delivery_platform TEXT DEFAULT '',
      delivery_server TEXT DEFAULT '',
      payment_method TEXT DEFAULT '',
      payment_provider TEXT DEFAULT '',
      payment_id TEXT DEFAULT '',
      payment_session_id TEXT DEFAULT '',
      payment_reference TEXT DEFAULT '',
      payment_status TEXT DEFAULT 'unpaid',
      coupon_code TEXT DEFAULT '',
      discount_amount REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      assigned_to INTEGER,
      assigned_at TEXT,
      assigned_by INTEGER,
      delivered_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_status_changed_at TEXT DEFAULT (datetime('now')),
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

    CREATE TABLE IF NOT EXISTS order_status_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      actor_user_id INTEGER,
      actor_role TEXT DEFAULT 'system',
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      message TEXT DEFAULT '',
      metadata TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE INDEX IF NOT EXISTS idx_products_game ON products(game_slug);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(game_slug, category);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_orders_payment_session ON orders(payment_session_id);
    CREATE INDEX IF NOT EXISTS idx_affiliate_referrer ON affiliate_commissions(referrer_id);
    CREATE INDEX IF NOT EXISTS idx_order_logs_order ON order_status_logs(order_id);
  `);
}

function migrateSchema(db) {
    ensureColumn(db, 'users', 'is_active INTEGER DEFAULT 1');

    ensureColumn(db, 'orders', `status TEXT DEFAULT '${ORDER_STATUS.PENDING_PAYMENT}'`);
    ensureColumn(db, 'orders', "delivery_email TEXT DEFAULT ''");
    ensureColumn(db, 'orders', "delivery_contact TEXT DEFAULT ''");
    ensureColumn(db, 'orders', "delivery_platform TEXT DEFAULT ''");
    ensureColumn(db, 'orders', "delivery_server TEXT DEFAULT ''");
    ensureColumn(db, 'orders', "payment_provider TEXT DEFAULT ''");
    ensureColumn(db, 'orders', "payment_session_id TEXT DEFAULT ''");
    ensureColumn(db, 'orders', "payment_reference TEXT DEFAULT ''");
    ensureColumn(db, 'orders', "payment_status TEXT DEFAULT 'unpaid'");
    ensureColumn(db, 'orders', 'assigned_to INTEGER');
    ensureColumn(db, 'orders', 'assigned_at TEXT');
    ensureColumn(db, 'orders', 'assigned_by INTEGER');
    ensureColumn(db, 'orders', 'delivered_at TEXT');
    ensureColumn(db, 'orders', 'completed_at TEXT');
    ensureColumn(db, 'orders', 'last_status_changed_at TEXT');

    db.exec(`
      UPDATE orders SET status = '${ORDER_STATUS.PENDING_PAYMENT}' WHERE status = 'pending';
      UPDATE orders SET status = '${ORDER_STATUS.ASSIGNED}' WHERE status = 'processing';
      UPDATE orders SET payment_status = 'paid' WHERE status IN ('${ORDER_STATUS.PAID}', '${ORDER_STATUS.ASSIGNED}', '${ORDER_STATUS.DELIVERING}', '${ORDER_STATUS.DELIVERED}', '${ORDER_STATUS.COMPLETED}') AND payment_status IN ('', 'unpaid');
      UPDATE orders SET payment_provider = 'legacy' WHERE payment_id != '' AND payment_provider = '';
      UPDATE orders SET delivery_email = '' WHERE delivery_email IS NULL;
      UPDATE orders SET delivery_contact = '' WHERE delivery_contact IS NULL;
      UPDATE orders SET delivery_platform = '' WHERE delivery_platform IS NULL;
      UPDATE orders SET delivery_server = '' WHERE delivery_server IS NULL;
      UPDATE orders SET payment_provider = '' WHERE payment_provider IS NULL;
      UPDATE orders SET payment_session_id = '' WHERE payment_session_id IS NULL;
      UPDATE orders SET payment_reference = '' WHERE payment_reference IS NULL;
      UPDATE orders SET payment_status = 'unpaid' WHERE payment_status IS NULL OR payment_status = '';
      UPDATE orders SET last_status_changed_at = updated_at WHERE last_status_changed_at IS NULL;
    `);
}

function ensureColumn(db, table, definition) {
    const columnName = definition.split(' ')[0];
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((column) => column.name === columnName)) {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    }
}

function seedData(db) {
    const count = db.prepare('SELECT COUNT(*) as c FROM products').get();
    if (count.c === 0) {
        const arcRaidersPath = path.join(process.cwd(), 'data', 'products', 'arc-raiders.json');
        if (fs.existsSync(arcRaidersPath)) {
            const raw = fs.readFileSync(arcRaidersPath, 'utf-8');
            const data = JSON.parse(raw);
            const items = data.items || data;

            const insert = db.prepare(`
              INSERT INTO products (game_slug, category, sub_category, name, description, price, original_price, discount, in_stock, image)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const tx = db.transaction((seedItems) => {
                for (const item of seedItems) {
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
    }

    const couponCount = db.prepare('SELECT COUNT(*) as c FROM coupons').get();
    if (couponCount.c === 0) {
        db.prepare('INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)').run('ARC8', 8, 1, '2027-12-31');
        db.prepare('INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)').run('WELCOME10', 10, 1, '2027-12-31');
        db.prepare('INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)').run('VIP15', 15, 1, '2027-12-31');
    }
}
