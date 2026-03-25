import { NextResponse } from 'next/server';
import {
    completeOAuthSignIn,
    exchangeDiscordCode,
    exchangeGoogleCode,
    getOAuthCookieName,
    normalizeReturnTo,
    verifyOAuthState,
    verifySteamCallback,
} from '@/lib/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function redirectWithError(request, provider, message = 'OAuth sign-in failed') {
    const target = new URL('/auth/callback', request.url);
    target.searchParams.set('error', message);
    target.searchParams.set('provider', provider);
    return NextResponse.redirect(target);
}

export async function GET(request, { params }) {
    const { provider } = await params;
    try {
        const url = new URL(request.url);
        const state = url.searchParams.get('state') || '';
        const oauthState = await verifyOAuthState(provider, request, state);

        let profile = null;
        if (provider === 'google') {
            const code = url.searchParams.get('code') || '';
            if (!code) {
                return redirectWithError(request, provider, 'Google authorization code missing');
            }
            profile = await exchangeGoogleCode(code, request);
        } else if (provider === 'discord') {
            const code = url.searchParams.get('code') || '';
            if (!code) {
                return redirectWithError(request, provider, 'Discord authorization code missing');
            }
            profile = await exchangeDiscordCode(code, request);
        } else if (provider === 'steam') {
            profile = await verifySteamCallback(request.url);
        } else {
            return redirectWithError(request, provider, 'Unsupported OAuth provider');
        }

        const { token } = await completeOAuthSignIn(profile);
        const returnTo = normalizeReturnTo(String(oauthState.returnTo || '/'));
        const redirectTarget = new URL('/auth/callback', request.url);
        redirectTarget.hash = new URLSearchParams({
            token,
            provider,
            returnTo,
        }).toString();

        const response = NextResponse.redirect(redirectTarget);
        response.cookies.set(getOAuthCookieName(provider), '', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 0,
        });
        return response;
    } catch (error) {
        console.error('OAuth callback error:', error);
        const response = redirectWithError(request, provider, error.message || 'OAuth sign-in failed');
        response.cookies.set(getOAuthCookieName(provider), '', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 0,
        });
        return response;
    }
}
