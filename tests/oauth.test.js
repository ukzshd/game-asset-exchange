import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanupIsolatedDb, setupIsolatedDb } from './helpers/test-env';

function extractCookieValue(setCookieHeader, name) {
    const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : '';
}

describe('OAuth provider flows', () => {
    let temp;

    beforeEach(async () => {
        temp = await setupIsolatedDb();
        process.env.GOOGLE_CLIENT_ID = 'google-client-id';
        process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
        process.env.DISCORD_CLIENT_ID = 'discord-client-id';
        process.env.DISCORD_CLIENT_SECRET = 'discord-client-secret';
        vi.restoreAllMocks();
    });

    afterEach(async () => {
        delete process.env.GOOGLE_CLIENT_ID;
        delete process.env.GOOGLE_CLIENT_SECRET;
        delete process.env.DISCORD_CLIENT_ID;
        delete process.env.DISCORD_CLIENT_SECRET;
        await cleanupIsolatedDb(temp);
    });

    it('starts Google OAuth and completes callback sign-in', async () => {
        const { GET: startOAuth } = await import('@/app/api/auth/oauth/[provider]/route');
        const { GET: oauthCallback } = await import('@/app/api/auth/oauth/[provider]/callback/route');
        const { getDb } = await import('@/lib/db');

        const fetchMock = vi.fn(async (input, init) => {
            const url = String(input);
            if (url === 'https://oauth2.googleapis.com/token') {
                expect(init?.method).toBe('POST');
                return new Response(JSON.stringify({ access_token: 'google-access-token' }), { status: 200 });
            }
            if (url === 'https://openidconnect.googleapis.com/v1/userinfo') {
                return new Response(JSON.stringify({
                    sub: 'google-subject-123',
                    email: 'google-user@example.com',
                    name: 'Google User',
                    picture: 'https://example.com/avatar.png',
                }), { status: 200 });
            }
            throw new Error(`Unexpected fetch url: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const startResponse = await startOAuth(new Request('http://localhost:3000/api/auth/oauth/google?returnTo=%2Fdashboard'), {
            params: Promise.resolve({ provider: 'google' }),
        });

        expect(startResponse.status).toBe(307);
        const authorizeUrl = new URL(startResponse.headers.get('location'));
        expect(authorizeUrl.origin).toBe('https://accounts.google.com');
        expect(authorizeUrl.searchParams.get('client_id')).toBe('google-client-id');
        const setCookie = startResponse.headers.get('set-cookie') || '';
        const state = extractCookieValue(setCookie, 'oauth_state_google');
        expect(state).toBeTruthy();

        const callbackResponse = await oauthCallback(new Request(`http://localhost:3000/api/auth/oauth/google/callback?code=test-code&state=${encodeURIComponent(state)}`, {
            headers: {
                cookie: `oauth_state_google=${encodeURIComponent(state)}`,
            },
        }), {
            params: Promise.resolve({ provider: 'google' }),
        });

        expect(callbackResponse.status).toBe(307);
        const redirectUrl = callbackResponse.headers.get('location');
        expect(redirectUrl).toContain('/auth/callback#');
        expect(redirectUrl).toContain('provider=google');

        const db = await getDb();
        const user = await db.prepare('SELECT * FROM users WHERE google_id = ?').get('google-subject-123');
        expect(user.email).toBe('google-user@example.com');
        expect(user.avatar_url).toBe('https://example.com/avatar.png');
    });

    it('starts Steam OpenID and completes callback sign-in', async () => {
        const { GET: startOAuth } = await import('@/app/api/auth/oauth/[provider]/route');
        const { GET: oauthCallback } = await import('@/app/api/auth/oauth/[provider]/callback/route');
        const { getDb } = await import('@/lib/db');

        const fetchMock = vi.fn(async (input, init) => {
            const url = String(input);
            if (url === 'https://steamcommunity.com/openid/login') {
                expect(init?.method).toBe('POST');
                return new Response('ns:http://specs.openid.net/auth/2.0\nis_valid:true\n', { status: 200 });
            }
            if (url === 'https://steamcommunity.com/profiles/76561198000000000/?xml=1') {
                return new Response(`
                    <profile>
                        <steamID><![CDATA[Steam User]]></steamID>
                        <avatarFull><![CDATA[https://steamcdn.example/avatar.jpg]]></avatarFull>
                    </profile>
                `, { status: 200 });
            }
            throw new Error(`Unexpected fetch url: ${url}`);
        });
        vi.stubGlobal('fetch', fetchMock);

        const startResponse = await startOAuth(new Request('http://localhost:3000/api/auth/oauth/steam?returnTo=%2F'), {
            params: Promise.resolve({ provider: 'steam' }),
        });
        expect(startResponse.status).toBe(307);
        const setCookie = startResponse.headers.get('set-cookie') || '';
        const state = extractCookieValue(setCookie, 'oauth_state_steam');
        expect(state).toBeTruthy();

        const callbackResponse = await oauthCallback(new Request(`http://localhost:3000/api/auth/oauth/steam/callback?state=${encodeURIComponent(state)}&openid.claimed_id=${encodeURIComponent('https://steamcommunity.com/openid/id/76561198000000000')}&openid.identity=${encodeURIComponent('https://steamcommunity.com/openid/id/76561198000000000')}`, {
            headers: {
                cookie: `oauth_state_steam=${encodeURIComponent(state)}`,
            },
        }), {
            params: Promise.resolve({ provider: 'steam' }),
        });

        expect(callbackResponse.status).toBe(307);
        const redirectUrl = callbackResponse.headers.get('location');
        expect(redirectUrl).toContain('/auth/callback#');
        expect(redirectUrl).toContain('provider=steam');

        const db = await getDb();
        const user = await db.prepare('SELECT * FROM users WHERE steam_id = ?').get('76561198000000000');
        expect(user.email).toBe('steam_76561198000000000@oauth.local');
        expect(user.username).toBe('Steam User');
    });
});
