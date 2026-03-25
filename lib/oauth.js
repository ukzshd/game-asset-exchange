import crypto from 'crypto';
import { jwtVerify, SignJWT } from 'jose';
import { getDb } from '@/lib/db';
import { generateReferralCode, generateToken, hashPassword } from '@/lib/auth';
import { getAppUrl, getJwtSecret, getOAuthProviderConfig } from '@/lib/env';

const OAUTH_COOKIE_PREFIX = 'oauth_state_';
const OAUTH_PROVIDERS = new Set(['google', 'discord', 'steam']);
const OAUTH_SECRET = new TextEncoder().encode(getJwtSecret());

function assertProvider(provider) {
    if (!OAUTH_PROVIDERS.has(provider)) {
        throw new Error(`Unsupported OAuth provider: ${provider}`);
    }
}

export function getOAuthCallbackUrl(provider, request) {
    return `${getAppUrl(request)}/api/auth/oauth/${provider}/callback`;
}

export function getOAuthCookieName(provider) {
    return `${OAUTH_COOKIE_PREFIX}${provider}`;
}

function getCookieValue(request, name) {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';').map((part) => part.trim());
    const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
    if (!match) return '';
    return decodeURIComponent(match.slice(name.length + 1));
}

export async function createOAuthState(provider, request, returnTo = '/') {
    assertProvider(provider);
    const nonce = crypto.randomBytes(16).toString('hex');
    const token = await new SignJWT({
        provider,
        nonce,
        returnTo: normalizeReturnTo(returnTo),
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('10m')
        .sign(OAUTH_SECRET);

    return token;
}

export async function verifyOAuthState(provider, request, state) {
    assertProvider(provider);
    const cookieValue = getCookieValue(request, getOAuthCookieName(provider));
    if (!state || !cookieValue || state !== cookieValue) {
        throw new Error('OAuth state validation failed');
    }

    const { payload } = await jwtVerify(state, OAUTH_SECRET);
    if (payload.provider !== provider) {
        throw new Error('OAuth provider mismatch');
    }

    return payload;
}

export function normalizeReturnTo(value) {
    if (!value || typeof value !== 'string') return '/';
    if (!value.startsWith('/') || value.startsWith('//')) return '/';
    return value;
}

function providerColumn(provider) {
    return `${provider}_id`;
}

function sanitizeUsername(source, fallback) {
    const base = String(source || fallback || 'player')
        .replace(/[^\w\- ]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 40);
    return base || fallback || 'player';
}

function syntheticEmail(provider, subject) {
    return `${provider}_${subject}@oauth.local`;
}

async function nextReferralCode(db) {
    let referralCode = generateReferralCode();
    while (await db.prepare('SELECT id FROM users WHERE referral_code = ?').get(referralCode)) {
        referralCode = generateReferralCode();
    }
    return referralCode;
}

export async function exchangeGoogleCode(code, request) {
    const { clientId, clientSecret } = getOAuthProviderConfig('google');
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: getOAuthCallbackUrl('google', request),
            grant_type: 'authorization_code',
        }),
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Google token exchange failed with status ${response.status}`);
    }

    const tokenPayload = await response.json();
    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
        cache: 'no-store',
    });
    if (!userInfoResponse.ok) {
        throw new Error(`Google user info fetch failed with status ${userInfoResponse.status}`);
    }

    const profile = await userInfoResponse.json();
    return {
        provider: 'google',
        subject: String(profile.sub),
        email: profile.email || '',
        username: sanitizeUsername(profile.name || profile.given_name, `google_${profile.sub}`),
        avatarUrl: profile.picture || '',
    };
}

export async function exchangeDiscordCode(code, request) {
    const { clientId, clientSecret } = getOAuthProviderConfig('discord');
    const response = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: getOAuthCallbackUrl('discord', request),
        }),
        cache: 'no-store',
    });

    if (!response.ok) {
        throw new Error(`Discord token exchange failed with status ${response.status}`);
    }

    const tokenPayload = await response.json();
    const userInfoResponse = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenPayload.access_token}` },
        cache: 'no-store',
    });
    if (!userInfoResponse.ok) {
        throw new Error(`Discord user info fetch failed with status ${userInfoResponse.status}`);
    }

    const profile = await userInfoResponse.json();
    const email = profile.email || '';
    return {
        provider: 'discord',
        subject: String(profile.id),
        email,
        username: sanitizeUsername(profile.global_name || profile.username, `discord_${profile.id}`),
        avatarUrl: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : '',
    };
}

