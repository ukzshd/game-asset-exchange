import staticCurrencyData from '@/data/currencies.json';
import { getDb } from '@/lib/db';

const DEFAULT_SOURCE = process.env.EXCHANGE_RATE_API_URL || 'https://open.er-api.com/v6/latest/USD';

export async function getLatestRates() {
    const db = await getDb();
    const rates = await db.prepare('SELECT code, rate, name, symbol, updated_at FROM exchange_rates ORDER BY code ASC').all();
    return rates;
}

export async function syncExchangeRates() {
    let fetchedRates = null;

    try {
        const response = await fetch(DEFAULT_SOURCE, { cache: 'no-store' });
        if (response.ok) {
            const payload = await response.json();
            const rates = payload?.rates || {};
            fetchedRates = staticCurrencyData.currencies
                .filter((currency) => typeof rates[currency.code] === 'number')
                .map((currency) => ({
                    code: currency.code,
                    name: currency.name,
                    symbol: currency.symbol,
                    rate: rates[currency.code],
                }));
        }
    } catch (error) {
        console.warn('Exchange rate sync failed, falling back to stored/static rates:', error);
    }

    const normalized = fetchedRates?.length
        ? fetchedRates
        : staticCurrencyData.currencies.map((currency) => ({
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            rate: currency.rate,
        }));

    const db = await getDb();
    const tx = db.transaction(async () => {
        for (const currency of normalized) {
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

    return getLatestRates();
}
