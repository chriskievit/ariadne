import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    // e2e/ and scripts/screenshots/ are both Playwright, not Vitest -- their
    // *.spec.ts files throw "test() was not expected here" if collected.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/.claude/**',
      '**/e2e/**',
      '**/scripts/screenshots/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
