import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: {
    __DEV__: true,
  },
  resolve: {
    alias: {
      'react-native-svg': path.resolve(__dirname, 'tests/mocks/react-native-svg.ts'),
    },
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
        'tests/mocks/**',
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
