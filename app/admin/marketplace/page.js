'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/authStore';
import useHydrated from '@/lib/useHydrated';
import styles from './page.module.css';

function formatMoney(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}

export default function AdminMarketplacePage() {
    const mounted = useHydrated();
    const { user, token, init: initAuth } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [sellers, setSellers] = useState([]);
    const [listings, setListings] = useState([]);
    const [payouts, setPayouts] = useState([]);
    const [disputes, setDisputes] = useState([]);
    const [busyAction, setBusyAction] = useState('');

    useEffect(() => {
        initAuth();
    }, [initAuth]);

    const loadData = useCallback(async () => {
        if (!token || user?.role !== 'admin') return;
        setLoading(true);
        try {
            const [sellerRes, listingRes, payoutRes, orderRes] = await Promise.all([
                fetch('/api/admin/sellers', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/admin/marketplace-listings', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/admin/payouts', { headers: { Authorization: `Bearer ${token}` } }),
                fetch('/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } }),
            ]);
            const [sellerData, listingData, payoutData, orderData] = await Promise.all([
                sellerRes.json(),
                listingRes.json(),
                payoutRes.json(),
                orderRes.json(),
            ]);

            if (!sellerRes.ok) throw new Error(sellerData.error || 'Failed to load sellers');
            if (!listingRes.ok) throw new Error(listingData.error || 'Failed to load listings');
            if (!payoutRes.ok) throw new Error(payoutData.error || 'Failed to load payouts');
            if (!orderRes.ok) throw new Error(orderData.error || 'Failed to load orders');

            setSellers(sellerData.sellers || []);
            setListings(listingData.listings || []);
            setPayouts(payoutData.payouts || []);
            setDisputes((orderData.orders || []).filter((order) => order.order_source === 'marketplace' && order.dispute_status === 'open'));
        } catch (error) {
            console.error('Admin marketplace load error:', error);
            setMessage(error.message || 'Failed to load marketplace operations');
        } finally {
            setLoading(false);
        }
    }, [token, user?.role]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const runAction = async ({ key, url, body }) => {
        if (!token) return;
        setBusyAction(key);
        setMessage('');
        try {
            const res = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Action failed');
            }
            await loadData();
        } catch (error) {
            setMessage(error.message || 'Action failed');
        } finally {
            setBusyAction('');
        }
    };

    if (!mounted) return null;

    if (!user || user.role !== 'admin') {
        return (
            <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
                <h1>Admin Access Required</h1>
                <p style={{ color: 'var(--text-muted)', margin: '16px 0' }}>Marketplace operations are only available to admin users.</p>
                <Link href="/admin" className="btn btn-primary">Back to Admin</Link>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className="container">
                <div className={styles.hero}>
                    <div>
                        <p className={styles.eyebrow}>Marketplace Ops</p>
                        <h1 className={styles.title}>Marketplace Review Console</h1>
                        <p className={styles.subtitle}>Review seller applications, approve marketplace listings, resolve disputes, and mark seller payouts as paid.</p>
                    </div>
                    <Link href="/admin" className={styles.backLink}>Back to Admin</Link>
                </div>

                {message ? <div className={styles.notice}>{message}</div> : null}
                {loading ? <div className={styles.panel}>Loading marketplace operations...</div> : null}

                {!loading && (
                    <>
                        <section className={styles.panel}>
                            <div className={styles.sectionHead}>
                                <div>
                                    <h2>Seller Applications</h2>
                                    <p>Approve, reject, or suspend marketplace sellers without changing staff roles.</p>
                                </div>
                            </div>
                            <div className={styles.table}>
                                <div className={styles.tableHead}>
                                    <span>Seller</span>
                                    <span>Status</span>
                                    <span>Contact</span>
                                    <span>Applied</span>
                                    <span>Actions</span>
                                </div>
                                {sellers.length === 0 ? <div className={styles.empty}>No seller profiles yet.</div> : sellers.map((seller) => (
                                    <div key={seller.user_id} className={styles.tableRow}>
                                        <span>{seller.display_name || seller.username}</span>
                                        <span><span className={`${styles.badge} ${styles[`badge_${seller.status}`] || ''}`}>{seller.status}</span></span>
                                        <span>{seller.contact_email || seller.email}</span>
                                        <span>{seller.applied_at?.slice(0, 10) || '-'}</span>
                                        <span className={styles.actions}>
                                            <button className={styles.inlineBlue} disabled={busyAction === `seller:${seller.user_id}:approved`} onClick={() => runAction({ key: `seller:${seller.user_id}:approved`, url: `/api/admin/sellers/${seller.user_id}/status`, body: { status: 'approved' } })}>Approve</button>
                                            <button className={styles.inlineWarn} disabled={busyAction === `seller:${seller.user_id}:rejected`} onClick={() => runAction({ key: `seller:${seller.user_id}:rejected`, url: `/api/admin/sellers/${seller.user_id}/status`, body: { status: 'rejected' } })}>Reject</button>
                                            <button className={styles.inlineWarn} disabled={busyAction === `seller:${seller.user_id}:suspended`} onClick={() => runAction({ key: `seller:${seller.user_id}:suspended`, url: `/api/admin/sellers/${seller.user_id}/status`, body: { status: 'suspended' } })}>Suspend</button>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className={styles.panel}>
                            <div className={styles.sectionHead}>
                                <div>
                                    <h2>Marketplace Listings</h2>
                                    <p>Only published listings become visible in the public catalog and product detail pages.</p>
                                </div>
                            </div>
                            <div className={styles.table}>
                                <div className={styles.tableHead}>
                                    <span>Listing</span>
                                    <span>Seller</span>
                                    <span>Price</span>
                                    <span>Status</span>
                                    <span>Actions</span>
                                </div>
                                {listings.length === 0 ? <div className={styles.empty}>No marketplace listings yet.</div> : listings.map((listing) => (
                                    <div key={listing.id} className={styles.tableRow}>
                                        <span>{listing.name}</span>
                                        <span>{listing.seller_display_name || listing.seller_username || `Seller #${listing.seller_user_id}`}</span>
                                        <span>{formatMoney(listing.price)}</span>
                                        <span><span className={`${styles.badge} ${styles[`badge_${listing.listing_status}`] || ''}`}>{listing.listing_status}</span></span>
                                        <span className={styles.actions}>
                                            <button className={styles.inlineBlue} disabled={busyAction === `listing:${listing.id}:published`} onClick={() => runAction({ key: `listing:${listing.id}:published`, url: `/api/admin/marketplace-listings/${listing.id}/review`, body: { listingStatus: 'published' } })}>Publish</button>
                                            <button className={styles.inlineWarn} disabled={busyAction === `listing:${listing.id}:rejected`} onClick={() => runAction({ key: `listing:${listing.id}:rejected`, url: `/api/admin/marketplace-listings/${listing.id}/review`, body: { listingStatus: 'rejected' } })}>Reject</button>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className={styles.panel}>
                            <div className={styles.sectionHead}>
                                <div>
                                    <h2>Open Disputes</h2>
                                    <p>Marketplace disputes block settlement until an admin resolves the order to completed or refunded.</p>
                                </div>
                            </div>
                            <div className={styles.table}>
                                <div className={styles.tableHead}>
                                    <span>Order</span>
                                    <span>Buyer</span>
                                    <span>Seller</span>
                                    <span>Status</span>
                                    <span>Actions</span>
                                </div>
                                {disputes.length === 0 ? <div className={styles.empty}>No open disputes.</div> : disputes.map((order) => (
                                    <div key={order.id} className={styles.tableRow}>
                                        <span>{order.order_no}</span>
                                        <span>{order.user_email || order.delivery_email || `Buyer #${order.user_id}`}</span>
                                        <span>{order.seller_display_name || order.seller_username || (order.seller_user_id ? `Seller #${order.seller_user_id}` : '-')}</span>
                                        <span>{order.status} / {order.dispute_status}</span>
                                        <span className={styles.actions}>
                                            <button className={styles.inlineBlue} disabled={busyAction === `dispute:${order.id}:completed`} onClick={() => runAction({ key: `dispute:${order.id}:completed`, url: `/api/orders/${order.id}/status`, body: { status: 'completed', note: 'Admin resolved dispute and completed order.' } })}>Resolve Complete</button>
                                            <button className={styles.inlineWarn} disabled={busyAction === `dispute:${order.id}:refunded`} onClick={() => runAction({ key: `dispute:${order.id}:refunded`, url: `/api/orders/${order.id}/status`, body: { status: 'refunded', note: 'Admin resolved dispute with refund.' } })}>Refund</button>
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className={styles.panel}>
                            <div className={styles.sectionHead}>
                                <div>
                                    <h2>Seller Payouts</h2>
                                    <p>V1 uses platform-collected payments and manual seller payout tracking.</p>
                                </div>
                            </div>
                            <div className={styles.table}>
                                <div className={styles.tableHead}>
                                    <span>Order</span>
                                    <span>Seller</span>
                                    <span>Net</span>
                                    <span>Status</span>
                                    <span>Action</span>
                                </div>
                                {payouts.length === 0 ? <div className={styles.empty}>No seller payouts yet.</div> : payouts.map((payout) => (
                                    <div key={payout.id} className={styles.tableRow}>
                                        <span>{payout.order_no}</span>
                                        <span>{payout.seller_username}</span>
                                        <span>{formatMoney(payout.net_amount)}</span>
                                        <span><span className={`${styles.badge} ${styles[`badge_${payout.status}`] || ''}`}>{payout.status}</span></span>
                                        <span className={styles.actions}>
                                            {payout.status !== 'paid' ? (
                                                <button className={styles.inlineBlue} disabled={busyAction === `payout:${payout.id}:paid`} onClick={() => runAction({ key: `payout:${payout.id}:paid`, url: `/api/admin/payouts/${payout.id}`, body: { status: 'paid', note: 'Manual payout recorded by admin.' } })}>Mark Paid</button>
                                            ) : '—'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
