import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'async_hooks';
import { Pool, types } from 'pg';
import { newDb } from 'pg-mem';
import { ORDER_STATUS } from '@/lib/orders';

types.setTypeParser(20, (value) => Number.parseInt(value, 10));

const txStorage = new AsyncLocalStorage();

let _dbPromise = null;
let _pool = null;

function resolveDatabaseUrl() {
    return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

function convertPlaceholders(sql) {
    let index = 0;
    return sql.replace(/\?/g, () => {
        index += 1;
        return `$${index}`;
    });
}

function withReturningId(sql) {
    if (!/^\s*insert\b/i.test(sql) || /\breturning\b/i.test(sql)) {
        return sql;
    }
    return `${sql.trimEnd()} RETURNING id`;
}

function createExecutor(pool) {
    async function query(text, params = []) {
        const client = txStorage.getStore();
        return (client || pool).query(text, params);
    }

    return {
        async query(text, params = []) {
            return query(text, params);
        },
        async exec(text) {
            return query(text);
        },
        prepare(sql) {
            const text = convertPlaceholders(sql);

            return {
                async get(...params) {
                    const result = await query(text, params);
                    return result.rows[0];
                },
                async all(...params) {
                    const result = await query(text, params);
                    return result.rows;
                },
                async run(...params) {
                    const statement = withReturningId(text);
                    const result = await query(statement, params);
                    return {
                        changes: result.rowCount || 0,
                        lastInsertRowid: result.rows[0]?.id || null,
                    };
                },
            };
        },
        transaction(fn) {
            return async (...args) => {
                const client = await pool.connect();
                try {
                    await client.query('BEGIN');
                    const result = await txStorage.run(client, async () => fn(...args));
                    await client.query('COMMIT');
                    return result;
                } catch (error) {
                    await client.query('ROLLBACK');
                    throw error;
                } finally {
                    client.release();
                }
            };
        },
        async close() {
            await pool.end();
        },
    };
}

async function createPool() {
    const databaseUrl = resolveDatabaseUrl();
    if (databaseUrl === 'pg-mem') {
        const memoryDb = newDb({
            autoCreateForeignKeyIndices: true,
        });
        const adapter = memoryDb.adapters.createPg();
        return new adapter.Pool();
    }

    if (!databaseUrl) {
        throw new Error('DATABASE_URL is not configured');
    }

    return new Pool({
        connectionString: databaseUrl,
    });
}

export async function getDb() {
    if (_dbPromise) return _dbPromise;

    _dbPromise = (async () => {
        _pool = await createPool();
        const db = createExecutor(_pool);
        await initTables(db);
        await migrateSchema(db);
        await seedData(db);
        return db;
    })();

    return _dbPromise;
}

export async function closeDb() {
    if (_pool) {
        await _pool.end();
    }
    _pool = null;
    _dbPromise = null;
}

async function initTables(db) {
    await db.exec(`
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

        CREATE TABLE IF NOT EXISTS products (
          id SERIAL PRIMARY KEY,
          external_id TEXT DEFAULT '',
          game_slug TEXT NOT NULL,
          category TEXT NOT NULL,
          sub_category TEXT DEFAULT '',
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          price DOUBLE PRECISION NOT NULL,
          original_price DOUBLE PRECISION DEFAULT 0,
          discount INTEGER DEFAULT 0,
          in_stock INTEGER DEFAULT 1,
          image TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS orders (
          id SERIAL PRIMARY KEY,
          order_no TEXT UNIQUE NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id),
          total DOUBLE PRECISION NOT NULL,
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
          discount_amount DOUBLE PRECISION DEFAULT 0,
          notes TEXT DEFAULT '',
          assigned_to INTEGER REFERENCES users(id),
          assigned_at TIMESTAMPTZ,
          assigned_by INTEGER REFERENCES users(id),
          delivered_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          last_status_changed_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS order_items (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id),
          product_name TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit_price DOUBLE PRECISION NOT NULL
        );

        CREATE TABLE IF NOT EXISTS coupons (
          id SERIAL PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          discount_percent INTEGER NOT NULL,
          active INTEGER DEFAULT 1,
          expires_at TEXT
        );

        CREATE TABLE IF NOT EXISTS affiliate_commissions (
          id SERIAL PRIMARY KEY,
          referrer_id INTEGER NOT NULL REFERENCES users(id),
          order_id INTEGER NOT NULL REFERENCES orders(id),
          order_amount DOUBLE PRECISION NOT NULL,
          commission_rate DOUBLE PRECISION DEFAULT 0.10,
          commission_amount DOUBLE PRECISION NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS order_status_logs (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          actor_user_id INTEGER REFERENCES users(id),
          actor_role TEXT DEFAULT 'system',
          event_type TEXT NOT NULL,
          from_status TEXT,
          to_status TEXT,
          message TEXT DEFAULT '',
          metadata TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_products_game ON products(game_slug);
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(game_slug, category);
        CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_affiliate_referrer ON affiliate_commissions(referrer_id);
        CREATE INDEX IF NOT EXISTS idx_order_logs_order ON order_status_logs(order_id);
    `);
}

async function migrateSchema(db) {
    await db.exec(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS external_id TEXT DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        CREATE INDEX IF NOT EXISTS idx_products_external ON products(game_slug, external_id);

        ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT '${ORDER_STATUS.PENDING_PAYMENT}';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_email TEXT DEFAULT '';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_contact TEXT DEFAULT '';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_platform TEXT DEFAULT '';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_server TEXT DEFAULT '';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT '';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_session_id TEXT DEFAULT '';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference TEXT DEFAULT '';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_to INTEGER REFERENCES users(id);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_by INTEGER REFERENCES users(id);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS last_status_changed_at TIMESTAMPTZ DEFAULT NOW();
        CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders(assigned_to);
        CREATE INDEX IF NOT EXISTS idx_orders_payment_session ON orders(payment_session_id);
    `);

    await db.exec(`
        UPDATE orders SET status = '${ORDER_STATUS.PENDING_PAYMENT}' WHERE status = 'pending';
        UPDATE orders SET status = '${ORDER_STATUS.ASSIGNED}' WHERE status = 'processing';
        UPDATE orders SET payment_status = 'paid'
        WHERE status IN ('${ORDER_STATUS.PAID}', '${ORDER_STATUS.ASSIGNED}', '${ORDER_STATUS.DELIVERING}', '${ORDER_STATUS.DELIVERED}', '${ORDER_STATUS.COMPLETED}')
          AND payment_status IN ('', 'unpaid');
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
        UPDATE products SET updated_at = created_at WHERE updated_at IS NULL;
    `);

    await backfillExternalProductIds(db);
}

async function seedData(db) {
    const count = await db.prepare('SELECT COUNT(*)::int AS c FROM products').get();
    if (count.c === 0) {
        const arcRaidersPath = path.join(process.cwd(), 'data', 'products', 'arc-raiders.json');
        if (fs.existsSync(arcRaidersPath)) {
            const raw = fs.readFileSync(arcRaidersPath, 'utf-8');
            const data = JSON.parse(raw);
            const items = data.items || data;
            const tx = db.transaction(async () => {
                for (const item of items) {
                    await db.prepare(`
                        INSERT INTO products (
                            external_id, game_slug, category, sub_category, name, description,
                            price, original_price, discount, in_stock, image
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `).run(
                        item.id || '',
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
            await tx();
        }
    }

    await backfillExternalProductIds(db);

    const couponCount = await db.prepare('SELECT COUNT(*)::int AS c FROM coupons').get();
    if (couponCount.c === 0) {
        await db.prepare('INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)').run('ARC8', 8, 1, '2027-12-31');
        await db.prepare('INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)').run('WELCOME10', 10, 1, '2027-12-31');
        await db.prepare('INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)').run('VIP15', 15, 1, '2027-12-31');
    }
}

async function backfillExternalProductIds(db) {
    const arcRaidersPath = path.join(process.cwd(), 'data', 'products', 'arc-raiders.json');
    if (!fs.existsSync(arcRaidersPath)) return;

    const raw = fs.readFileSync(arcRaidersPath, 'utf-8');
    const data = JSON.parse(raw);
    const items = data.items || data;
    const tx = db.transaction(async () => {
        for (const item of items) {
            if (!item?.id || !item?.name) continue;
            await db.prepare(`
                UPDATE products
                SET external_id = ?
                WHERE game_slug = ?
                  AND name = ?
                  AND (external_id IS NULL OR external_id = '')
            `).run(item.id, 'arc-raiders', item.name);
        }
    });
    await tx();
}
