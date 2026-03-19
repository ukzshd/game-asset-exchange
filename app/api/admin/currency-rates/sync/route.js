import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { assertTrustedOrigin } from '@/lib/request-security';
import { syncExchangeRates } from '@/lib/currency-rates';

export async function POST(request) {
    try {
        assertTrustedOrigin(request);
        await requireAdmin(request);
        const rates = await syncExchangeRates();
        return NextResponse.json({ rates, synced: true });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Sync currency rates error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
