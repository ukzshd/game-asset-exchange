'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/authStore';
import styles from './page.module.css';

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState('orders');
    const [orders, setOrders] = useState([]);
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, totalUsers: 0, pendingOrders: 0 });
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    const { user, token, init: initAuth } = useAuthStore();

    useEffect(() => {
        setMounted(true);
        initAuth();
    }, [initAuth]);

    useEffect(() => {
        if (!token || !user) return;
        if (user.role !== 'admin') return;
        fetchOrders();
        fetchUsers();
    }, [token, user]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/orders', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setOrders(data.orders || []);
                const total = data.orders?.length || 0;
                const revenue = data.orders?.reduce((s, o) => s + (o.status !== 'refunded' ? o.total : 0), 0) || 0;
                const pending = data.orders?.filter(o => ['pending', 'paid'].includes(o.status)).length || 0;
                setStats(prev => ({ ...prev, totalOrders: total, totalRevenue: revenue, pendingOrders: pending }));
            }
        } catch (err) {
            console.error('Failed to fetch orders:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('/api/admin/users', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || []);
                setStats(prev => ({ ...prev, totalUsers: data.total || 0 }));
            }
        } catch (err) {
            console.error('Failed to fetch users:', err);
        }
    };

    const updateOrderStatus = async (orderId, newStatus) => {
        try {
            const res = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                fetchOrders();
            }
        } catch (err) {
            console.error('Failed to update order:', err);
        }
    };

    if (!mounted) return null;

    if (!user) {
        return (
            <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
                <h1>Please Log In</h1>
                <p style={{ color: 'var(--text-muted)', margin: '16px 0' }}>Admin access required.</p>
                <Link href="/" className="btn btn-primary">← Go Home</Link>
            </div>
        );
    }

    if (user.role !== 'admin') {
        return (
            <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
                <h1>🚫 Access Denied</h1>
                <p style={{ color: 'var(--text-muted)', margin: '16px 0' }}>This page is only accessible to administrators.</p>
                <Link href="/" className="btn btn-primary">← Go Home</Link>
            </div>
        );
    }

    return (
        <div className={styles.adminPage}>
            <div className="container">
                <h1 className={styles.title}>⚙️ Admin Panel</h1>

                {/* Stats */}
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <span className={styles.statIcon}>📦</span>
                        <div>
                            <span className={styles.statValue}>{stats.totalOrders}</span>
                            <span className={styles.statLabel}>Total Orders</span>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statIcon}>💰</span>
                        <div>
                            <span className={styles.statValue}>${stats.totalRevenue.toFixed(2)}</span>
                            <span className={styles.statLabel}>Total Revenue</span>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statIcon}>👥</span>
                        <div>
                            <span className={styles.statValue}>{stats.totalUsers}</span>
                            <span className={styles.statLabel}>Total Users</span>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statIcon}>⏳</span>
                        <div>
                            <span className={styles.statValue}>{stats.pendingOrders}</span>
                            <span className={styles.statLabel}>Pending Orders</span>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    <button className={`${styles.tab} ${activeTab === 'orders' ? styles.tabActive : ''}`} onClick={() => setActiveTab('orders')}>
                        📋 Order Management
                    </button>
                    <button className={`${styles.tab} ${activeTab === 'users' ? styles.tabActive : ''}`} onClick={() => setActiveTab('users')}>
                        👥 User Management
                    </button>
                </div>

                {/* Orders Tab */}
                {activeTab === 'orders' && (
                    <div className={styles.tableCard}>
                        {loading ? (
                            <div className={styles.emptyState}>Loading orders...</div>
                        ) : orders.length === 0 ? (
                            <div className={styles.emptyState}>No orders yet.</div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Order No.</th>
                                            <th>Customer</th>
                                            <th>Items</th>
                                            <th>Amount</th>
                                            <th>Embark ID</th>
                                            <th>Status</th>
                                            <th>Date</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders.map((order) => (
                                            <tr key={order.id}>
                                                <td className={styles.orderNo}>{order.order_no}</td>
                                                <td>
                                                    <div className={styles.customer}>
                                                        <span className={styles.customerName}>{order.username || 'Unknown'}</span>
                                                        <span className={styles.customerEmail}>{order.user_email || ''}</span>
                                                    </div>
                                                </td>
                                                <td className={styles.itemsList}>
                                                    {order.items?.map((item, i) => (
                                                        <span key={i}>{item.product_name} ×{item.quantity}</span>
                                                    )).reduce((prev, curr, i) => i === 0 ? [curr] : [...prev, ', ', curr], [])}
                                                </td>
                                                <td className={styles.amount}>${order.total?.toFixed(2)}</td>
                                                <td className={styles.embarkId}>{order.embark_id || '-'}</td>
                                                <td>
                                                    <span className={`${styles.statusBadge} ${styles[`status_${order.status}`]}`}>
                                                        {order.status}
                                                    </span>
                                                </td>
                                                <td className={styles.date}>{order.created_at?.substring(0, 10)}</td>
                                                <td>
                                                    <select
                                                        className={styles.statusSelect}
                                                        value={order.status}
                                                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                                    >
                                                        <option value="pending">Pending</option>
                                                        <option value="paid">Paid</option>
                                                        <option value="processing">Processing</option>
                                                        <option value="delivered">Delivered</option>
                                                        <option value="completed">Completed</option>
                                                        <option value="refunded">Refunded</option>
                                                        <option value="cancelled">Cancelled</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className={styles.tableCard}>
                        {users.length === 0 ? (
                            <div className={styles.emptyState}>No users yet.</div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Username</th>
                                            <th>Email</th>
                                            <th>Role</th>
                                            <th>Embark ID</th>
                                            <th>Orders</th>
                                            <th>Referral Code</th>
                                            <th>Joined</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((u) => (
                                            <tr key={u.id}>
                                                <td>#{u.id}</td>
                                                <td className={styles.customerName}>{u.username}</td>
                                                <td>{u.email}</td>
                                                <td>
                                                    <span className={`${styles.roleBadge} ${u.role === 'admin' ? styles.roleAdmin : styles.roleUser}`}>
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td>{u.embark_id || '-'}</td>
                                                <td>{u.order_count}</td>
                                                <td className={styles.referralCode}>{u.referral_code}</td>
                                                <td className={styles.date}>{u.created_at?.substring(0, 10)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