async function fetchSteamProfile(steamId) {
    const xmlResponse = await fetch(`https://steamcommunity.com/profiles/${steamId}/?xml=1`, {
        cache: 'no-store',
    });
    if (!xmlResponse.ok) {
        return { username: `steam_${steamId}`, avatarUrl: '' };
    }

    const xml = await xmlResponse.text();
    const nameMatch = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/);
    const avatarMatch = xml.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);
    return {
        username: sanitizeUsername(nameMatch?.[1], `steam_${steamId}`),
        avatarUrl: avatarMatch?.[1] || '',
    };
}

export async function verifySteamCallback(requestUrl) {
    const url = new URL(requestUrl);
    const claimedId = url.searchParams.get('openid.claimed_id') || '';
    const identity = url.searchParams.get('openid.identity') || '';
    const steamId = (claimedId || identity).match(/\/id\/|\/profiles\//)
        ? (claimedId || identity).split('/').filter(Boolean).at(-1)
        : '';

    if (!steamId) {
        throw new Error('Steam claimed id missing');
    }

    const params = new URLSearchParams(url.searchParams);
    params.set('openid.mode', 'check_authentication');
    const response = await fetch('https://steamcommunity.com/openid/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        cache: 'no-store',
    });

    const body = await response.text();
    if (!response.ok || !body.includes('is_valid:true')) {
        throw new Error('Steam OpenID verification failed');
    }

    const profile = await fetchSteamProfile(steamId);
    return {
        provider: 'steam',
        subject: steamId,
        email: syntheticEmail('steam', steamId),
        username: profile.username,
        avatarUrl: profile.avatarUrl,
    };
}

export async function upsertOAuthUser(profile) {
    const db = await getDb();
    const column = providerColumn(profile.provider);
    const email = profile.email || syntheticEmail(profile.provider, profile.subject);
    const username = sanitizeUsername(profile.username, `${profile.provider}_${profile.subject}`);
    const avatarUrl = profile.avatarUrl || '';

    const existingByProvider = await db.prepare(`SELECT * FROM users WHERE ${column} = ?`).get(profile.subject);
    if (existingByProvider) {
        await db.prepare(`
            UPDATE users
            SET email = COALESCE(NULLIF(?, ''), email),
                username = COALESCE(NULLIF(?, ''), username),
                avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
                is_active = 1
            WHERE id = ?
        `).run(email, username, avatarUrl, existingByProvider.id);
        return db.prepare(`
            SELECT id, email, username, avatar_url, google_id, discord_id, steam_id, role, embark_id, phone, referral_code, referred_by, created_at
            FROM users WHERE id = ?
        `).get(existingByProvider.id);
    }

    const existingByEmail = await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existingByEmail) {
        await db.prepare(`
            UPDATE users
            SET ${column} = ?,
                username = COALESCE(NULLIF(?, ''), username),
                avatar_url = COALESCE(NULLIF(?, ''), avatar_url),
                is_active = 1
            WHERE id = ?
        `).run(profile.subject, username, avatarUrl, existingByEmail.id);
        return db.prepare(`
            SELECT id, email, username, avatar_url, google_id, discord_id, steam_id, role, embark_id, phone, referral_code, referred_by, created_at
            FROM users WHERE id = ?
        `).get(existingByEmail.id);
    }

    const referralCode = await nextReferralCode(db);
    const passwordHash = await hashPassword(crypto.randomBytes(24).toString('hex'));
    const result = await db.prepare(`
        INSERT INTO users (email, password_hash, username, avatar_url, role, referral_code, ${column})
        VALUES (?, ?, ?, ?, 'user', ?, ?)
    `).run(email, passwordHash, username, avatarUrl, referralCode, profile.subject);

    return db.prepare(`
        SELECT id, email, username, avatar_url, google_id, discord_id, steam_id, role, embark_id, phone, referral_code, referred_by, created_at
        FROM users WHERE id = ?
    `).get(result.lastInsertRowid);
}

export async function completeOAuthSignIn(profile) {
    const user = await upsertOAuthUser(profile);
    const token = await generateToken(user);
    return { user, token };
}
