'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import gamesData from '@/data/games.json';
import useAuthStore from '@/store/authStore';
import useHydrated from '@/lib/useHydrated';
import styles from './page.module.css';

const STAFF_ROLES = new Set(['admin', 'support', 'worker']);
const EMPTY_PRODUCT = {
    id: null,
    externalId: '',
    gameSlug: 'arc-raiders',
    category: 'Misc',
    subCategory: '',
    name: '',
    description: '',
    price: '',
    originalPrice: '',
    discount: '0',
    image: '',
    inStock: true,
};
const EMPTY_ARTICLE = {
    id: null,
    slug: '',
    title: '',
    excerpt: '',
    content: '',
    category: 'guides',
    gameSlug: 'arc-raiders',
    published: true,
};

export default function AdminPage() {
    const mounted = useHydrated();
    const [activeTab, setActiveTab] = useState('orders');
    const [orders, setOrders] = useState([]);
    const [users, setUsers] = useState([]);
    const [products, setProducts] = useState([]);
    const [articles, setArticles] = useState([]);
    const [riskEvents, setRiskEvents] = useState([]);
    const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
    const [articleForm, setArticleForm] = useState(EMPTY_ARTICLE);
    const [productSearch, setProductSearch] = useState('');
    const [articleSearch, setArticleSearch] = useState('');
    const [savingProduct, setSavingProduct] = useState(false);
    const [savingArticle, setSavingArticle] = useState(false);
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

    const fetchProducts = useCallback(async (authToken = token, search = productSearch) => {
        if (!authToken || user?.role !== 'admin') return;
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set('search', search.trim());
            const res = await fetch(`/api/admin/products?${params.toString()}`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (res.ok) {
                const data = await res.json();
                setProducts(data.products || []);
            }
        } catch (error) {
            console.error('Failed to fetch products:', error);
        }
    }, [productSearch, token, user]);

    const fetchArticles = useCallback(async (authToken = token, search = articleSearch) => {
        if (!authToken || user?.role !== 'admin') return;
        try {
            const res = await fetch('/api/admin/articles', {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (res.ok) {
                const data = await res.json();
                const normalizedSearch = search.trim().toLowerCase();
                const nextArticles = (data.articles || []).filter((article) => {
                    if (!normalizedSearch) return true;
                    return [article.title, article.slug, article.category, article.game_slug, article.excerpt]
                        .filter(Boolean)
                        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
                });
                setArticles(nextArticles);
            }
        } catch (error) {
            console.error('Failed to fetch articles:', error);
        }
    }, [articleSearch, token, user]);

    const fetchRiskEvents = useCallback(async (authToken = token) => {
        if (!authToken || !STAFF_ROLES.has(user?.role)) return;
        try {
            const res = await fetch('/api/admin/risk-events', {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (res.ok) {
                const data = await res.json();
                setRiskEvents(data.events || []);
            }
        } catch (error) {
            console.error('Failed to fetch risk events:', error);
        }
    }, [token, user]);

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

                    const productsRes = await fetch('/api/admin/products', {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (productsRes.ok) {
                        const productsData = await productsRes.json();
                        setProducts(productsData.products || []);
                    }
                }
            } catch (error) {
                console.error('Failed to load operations data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
        if (user.role !== 'admin' && ['users', 'products', 'articles'].includes(activeTab)) {
            setActiveTab('orders');
        }
    }, [token, user, activeTab]);

    useEffect(() => {
        if (!token || user?.role !== 'admin') return undefined;
        const timer = setTimeout(() => {
            if (activeTab === 'products') {
                fetchProducts(token, productSearch);
            }
            if (activeTab === 'articles') {
                fetchArticles(token, articleSearch);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [activeTab, productSearch, articleSearch, token, user, fetchProducts, fetchArticles]);

    useEffect(() => {
        if (activeTab === 'risk' && token && STAFF_ROLES.has(user?.role)) {
            fetchRiskEvents(token);
        }
    }, [activeTab, token, user, fetchRiskEvents]);

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

    function startProductEdit(product) {
        setProductForm({
            id: product.id,
            externalId: product.external_id || '',
            gameSlug: product.game_slug,
            category: product.category,
            subCategory: product.sub_category || '',
            name: product.name,
            description: product.description || '',
            price: String(product.price || ''),
            originalPrice: String(product.original_price || ''),
            discount: String(product.discount || 0),
            image: product.image || '',
            inStock: Boolean(product.in_stock),
        });
        setActiveTab('products');
    }

    async function saveProduct() {
        if (!productForm.name || !productForm.gameSlug || !productForm.category || !productForm.price) {
            return;
        }

        setSavingProduct(true);
        try {
            const isEditing = Boolean(productForm.id);
            const res = await fetch(isEditing ? `/api/admin/products/${productForm.id}` : '/api/admin/products', {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(productForm),
            });

            if (res.ok) {
                setProductForm(EMPTY_PRODUCT);
                fetchProducts(token);
            }
        } catch (error) {
            console.error('Failed to save product:', error);
        } finally {
            setSavingProduct(false);
        }
    }

    async function deleteProduct(productId) {
        try {
            const res = await fetch(`/api/admin/products/${productId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                if (productForm.id === productId) {
                    setProductForm(EMPTY_PRODUCT);
                }
                fetchProducts(token);
            }
        } catch (error) {
            console.error('Failed to delete product:', error);
        }
    }

    function startArticleEdit(article) {
        setArticleForm({
            id: article.id,
            slug: article.slug,
            title: article.title,
            excerpt: article.excerpt || '',
            content: article.content || '',
            category: article.category || 'guides',
            gameSlug: article.game_slug || 'arc-raiders',
            published: Boolean(article.published),
        });
        setActiveTab('articles');
    }

    async function saveArticle() {
        if (!articleForm.slug || !articleForm.title || !articleForm.content) {
            return;
        }

        setSavingArticle(true);
        try {
            const isEditing = Boolean(articleForm.id);
            const res = await fetch(isEditing ? `/api/admin/articles/${articleForm.id}` : '/api/admin/articles', {
                method: isEditing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(articleForm),
            });

            if (res.ok) {
                setArticleForm(EMPTY_ARTICLE);
                fetchArticles(token);
            }
        } catch (error) {
            console.error('Failed to save article:', error);
        } finally {
            setSavingArticle(false);
        }
    }

    async function deleteArticle(articleId) {
        try {
            const res = await fetch(`/api/admin/articles/${articleId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                if (articleForm.id === articleId) {
                    setArticleForm(EMPTY_ARTICLE);
                }
                fetchArticles(token);
            }
        } catch (error) {
            console.error('Failed to delete article:', error);
        }
    }

    async function syncCurrencyRates() {
        try {
            const res = await fetch('/api/admin/currency-rates/sync', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                console.error('Failed to sync currency rates');
            }
        } catch (error) {
            console.error('Failed to sync currency rates:', error);
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
                    {user.role === 'admin' && (
                        <button className={`${styles.tab} ${activeTab === 'products' ? styles.tabActive : ''}`} onClick={() => setActiveTab('products')}>
                            🛒 Product Management
                        </button>
                    )}
                    {user.role === 'admin' && (
                        <button className={`${styles.tab} ${activeTab === 'articles' ? styles.tabActive : ''}`} onClick={() => setActiveTab('articles')}>
                            📰 Article Management
                        </button>
                    )}
                    <button className={`${styles.tab} ${activeTab === 'risk' ? styles.tabActive : ''}`} onClick={() => setActiveTab('risk')}>
                        🛡️ Risk Events
                    </button>
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

                {user.role === 'admin' && activeTab === 'products' && (
                    <div className={styles.productsLayout}>
                        <div className={styles.formCard}>
                            <div className={styles.formHeader}>
                                <h2>{productForm.id ? 'Edit Product' : 'Create Product'}</h2>
                                {productForm.id && (
                                    <button className={styles.resetBtn} onClick={() => setProductForm(EMPTY_PRODUCT)}>
                                        Reset
                                    </button>
                                )}
                            </div>

                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span>Game</span>
                                    <select className={styles.statusSelect} value={productForm.gameSlug} onChange={(e) => setProductForm((prev) => ({ ...prev, gameSlug: e.target.value }))}>
                                        {gamesData.filter((game) => game.active).map((game) => (
                                            <option key={game.slug} value={game.slug}>{game.name}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span>External ID</span>
                                    <input className={styles.textInput} value={productForm.externalId} onChange={(e) => setProductForm((prev) => ({ ...prev, externalId: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Category</span>
                                    <input className={styles.textInput} value={productForm.category} onChange={(e) => setProductForm((prev) => ({ ...prev, category: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Sub Category</span>
                                    <input className={styles.textInput} value={productForm.subCategory} onChange={(e) => setProductForm((prev) => ({ ...prev, subCategory: e.target.value }))} />
                                </label>
                                <label className={`${styles.field} ${styles.fieldWide}`}>
                                    <span>Name</span>
                                    <input className={styles.textInput} value={productForm.name} onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))} />
                                </label>
                                <label className={`${styles.field} ${styles.fieldWide}`}>
                                    <span>Description</span>
                                    <textarea className={styles.textArea} value={productForm.description} onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Price</span>
                                    <input className={styles.textInput} type="number" min="0" step="0.01" value={productForm.price} onChange={(e) => setProductForm((prev) => ({ ...prev, price: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Original Price</span>
                                    <input className={styles.textInput} type="number" min="0" step="0.01" value={productForm.originalPrice} onChange={(e) => setProductForm((prev) => ({ ...prev, originalPrice: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Discount %</span>
                                    <input className={styles.textInput} type="number" min="0" max="99" value={productForm.discount} onChange={(e) => setProductForm((prev) => ({ ...prev, discount: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Image</span>
                                    <input className={styles.textInput} value={productForm.image} onChange={(e) => setProductForm((prev) => ({ ...prev, image: e.target.value }))} />
                                </label>
                                <label className={styles.checkboxField}>
                                    <input type="checkbox" checked={productForm.inStock} onChange={(e) => setProductForm((prev) => ({ ...prev, inStock: e.target.checked }))} />
                                    <span>In stock</span>
                                </label>
                            </div>

                            <div className={styles.formActions}>
                                <button className="btn btn-primary" onClick={saveProduct} disabled={savingProduct}>
                                    {savingProduct ? 'Saving...' : productForm.id ? 'Update Product' : 'Create Product'}
                                </button>
                            </div>
                        </div>

                        <div className={styles.tableCard}>
                            <div className={styles.toolbar}>
                                <input
                                    className={styles.textInput}
                                    placeholder="Search products..."
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                />
                                <button className={styles.resetBtn} onClick={() => fetchProducts(token, productSearch)}>
                                    Refresh
                                </button>
                            </div>

                            {products.length === 0 ? (
                                <div className={styles.emptyState}>No products available.</div>
                            ) : (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>ID</th>
                                                <th>Game</th>
                                                <th>Name</th>
                                                <th>Category</th>
                                                <th>Price</th>
                                                <th>Stock</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {products.map((product) => (
                                                <tr key={product.id}>
                                                    <td>#{product.id}</td>
                                                    <td>{product.game_slug}</td>
                                                    <td className={styles.customerName}>{product.name}</td>
                                                    <td>{product.category}{product.sub_category ? ` / ${product.sub_category}` : ''}</td>
                                                    <td className={styles.amount}>${Number(product.price).toFixed(2)}</td>
                                                    <td>
                                                        <span className={`${styles.statusBadge} ${product.in_stock ? styles.status_completed : styles.status_refunded}`}>
                                                            {product.in_stock ? 'in stock' : 'out'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className={styles.actionGroup}>
                                                            <button className={styles.resetBtn} onClick={() => startProductEdit(product)}>Edit</button>
                                                            <button className={styles.dangerBtn} onClick={() => deleteProduct(product.id)}>Delete</button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {user.role === 'admin' && activeTab === 'articles' && (
                    <div className={styles.productsLayout}>
                        <div className={styles.formCard}>
                            <div className={styles.formHeader}>
                                <h2>{articleForm.id ? 'Edit Article' : 'Create Article'}</h2>
                                {articleForm.id && (
                                    <button className={styles.resetBtn} onClick={() => setArticleForm(EMPTY_ARTICLE)}>
                                        Reset
                                    </button>
                                )}
                            </div>

                            <div className={styles.formGrid}>
                                <label className={styles.field}>
                                    <span>Slug</span>
                                    <input className={styles.textInput} value={articleForm.slug} onChange={(e) => setArticleForm((prev) => ({ ...prev, slug: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Category</span>
                                    <input className={styles.textInput} value={articleForm.category} onChange={(e) => setArticleForm((prev) => ({ ...prev, category: e.target.value }))} />
                                </label>
                                <label className={`${styles.field} ${styles.fieldWide}`}>
                                    <span>Title</span>
                                    <input className={styles.textInput} value={articleForm.title} onChange={(e) => setArticleForm((prev) => ({ ...prev, title: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Game</span>
                                    <select className={styles.statusSelect} value={articleForm.gameSlug} onChange={(e) => setArticleForm((prev) => ({ ...prev, gameSlug: e.target.value }))}>
                                        <option value="">General</option>
                                        {gamesData.filter((game) => game.active).map((game) => (
                                            <option key={game.slug} value={game.slug}>{game.name}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className={styles.checkboxField}>
                                    <input type="checkbox" checked={articleForm.published} onChange={(e) => setArticleForm((prev) => ({ ...prev, published: e.target.checked }))} />
                                    <span>Published</span>
                                </label>
                                <label className={`${styles.field} ${styles.fieldWide}`}>
                                    <span>Excerpt</span>
                                    <textarea className={styles.textArea} value={articleForm.excerpt} onChange={(e) => setArticleForm((prev) => ({ ...prev, excerpt: e.target.value }))} />
                                </label>
                                <label className={`${styles.field} ${styles.fieldWide}`}>
                                    <span>Content</span>
                                    <textarea className={styles.textArea} value={articleForm.content} onChange={(e) => setArticleForm((prev) => ({ ...prev, content: e.target.value }))} />
                                </label>
                            </div>

                            <div className={styles.formActions}>
                                <button className="btn btn-primary" onClick={saveArticle} disabled={savingArticle}>
                                    {savingArticle ? 'Saving...' : articleForm.id ? 'Update Article' : 'Create Article'}
                                </button>
                                <button className={styles.resetBtn} onClick={syncCurrencyRates}>
                                    Sync Rates
                                </button>
                            </div>
                        </div>

                        <div className={styles.tableCard}>
                            <div className={styles.toolbar}>
                                <input
                                    className={styles.textInput}
                                    placeholder="Search articles"
                                    value={articleSearch}
                                    onChange={(e) => setArticleSearch(e.target.value)}
                                />
                                <span className={styles.customerEmail}>{articles.length} article(s)</span>
                            </div>
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Slug</th>
                                            <th>Title</th>
                                            <th>Category</th>
                                            <th>Game</th>
                                            <th>Status</th>
                                            <th>Updated</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {articles.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" className={styles.emptyState}>No articles found.</td>
                                            </tr>
                                        ) : articles.map((article) => (
                                            <tr key={article.id}>
                                                <td className={styles.orderNo}>{article.slug}</td>
                                                <td className={styles.customerName}>{article.title}</td>
                                                <td>{article.category}</td>
                                                <td>{article.game_slug || 'General'}</td>
                                                <td>
                                                    <span className={`${styles.statusBadge} ${article.published ? styles.status_completed : styles.status_cancelled}`}>
                                                        {article.published ? 'published' : 'draft'}
                                                    </span>
                                                </td>
                                                <td className={styles.date}>{String(article.updated_at).slice(0, 10)}</td>
                                                <td>
                                                    <div className={styles.actionGroup}>
                                                        <button className={styles.resetBtn} onClick={() => startArticleEdit(article)}>Edit</button>
                                                        <button className={styles.dangerBtn} onClick={() => deleteArticle(article.id)}>Delete</button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'risk' && (
                    <div className={styles.tableCard}>
                        {riskEvents.length === 0 ? (
                            <div className={styles.emptyState}>No risk events recorded.</div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Severity</th>
                                            <th>Event</th>
                                            <th>User</th>
                                            <th>Order</th>
                                            <th>Score</th>
                                            <th>IP</th>
                                            <th>Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {riskEvents.map((event) => (
                                            <tr key={event.id}>
                                                <td>
                                                    <span className={`${styles.statusBadge} ${styles[`status_${event.severity === 'high' ? 'refunded' : event.severity === 'medium' ? 'assigned' : 'paid'}`]}`}>
                                                        {event.severity}
                                                    </span>
                                                </td>
                                                <td>{event.event_type}</td>
                                                <td>{event.username || '-'}</td>
                                                <td className={styles.orderNo}>{event.order_no || '-'}</td>
                                                <td>{event.score}</td>
                                                <td className={styles.embarkId}>{event.ip_address || '-'}</td>
                                                <td className={styles.date}>{String(event.created_at).slice(0, 19).replace('T', ' ')}</td>
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
