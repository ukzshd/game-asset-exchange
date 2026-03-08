'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCartStore = create(
    persist(
        (set, get) => ({
            items: [],

            addItem: (product, quantity = 1) => {
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
        }),
        {
            name: 'iggm-cart',
        }
    )
);

export default useCartStore;
