import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '@/lib/db';
import { getAppUrl } from '@/lib/env';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const db = await getDb();
    const article = await db.prepare('SELECT * FROM content_articles WHERE slug = ? AND published = 1').get(slug);

    if (!article) {
        return { title: 'Article Not Found | IGGM', description: 'The requested article does not exist.' };
    }

    return {
        title: `${article.title} | IGGM`,
        description: article.excerpt || article.title,
        alternates: { canonical: `/news/${article.slug}` },
        openGraph: {
            title: article.title,
            description: article.excerpt || article.title,
            url: `${getAppUrl()}/news/${article.slug}`,
        },
    };
}

export default async function NewsArticlePage({ params }) {
    const { slug } = await params;
    const db = await getDb();
    const article = await db.prepare('SELECT * FROM content_articles WHERE slug = ? AND published = 1').get(slug);

    if (!article) {
        notFound();
    }

    const related = await db.prepare(`
        SELECT id, slug, title
        FROM content_articles
        WHERE published = 1 AND id != ?
        ORDER BY published_at DESC
        LIMIT 4
    `).all(article.id);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.excerpt || article.title,
        datePublished: article.published_at,
        dateModified: article.updated_at,
        mainEntityOfPage: `${getAppUrl()}/news/${article.slug}`,
        author: { '@type': 'Organization', name: 'IGGM' },
    };

    return (
        <div className={styles.page}>
            <div className="container">
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
                <nav className={styles.breadcrumbs}>
                    <Link href="/">Home</Link>
                    <span>&gt;</span>
                    <Link href="/news">News</Link>
                    <span>&gt;</span>
                    <span>{article.title}</span>
                </nav>
                <article className={styles.article}>
                    <div className={styles.badges}>
                        <span>{article.category}</span>
                        {article.game_slug ? <span>{article.game_slug}</span> : null}
                    </div>
                    <h1>{article.title}</h1>
                    <p className={styles.excerpt}>{article.excerpt}</p>
                    <div className={styles.content}>
                        {article.content.split('\n').filter(Boolean).map((paragraph, index) => (
                            <p key={index}>{paragraph}</p>
                        ))}
                    </div>
                </article>
                {related.length > 0 ? (
                    <section className={styles.related}>
                        <h2>Related Articles</h2>
                        <div className={styles.relatedList}>
                            {related.map((item) => (
                                <Link key={item.id} href={`/news/${item.slug}`}>{item.title}</Link>
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>
        </div>
    );
}
