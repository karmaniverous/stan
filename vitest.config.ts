import { defineConfig } from 'vitest/config';

/**
 * REQUIREMENTS
 * - Exclude compiled caches from test discovery. [req-vitest-exclude-cache]
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['node_modules/**', 'dist/**', '.rollup.cache/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
