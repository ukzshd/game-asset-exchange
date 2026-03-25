import { NextResponse } from 'next/server';
import { createOAuthState, getOAuthCallbackUrl, getOAuthCookieName, normalizeReturnTo } from '@/lib/oauth';
import { getOAuthProviderConfig } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function buildProviderUrl(provider, request, returnTo, state) {
    if (provider === 'google') {
        const { clientId } = getOAuthProviderConfig('google');
        const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('redirect_uri', getOAuthCallbackUrl('google', request));
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', 'openid email profile');
        url.searchParams.set('state', state);
        url.searchParams.set('prompt', 'select_account');
        return url.toString();
    }

    if (provider === 'discord') {
        const { clientId } = getOAuthProviderConfig('discord');
        const url = new URL('https://discord.com/oauth2/authorize');
        url.searchParams.set('client_id', clientId);
        url.searchParams.set('redirect_uri', getOAuthCallbackUrl('discord', request));
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', 'identify email');
        url.searchParams.set('state', state);
        url.searchParams.set('prompt', 'consent');
        return url.toString();
    }

    if (provider === 'steam') {
        const callback = getOAuthCallbackUrl('steam', request);
        const realm = new URL(callback).origin;
        const url = new URL('https://steamcommunity.com/openid/login');
        url.searchParams.set('openid.ns', 'http://specs.openid.net/auth/2.0');
        url.searchParams.set('openid.mode', 'checkid_setup');
        url.searchParams.set('openid.return_to', `${callback}?state=${encodeURIComponent(state)}`);
        url.searchParams.set('openid.realm', realm);
        url.searchParams.set('openid.identity', 'http://specs.openid.net/auth/2.0/identifier_select');
        url.searchParams.set('openid.claimed_id', 'http://specs.openid.net/auth/2.0/identifier_select');
        return url.toString();
    }

    throw new Error(`Unsupported OAuth provider: ${provider}`);
}

export async function GET(request, { params }) {
    try {
        const { provider } = await params;
        const { searchParams } = new URL(request.url);
        const returnTo = normalizeReturnTo(searchParams.get('returnTo') || '/');
        const state = await createOAuthState(provider, request, returnTo);
        const redirectUrl = buildProviderUrl(provider, request, returnTo, state);
        const response = NextResponse.redirect(redirectUrl);
        response.cookies.set(getOAuthCookieName(provider), state, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 600,
        });
        return response;
    } catch (error) {
        console.error('OAuth start error:', error);
        return NextResponse.json({ error: error.message || 'Failed to start OAuth' }, { status: 400 });
    }
}
