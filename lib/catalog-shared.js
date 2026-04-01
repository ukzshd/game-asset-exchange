import games from '@/data/games.json';

export function getGameBySlug(gameSlug) {
    return games.find((game) => game.slug === gameSlug) || null;
}

export function getGameCategory(gameSlug, categorySlug) {
    const game = getGameBySlug(gameSlug);
    if (!game) return null;
    return game.categories?.find((category) => category.slug === categorySlug) || game.categories?.[0] || null;
}

export function getProductPath(gameSlug, product) {
    return `/${gameSlug}/product/${product.external_id || product.id}`;
}

export function getProductIcon(category) {
    switch (category) {
        case 'BluePrint':
            return '📋';
        case 'Weapon':
            return '🔫';
        case 'Modded Weapon':
            return '⚡';
        case 'Key':
            return '🔑';
        case 'Shield And Augment':
            return '🛡️';
        case 'Loadout':
            return '🎒';
        case 'Material':
        case 'Weather Monitor Material':
        case 'Trophy Display Material':
        case 'Expedition Material':
        case 'Station Material':
            return '🧰';
        case 'Misc':
            return '📦';
        default:
            return '📦';
    }
}
