'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useAuthStore from '@/store/authStore';

export default function AuthCallbackClient() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const completeOAuthLogin = useAuthStore((state) => state.completeOAuthLogin);
    const [authError, setAuthError] = useState('');
    const error = searchParams.get('error') || '';
    const token = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.hash.replace(/^#/, '')).get('token') || ''
        : '';

    useEffect(() => {
        const hash = window.location.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hash);
        const currentToken = hashParams.get('token') || '';
        const returnTo = hashParams.get('returnTo') || '/';

        if (error) {
            return;
        }

        if (!currentToken) {
            return;
        }

        let cancelled = false;
        const finish = async () => {
            const success = await completeOAuthLogin(currentToken);
            if (!cancelled) {
                if (success) {
                    router.replace(returnTo);
                } else {
                    setAuthError('Failed to complete OAuth sign-in');
                }
            }
        };

        finish();
        return () => {
            cancelled = true;
        };
    }, [completeOAuthLogin, error, router]);

    return (
        <div className="container" style={{ padding: '96px 0', textAlign: 'center' }}>
            <h1>Sign-In</h1>
            <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>{error || authError || (token ? 'Completing sign-in...' : 'OAuth token missing')}</p>
        </div>
    );
}
