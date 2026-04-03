'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function getCatalogSource(item) {
    return item?.catalogSource || item?.catalog_source || 'platform';
}

function getSellerId(item) {
    return item?.sellerSummary?.sellerId || item?.seller_user_id || item?.sellerUserId || null;
}

function getCartConflict(items, product) {
    if (!items.length) return '';

    const currentSource = getCatalogSource(items[0]);
    const nextSource = getCatalogSource(product);
    if (currentSource !== nextSource) {
        return 'Platform and marketplace items must be checked out separately.';
    }

    if (nextSource === 'marketplace') {
        const currentSellerId = getSellerId(items[0]);
        const nextSellerId = getSellerId(product);
        if (currentSellerId && nextSellerId && String(currentSellerId) !== String(nextSellerId)) {
            return 'Marketplace items from different sellers must be purchased separately.';
        }
    }

    return '';
}

const useCartStore = create(
    persist(
        (set, get) => ({
            items: [],

            addItem: (product, quantity = 1) => {
                const conflict = getCartConflict(get().items, product);
                if (conflict) {
                    return { ok: false, error: conflict };
                }

                set((state) => {
                    const existingIndex = state.items.findIndex(item => item.id === product.id);
                    if (existingIndex >= 0) {
                        const newItems = [...state.items];
                        newItems[existingIndex] = {
                            ...newItems[existingIndex],
                            quantity: newItems[existingIndex].quantity + quantity,
                        };
                        return { items: newItems };
                    }
                    return {
                        items: [...state.items, { ...product, quantity }],
                    };
                });
                return { ok: true };
            },

            removeItem: (productId) => {
                set((state) => ({
                    items: state.items.filter(item => item.id !== productId),
                }));
            },

            updateQuantity: (productId, quantity) => {
                if (quantity < 1) return;
                set((state) => ({
                    items: state.items.map(item =>
                        item.id === productId ? { ...item, quantity } : item
                    ),
                }));
            },

            clearCart: () => set({ items: [] }),

            getItemCount: () => {
                return get().items.reduce((total, item) => total + item.quantity, 0);
            },

            getSubtotal: () => {
                return get().items.reduce(
                    (total, item) => total + item.price * item.quantity,
                    0
                );
            },

            getCartConflict: (product) => getCartConflict(get().items, product),
        }),
        {
            name: 'iggm-cart',
        }
    )
);

export default useCartStore;
