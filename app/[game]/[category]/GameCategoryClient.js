'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import gamesData from '@/data/games.json';
import ProductCard from '@/components/ProductCard';
import SeoContent from '@/components/SeoContent';
import styles from './page.module.css';

const SORT_MAP = {
    az: 'name_asc',
    za: 'name_desc',
    low: 'price_asc',
    high: 'price_desc',
};

export default function GameCategoryClient({ gameSlug, categorySlug }) {
    const [activeFilters, setActiveFilters] = useState(['All']);
    const [subFilter, setSubFilter] = useState('All');
    const [platformFilter, setPlatformFilter] = useState('All');
    const [serverRegionFilter, setServerRegionFilter] = useState('All');
    const [rarityFilter, setRarityFilter] = useState('All');
    const [stockFilter, setStockFilter] = useState('all');
    const [sortBy, setSortBy] = useState('az');
    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState([]);
    const [catalogFilters, setCatalogFilters] = useState({ platforms: [], serverRegions: [], rarities: [] });
    const [loading, setLoading] = useState(true);

    const gameData = useMemo(() => gamesData.find((game) => game.slug === gameSlug), [gameSlug]);

    useEffect(() => {
        let cancelled = false;

        async function loadProducts() {
            setLoading(true);
            try {
                const selectedCategory = activeFilters.find((item) => item !== 'All') || '';
                const params = new URLSearchParams();
                if (selectedCategory) params.set('category', selectedCategory);
                if (subFilter && subFilter !== 'All') params.set('subCategory', subFilter);
                if (platformFilter !== 'All') params.set('platform', platformFilter);
                if (serverRegionFilter !== 'All') params.set('serverRegion', serverRegionFilter);
                if (rarityFilter !== 'All') params.set('rarity', rarityFilter);
                if (stockFilter !== 'all') params.set('stock', stockFilter);
                if (searchQuery.trim()) params.set('search', searchQuery.trim());
                params.set('sort', SORT_MAP[sortBy] || 'name_asc');
                params.set('limit', '120');

                const response = await fetch(`/api/products/${gameSlug}?${params.toString()}`);
                if (!response.ok) {
                    throw new Error('Failed to load products');
                }

                const payload = await response.json();
                if (!cancelled) {
                    setProducts(payload.products || []);
                    setCatalogFilters({
                        platforms: payload.platforms || [],
                        serverRegions: payload.serverRegions || [],
                        rarities: payload.rarities || [],
                    });
                }
            } catch (error) {
                console.error('Catalog fetch error:', error);
                if (!cancelled) {
                    setProducts([]);
                    setCatalogFilters({ platforms: [], serverRegions: [], rarities: [] });
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadProducts();
        return () => {
            cancelled = true;
        };
    }, [activeFilters, subFilter, platformFilter, serverRegionFilter, rarityFilter, stockFilter, sortBy, searchQuery, gameSlug]);

    if (!gameData) {
        return (
            <div className="container" style={{ padding: '80px 0', textAlign: 'center' }}>
                <h1>Game Not Found</h1>
                <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>
                    The game you&apos;re looking for doesn&apos;t exist.
                </p>
                <Link href="/" className="btn btn-primary" style={{ marginTop: '24px', display: 'inline-flex' }}>
                    ← Back Home
                </Link>
            </div>
        );
    }

    const activeCategory = gameData.categories.find((item) => item.slug === categorySlug) || gameData.categories[0];
    const filterTypes = gameData.filters?.itemTypes || ['All'];
    const subTypes = gameData.filters?.subTypes || {};
    const platforms = catalogFilters.platforms.length > 0 ? catalogFilters.platforms : (gameData.filters?.platforms || []);
    const serverRegions = catalogFilters.serverRegions;
    const rarities = catalogFilters.rarities;

    const activeMainFilter = activeFilters.find((filter) => filter !== 'All' && subTypes[filter]);
    const currentSubTypes = activeMainFilter ? subTypes[activeMainFilter] : null;

    const handleFilterToggle = (filter) => {
        if (filter === 'All') {
            setActiveFilters(['All']);
            setSubFilter('All');
            return;
        }
        setActiveFilters((prev) => {
            const without = prev.filter((item) => item !== 'All' && item !== filter);
            if (prev.includes(filter)) {
                return without.length === 0 ? ['All'] : without;
            }
            return [...without, filter];
        });
        setSubFilter('All');
    };

    return (
        <div className={styles.page}>
            <div className="container">
                <nav className={styles.breadcrumbs}>
                    <Link href="/">Home</Link>
                    <span className={styles.breadcrumbSep}>&gt;</span>
                    <Link href={`/${gameSlug}/${gameData.categories[0]?.slug || 'items'}`}>{gameData.name}</Link>
                    <span className={styles.breadcrumbSep}>&gt;</span>
                    <span className={styles.breadcrumbActive}>{activeCategory?.name?.split(' ').pop() || 'Items'}</span>
                </nav>

                <h1 className={styles.pageTitle}>{gameData.name} {activeCategory?.name?.split(' ').pop() || 'Items'}</h1>

                <div className={styles.categoryPills}>
                    {gameData.categories.map((cat) => (
                        <Link
                            key={cat.slug}
                            href={`/${gameSlug}/${cat.slug}`}
                            className={`${styles.pill} ${cat.slug === categorySlug ? styles.pillActive : ''}`}
                        >
                            <span className={styles.pillIcon}>{cat.icon}</span>
                            <span>{cat.name}</span>
                        </Link>
                    ))}
                    <Link href="https://discord.gg/W2qp3n7dpT" className={styles.pill} target="_blank">
                        <span className={styles.pillIcon}>🎁</span>
                        <span>Giveaway</span>
                    </Link>
                    <Link href="/sell-to-us" className={styles.pill}>
                        <span className={styles.pillIcon}>💸</span>
                        <span>Sell To Us</span>
                    </Link>
                    <Link href="/news" className={styles.pill}>
                        <span className={styles.pillIcon}>📰</span>
                        <span>News</span>
                    </Link>
                </div>

                <div className={styles.filterSection}>
                    {platforms.length > 0 && (
                        <div className={styles.filterRow}>
                            <span className={styles.filterLabel}>Platform</span>
                            <div className={styles.filterChips}>
                                {platforms.map((platform) => (
                                    <button
                                        key={platform}
                                        className={`${styles.filterChip} ${platformFilter === platform ? styles.chipActive : ''}`}
                                        onClick={() => setPlatformFilter((prev) => (prev === platform ? 'All' : platform))}
                                    >
                                        {platform}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {serverRegions.length > 0 && (
                        <div className={styles.filterRow}>
                            <span className={styles.filterLabel}>Server</span>
                            <div className={styles.filterChips}>
                                {serverRegions.map((server) => (
                                    <button
                                        key={server}
                                        className={`${styles.filterChip} ${serverRegionFilter === server ? styles.chipActive : ''}`}
                                        onClick={() => setServerRegionFilter((prev) => (prev === server ? 'All' : server))}
                                    >
                                        {server}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {rarities.length > 0 && (
                        <div className={styles.filterRow}>
                            <span className={styles.filterLabel}>Rarity</span>
                            <div className={styles.filterChips}>
                                {rarities.map((item) => (
                                    <button
                                        key={item}
                                        className={`${styles.filterChip} ${rarityFilter === item ? styles.chipActive : ''}`}
                                        onClick={() => setRarityFilter((prev) => (prev === item ? 'All' : item))}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={styles.filterRow}>
                        <span className={styles.filterLabel}>Stock</span>
                        <div className={styles.filterChips}>
                            {[
                                { value: 'all', label: 'All' },
                                { value: 'in_stock', label: 'In Stock' },
                                { value: 'out_of_stock', label: 'Out of Stock' },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    className={`${styles.filterChip} ${stockFilter === option.value ? styles.chipActive : ''}`}
                                    onClick={() => setStockFilter(option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.filterGrid}>
                        {filterTypes.map((type) => (
                            <label key={type} className={styles.filterCheck}>
                                <input
                                    type="checkbox"
                                    checked={activeFilters.includes(type)}
                                    onChange={() => handleFilterToggle(type)}
                                />
                                <span className={styles.checkmark}></span>
                                <span className={styles.checkLabel}>{type}</span>
                            </label>
                        ))}
                    </div>

                    {currentSubTypes && (
                        <div className={styles.subFilterGrid}>
                            {currentSubTypes.map((sub) => (
                                <label key={sub} className={styles.filterCheck}>
                                    <input
                                        type="checkbox"
                                        checked={subFilter === sub}
                                        onChange={() => setSubFilter(sub)}
                                    />
                                    <span className={styles.checkmark}></span>
                                    <span className={styles.checkLabel}>{sub}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                <div className={styles.sortBar}>
                    <div className={styles.sortBarLeft}>
                        <h2 className={styles.sortTitle}>{activeFilters.includes('All') ? 'All' : activeFilters.join(', ')}</h2>
                    </div>
                    <div className={styles.sortBarRight}>
                        <div className={styles.searchItems}>
                            <input
                                type="text"
                                placeholder="Search Items..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className={styles.searchItemsInput}
                            />
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchItemsIcon}>
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.3-4.3" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className={styles.sortOptions}>
                    {[
                        { value: 'az', label: 'From A to Z' },
                        { value: 'za', label: 'From Z to A' },
                        { value: 'low', label: 'Lowest Price' },
                        { value: 'high', label: 'Highest Price' },
                    ].map((option) => (
                        <label key={option.value} className={styles.sortRadio}>
                            <input
                                type="radio"
                                name="sort"
                                value={option.value}
                                checked={sortBy === option.value}
                                onChange={() => setSortBy(option.value)}
                            />
                            <span className={styles.radioMark}></span>
                            <span>{option.label}</span>
                        </label>
                    ))}
                </div>

                <div className={styles.deliveryNotice}>
                    <p>1.We will invite you to a group, Remember to put the items we drop to you in your <strong>Safe Pocket Slots</strong>.</p>
                    <p>We will not response for item lost if you have not put them in safe box.</p>
                    <p>2. Do not take any valuable items to the game.</p>
                </div>

                {loading ? (
                    <div className={styles.noResults}>
                        <p>Loading products...</p>
                    </div>
                ) : (
                    <div className={styles.productGrid}>
                        {products.map((product) => (
                            <ProductCard key={product.id} product={product} gameSlug={gameSlug} />
                        ))}
                    </div>
                )}

                {!loading && products.length === 0 && (
                    <div className={styles.noResults}>
                        <p>No items found. Try adjusting your filters.</p>
                    </div>
                )}

                <SeoContent gameSlug={gameSlug} gameName={gameData.name} couponCode={gameData.couponCode} couponDiscount={gameData.couponDiscount} />
            </div>
        </div>
    );
}
