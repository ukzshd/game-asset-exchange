'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import styles from './page.module.css';

export default function ForgotPasswordClient() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token') || '';
    const prefilledEmail = searchParams.get('email') || '';

    const [email, setEmail] = useState(prefilledEmail);
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleRequestReset(event) {
        event.preventDefault();
        setLoading(true);
        setStatus('');
        try {
            const response = await fetch('/api/auth/password-reset/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            const payload = await response.json();
            setStatus(payload.message || (response.ok ? 'Reset link sent.' : payload.error));
        } finally {
            setLoading(false);
        }
    }

    async function handleConfirmReset(event) {
        event.preventDefault();
        setLoading(true);
        setStatus('');
        try {
            const response = await fetch('/api/auth/password-reset/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, token, password }),
            });
            const payload = await response.json();
            setStatus(response.ok ? 'Password reset successfully.' : payload.error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className={styles.page}>
            <div className="container">
                <div className={styles.card}>
                    <h1>{token ? 'Set New Password' : 'Forgot Password'}</h1>
                    <p>{token ? 'Enter your email and new password to complete the reset.' : 'Request a password reset link. If SMTP is configured, the link will be emailed to you.'}</p>

                    <form onSubmit={token ? handleConfirmReset : handleRequestReset} className={styles.form}>
                        <input
                            className={styles.input}
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                        {token ? (
                            <input
                                className={styles.input}
                                type="password"
                                placeholder="New password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                required
                            />
                        ) : null}
                        <button className={styles.button} type="submit" disabled={loading}>
                            {loading ? 'Please wait...' : token ? 'Reset Password' : 'Send Reset Link'}
                        </button>
                    </form>

                    {status ? <div className={styles.status}>{status}</div> : null}
                </div>
            </div>
        </div>
    );
}
