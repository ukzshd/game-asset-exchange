'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import currencyData from '@/data/currencies.json';

// Dynamically load translations
const translationCache = {};

async function loadTranslation(lang) {
    if (translationCache[lang]) return translationCache[lang];
    try {
        const mod = await import(`@/data/translations/${lang}.json`);
        translationCache[lang] = mod.default;
        return mod.default;
    } catch {
        // Fallback to English
        const mod = await import('@/data/translations/en.json');
        translationCache[lang] = mod.default;
        return mod.default;
    }
}

const useLanguageStore = create(
    persist(
        (set, get) => ({
            language: 'en',
            languages: currencyData.languages,
            translations: null,
            isLoaded: false,

            setLanguage: async (code) => {
                const translations = await loadTranslation(code);
                set({ language: code, translations, isLoaded: true });
            },

            initTranslations: async () => {
                const state = get();
                if (!state.isLoaded) {
                    const translations = await loadTranslation(state.language);
                    set({ translations, isLoaded: true });
                }
            },

            t: (key) => {
                const state = get();
                if (!state.translations) return key;

                // Support dot notation: 'nav.searchPlaceholder'
                const keys = key.split('.');
                let value = state.translations;
                for (const k of keys) {
                    value = value?.[k];
                }
                return value || key;
            },
        }),
        {
            name: 'iggm-language',
            partialize: (state) => ({ language: state.language }),
        }
    )
);

export default useLanguageStore;
