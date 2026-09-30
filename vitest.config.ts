import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.snapshot.test.ts', 'test/package/**', 'node_modules/**'],
    testTimeout: 20_000,
  },
});
