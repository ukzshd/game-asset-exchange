import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductCard from '@/components/ProductCard';
import { getAppUrl } from '@/lib/env';
import { getGameBySlug, getProductByGameAndIdentifier, getProductIcon, getProductPath, getRelatedProducts } from '@/lib/catalog';
import ProductDetailClient from './ProductDetailClient';
import styles from './page.module.css';

export async function generateMetadata({ params }) {
    const { game, id } = await params;
    const gameData = getGameBySlug(game);
    const product = await getProductByGameAndIdentifier(game, id);

    if (!gameData || !product) {
        return {
            title: 'Product Not Found | IGGM',
            description: 'The requested product does not exist.',
        };
    }

    const title = `${product.name} | Buy ${gameData.name} Items | IGGM`;
    const description = product.description
        ? product.description.slice(0, 150)
        : `Buy ${product.name} for ${gameData.name} with secure checkout and manual in-game delivery.`;

    return {
        title,
        description,
        alternates: {
            canonical: getProductPath(game, product),
        },
        openGraph: {
            title,
            description,
            type: 'product',
            url: `${getAppUrl()}${getProductPath(game, product)}`,
        },
    };
}

export default async function ProductDetailPage({ params }) {
    const { game, id } = await params;
    const gameData = getGameBySlug(game);
    const product = await getProductByGameAndIdentifier(game, id);

    if (!gameData || !product) {
        notFound();
    }

    const related = await getRelatedProducts(game, product.id, product.category, 4);
    const breadcrumbCategory = gameData.categories?.[0]?.slug || 'items';
    const offerUrl = `${getAppUrl()}${getProductPath(game, product)}`;

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description || `${product.name} for ${gameData.name}`,
        category: product.category,
        brand: {
            '@type': 'Brand',
            name: 'IGGM',
        },
        offers: {
            '@type': 'Offer',
            priceCurrency: 'USD',
            price: Number(product.price).toFixed(2),
            availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: offerUrl,
        },
    };

    return (
        <div className={styles.page}>
            <div className="container">
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />

                <nav className={styles.breadcrumbs}>
                    <Link href="/">Home</Link>
                    <span className={styles.sep}>&gt;</span>
                    <Link href={`/${game}/${breadcrumbCategory}`}>{gameData.name}</Link>
                    <span className={styles.sep}>&gt;</span>
                    <span>{product.name}</span>
                </nav>

                <div className={styles.hero}>
                    <div className={styles.visualCard}>
                        <div className={styles.iconWrap}>{getProductIcon(product.category)}</div>
                        <div className={styles.metaList}>
                            <span className={styles.metaPill}>{product.category}</span>
                            {product.sub_category ? <span className={styles.metaPill}>{product.sub_category}</span> : null}
                            <span className={`${styles.metaPill} ${product.in_stock ? styles.stockIn : styles.stockOut}`}>
                                {product.in_stock ? 'In Stock' : 'Out of Stock'}
                            </span>
                        </div>
                    </div>

                    <div className={styles.content}>
                        <h1 className={styles.title}>{product.name}</h1>
                        <p className={styles.description}>
                            {product.description || `Manual in-game delivery for ${gameData.name}.`}
                        </p>

                        <div className={styles.highlights}>
                            <div className={styles.highlight}>
                                <strong>Delivery</strong>
                                <span>Manual in-game handoff after payment confirmation.</span>
                            </div>
                            <div className={styles.highlight}>
                                <strong>Game</strong>
                                <span>{gameData.name}</span>
                            </div>
                            <div className={styles.highlight}>
                                <strong>Support</strong>
                                <span>Order moves through paid, assigned, delivering, and completed states.</span>
                            </div>
                        </div>

                        <ProductDetailClient product={product} />
                    </div>
                </div>

                <section className={styles.section}>
                    <h2>Delivery Notes</h2>
                    <ul className={styles.notesList}>
                        <li>Use a correct game ID in checkout so operations staff can reach you without delay.</li>
                        <li>Bring only what is necessary into the delivery session.</li>
                        <li>High-value items should be secured immediately after handoff.</li>
                    </ul>
                </section>

                {product.description ? (
                    <section className={styles.section}>
                        <h2>Package Details</h2>
                        <p className={styles.longText}>{product.description}</p>
                    </section>
                ) : null}

                {related.length > 0 ? (
                    <section className={styles.section}>
                        <div className={styles.sectionHead}>
                            <h2>Related Products</h2>
                            <Link href={`/${game}/${breadcrumbCategory}`} className={styles.sectionLink}>View catalog</Link>
                        </div>
                        <div className={styles.relatedGrid}>
                            {related.map((item) => (
                                <ProductCard key={item.id} product={item} gameSlug={game} />
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        </div>
    );
}
