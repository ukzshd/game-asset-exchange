import Link from 'next/link';
import { getAppUrl } from '@/lib/env';
import { getDb } from '@/lib/db';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export const metadata = {
    title: 'News & Guides | IGGM',
    description: 'Marketplace guides, trading notes, and game item articles.',
};

export default async function NewsPage() {
    const db = await getDb();
    const articles = await db.prepare(`
        SELECT id, slug, title, excerpt, category, game_slug, published_at
        FROM content_articles
        WHERE published = 1
        ORDER BY published_at DESC, created_at DESC
    `).all();

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Blog',
        name: 'IGGM News',
        url: `${getAppUrl()}/news`,
    };

    return (
        <div className={styles.page}>
            <div className="container">
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
                <header className={styles.header}>
                    <h1>News & Guides</h1>
                    <p>Trading notes, delivery guidance, and game-specific buying articles.</p>
                </header>
                <div className={styles.grid}>
                    {articles.map((article) => (
                        <Link key={article.id} href={`/news/${article.slug}`} className={styles.card}>
                            <div className={styles.badges}>
                                <span>{article.category}</span>
                                {article.game_slug ? <span>{article.game_slug}</span> : null}
                            </div>
                            <h2>{article.title}</h2>
                            <p>{article.excerpt}</p>
                            <span className={styles.meta}>{article.published_at?.toISOString?.()?.slice(0, 10) || String(article.published_at).slice(0, 10)}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
