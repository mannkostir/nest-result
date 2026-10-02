import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    swagger: 'src/swagger/index.ts',
    transactional: 'src/transactional/index.ts',
    'unit-of-work': 'src/unit-of-work/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  clean: true,
  sourcemap: true,
  target: 'node22',
  tsconfig: 'tsconfig.build.json',
});
