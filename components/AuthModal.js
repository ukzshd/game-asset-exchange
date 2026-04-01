'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/authStore';
import styles from './AuthModal.module.css';

export default function AuthModal({ initialTab = 'login', onClose }) {
    const [tab, setTab] = useState(initialTab);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [verifyCode, setVerifyCode] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [localError, setLocalError] = useState('');
    const [localMessage, setLocalMessage] = useState('');

    const { login, register, sendVerificationCode, loading, error } = useAuthStore();

    const handleOAuthStart = (provider) => {
        const returnTo = typeof window !== 'undefined'
            ? `${window.location.pathname}${window.location.search}`
            : '/';
        window.location.href = `/api/auth/oauth/${provider}?returnTo=${encodeURIComponent(returnTo)}`;
    };

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEsc);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleSendCode = () => {
        if (!email || countdown > 0) return;
        setLocalError('');
        setLocalMessage('');
        sendVerificationCode(email, tab === 'login' ? 'login' : 'register').then((result) => {
            if (result.success) {
                setLocalMessage(result.message);
                setCountdown(60);
            } else {
                setLocalError(result.message);
            }
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError('');
        setLocalMessage('');

        if (tab === 'login') {
            const success = await login(email, password, verifyCode);
            if (success) onClose();
        } else {
            if (password !== confirmPassword) {
                setLocalError('Passwords do not match');
                return;
            }
            if (!username.trim()) {
                setLocalError('Username is required');
                return;
            }
            if (!verifyCode.trim()) {
                setLocalError('Verification code is required');
                return;
            }
            const success = await register(email, password, username, verifyCode);
            if (success) onClose();
        }
    };

    const displayError = localError || error;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeBtn} onClick={onClose}>×</button>

                {/* Tabs */}
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${tab === 'login' ? styles.activeTab : ''}`}
                        onClick={() => { setTab('login'); setLocalError(''); }}
                    >
                        Log In
                    </button>
                    <button
                        className={`${styles.tab} ${tab === 'register' ? styles.activeTab : ''}`}
                        onClick={() => { setTab('register'); setLocalError(''); }}
                    >
                        Sign Up
                    </button>
                </div>

                {/* Error Message */}
                {displayError && (
                    <div className={styles.errorMsg}>{displayError}</div>
                )}
                {localMessage && (
                    <div className={styles.successMsg}>{localMessage}</div>
                )}

                <form className={styles.form} onSubmit={handleSubmit}>
                    {/* Email */}
                    <div className={styles.field}>
                        <div className={styles.inputWrapper}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.fieldIcon}>
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                            <input
                                type="email"
                                placeholder="Email Address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={styles.input}
                                required
                            />
                        </div>
                    </div>

                    {/* Username (Register only) */}
                    {tab === 'register' && (
                        <div className={styles.field}>
                            <div className={styles.inputWrapper}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.fieldIcon}>
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                                <input
                                    type="text"
                                    placeholder="Username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className={styles.input}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {/* Verification Code */}
                    <div className={styles.field}>
                        <div className={styles.inputWrapper}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.fieldIcon}>
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <input
                                type="text"
                                placeholder={tab === 'login' ? 'Verification Code (optional)' : 'Verification Code'}
                                value={verifyCode}
                                onChange={(e) => setVerifyCode(e.target.value)}
                                className={styles.input}
                            />
                            <button
                                type="button"
                                className={styles.sendCodeBtn}
                                onClick={handleSendCode}
                                disabled={countdown > 0 || loading}
                            >
                                {countdown > 0 ? `${countdown}s` : 'Send'}
                            </button>
                        </div>
                    </div>

                    {/* Password */}
                    <div className={styles.field}>
                        <div className={styles.inputWrapper}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.fieldIcon}>
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <input
                                type="password"
                                placeholder={tab === 'login' ? 'Password (optional if using code)' : 'Password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={styles.input}
                                required={tab !== 'login' || !verifyCode}
                            />
                        </div>
                    </div>

                    {/* Confirm Password (Register only) */}
                    {tab === 'register' && (
                        <div className={styles.field}>
                            <div className={styles.inputWrapper}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.fieldIcon}>
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                                <input
                                    type="password"
                                    placeholder="Confirm Password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={styles.input}
                                />
                            </div>
                        </div>
                    )}

                    {/* Terms (Register) */}
                    {tab === 'register' && (
                        <div className={styles.terms}>
                            <label className={styles.checkboxLabel}>
                                <input type="checkbox" required />
                                <span>I agree to the Terms and Conditions and Privacy Policy.</span>
                            </label>
                        </div>
                    )}

                    {/* Submit */}
                    <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
                        {loading ? 'Please wait...' : (tab === 'login' ? 'Log In' : 'Sign Up')}
                    </button>

                    {/* Forgot Password */}
                    {tab === 'login' && (
                        <Link href="/forgot-password" className={styles.forgotLink}>
                            Forgot your password?
                        </Link>
                    )}

                    {/* Social Login */}
                    <div className={styles.socialDivider}>
                        <span>or continue with social networks</span>
                    </div>

                    <div className={styles.socialButtons}>
                        <button type="button" className={styles.socialBtn} title="Google" onClick={() => handleOAuthStart('google')}>
                            <svg viewBox="0 0 24 24" width="22" height="22">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                            </svg>
                        </button>
                        <button type="button" className={styles.socialBtn} title="Discord" onClick={() => handleOAuthStart('discord')}>
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="#5865F2">
                                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                            </svg>
                        </button>
                        <button type="button" className={styles.socialBtn} title="Steam" onClick={() => handleOAuthStart('steam')}>
                            <svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff">
                                <path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 12.021-5.373 12.021-12C24 5.373 18.606 0 11.979 0z" />
                            </svg>
                        </button>
                    </div>

                    {/* Toggle tab */}
                    <div className={styles.toggleTab}>
                        {tab === 'login' ? (
                            <button type="button" onClick={() => setTab('register')}>
                                Sign up now
                            </button>
                        ) : (
                            <button type="button" onClick={() => setTab('login')}>
                                Sign in
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}
