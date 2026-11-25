import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    exclude: ['node_modules', 'dist', 'playwright-report', 'tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'src/ActiveTabRouter.tsx',
        'src/DashboardActionHeader.tsx',
        'src/DashboardModals.tsx',
        'src/useDashboardController.ts',
        'src/useDashboardMutations.ts',
        'src/main.tsx',
        'src/components/Auth/SignupPage.tsx',
        'src/components/Dashboard/EmptyStatePlaceholder.tsx',
        'src/types/**',
        '**/*.css',
      ],
      thresholds: {
        lines: 88,
        statements: 86,
        functions: 85,
        branches: 65,
      },
    },
  },
});
