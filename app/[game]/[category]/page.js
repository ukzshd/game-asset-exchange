import { notFound } from 'next/navigation';
import { getGameBySlug, getGameCategory } from '@/lib/catalog-shared';
import { getAppUrl } from '@/lib/env';
import GameCategoryClient from './GameCategoryClient';

export async function generateMetadata({ params }) {
    const { game, category } = await params;
    const gameData = getGameBySlug(game);
    const categoryData = getGameCategory(game, category);

    if (!gameData || !categoryData) {
        return {
            title: 'Catalog Not Found | IGGM',
            description: 'The requested game catalog does not exist.',
        };
    }

    const title = `${categoryData.name} | Buy ${gameData.name} Assets Fast | IGGM`;
    const description = `Browse ${gameData.name} ${categoryData.name.toLowerCase()} with secure checkout, fast manual delivery, and operations-backed fulfillment.`;

    return {
        title,
        description,
        alternates: {
            canonical: `/${game}/${category}`,
        },
        openGraph: {
            title,
            description,
            type: 'website',
            url: `${getAppUrl()}/${game}/${category}`,
        },
    };
}

export default async function GameCategoryPage({ params }) {
    const { game, category } = await params;
    const gameData = getGameBySlug(game);
    const categoryData = getGameCategory(game, category);

    if (!gameData || !categoryData) {
        notFound();
    }

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${gameData.name} ${categoryData.name}`,
        description: `Marketplace catalog for ${gameData.name} ${categoryData.name.toLowerCase()}.`,
        url: `${getAppUrl()}/${game}/${category}`,
        isPartOf: {
            '@type': 'WebSite',
            name: 'IGGM',
            url: getAppUrl(),
        },
    };

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <GameCategoryClient gameSlug={game} categorySlug={category} />
        </>
    );
}
