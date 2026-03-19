'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import { getProductPath } from '@/lib/catalog-shared';
import styles from './page.module.css';

export default function SearchResults({ initialQuery }) {
    const [query, setQuery] = useState(initialQuery);
    const [loading, setLoading] = useState(false);
    const [games, setGames] = useState([]);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        setQuery(initialQuery);
    }, [initialQuery]);

    useEffect(() => {
        let cancelled = false;

        async function search() {
            if (!query) {
                setGames([]);
                setProducts([]);
                return;
            }

            setLoading(true);
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=12`);
                const payload = await response.json();
                if (!cancelled) {
                    setGames(payload.games || []);
                    setProducts(payload.products || []);
                }
            } catch (error) {
                console.error('Search page error:', error);
                if (!cancelled) {
                    setGames([]);
                    setProducts([]);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        search();
        return () => {
            cancelled = true;
        };
    }, [query]);

    return (
        <div className={styles.resultsWrap}>
            <form className={styles.searchForm} action="/search">
                <input
                    type="text"
                    name="q"
                    defaultValue={initialQuery}
                    placeholder="Search games or products..."
                    className={styles.searchInput}
                />
                <button className={styles.searchButton} type="submit">Search</button>
            </form>

            {loading ? <div className={styles.emptyState}>Loading search results...</div> : null}

            {!loading && !query ? (
                <div className={styles.emptyState}>Enter a keyword to search the marketplace.</div>
            ) : null}

            {!loading && query && games.length === 0 && products.length === 0 ? (
                <div className={styles.emptyState}>No results found for &quot;{query}&quot;.</div>
            ) : null}

            {!loading && games.length > 0 ? (
                <section className={styles.section}>
                    <div className={styles.sectionHead}>
                        <h2>Games</h2>
                        <span>{games.length} matches</span>
                    </div>
                    <div className={styles.gameGrid}>
                        {games.map((game) => (
                            <Link key={game.slug} href={`/${game.slug}/${game.primaryCategory}`} className={styles.gameCard}>
                                <span className={styles.gameIcon}>{game.icon}</span>
                                <div>
                                    <strong>{game.name}</strong>
                                    <p>{game.shortName}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            ) : null}

            {!loading && products.length > 0 ? (
                <section className={styles.section}>
                    <div className={styles.sectionHead}>
                        <h2>Products</h2>
                        <span>{products.length} matches</span>
                    </div>
                    <div className={styles.productLinks}>
                        {products.map((product) => (
                            <Link
                                key={`${product.game_slug}-${product.id}`}
                                href={getProductPath(product.game_slug, product)}
                                className={styles.resultLink}
                            >
                                <div>
                                    <strong>{product.name}</strong>
                                    <p>{product.game_slug} · {product.category}</p>
                                </div>
                                <span>${Number(product.price).toFixed(2)}</span>
                            </Link>
                        ))}
                    </div>
                    <div className={styles.productGrid}>
                        {products.slice(0, 4).map((product) => (
                            <ProductCard key={product.id} product={product} gameSlug={product.game_slug} />
                        ))}
                    </div>
                </section>
            ) : null}
        </div>
    );
}
