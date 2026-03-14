'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import useAuthStore from '@/store/authStore';
import useHydrated from '@/lib/useHydrated';
import styles from './page.module.css';

const STAFF_ROLES = new Set(['admin', 'support', 'worker']);

export default function AdminPage() {
    const mounted = useHydrated();
    const [activeTab, setActiveTab] = useState('orders');
    const [orders, setOrders] = useState([]);
    const [users, setUsers] = useState([]);
    const [staffOptions, setStaffOptions] = useState([]);
    const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, totalUsers: 0, pendingOrders: 0 });
    const [loading, setLoading] = useState(true);
    const { user, token, init: initAuth } = useAuthStore();

    async function fetchOrders(authToken = token) {
        if (!authToken) return;
        setLoading(true);
        try {
            const res = await fetch('/api/admin/orders', {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (res.ok) {
                const data = await res.json();
                setOrders(data.orders || []);
                setStaffOptions(data.staff || []);
                const total = data.orders?.length || 0;
                const revenue = data.orders?.reduce((sum, order) => sum + (order.status !== 'refunded' ? order.total : 0), 0) || 0;
                const pending = data.orders?.filter((order) => ['pending_payment', 'paid', 'assigned', 'delivering'].includes(order.status)).length || 0;
                setStats((prev) => ({ ...prev, totalOrders: total, totalRevenue: revenue, pendingOrders: pending }));
            }
        } catch (error) {
            console.error('Failed to fetch orders:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchUsers(authToken = token) {
        if (!authToken) return;
        try {
            const res = await fetch('/api/admin/users', {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || []);
                setStats((prev) => ({ ...prev, totalUsers: data.total || 0 }));
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        }
    }

    useEffect(() => {
        initAuth();
    }, [initAuth]);

    useEffect(() => {
        if (!token || !user || !STAFF_ROLES.has(user.role)) return;
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const ordersRes = await fetch('/api/admin/orders', {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (ordersRes.ok) {
                    const ordersData = await ordersRes.json();
                    setOrders(ordersData.orders || []);
                    setStaffOptions(ordersData.staff || []);
                    const total = ordersData.orders?.length || 0;
                    const revenue = ordersData.orders?.reduce((sum, order) => sum + (order.status !== 'refunded' ? order.total : 0), 0) || 0;
                    const pending = ordersData.orders?.filter((order) => ['pending_payment', 'paid', 'assigned', 'delivering'].includes(order.status)).length || 0;
                    setStats((prev) => ({ ...prev, totalOrders: total, totalRevenue: revenue, pendingOrders: pending }));
                }

                if (user.role === 'admin') {
                    const usersRes = await fetch('/api/admin/users', {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (usersRes.ok) {
                        const usersData = await usersRes.json();
                        setUsers(usersData.users || []);
                        setStats((prev) => ({ ...prev, totalUsers: usersData.total || 0 }));
                    }
                }
            } catch (error) {
                console.error('Failed to load operations data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
        if (user.role !== 'admin' && activeTab === 'users') {
            setActiveTab('orders');
        }
    }, [token, user, activeTab]);

    async function updateOrderStatus(orderId, newStatus) {
        try {
            const res = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                fetchOrders(token);
            }
        } catch (error) {
            console.error('Failed to update order:', error);
        }
    }

    async function assignOrder(orderId, assigneeId) {
        if (!assigneeId) return;
        try {
            const res = await fetch(`/api/admin/orders/${orderId}/assign`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ assigneeId }),
            });
            if (res.ok) {
                fetchOrders(token);
            }
        } catch (error) {
            console.error('Failed to assign order:', error);
        }
    }

    async function updateUserRole(userId, role) {
        try {
            const res = await fetch(`/api/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ role }),
            });
            if (res.ok) {
                fetchUsers(token);
                fetchOrders(token);
            }
        } catch (error) {
            console.error('Failed to update user role:', error);
        }
    }

    if (!mounted) return null;

    if (!user) {
        return (
            <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
                <h1>Please Log In</h1>
                <p style={{ color: 'var(--text-muted)', margin: '16px 0' }}>Operations access required.</p>
                <Link href="/" className="btn btn-primary">← Go Home</Link>
            </div>
        );
    }

    if (!STAFF_ROLES.has(user.role)) {
        return (
            <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
                <h1>🚫 Access Denied</h1>
                <p style={{ color: 'var(--text-muted)', margin: '16px 0' }}>This page is only accessible to operations staff.</p>
                <Link href="/" className="btn btn-primary">← Go Home</Link>
            </div>
        );
    }

    return (
        <div className={styles.adminPage}>
            <div className="container">
                <h1 className={styles.title}>⚙️ Operations Panel</h1>

                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <span className={styles.statIcon}>📦</span>
                        <div>
                            <span className={styles.statValue}>{stats.totalOrders}</span>
                            <span className={styles.statLabel}>Visible Orders</span>
                        </div>
                    </div>
                    <div className={styles.statCard}>
                        <span className={styles.statIcon}>💰</span>
                        <div>
                            <span className={styles.statValue}>${stats.totalRevenue.toFixed(2)}</span>
                            <span className={styles.statLabel}>Visible Revenue</span>
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
                            <span className={styles.statLabel}>Active Orders</span>
                        </div>
                    </div>
                </div>

                <div className={styles.tabs}>
                    <button className={`${styles.tab} ${activeTab === 'orders' ? styles.tabActive : ''}`} onClick={() => setActiveTab('orders')}>
                        📋 Order Management
                    </button>
                    {user.role === 'admin' && (
                        <button className={`${styles.tab} ${activeTab === 'users' ? styles.tabActive : ''}`} onClick={() => setActiveTab('users')}>
                            👥 User Management
                        </button>
                    )}
                </div>

                {activeTab === 'orders' && (
                    <div className={styles.tableCard}>
                        {loading ? (
                            <div className={styles.emptyState}>Loading orders...</div>
                        ) : orders.length === 0 ? (
                            <div className={styles.emptyState}>No orders available.</div>
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
                                            <th>Assignee</th>
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
                                                    {order.items?.map((item, index) => (
                                                        <span key={index}>{item.product_name} ×{item.quantity}</span>
                                                    )).reduce((prev, curr, index) => index === 0 ? [curr] : [...prev, ', ', curr], [])}
                                                </td>
                                                <td className={styles.amount}>${order.total?.toFixed(2)}</td>
                                                <td className={styles.embarkId}>{order.embark_id || '-'}</td>
                                                <td>
                                                    <div className={styles.customer}>
                                                        <span className={styles.customerName}>{order.assigned_username || 'Unassigned'}</span>
                                                        {order.assigned_by_username && (
                                                            <span className={styles.customerEmail}>by {order.assigned_by_username}</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`${styles.statusBadge} ${styles[`status_${order.status}`] || ''}`}>
                                                        {order.status.replace(/_/g, ' ')}
                                                    </span>
                                                </td>
                                                <td className={styles.date}>{order.created_at?.substring(0, 10)}</td>
                                                <td>
                                                    <div className={styles.actionGroup}>
                                                        {(user.role === 'admin' || user.role === 'support') && (
                                                            <select
                                                                className={styles.statusSelect}
                                                                value={order.assigned_to || ''}
                                                                onChange={(e) => assignOrder(order.id, e.target.value)}
                                                            >
                                                                <option value="">Assign to...</option>
                                                                {staffOptions.map((staff) => (
                                                                    <option key={staff.id} value={staff.id}>
                                                                        {staff.username} ({staff.role})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        )}
                                                        <select
                                                            className={styles.statusSelect}
                                                            value={order.status}
                                                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                                                        >
                                                            {[order.status, ...(order.allowedTransitions || [])]
                                                                .filter((status, index, list) => list.indexOf(status) === index)
                                                                .map((status) => (
                                                                <option key={status} value={status}>
                                                                    {status.replace(/_/g, ' ')}
                                                                </option>
                                                                ))}
                                                        </select>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {user.role === 'admin' && activeTab === 'users' && (
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
                                        {users.map((account) => (
                                            <tr key={account.id}>
                                                <td>#{account.id}</td>
                                                <td className={styles.customerName}>{account.username}</td>
                                                <td>{account.email}</td>
                                                <td>
                                                    <select
                                                        className={styles.statusSelect}
                                                        value={account.role}
                                                        onChange={(e) => updateUserRole(account.id, e.target.value)}
                                                    >
                                                        {['user', 'worker', 'support', 'admin'].map((role) => (
                                                            <option key={role} value={role}>{role}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>{account.embark_id || '-'}</td>
                                                <td>{account.order_count}</td>
                                                <td className={styles.referralCode}>{account.referral_code}</td>
                                                <td className={styles.date}>{account.created_at?.substring(0, 10)}</td>
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
