import { defineConfig, devices } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Stop the suite immediately after 1 failure */
  maxFailures: 1,
  /* Opt out of parallel execution to keep process linear for the agent */
  workers: 1,
  /* Force a clean exit without triggering an interactive browser/HTML report */
  reporter: 'line',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    
    // Prevent the agent from getting stuck on default 30-second timeouts
    actionTimeout: 5000, 
    navigationTimeout: 10000,

    // Inject localStorage state to bypass auth globally
    storageState: {
      cookies: [],
      origins: [
        {
          origin: process.env.E2E_BASE_URL || 'http://localhost:5173',
          localStorage: [
            { name: 'bypass-auth', value: 'true' },
            { name: 'token', value: 'mock-token' },
            { name: 'user', value: '{"id":"test-user","email":"test@example.com","name":"Test User"}' }
          ]
        }
      ]
    },
    // Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
