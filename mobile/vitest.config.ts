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
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'tests/mocks/react-native.ts'),
      'react-native-svg': path.resolve(__dirname, 'tests/mocks/react-native-svg.ts'),
      'expo-constants': path.resolve(__dirname, 'tests/mocks/expo-constants.ts'),
      'react-native-safe-area-context': path.resolve(__dirname, 'tests/mocks/react-native-safe-area-context.ts'),
    },
  },
  test: {
    globals: true,
    testTimeout: 15000,
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
        'src/e2e/**',
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
