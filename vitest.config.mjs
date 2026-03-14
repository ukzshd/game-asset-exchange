import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.js'],
        coverage: {
            enabled: false,
        },
    },
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./', import.meta.url)),
        },
    },
});
