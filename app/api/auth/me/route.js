import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';

export async function GET(request) {
    try {
        const user = await getUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        return NextResponse.json({ user });
    } catch (error) {
        console.error('Me error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
