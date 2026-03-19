import Link from 'next/link';
import { getAppUrl } from '@/lib/env';
import SearchResults from './search-results';
import styles from './page.module.css';

export async function generateMetadata({ searchParams }) {
    const params = await searchParams;
    const query = String(params?.q || '').trim();

    return {
        title: query ? `Search: ${query} | IGGM` : 'Search Marketplace | IGGM',
        description: query
            ? `Search marketplace results for ${query}.`
            : 'Search games and products across the marketplace.',
        alternates: {
            canonical: query ? `/search?q=${encodeURIComponent(query)}` : '/search',
        },
        openGraph: {
            title: query ? `Search: ${query} | IGGM` : 'Search Marketplace | IGGM',
            description: query
                ? `Search marketplace results for ${query}.`
                : 'Search games and products across the marketplace.',
            url: `${getAppUrl()}/search${query ? `?q=${encodeURIComponent(query)}` : ''}`,
        },
    };
}

export default async function SearchPage({ searchParams }) {
    const params = await searchParams;
    const query = String(params?.q || '').trim();

    return (
        <div className={styles.page}>
            <div className="container">
                <nav className={styles.breadcrumbs}>
                    <Link href="/">Home</Link>
                    <span>&gt;</span>
                    <span>Search</span>
                </nav>

                <header className={styles.header}>
                    <h1>Search Marketplace</h1>
                    <p>{query ? `Showing search results for "${query}"` : 'Search products and games from the header or this page.'}</p>
                </header>

                <SearchResults initialQuery={query} />
            </div>
        </div>
    );
}
