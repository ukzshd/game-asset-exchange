import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupIsolatedDb, setupIsolatedDb } from './helpers/test-env';

vi.mock('@/lib/email', async () => {
    const actual = await vi.importActual('@/lib/email');
    return {
        ...actual,
        generateVerificationCode: () => '123456',
        sendEmail: vi.fn(async () => ({ skipped: false })),
    };
});

describe('email verification auth flow', () => {
    let temp;

    beforeEach(async () => {
        temp = await setupIsolatedDb();
    });

    afterEach(async () => {
        await cleanupIsolatedDb(temp);
    });

    it('sends a verification code and requires it for registration', async () => {
        const { POST: sendCode } = await import('@/app/api/auth/verification-code/route');
        const { POST: register } = await import('@/app/api/auth/register/route');

        const sendResponse = await sendCode(new Request('http://localhost:3000/api/auth/verification-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'http://localhost:3000',
            },
            body: JSON.stringify({ email: 'code-register@example.com', purpose: 'register' }),
        }));

        expect(sendResponse.status).toBe(200);

        const registerResponse = await register(new Request('http://localhost:3000/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'http://localhost:3000',
            },
            body: JSON.stringify({
                email: 'code-register@example.com',
                password: 'password123',
                username: 'codeduser',
                verifyCode: '123456',
            }),
        }));

        expect(registerResponse.status).toBe(201);
        const payload = await registerResponse.json();
        expect(payload.user.email).toBe('code-register@example.com');
    });

    it('allows login using a verification code without password', async () => {
        const { POST: sendCode } = await import('@/app/api/auth/verification-code/route');
        const { POST: login } = await import('@/app/api/auth/login/route');
        const { createUser } = await import('./helpers/test-env');

        await createUser({ email: 'code-login@example.com', username: 'codelogin', password: 'password123' });

        const sendResponse = await sendCode(new Request('http://localhost:3000/api/auth/verification-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'http://localhost:3000',
            },
            body: JSON.stringify({ email: 'code-login@example.com', purpose: 'login' }),
        }));

        expect(sendResponse.status).toBe(200);

        const loginResponse = await login(new Request('http://localhost:3000/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Origin: 'http://localhost:3000',
            },
            body: JSON.stringify({
                email: 'code-login@example.com',
                verifyCode: '123456',
            }),
        }));

        expect(loginResponse.status).toBe(200);
        const payload = await loginResponse.json();
        expect(payload.user.email).toBe('code-login@example.com');
        expect(payload.token).toBeTruthy();
    });
});
