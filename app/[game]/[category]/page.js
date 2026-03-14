'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import gamesData from '@/data/games.json';
import arcProducts from '@/data/products/arc-raiders.json';
import ProductCard from '@/components/ProductCard';
import SeoContent from '@/components/SeoContent';
import styles from './page.module.css';

// Map game slugs to product data
const productMap = {
    'arc-raiders': arcProducts,
};

export default function GameCategoryPage() {
    const params = useParams();
    const { game: gameSlug, category: categorySlug } = params;

    const [activeFilters, setActiveFilters] = useState(['All']);
    const [subFilter, setSubFilter] = useState('All');
    const [sortBy, setSortBy] = useState('az');
    const [searchQuery, setSearchQuery] = useState('');

    const gameData = gamesData.find(g => g.slug === gameSlug);
    const products = productMap[gameSlug] || [];

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

    const activeCategory = gameData.categories.find(c => c.slug === categorySlug) || gameData.categories[0];
    const filterTypes = gameData.filters?.itemTypes || ['All'];
    const subTypes = gameData.filters?.subTypes || {};
    const platforms = gameData.filters?.platforms || [];

    // Get active sub-categories
    const activeMainFilter = activeFilters.find(f => f !== 'All' && subTypes[f]);
    const currentSubTypes = activeMainFilter ? subTypes[activeMainFilter] : null;

    let filteredProducts = [...products];

    if (!activeFilters.includes('All') && activeFilters.length > 0) {
        filteredProducts = filteredProducts.filter((product) => activeFilters.includes(product.category));
    }

    if (subFilter && subFilter !== 'All' && activeMainFilter) {
        filteredProducts = filteredProducts.filter((product) => product.subCategory === subFilter);
    }

    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filteredProducts = filteredProducts.filter((product) => product.name.toLowerCase().includes(query));
    }

    switch (sortBy) {
        case 'az':
            filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'za':
            filteredProducts.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'low':
            filteredProducts.sort((a, b) => a.price - b.price);
            break;
        case 'high':
            filteredProducts.sort((a, b) => b.price - a.price);
            break;
        default:
            break;
    }

    const handleFilterToggle = (filter) => {
        if (filter === 'All') {
            setActiveFilters(['All']);
            setSubFilter('All');
            return;
        }
        setActiveFilters(prev => {
            const without = prev.filter(f => f !== 'All' && f !== filter);
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
                {/* Breadcrumbs */}
                <nav className={styles.breadcrumbs}>
                    <Link href="/">Home</Link>
                    <span className={styles.breadcrumbSep}>&gt;</span>
                    <Link href={`/${gameSlug}/${gameData.categories[0]?.slug || 'items'}`}>{gameData.name}</Link>
                    <span className={styles.breadcrumbSep}>&gt;</span>
                    <span className={styles.breadcrumbActive}>{activeCategory?.name?.split(' ').pop() || 'Items'}</span>
                </nav>

                {/* Page Title */}
                <h1 className={styles.pageTitle}>{gameData.name} {activeCategory?.name?.split(' ').pop() || 'Items'}</h1>

                {/* Category Pills */}
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
                    <Link href={`https://discord.gg/W2qp3n7dpT`} className={styles.pill} target="_blank">
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

                {/* Filters */}
                <div className={styles.filterSection}>
                    {/* Platform */}
                    {platforms.length > 0 && (
                        <div className={styles.filterRow}>
                            <span className={styles.filterLabel}>Platform</span>
                            <div className={styles.filterChips}>
                                {platforms.map((platform) => (
                                    <button key={platform} className={`${styles.filterChip} ${styles.chipActive}`}>
                                        {platform}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Item Type Filters */}
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

                    {/* Sub-type filters */}
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

                {/* Sort & Search */}
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

                {/* Sort Options */}
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

                {/* Delivery Notice */}
                <div className={styles.deliveryNotice}>
                    <p>1.We will invite you to a group, Remember to put the items we drop to you in your <strong>Safe Pocket Slots</strong>.</p>
                    <p>We will not response for item lost if you have not put them in safe box.</p>
                    <p>2. Do not take any valuable items to the game.</p>
                </div>

                {/* Product Grid */}
                <div className={styles.productGrid}>
                    {filteredProducts.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>

                {filteredProducts.length === 0 && mounted && (
                    <div className={styles.noResults}>
                        <p>No items found. Try adjusting your filters.</p>
                    </div>
                )}

                {/* SEO Content */}
                <SeoContent gameSlug={gameSlug} gameName={gameData.name} couponCode={gameData.couponCode} couponDiscount={gameData.couponDiscount} />
            </div>
        </div>
    );
}
