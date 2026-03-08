'use client';

import { useState, useEffect } from 'react';
import useAuthStore from '@/store/authStore';
import styles from './page.module.css';

export default function AffiliatePage() {
    const [copied, setCopied] = useState(false);
    const [stats, setStats] = useState(null);
    const [commissions, setCommissions] = useState([]);
    const [mounted, setMounted] = useState(false);

    const { user, token, init: initAuth } = useAuthStore();

    useEffect(() => {
        setMounted(true);
        initAuth();
    }, [initAuth]);

    useEffect(() => {
        if (!token) return;
        fetchStats();
        fetchCommissions();
    }, [token]);

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/affiliate/stats', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Failed to fetch affiliate stats:', err);
        }
    };

    const fetchCommissions = async () => {
        try {
            const res = await fetch('/api/affiliate/commissions', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setCommissions(data.commissions || []);
            }
        } catch (err) {
            console.error('Failed to fetch commissions:', err);
        }
    };

    const referralLink = stats?.referral_link || `https://iggm.com/?ref=${user?.referral_code || ''}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!mounted) return null;

    return (
        <div className={styles.affiliatePage}>
            <div className="container">
                <h1 className={styles.title}>Affiliate Program</h1>
                <p className={styles.subtitle}>Earn 10% commission on every purchase made through your referral link!</p>

                {/* Stats Cards */}
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>💰</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statValue}>${stats?.total_earnings?.toFixed(2) || '0.00'}</span>
                            <span className={styles.statLabel}>Total Earnings</span>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>👥</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statValue}>{stats?.total_referrals || 0}</span>
                            <span className={styles.statLabel}>Total Referrals</span>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>⏳</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statValue}>${stats?.pending_earnings?.toFixed(2) || '0.00'}</span>
                            <span className={styles.statLabel}>Pending Commission</span>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <div className={styles.statIcon}>📈</div>
                        <div className={styles.statInfo}>
                            <span className={styles.statValue}>10%</span>
                            <span className={styles.statLabel}>Commission Rate</span>
                        </div>
                    </div>
                </div>

                {/* Referral Link */}
                <div className={styles.linkCard}>
                    <h3>Your Referral Link</h3>
                    <div className={styles.linkRow}>
                        <input type="text" value={referralLink} readOnly className={styles.linkInput} />
                        <button className={`btn btn-primary ${styles.copyBtn}`} onClick={handleCopy}>
                            {copied ? '✓ Copied!' : 'Copy Link'}
                        </button>
                    </div>
                    <p className={styles.linkNote}>Share this link with your friends. You&apos;ll earn 10% of their first purchase.</p>
                </div>

                {/* Referral History */}
                <div className={styles.historyCard}>
                    <h3>Referral History</h3>
                    {commissions.length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No referrals yet. Share your link to start earning!
                        </div>
                    ) : (
                        <div className={styles.historyTable}>
                            <div className={styles.historyHeader}>
                                <span>Order</span>
                                <span>Date</span>
                                <span>Order Amount</span>
                                <span>Commission</span>
                                <span>Status</span>
                            </div>
                            {commissions.map((c) => (
                                <div key={c.id} className={styles.historyRow}>
                                    <span>{c.order_no || `#${c.order_id}`}</span>
                                    <span className={styles.histDate}>{c.created_at?.substring(0, 10)}</span>
                                    <span>${c.order_amount?.toFixed(2)}</span>
                                    <span className={styles.commission}>${c.commission_amount?.toFixed(2)}</span>
                                    <span className={`${styles.refStatus} ${c.status === 'paid' ? styles.paid : styles.pending}`}>
                                        {c.status === 'paid' ? 'Paid' : 'Pending'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* How It Works */}
                <div className={styles.howItWorks}>
                    <h3>How It Works</h3>
                    <div className={styles.stepsGrid}>
                        <div className={styles.stepCard}>
                            <div className={styles.stepNum}>1</div>
                            <h4>Share Your Link</h4>
                            <p>Copy your unique referral link and share it on social media, forums, or with friends.</p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepNum}>2</div>
                            <h4>Friends Sign Up</h4>
                            <p>When someone clicks your link and creates an account, they&apos;re tied to your referral.</p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepNum}>3</div>
                            <h4>Earn Commission</h4>
                            <p>You earn 10% commission on every purchase they make. Withdraw anytime!</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
