'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import gamesData from '@/data/games.json';
import { STAFF_ROLES } from '@/lib/orders';
import useAuthStore from '@/store/authStore';
import useHydrated from '@/lib/useHydrated';
import styles from './page.module.css';

const EMPTY_PRODUCT = {
    id: null,
    externalId: '',
    gameSlug: 'arc-raiders',
    category: 'Misc',
    subCategory: '',
    platform: '',
    serverRegion: '',
    rarity: '',
    name: '',
    description: '',
    deliveryNote: '',
    packageLabel: '',
    packageSize: '1',
    packageUnit: 'bundle',
    price: '',
    originalPrice: '',
    discount: '0',
    stockQuantity: '999',
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
const EMPTY_INVENTORY_LOT = {
    productId: '',
    availableQuantity: '0',
    sourceType: 'manual',
    sourceRef: '',
    note: '',
};

export default function AdminPage() {
    const mounted = useHydrated();
    const [activeTab, setActiveTab] = useState('orders');
    const [orders, setOrders] = useState([]);
    const [users, setUsers] = useState([]);
    const [products, setProducts] = useState([]);
    const [articles, setArticles] = useState([]);
    const [riskEvents, setRiskEvents] = useState([]);
    const [inventoryLots, setInventoryLots] = useState([]);
    const [inventoryDrafts, setInventoryDrafts] = useState({});
    const [productForm, setProductForm] = useState(EMPTY_PRODUCT);
    const [articleForm, setArticleForm] = useState(EMPTY_ARTICLE);
    const [inventoryForm, setInventoryForm] = useState(EMPTY_INVENTORY_LOT);
    const [productSearch, setProductSearch] = useState('');
    const [articleSearch, setArticleSearch] = useState('');
    const [inventorySearch, setInventorySearch] = useState('');
    const [savingProduct, setSavingProduct] = useState(false);
    const [savingArticle, setSavingArticle] = useState(false);
    const [savingInventory, setSavingInventory] = useState(false);
    const [staffOptions, setStaffOptions] = useState([]);
    const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0, totalUsers: 0, pendingOrders: 0 });
    const [loading, setLoading] = useState(true);
    const { user, token, init: initAuth } = useAuthStore();

    const fetchOrders = useCallback(async (authToken = token, withLoading = true) => {
        if (!authToken) return;
        if (withLoading) setLoading(true);
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
            if (withLoading) setLoading(false);
        }
    }, [token]);

    const fetchUsers = useCallback(async (authToken = token) => {
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
    }, [token]);

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
            const params = new URLSearchParams();
            if (search.trim()) params.set('search', search.trim());
            const res = await fetch(`/api/admin/articles?${params.toString()}`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (res.ok) {
                const data = await res.json();
                setArticles(data.articles || []);
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

    const fetchInventoryLots = useCallback(async (authToken = token, search = inventorySearch) => {
        if (!authToken || user?.role !== 'admin') return;
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set('search', search.trim());
            const res = await fetch(`/api/admin/inventory?${params.toString()}`, {
                headers: { Authorization: `Bearer ${authToken}` },
            });
            if (res.ok) {
                const data = await res.json();
                setInventoryLots(data.lots || []);
            }
        } catch (error) {
            console.error('Failed to fetch inventory lots:', error);
        }
    }, [inventorySearch, token, user]);

    useEffect(() => {
        initAuth();
    }, [initAuth]);

    useEffect(() => {
        if (!token || !user || !STAFF_ROLES.has(user.role)) return;
        const loadInitialData = async () => {
            setLoading(true);
            try {
                if (user.role === 'admin') {
                    await Promise.all([
                        fetchOrders(token, false),
                        fetchUsers(token),
                        fetchProducts(token, ''),
                        fetchInventoryLots(token, ''),
                    ]);
                } else {
                    await fetchOrders(token, false);
                }
            } catch (error) {
                console.error('Failed to load operations data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadInitialData();
    }, [token, user, fetchOrders, fetchUsers, fetchProducts, fetchInventoryLots]);

    useEffect(() => {
        if (!user) return;
        if (user.role !== 'admin' && ['users', 'products', 'articles'].includes(activeTab)) {
            setActiveTab('orders');
        }
    }, [user, activeTab]);

    useEffect(() => {
        if (!token || user?.role !== 'admin') return undefined;
        const timer = setTimeout(() => {
            if (activeTab === 'products') {
                fetchProducts(token, productSearch);
            }
            if (activeTab === 'articles') {
                fetchArticles(token, articleSearch);
            }
            if (activeTab === 'inventory') {
                fetchInventoryLots(token, inventorySearch);
            }
        }, 200);

        return () => clearTimeout(timer);
    }, [activeTab, productSearch, articleSearch, inventorySearch, token, user, fetchProducts, fetchArticles, fetchInventoryLots]);

    useEffect(() => {
        if (activeTab === 'risk' && token && STAFF_ROLES.has(user?.role)) {
            fetchRiskEvents(token);
        }
    }, [activeTab, token, user, fetchRiskEvents]);

    useEffect(() => {
        setInventoryDrafts((prev) => {
            const next = {};
            for (const lot of inventoryLots) {
                next[lot.id] = prev[lot.id] || {
                    availableQuantity: String(lot.available_quantity ?? 0),
                    sourceType: lot.source_type || 'manual',
                    sourceRef: lot.source_ref || '',
                    note: lot.note || '',
                };
            }
            return next;
        });
    }, [inventoryLots]);

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
            platform: product.platform || '',
            serverRegion: product.server_region || '',
            rarity: product.rarity || '',
            name: product.name,
            description: product.description || '',
            deliveryNote: product.delivery_note || '',
            packageLabel: product.package_label || '',
            packageSize: String(product.package_size || 1),
            packageUnit: product.package_unit || 'bundle',
            price: String(product.price || ''),
            originalPrice: String(product.original_price || ''),
            discount: String(product.discount || 0),
            stockQuantity: String(product.stock_quantity ?? 999),
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

    async function saveInventoryLot() {
        if (!inventoryForm.productId || Number.parseInt(inventoryForm.availableQuantity, 10) < 0) {
            return;
        }

        setSavingInventory(true);
        try {
            const res = await fetch('/api/admin/inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(inventoryForm),
            });
            if (res.ok) {
                setInventoryForm(EMPTY_INVENTORY_LOT);
                fetchInventoryLots(token, inventorySearch);
                fetchProducts(token, productSearch);
            }
        } catch (error) {
            console.error('Failed to create inventory lot:', error);
        } finally {
            setSavingInventory(false);
        }
    }

    async function updateInventoryLot(lotId, updates) {
        try {
            const res = await fetch(`/api/admin/inventory/${lotId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(updates),
            });
            if (res.ok) {
                fetchInventoryLots(token, inventorySearch);
                fetchProducts(token, productSearch);
            }
        } catch (error) {
            console.error('Failed to update inventory lot:', error);
        }
    }

    function updateInventoryDraft(lotId, field, value) {
        setInventoryDrafts((prev) => ({
            ...prev,
            [lotId]: {
                ...(prev[lotId] || {}),
                [field]: value,
            },
        }));
    }

    async function deleteInventoryLot(lotId) {
        try {
            const res = await fetch(`/api/admin/inventory/${lotId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                fetchInventoryLots(token, inventorySearch);
                fetchProducts(token, productSearch);
            }
        } catch (error) {
            console.error('Failed to delete inventory lot:', error);
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
                    {user.role === 'admin' && (
                        <button className={`${styles.tab} ${activeTab === 'inventory' ? styles.tabActive : ''}`} onClick={() => setActiveTab('inventory')}>
                            📚 Inventory Lots
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
                                <label className={styles.field}>
                                    <span>Platform</span>
                                    <input className={styles.textInput} value={productForm.platform} onChange={(e) => setProductForm((prev) => ({ ...prev, platform: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Server Region</span>
                                    <input className={styles.textInput} value={productForm.serverRegion} onChange={(e) => setProductForm((prev) => ({ ...prev, serverRegion: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Rarity</span>
                                    <input className={styles.textInput} value={productForm.rarity} onChange={(e) => setProductForm((prev) => ({ ...prev, rarity: e.target.value }))} />
                                </label>
                                <label className={`${styles.field} ${styles.fieldWide}`}>
                                    <span>Name</span>
                                    <input className={styles.textInput} value={productForm.name} onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))} />
                                </label>
                                <label className={`${styles.field} ${styles.fieldWide}`}>
                                    <span>Description</span>
                                    <textarea className={styles.textArea} value={productForm.description} onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))} />
                                </label>
                                <label className={`${styles.field} ${styles.fieldWide}`}>
                                    <span>Delivery Note</span>
                                    <textarea className={styles.textArea} value={productForm.deliveryNote} onChange={(e) => setProductForm((prev) => ({ ...prev, deliveryNote: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Package Label</span>
                                    <input className={styles.textInput} value={productForm.packageLabel} onChange={(e) => setProductForm((prev) => ({ ...prev, packageLabel: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Package Size</span>
                                    <input className={styles.textInput} type="number" min="1" step="1" value={productForm.packageSize} onChange={(e) => setProductForm((prev) => ({ ...prev, packageSize: e.target.value }))} />
                                </label>
                                <label className={styles.field}>
                                    <span>Package Unit</span>
                                    <input className={styles.textInput} value={productForm.packageUnit} onChange={(e) => setProductForm((prev) => ({ ...prev, packageUnit: e.target.value }))} />
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
                                    <span>Stock Qty</span>
                                    <input className={styles.textInput} type="number" min="0" step="1" value={productForm.stockQuantity} onChange={(e) => setProductForm((prev) => ({ ...prev, stockQuantity: e.target.value }))} />
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
                                                <th>Package</th>
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
                                                    <td>{product.package_label || `${product.package_size || 1} ${product.package_unit || 'bundle'}`}</td>
                                                    <td className={styles.amount}>${Number(product.price).toFixed(2)}</td>
                                                    <td>
                                                        <span className={`${styles.statusBadge} ${product.in_stock ? styles.status_completed : styles.status_refunded}`}>
                                                            {product.in_stock ? `${product.stock_quantity ?? 0} in stock` : 'out'}
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

                {user.role === 'admin' && activeTab === 'inventory' && (
                    <div className={styles.productsLayout}>
                        <div className={styles.formCard}>
                            <div className={styles.formHeader}>
                                <h2>Create Inventory Lot</h2>
                            </div>

                            <div className={styles.formGrid}>
                                <label className={`${styles.field} ${styles.fieldWide}`}>
                                    <span>Product</span>
                                    <select
                                        className={styles.statusSelect}
                                        value={inventoryForm.productId}
                                        onChange={(e) => setInventoryForm((prev) => ({ ...prev, productId: e.target.value }))}
                                    >
                                        <option value="">Select product...</option>
                                        {products.map((product) => (
                                            <option key={product.id} value={product.id}>
                                                #{product.id} {product.name} ({product.game_slug})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className={styles.field}>
                                    <span>Quantity</span>
                                    <input
                                        className={styles.textInput}
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={inventoryForm.availableQuantity}
                                        onChange={(e) => setInventoryForm((prev) => ({ ...prev, availableQuantity: e.target.value }))}
                                    />
                                </label>
                                <label className={styles.field}>
                                    <span>Source Type</span>
                                    <input
                                        className={styles.textInput}
                                        value={inventoryForm.sourceType}
                                        onChange={(e) => setInventoryForm((prev) => ({ ...prev, sourceType: e.target.value }))}
                                    />
                                </label>
                                <label className={`${styles.field} ${styles.fieldWide}`}>
                                    <span>Source Ref</span>
                                    <input
                                        className={styles.textInput}
                                        value={inventoryForm.sourceRef}
                                        onChange={(e) => setInventoryForm((prev) => ({ ...prev, sourceRef: e.target.value }))}
                                    />
                                </label>
                                <label className={`${styles.field} ${styles.fieldWide}`}>
                                    <span>Note</span>
                                    <textarea
                                        className={styles.textArea}
                                        value={inventoryForm.note}
                                        onChange={(e) => setInventoryForm((prev) => ({ ...prev, note: e.target.value }))}
                                    />
                                </label>
                            </div>

                            <div className={styles.formActions}>
                                <button className="btn btn-primary" onClick={saveInventoryLot} disabled={savingInventory}>
                                    {savingInventory ? 'Saving...' : 'Create Lot'}
                                </button>
                            </div>
                        </div>

                        <div className={styles.tableCard}>
                            <div className={styles.toolbar}>
                                <input
                                    className={styles.textInput}
                                    placeholder="Search lots by product or ref..."
                                    value={inventorySearch}
                                    onChange={(e) => setInventorySearch(e.target.value)}
                                />
                                <button className={styles.resetBtn} onClick={() => fetchInventoryLots(token, inventorySearch)}>
                                    Refresh
                                </button>
                            </div>

                            {inventoryLots.length === 0 ? (
                                <div className={styles.emptyState}>No inventory lots available.</div>
                            ) : (
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Lot</th>
                                                <th>Product</th>
                                                <th>Package</th>
                                                <th>Source</th>
                                                <th>Quantity</th>
                                                <th>Note</th>
                                                <th>Updated</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {inventoryLots.map((lot) => (
                                                <tr key={lot.id}>
                                                    <td className={styles.orderNo}>#{lot.id}</td>
                                                    <td>
                                                        <div className={styles.customer}>
                                                            <span className={styles.customerName}>{lot.product_name}</span>
                                                            <span className={styles.customerEmail}>{lot.game_slug} / #{lot.product_id}</span>
                                                        </div>
                                                    </td>
                                                    <td>{lot.package_label || `${lot.package_size || 1} ${lot.package_unit || 'bundle'}`}</td>
                                                    <td>
                                                        <div className={styles.customer}>
                                                            <span className={styles.customerName}>{lot.source_type}</span>
                                                            <span className={styles.customerEmail}>{lot.source_ref || '-'}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <input
                                                            className={styles.textInput}
                                                            type="number"
                                                            min="0"
                                                            step="1"
                                                            value={inventoryDrafts[lot.id]?.availableQuantity ?? String(lot.available_quantity ?? 0)}
                                                            onChange={(e) => updateInventoryDraft(lot.id, 'availableQuantity', e.target.value)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <input
                                                            className={styles.textInput}
                                                            value={inventoryDrafts[lot.id]?.note ?? (lot.note || '')}
                                                            onChange={(e) => updateInventoryDraft(lot.id, 'note', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className={styles.date}>{String(lot.updated_at).slice(0, 19).replace('T', ' ')}</td>
                                                    <td>
                                                        <div className={styles.actionGroup}>
                                                            <button
                                                                className={styles.resetBtn}
                                                                onClick={() => {
                                                                    const draft = inventoryDrafts[lot.id] || {};
                                                                    updateInventoryLot(lot.id, {
                                                                        availableQuantity: Number.parseInt(draft.availableQuantity || '0', 10) || 0,
                                                                        sourceType: draft.sourceType || lot.source_type,
                                                                        sourceRef: draft.sourceRef ?? lot.source_ref ?? '',
                                                                        note: draft.note ?? lot.note ?? '',
                                                                    });
                                                                }}
                                                            >
                                                                Save
                                                            </button>
                                                            <button className={styles.dangerBtn} onClick={() => deleteInventoryLot(lot.id)}>
                                                                Delete
                                                            </button>
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
