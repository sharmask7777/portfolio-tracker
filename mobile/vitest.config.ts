import { defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __DEV__: true,
  },
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'app/_layout.tsx',
        'app/(auth)/_layout.tsx',
        'app/(tabs)/_layout.tsx',
        'src/types/**',
        'src/components/index.ts',
        'src/db/index.ts',
        'src/feeds/index.ts',
        'src/services/index.ts',
      ],
      thresholds: {
        lines: 85,
        statements: 85,
        functions: 80,
        branches: 70,
      },
    },
  },
});
