import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/diagnostics/*.snapshot.test.ts'],
    testTimeout: 60_000,
  },
});
