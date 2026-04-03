'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import gamesData from '@/data/games.json';
import useAuthStore from '@/store/authStore';
import useHydrated from '@/lib/useHydrated';
import styles from './page.module.css';

const EMPTY_APPLICATION = {
    displayName: '',
    contactEmail: '',
    contactHandle: '',
    payoutMethod: 'manual',
    payoutDetails: '',
    bio: '',
    note: '',
};

const EMPTY_LISTING = {
    gameSlug: 'arc-raiders',
    category: 'Items',
    subCategory: '',
    name: '',
    description: '',
    deliveryNote: '',
    packageLabel: '',
    packageSize: '1',
    packageUnit: 'bundle',
    price: '',
    stockQuantity: '1',
    platform: '',
    serverRegion: '',
    rarity: '',
    listingStatus: 'pending_review',
};

function formatMoney(value) {
    return `$${Number(value || 0).toFixed(2)}`;
}

function getOrderAction(order) {
    if (order.status === 'paid') return 'delivering';
    if (order.status === 'delivering') return 'delivered';
    return '';
}

export default function SellerPage() {
    const mounted = useHydrated();
    const { user, token, init: initAuth } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [sellerState, setSellerState] = useState({ profile: null, latestApplication: null, stats: null });
    const [listings, setListings] = useState([]);
    const [orders, setOrders] = useState([]);
    const [message, setMessage] = useState('');
    const [submittingApplication, setSubmittingApplication] = useState(false);
    const [submittingListing, setSubmittingListing] = useState(false);
    const [updatingOrder, setUpdatingOrder] = useState('');
    const [applicationForm, setApplicationForm] = useState(EMPTY_APPLICATION);
    const [listingForm, setListingForm] = useState(EMPTY_LISTING);

    const approved = sellerState.profile?.status === 'approved';
    const status = sellerState.profile?.status || 'not_applied';
    const games = useMemo(() => gamesData.games || [], []);

    useEffect(() => {
        initAuth();
    }, [initAuth]);

    const loadSellerState = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        try {
            const meRes = await fetch('/api/seller/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const meData = await meRes.json();
            if (!meRes.ok) {
                throw new Error(meData.error || 'Failed to load seller profile');
            }
            setSellerState(meData);
            setApplicationForm({
                displayName: meData.profile?.display_name || user?.username || '',
                contactEmail: meData.profile?.contact_email || user?.email || '',
                contactHandle: meData.profile?.contact_handle || '',
                payoutMethod: meData.profile?.payout_method || 'manual',
                payoutDetails: meData.profile?.payout_details || '',
                bio: meData.profile?.bio || '',
                note: '',
            });

            if (meData.profile?.status === 'approved') {
                const [listingsRes, ordersRes] = await Promise.all([
                    fetch('/api/seller/listings', { headers: { Authorization: `Bearer ${token}` } }),
                    fetch('/api/seller/orders', { headers: { Authorization: `Bearer ${token}` } }),
                ]);
                const [listingsData, ordersData] = await Promise.all([listingsRes.json(), ordersRes.json()]);
                if (listingsRes.ok) setListings(listingsData.listings || []);
                if (ordersRes.ok) setOrders(ordersData.orders || []);
            } else {
                setListings([]);
                setOrders([]);
            }
        } catch (error) {
            console.error('Seller page load error:', error);
            setMessage(error.message || 'Failed to load seller center');
        } finally {
            setLoading(false);
        }
    }, [token, user?.email, user?.username]);

    useEffect(() => {
        if (!token) return;
        loadSellerState();
    }, [token, loadSellerState]);

    const submitApplication = async () => {
        if (!token) return;
        setSubmittingApplication(true);
        setMessage('');
        try {
            const res = await fetch('/api/seller/application', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(applicationForm),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to submit application');
            }
            setMessage('Seller application submitted.');
            await loadSellerState();
        } catch (error) {
            setMessage(error.message || 'Failed to submit application');
        } finally {
            setSubmittingApplication(false);
        }
    };

    const createListing = async () => {
        if (!token) return;
        setSubmittingListing(true);
        setMessage('');
        try {
            const res = await fetch('/api/seller/listings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    ...listingForm,
                    price: Number(listingForm.price || 0),
                    stockQuantity: Number.parseInt(String(listingForm.stockQuantity || '0'), 10) || 0,
                    packageSize: Number.parseInt(String(listingForm.packageSize || '1'), 10) || 1,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to create listing');
            }
            setListingForm(EMPTY_LISTING);
            setMessage('Listing submitted for review.');
            await loadSellerState();
        } catch (error) {
            setMessage(error.message || 'Failed to create listing');
        } finally {
            setSubmittingListing(false);
        }
    };

    const updateSellerOrder = async (orderId, statusValue) => {
        if (!token || !statusValue) return;
        setUpdatingOrder(`${orderId}:${statusValue}`);
        setMessage('');
        try {
            const res = await fetch(`/api/seller/orders/${orderId}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ status: statusValue }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Failed to update order');
            }
            await loadSellerState();
        } catch (error) {
            setMessage(error.message || 'Failed to update order');
        } finally {
            setUpdatingOrder('');
        }
    };

    if (!mounted) return null;

    if (!user) {
        return (
            <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
                <h1>Please Log In</h1>
                <p style={{ color: 'var(--text-muted)', margin: '16px 0' }}>You need an account before applying to sell.</p>
                <Link href="/dashboard" className="btn btn-primary">Go to Dashboard</Link>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className="container">
                <div className={styles.hero}>
                    <div>
                        <p className={styles.eyebrow}>Marketplace</p>
                        <h1 className={styles.title}>Seller Center</h1>
                        <p className={styles.subtitle}>Apply as a seller, publish marketplace listings, track delivery, and monitor settlement readiness.</p>
                    </div>
                    <div className={`${styles.statusCard} ${styles[`status_${status}`] || ''}`}>
                        <span className={styles.statusLabel}>Seller Status</span>
                        <strong>{status.replaceAll('_', ' ')}</strong>
                    </div>
                </div>

                {message ? <div className={styles.notice}>{message}</div> : null}

                {loading ? <div className={styles.panel}>Loading seller center...</div> : null}

                {!loading && (
                    <>
                        <div className={styles.statsGrid}>
                            <div className={styles.statCard}>
                                <span className={styles.statLabel}>Listings</span>
                                <strong>{sellerState.stats?.listingCount || 0}</strong>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statLabel}>Marketplace Orders</span>
                                <strong>{sellerState.stats?.orderCount || 0}</strong>
                            </div>
                            <div className={styles.statCard}>
                                <span className={styles.statLabel}>Available Payouts</span>
                                <strong>{formatMoney(sellerState.stats?.availablePayouts || 0)}</strong>
                            </div>
                        </div>

                        {!approved ? (
                            <section className={styles.panel}>
                                <div className={styles.sectionHead}>
                                    <div>
                                        <h2>Seller Application</h2>
                                        <p>Submit your seller profile for marketplace review. Approved sellers can publish listings and fulfill orders.</p>
                                    </div>
                                </div>
                                <div className={styles.formGrid}>
                                    <label className={styles.field}>
                                        <span>Display Name</span>
                                        <input value={applicationForm.displayName} onChange={(e) => setApplicationForm((prev) => ({ ...prev, displayName: e.target.value }))} />
                                    </label>
                                    <label className={styles.field}>
                                        <span>Contact Email</span>
                                        <input value={applicationForm.contactEmail} onChange={(e) => setApplicationForm((prev) => ({ ...prev, contactEmail: e.target.value }))} />
                                    </label>
                                    <label className={styles.field}>
                                        <span>Contact Handle</span>
                                        <input value={applicationForm.contactHandle} onChange={(e) => setApplicationForm((prev) => ({ ...prev, contactHandle: e.target.value }))} placeholder="Discord / Telegram / WhatsApp" />
                                    </label>
                                    <label className={styles.field}>
                                        <span>Payout Method</span>
                                        <input value={applicationForm.payoutMethod} onChange={(e) => setApplicationForm((prev) => ({ ...prev, payoutMethod: e.target.value }))} />
                                    </label>
                                    <label className={`${styles.field} ${styles.fullWidth}`}>
                                        <span>Payout Details</span>
                                        <textarea rows={3} value={applicationForm.payoutDetails} onChange={(e) => setApplicationForm((prev) => ({ ...prev, payoutDetails: e.target.value }))} />
                                    </label>
                                    <label className={`${styles.field} ${styles.fullWidth}`}>
                                        <span>Bio</span>
                                        <textarea rows={4} value={applicationForm.bio} onChange={(e) => setApplicationForm((prev) => ({ ...prev, bio: e.target.value }))} />
                                    </label>
                                    <label className={`${styles.field} ${styles.fullWidth}`}>
                                        <span>Note to Review Team</span>
                                        <textarea rows={3} value={applicationForm.note} onChange={(e) => setApplicationForm((prev) => ({ ...prev, note: e.target.value }))} />
                                    </label>
                                </div>
                                {sellerState.profile?.review_note ? (
                                    <div className={styles.inlineNotice}>Latest review note: {sellerState.profile.review_note}</div>
                                ) : null}
                                <div className={styles.actions}>
                                    <button className="btn btn-primary" onClick={submitApplication} disabled={submittingApplication}>
                                        {submittingApplication ? 'Submitting...' : status === 'rejected' || status === 'suspended' ? 'Resubmit Application' : 'Submit Application'}
                                    </button>
                                </div>
                            </section>
                        ) : (
                            <>
                                <section className={styles.panel}>
                                    <div className={styles.sectionHead}>
                                        <div>
                                            <h2>Create Listing</h2>
                                            <p>Marketplace listings reuse the current product structure and enter review before going live.</p>
                                        </div>
                                    </div>
                                    <div className={styles.formGrid}>
                                        <label className={styles.field}>
                                            <span>Game</span>
                                            <select value={listingForm.gameSlug} onChange={(e) => setListingForm((prev) => ({ ...prev, gameSlug: e.target.value }))}>
                                                {games.map((game) => (
                                                    <option key={game.slug} value={game.slug}>{game.name}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className={styles.field}>
                                            <span>Category</span>
                                            <input value={listingForm.category} onChange={(e) => setListingForm((prev) => ({ ...prev, category: e.target.value }))} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Subcategory</span>
                                            <input value={listingForm.subCategory} onChange={(e) => setListingForm((prev) => ({ ...prev, subCategory: e.target.value }))} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Listing Name</span>
                                            <input value={listingForm.name} onChange={(e) => setListingForm((prev) => ({ ...prev, name: e.target.value }))} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Price (USD)</span>
                                            <input type="number" min="0" step="0.01" value={listingForm.price} onChange={(e) => setListingForm((prev) => ({ ...prev, price: e.target.value }))} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Stock Quantity</span>
                                            <input type="number" min="0" value={listingForm.stockQuantity} onChange={(e) => setListingForm((prev) => ({ ...prev, stockQuantity: e.target.value }))} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Platform</span>
                                            <input value={listingForm.platform} onChange={(e) => setListingForm((prev) => ({ ...prev, platform: e.target.value }))} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Server Region</span>
                                            <input value={listingForm.serverRegion} onChange={(e) => setListingForm((prev) => ({ ...prev, serverRegion: e.target.value }))} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Rarity</span>
                                            <input value={listingForm.rarity} onChange={(e) => setListingForm((prev) => ({ ...prev, rarity: e.target.value }))} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Package Label</span>
                                            <input value={listingForm.packageLabel} onChange={(e) => setListingForm((prev) => ({ ...prev, packageLabel: e.target.value }))} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Package Size</span>
                                            <input type="number" min="1" value={listingForm.packageSize} onChange={(e) => setListingForm((prev) => ({ ...prev, packageSize: e.target.value }))} />
                                        </label>
                                        <label className={styles.field}>
                                            <span>Listing State</span>
                                            <select value={listingForm.listingStatus} onChange={(e) => setListingForm((prev) => ({ ...prev, listingStatus: e.target.value }))}>
                                                <option value="pending_review">Pending Review</option>
                                                <option value="draft">Draft</option>
                                            </select>
                                        </label>
                                        <label className={`${styles.field} ${styles.fullWidth}`}>
                                            <span>Description</span>
                                            <textarea rows={4} value={listingForm.description} onChange={(e) => setListingForm((prev) => ({ ...prev, description: e.target.value }))} />
                                        </label>
                                        <label className={`${styles.field} ${styles.fullWidth}`}>
                                            <span>Delivery Note</span>
                                            <textarea rows={3} value={listingForm.deliveryNote} onChange={(e) => setListingForm((prev) => ({ ...prev, deliveryNote: e.target.value }))} />
                                        </label>
                                    </div>
                                    <div className={styles.actions}>
                                        <button className="btn btn-primary" onClick={createListing} disabled={submittingListing}>
                                            {submittingListing ? 'Submitting...' : 'Create Listing'}
                                        </button>
                                    </div>
                                </section>

                                <section className={styles.panel}>
                                    <div className={styles.sectionHead}>
                                        <div>
                                            <h2>My Listings</h2>
                                            <p>Published listings appear in the public catalog alongside platform items, with marketplace badges.</p>
                                        </div>
                                    </div>
                                    <div className={styles.listGrid}>
                                        {listings.length === 0 ? <div className={styles.empty}>No listings yet.</div> : listings.map((listing) => (
                                            <div key={listing.id} className={styles.listCard}>
                                                <div className={styles.listCardTop}>
                                                    <h3>{listing.name}</h3>
                                                    <span className={`${styles.badge} ${styles[`badge_${listing.listing_status}`] || ''}`}>{listing.listing_status}</span>
                                                </div>
                                                <p>{listing.game_slug} · {listing.category}{listing.sub_category ? ` · ${listing.sub_category}` : ''}</p>
                                                <div className={styles.metaRow}>
                                                    <span>{formatMoney(listing.price)}</span>
                                                    <span>Stock {listing.stock_quantity}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className={styles.panel}>
                                    <div className={styles.sectionHead}>
                                        <div>
                                            <h2>Seller Orders</h2>
                                            <p>Seller-managed orders move from paid to delivering to delivered. Buyer confirmation or timeout completes settlement.</p>
                                        </div>
                                    </div>
                                    <div className={styles.table}>
                                        <div className={styles.tableHead}>
                                            <span>Order</span>
                                            <span>Buyer</span>
                                            <span>Items</span>
                                            <span>Status</span>
                                            <span>Settlement</span>
                                            <span>Action</span>
                                        </div>
                                        {orders.length === 0 ? <div className={styles.empty}>No marketplace orders yet.</div> : orders.map((order) => {
                                            const nextStatus = getOrderAction(order);
                                            return (
                                                <div key={order.id} className={styles.tableRow}>
                                                    <span>{order.order_no}</span>
                                                    <span>{order.buyer_username || order.buyer_email}</span>
                                                    <span>{order.items?.map((item) => `${item.product_name} ×${item.quantity}`).join(', ') || '-'}</span>
                                                    <span>{order.status}</span>
                                                    <span>{order.settlement_status || 'pending'}</span>
                                                    <span>
                                                        {nextStatus ? (
                                                            <button
                                                                className={styles.inlineButton}
                                                                disabled={updatingOrder === `${order.id}:${nextStatus}`}
                                                                onClick={() => updateSellerOrder(order.id, nextStatus)}
                                                            >
                                                                {nextStatus === 'delivering' ? 'Start Delivery' : 'Mark Delivered'}
                                                            </button>
                                                        ) : '—'}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
