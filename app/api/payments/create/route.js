import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// POST - Create a simulated payment intent
export async function POST(request) {
    try {
        const user = await requireAuth(request);
        const { orderId, paymentMethod } = await request.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
        }

        // Simulate payment intent creation
        const paymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

        return NextResponse.json({
            paymentId,
            clientSecret: `cs_${paymentId}`,
            status: 'requires_confirmation',
            paymentMethod: paymentMethod || 'stripe',
        });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Create payment error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
