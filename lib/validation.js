export function cleanText(value, maxLength = 255) {
    if (typeof value !== 'string') return '';
    return value.replace(/\u0000/g, '').trim().slice(0, maxLength);
}

export function cleanMultilineText(value, maxLength = 2000) {
    if (typeof value !== 'string') return '';
    return value.replace(/\u0000/g, '').replace(/\r/g, '').trim().slice(0, maxLength);
}

export function normalizeEmail(value) {
    return cleanText(value, 320).toLowerCase();
}

export function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isStrongEnoughPassword(value) {
    return typeof value === 'string' && value.length >= 8;
}

export function toInteger(value, fallback = 0) {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function sanitizeOrderItems(items) {
    if (!Array.isArray(items)) return [];

    return items
        .map((item) => ({
            productId: toInteger(item?.productId || item?.id, 0),
            quantity: Math.max(1, Math.min(99, toInteger(item?.quantity, 1))),
            name: cleanText(item?.name || '', 255),
        }))
        .filter((item) => item.productId > 0);
}
