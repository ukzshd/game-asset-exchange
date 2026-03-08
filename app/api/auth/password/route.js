import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAuth, verifyPassword, hashPassword } from '@/lib/auth';

export async function PUT(request) {
    try {
        const user = await requireAuth(request);
        const { currentPassword, newPassword } = await request.json();

        if (!currentPassword || !newPassword) {
            return NextResponse.json({ error: 'Current and new passwords are required' }, { status: 400 });
        }

        if (newPassword.length < 6) {
            return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
        }

        const db = getDb();
        const fullUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(user.id);

        const valid = await verifyPassword(currentPassword, fullUser.password_hash);
        if (!valid) {
            return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
        }

        const newHash = await hashPassword(newPassword);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, user.id);

        return NextResponse.json({ message: 'Password updated successfully' });
    } catch (error) {
        if (error instanceof Response) return error;
        console.error('Password change error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
