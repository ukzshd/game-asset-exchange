import { NextResponse } from 'next/server';
import { getLatestRates, syncExchangeRates } from '@/lib/currency-rates';

export async function GET() {
    try {
        let rates = await getLatestRates();
        if (!rates.length) {
            rates = await syncExchangeRates();
        }
        return NextResponse.json({ rates });
    } catch (error) {
        console.error('Currency rates error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
