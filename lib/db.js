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
    if (/\binto\s+exchange_rates\b/i.test(sql)) {
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
          avatar_url TEXT DEFAULT '',
          google_id TEXT UNIQUE,
          discord_id TEXT UNIQUE,
          steam_id TEXT UNIQUE,
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
          spu_id INTEGER,
          sku_id INTEGER,
          game_slug TEXT NOT NULL,
          category TEXT NOT NULL,
          sub_category TEXT DEFAULT '',
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          platform TEXT DEFAULT '',
          server_region TEXT DEFAULT '',
          rarity TEXT DEFAULT '',
          delivery_note TEXT DEFAULT '',
          package_label TEXT DEFAULT '',
          package_size INTEGER DEFAULT 1,
          package_unit TEXT DEFAULT 'bundle',
          price DOUBLE PRECISION NOT NULL,
          original_price DOUBLE PRECISION DEFAULT 0,
          discount INTEGER DEFAULT 0,
          in_stock INTEGER DEFAULT 1,
          stock_quantity INTEGER DEFAULT 0,
          image TEXT DEFAULT '',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS product_spus (
          id SERIAL PRIMARY KEY,
          game_slug TEXT NOT NULL,
          category TEXT NOT NULL,
          sub_category TEXT DEFAULT '',
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          image TEXT DEFAULT '',
          platform TEXT DEFAULT '',
          server_region TEXT DEFAULT '',
          rarity TEXT DEFAULT '',
          delivery_note TEXT DEFAULT '',
          active INTEGER DEFAULT 1,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS product_skus (
          id SERIAL PRIMARY KEY,
          spu_id INTEGER NOT NULL REFERENCES product_spus(id) ON DELETE CASCADE,
          legacy_product_id INTEGER UNIQUE REFERENCES products(id) ON DELETE SET NULL,
          external_id TEXT DEFAULT '',
          sku_code TEXT UNIQUE,
          package_label TEXT DEFAULT '',
          package_size INTEGER DEFAULT 1,
          package_unit TEXT DEFAULT 'bundle',
          price DOUBLE PRECISION NOT NULL,
          original_price DOUBLE PRECISION DEFAULT 0,
          discount INTEGER DEFAULT 0,
          in_stock INTEGER DEFAULT 1,
          stock_quantity INTEGER DEFAULT 0,
          attributes_json TEXT DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS inventory_lots (
          id SERIAL PRIMARY KEY,
          sku_id INTEGER NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
          source_type TEXT DEFAULT 'manual',
          source_ref TEXT DEFAULT '',
          available_quantity INTEGER DEFAULT 0,
          reserved_quantity INTEGER DEFAULT 0,
          unit_cost DOUBLE PRECISION DEFAULT 0,
          note TEXT DEFAULT '',
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

        CREATE TABLE IF NOT EXISTS order_inventory_allocations (
          id SERIAL PRIMARY KEY,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id),
          sku_id INTEGER NOT NULL REFERENCES product_skus(id),
          lot_id INTEGER NOT NULL REFERENCES inventory_lots(id),
          quantity INTEGER NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS coupons (
          id SERIAL PRIMARY KEY,
          code TEXT UNIQUE NOT NULL,
          discount_percent INTEGER NOT NULL,
          active INTEGER DEFAULT 1,
          expires_at TEXT
        );

        CREATE TABLE IF NOT EXISTS exchange_rates (
          code TEXT PRIMARY KEY,
          rate DOUBLE PRECISION NOT NULL,
          name TEXT NOT NULL,
          symbol TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS content_articles (
          id SERIAL PRIMARY KEY,
          slug TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          excerpt TEXT DEFAULT '',
          content TEXT NOT NULL,
          cover_image TEXT DEFAULT '',
          category TEXT DEFAULT 'guides',
          game_slug TEXT DEFAULT '',
          published INTEGER DEFAULT 1,
          published_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS email_verification_codes (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          purpose TEXT NOT NULL,
          code_hash TEXT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS risk_events (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
          event_type TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'info',
          score INTEGER NOT NULL DEFAULT 0,
          ip_address TEXT DEFAULT '',
          user_agent TEXT DEFAULT '',
          metadata TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
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
        CREATE INDEX IF NOT EXISTS idx_products_spu ON products(spu_id);
        CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku_id);
        CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
        CREATE INDEX IF NOT EXISTS idx_affiliate_referrer ON affiliate_commissions(referrer_id);
        CREATE INDEX IF NOT EXISTS idx_order_logs_order ON order_status_logs(order_id);
        CREATE INDEX IF NOT EXISTS idx_spus_game ON product_spus(game_slug, category);
        CREATE INDEX IF NOT EXISTS idx_skus_spu ON product_skus(spu_id);
        CREATE INDEX IF NOT EXISTS idx_skus_legacy ON product_skus(legacy_product_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_lots(sku_id);
        CREATE INDEX IF NOT EXISTS idx_order_inventory_allocations_order ON order_inventory_allocations(order_id);
        CREATE INDEX IF NOT EXISTS idx_order_inventory_allocations_lot ON order_inventory_allocations(lot_id);
        CREATE INDEX IF NOT EXISTS idx_articles_slug ON content_articles(slug);
        CREATE INDEX IF NOT EXISTS idx_articles_published ON content_articles(published, published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_email_codes_lookup ON email_verification_codes(email, purpose, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_risk_user ON risk_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_risk_order ON risk_events(order_id);
    `);
}

async function migrateSchema(db) {
    await db.exec(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
        ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_id TEXT UNIQUE;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_id TEXT UNIQUE;
        CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
        CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id);
        CREATE INDEX IF NOT EXISTS idx_users_steam_id ON users(steam_id);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS external_id TEXT DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS spu_id INTEGER REFERENCES product_spus(id);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS sku_id INTEGER REFERENCES product_skus(id);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS server_region TEXT DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS rarity TEXT DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_note TEXT DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS package_label TEXT DEFAULT '';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS package_size INTEGER DEFAULT 1;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS package_unit TEXT DEFAULT 'bundle';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;
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
        UPDATE products SET platform = '' WHERE platform IS NULL;
        UPDATE products SET server_region = '' WHERE server_region IS NULL;
        UPDATE products SET rarity = '' WHERE rarity IS NULL;
        UPDATE products SET delivery_note = '' WHERE delivery_note IS NULL;
        UPDATE products SET package_label = '' WHERE package_label IS NULL;
        UPDATE products SET package_size = 1 WHERE package_size IS NULL OR package_size < 1;
        UPDATE products SET package_unit = 'bundle' WHERE package_unit IS NULL OR package_unit = '';
        UPDATE products SET stock_quantity = CASE WHEN in_stock = 1 THEN 999 ELSE 0 END WHERE stock_quantity IS NULL;
    `);

    await backfillExternalProductIds(db);
    await backfillNormalizedCatalogModel(db);
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
    await backfillNormalizedCatalogModel(db);

    const couponCount = await db.prepare('SELECT COUNT(*)::int AS c FROM coupons').get();
    if (couponCount.c === 0) {
        await db.prepare('INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)').run('ARC8', 8, 1, '2027-12-31');
        await db.prepare('INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)').run('WELCOME10', 10, 1, '2027-12-31');
        await db.prepare('INSERT INTO coupons (code, discount_percent, active, expires_at) VALUES (?, ?, ?, ?)').run('VIP15', 15, 1, '2027-12-31');
    }

    const articleCount = await db.prepare('SELECT COUNT(*)::int AS c FROM content_articles').get();
    if (articleCount.c === 0) {
        const articles = [
            {
                slug: 'arc-raiders-season-3-trials-guide',
                title: 'ARC Raiders Season 3 Trials Guide',
                excerpt: 'Fast route notes for clearing current ARC Raiders trials and extracting safely.',
                content: 'Season 3 trials reward efficient routing, low-risk extraction, and keeping your inventory discipline intact. Start by securing the low-conflict objectives, rotate through material-heavy zones, and only contest hot areas when you already have an extraction route planned.',
                category: 'guides',
                gameSlug: 'arc-raiders',
            },
            {
                slug: 'arc-raiders-material-buying-guide',
                title: 'ARC Raiders Material Buying Guide',
                excerpt: 'How to choose between weather monitor, trophy display, and station materials when buying.',
                content: 'Material bundles should be purchased according to your current upgrade bottleneck. Weather Monitor bundles are efficient for progression, Trophy Display materials tend to be more expensive and should be targeted, and station materials work best when your team already has delivery timing set.',
                category: 'news',
                gameSlug: 'arc-raiders',
            },
        ];

        const tx = db.transaction(async () => {
            for (const article of articles) {
                await db.prepare(`
                    INSERT INTO content_articles (slug, title, excerpt, content, category, game_slug, published)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                `).run(article.slug, article.title, article.excerpt, article.content, article.category, article.gameSlug);
            }
        });
        await tx();
    }

    const exchangeCount = await db.prepare('SELECT COUNT(*)::int AS c FROM exchange_rates').get();
    if (exchangeCount.c === 0) {
        const currencyPath = path.join(process.cwd(), 'data', 'currencies.json');
        if (fs.existsSync(currencyPath)) {
            const raw = fs.readFileSync(currencyPath, 'utf-8');
            const parsed = JSON.parse(raw);
            const rates = parsed.currencies || [];
            const tx = db.transaction(async () => {
                for (const currency of rates) {
                    await db.prepare(`
                        INSERT INTO exchange_rates (code, rate, name, symbol, updated_at)
                        VALUES (?, ?, ?, ?, NOW())
                        ON CONFLICT (code) DO UPDATE
                        SET rate = EXCLUDED.rate,
                            name = EXCLUDED.name,
                            symbol = EXCLUDED.symbol,
                            updated_at = NOW()
                    `).run(currency.code, currency.rate, currency.name, currency.symbol);
                }
            });
            await tx();
        }
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

async function backfillNormalizedCatalogModel(db) {
    const products = await db.prepare(`
        SELECT *
        FROM products
        ORDER BY id ASC
    `).all();

    const tx = db.transaction(async () => {
        for (const product of products) {
            if (product.spu_id && product.sku_id) {
                const lotCount = (await db.prepare('SELECT COUNT(*)::int AS c FROM inventory_lots WHERE sku_id = ?').get(product.sku_id)).c;
                const lotAvailable = (await db.prepare(`
                    SELECT COALESCE(SUM(available_quantity - reserved_quantity), 0)::int AS available
                    FROM inventory_lots
                    WHERE sku_id = ?
                `).get(product.sku_id)).available;
                const sku = await db.prepare('SELECT stock_quantity FROM product_skus WHERE id = ?').get(product.sku_id);

                const needsAggregateRepair =
                    lotCount === 0
                    || product.stock_quantity !== lotAvailable
                    || (sku && sku.stock_quantity !== lotAvailable);

                if (!needsAggregateRepair) {
                    continue;
                }

                if (lotCount === 0) {
                    await db.prepare(`
                        INSERT INTO inventory_lots (sku_id, source_type, source_ref, available_quantity, reserved_quantity, unit_cost, note)
                        VALUES (?, 'legacy-import', ?, ?, 0, 0, 'Auto-generated from legacy product row')
                    `).run(product.sku_id, `product:${product.id}`, product.stock_quantity || (product.in_stock ? 999 : 0));
                }
                const { recomputeInventoryAggregates } = await import('@/lib/inventory');
                await recomputeInventoryAggregates(db, product.sku_id, product.id);
                continue;
            }

            const spuInsert = await db.prepare(`
                INSERT INTO product_spus (
                    game_slug, category, sub_category, name, description, image,
                    platform, server_region, rarity, delivery_note, active
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                product.game_slug,
                product.category,
                product.sub_category || '',
                product.name,
                product.description || '',
                product.image || '',
                product.platform || '',
                product.server_region || '',
                product.rarity || '',
                product.delivery_note || '',
                product.in_stock ? 1 : 0
            );

            const skuInsert = await db.prepare(`
                INSERT INTO product_skus (
                    spu_id, legacy_product_id, external_id, sku_code, package_label,
                    package_size, package_unit, price, original_price, discount,
                    in_stock, stock_quantity, attributes_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                spuInsert.lastInsertRowid,
                product.id,
                product.external_id || '',
                `SKU-${product.id}`,
                product.package_label || product.name,
                product.package_size || 1,
                product.package_unit || 'bundle',
                product.price,
                product.original_price || product.price,
                product.discount || 0,
                product.in_stock ? 1 : 0,
                product.stock_quantity || (product.in_stock ? 999 : 0),
                JSON.stringify({
                    platform: product.platform || '',
                    serverRegion: product.server_region || '',
                    rarity: product.rarity || '',
                })
            );

            await db.prepare(`
                UPDATE products
                SET spu_id = ?, sku_id = ?, stock_quantity = ?
                WHERE id = ?
            `).run(
                spuInsert.lastInsertRowid,
                skuInsert.lastInsertRowid,
                product.stock_quantity || (product.in_stock ? 999 : 0),
                product.id
            );

            await db.prepare(`
                INSERT INTO inventory_lots (sku_id, source_type, source_ref, available_quantity, reserved_quantity, unit_cost, note)
                VALUES (?, 'legacy-import', ?, ?, 0, 0, 'Auto-generated from legacy product row')
            `).run(
                skuInsert.lastInsertRowid,
                `product:${product.id}`,
                product.stock_quantity || (product.in_stock ? 999 : 0)
            );
        }
    });

    await tx();
}
