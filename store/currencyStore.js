'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import currencyData from '@/data/currencies.json';

const useCurrencyStore = create(
    persist(
        (set, get) => ({
            currency: 'USD',
            currencies: currencyData.currencies,

            setCurrency: (code) => set({ currency: code }),
            syncRates: async () => {
                try {
                    const res = await fetch('/api/currency-rates');
                    if (!res.ok) return;
                    const data = await res.json();
                    if (Array.isArray(data.rates) && data.rates.length > 0) {
                        set({ currencies: data.rates.map((rate) => ({
                            code: rate.code,
                            symbol: rate.symbol,
                            name: rate.name,
                            rate: rate.rate,
                        })) });
                    }
                } catch {
                    // keep static fallback
                }
            },

            getCurrentCurrency: () => {
                const state = get();
                return state.currencies.find(c => c.code === state.currency) || state.currencies[0];
            },

            convertPrice: (usdPrice) => {
                const current = get().getCurrentCurrency();
                return usdPrice * current.rate;
            },

            formatPrice: (usdPrice) => {
                const current = get().getCurrentCurrency();
                const converted = usdPrice * current.rate;

                // Format based on currency
                if (current.rate > 100) {
                    return `${current.symbol} ${Math.round(converted).toLocaleString()}`;
                }
                return `${current.symbol}${converted.toFixed(2)}`;
            },
        }),
        {
            name: 'iggm-currency',
            partialize: (state) => ({ currency: state.currency }),
        }
    )
);

export default useCurrencyStore;
