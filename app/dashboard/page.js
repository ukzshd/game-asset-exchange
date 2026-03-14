'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/authStore';
import useHydrated from '@/lib/useHydrated';
import styles from './page.module.css';

export default function DashboardPage() {
    const [activeTab, setActiveTab] = useState('orders');
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const mounted = useHydrated();

    const { user, token, init: initAuth, updateProfile, changePassword } = useAuthStore();

    // Settings form state
    const [profileForm, setProfileForm] = useState({ username: '', embark_id: '', phone: '' });
    const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
    const [saveMsg, setSaveMsg] = useState('');

    useEffect(() => {
        initAuth();
    }, [initAuth]);

    useEffect(() => {
        if (!token) return;
        const loadOrders = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/orders', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setOrders(data.orders || []);
                }
            } catch (err) {
                console.error('Failed to fetch orders:', err);
            } finally {
                setLoading(false);
            }
        };

        loadOrders();
    }, [token]);

    // Init profile form when user loads
    useEffect(() => {
        if (user) {
            setProfileForm({ username: user.username || '', embark_id: user.embark_id || '', phone: user.phone || '' });
        }
    }, [user]);

    const getStatusBadge = (status) => {
        const map = {
            pending_payment: { label: 'Pending Payment', cls: styles.statusProcessing },
            payment_failed: { label: 'Payment Failed', cls: styles.statusRefunded },
            paid: { label: 'Paid', cls: styles.statusDelivered },
            assigned: { label: 'Assigned', cls: styles.statusProcessing },
            delivering: { label: 'Delivering', cls: styles.statusProcessing },
            delivered: { label: 'Delivered', cls: styles.statusDelivered },
            completed: { label: 'Completed', cls: styles.statusCompleted },
            refunded: { label: 'Refunded', cls: styles.statusRefunded },
            cancelled: { label: 'Cancelled', cls: styles.statusRefunded },
        };
        const s = map[status] || map.pending_payment;
        return <span className={`${styles.statusBadge} ${s.cls}`}>{s.label}</span>;
    };

    const handleSaveProfile = async () => {
        const ok = await updateProfile(profileForm);
        setSaveMsg(ok ? 'Profile saved!' : 'Failed to save');
        setTimeout(() => setSaveMsg(''), 3000);
    };

    const handleChangePassword = async () => {
        if (!passwordForm.currentPassword || !passwordForm.newPassword) return;
        const ok = await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
        setSaveMsg(ok ? 'Password updated!' : 'Failed to update password');
        setPasswordForm({ currentPassword: '', newPassword: '' });
        setTimeout(() => setSaveMsg(''), 3000);
    };

    if (!mounted) return null;

    if (!user) {
        return (
            <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
                <h1>Please Log In</h1>
                <p style={{ color: 'var(--text-muted)', margin: '16px 0' }}>You need to log in to access your dashboard.</p>
                <Link href="/" className="btn btn-primary">← Go Home</Link>
            </div>
        );
    }

    return (
        <div className={styles.dashboard}>
            <div className="container">
                <div className={styles.layout}>
                    {/* Sidebar */}
                    <aside className={styles.sidebar}>
                        <div className={styles.userCard}>
                            <div className={styles.avatar}>👤</div>
                            <div>
                                <h3>{user.username}</h3>
                                <span className={styles.memberBadge}>{user.role === 'admin' ? 'Admin' : 'VIP Member'}</span>
                            </div>
                        </div>
                        <nav className={styles.sideNav}>
                            <button className={`${styles.sideNavItem} ${activeTab === 'orders' ? styles.sideNavActive : ''}`} onClick={() => setActiveTab('orders')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></svg>
                                My Orders
                            </button>
                            <button className={`${styles.sideNavItem} ${activeTab === 'settings' ? styles.sideNavActive : ''}`} onClick={() => setActiveTab('settings')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                                Account Settings
                            </button>
                            <Link href="/affiliate" className={styles.sideNavItem}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6M23 11h-6" /></svg>
                                Affiliate Program
                            </Link>
                        </nav>
                    </aside>

                    {/* Main Content */}
                    <main className={styles.main}>
                        {activeTab === 'orders' && (
                            <>
                                <h1 className={styles.pageTitle}>My Orders</h1>
                                <div className={styles.orderStats}>
                                    <div className={styles.statCard}>
                                        <span className={styles.statValue}>{orders.length}</span>
                                        <span className={styles.statLabel}>Total Orders</span>
                                    </div>
                                    <div className={styles.statCard}>
                                        <span className={styles.statValue}>${orders.reduce((s, o) => s + (o.status !== 'refunded' ? o.total : 0), 0).toFixed(2)}</span>
                                        <span className={styles.statLabel}>Total Spent</span>
                                    </div>
                                    <div className={styles.statCard}>
                                        <span className={styles.statValue}>{orders.filter(o => ['pending_payment', 'paid', 'assigned', 'delivering'].includes(o.status)).length}</span>
                                        <span className={styles.statLabel}>In Progress</span>
                                    </div>
                                </div>

                                {loading ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading orders...</div>
                                ) : orders.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                        <p>No orders yet.</p>
                                        <Link href="/" className="btn btn-primary" style={{ marginTop: '16px', display: 'inline-flex' }}>Start Shopping</Link>
                                    </div>
                                ) : (
                                    <div className={styles.ordersTable}>
                                        <div className={styles.tableHeader}>
                                            <span>Order ID</span>
                                            <span>Date</span>
                                            <span>Items</span>
                                            <span>Amount</span>
                                            <span>Status</span>
                                        </div>
                                        {orders.map((order) => (
                                            <div key={order.id} className={styles.tableRow}>
                                                <span className={styles.orderId}>{order.order_no}</span>
                                                <span className={styles.orderDate}>{order.created_at?.split('T')[0] || order.created_at?.substring(0, 10)}</span>
                                                <span className={styles.orderItem}>{order.items?.map(i => i.product_name).join(', ') || '-'}</span>
                                                <span className={styles.orderAmount}>${order.total?.toFixed(2)}</span>
                                                <span>{getStatusBadge(order.status)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {activeTab === 'settings' && (
                            <>
                                <h1 className={styles.pageTitle}>Account Settings</h1>
                                {saveMsg && <div style={{ padding: '10px 16px', background: 'rgba(34,197,94,0.12)', color: 'var(--accent-green)', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>{saveMsg}</div>}
                                <div className={styles.settingsCard}>
                                    <h3>Profile Information</h3>
                                    <div className={styles.settingsGrid}>
                                        <div className={styles.field}>
                                            <label>Email</label>
                                            <input type="email" value={user.email} className={styles.input} disabled />
                                        </div>
                                        <div className={styles.field}>
                                            <label>Username</label>
                                            <input type="text" value={profileForm.username} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} className={styles.input} />
                                        </div>
                                        <div className={styles.field}>
                                            <label>Default Embark ID</label>
                                            <input type="text" value={profileForm.embark_id} onChange={(e) => setProfileForm({ ...profileForm, embark_id: e.target.value })} placeholder="Your Embark ID" className={styles.input} />
                                        </div>
                                        <div className={styles.field}>
                                            <label>Phone</label>
                                            <input type="tel" value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} placeholder="Phone number" className={styles.input} />
                                        </div>
                                    </div>
                                    <button className="btn btn-primary" style={{ marginTop: '20px' }} onClick={handleSaveProfile}>Save Changes</button>
                                </div>
                                <div className={styles.settingsCard}>
                                    <h3>Change Password</h3>
                                    <div className={styles.settingsGrid}>
                                        <div className={styles.field}>
                                            <label>Current Password</label>
                                            <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} placeholder="••••••••" className={styles.input} />
                                        </div>
                                        <div className={styles.field}>
                                            <label>New Password</label>
                                            <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} placeholder="••••••••" className={styles.input} />
                                        </div>
                                    </div>
                                    <button className="btn btn-secondary" style={{ marginTop: '20px' }} onClick={handleChangePassword}>Update Password</button>
                                </div>

                                <div className={styles.settingsCard}>
                                    <h3>Referral Code</h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '8px' }}>Share your referral code to earn 10% commission:</p>
                                    <code style={{ background: 'var(--bg-input)', padding: '8px 16px', borderRadius: '8px', color: 'var(--accent-cyan)', fontSize: '1.1rem', fontWeight: '600' }}>{user.referral_code}</code>
                                </div>
                            </>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}
