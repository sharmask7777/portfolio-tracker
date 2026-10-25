import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';
import { BasePage } from './pom/base.page';

test.describe('Smoke Suite', () => {
  test.describe('Standard Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuth(page);
    });

    test('has title and logo', async ({ page }) => {
      await page.goto('/');

      // Expect a title "to contain" a substring.
      await expect(page).toHaveTitle(/frontend/);

      // Check for the logo text
      await expect(page.locator('.logo')).toContainText('Portfolio Tracker');
    });

    test('shows empty state when no data', async ({ page }) => {
      // We mock the API to return a 404 or empty object if we want to be sure
      await page.route('**/api/portfolio/summary*', async route => {
        await route.fulfill({ status: 200, body: JSON.stringify(null) });
      });

      await page.goto('/');
      
      // Wait for loading to finish
      await expect(page.locator('.loading-state')).not.toBeVisible();
      
      // Should show empty state
      await expect(page.locator('.empty-state h2')).toContainText('No portfolio data found');
    });
  });

  test.describe('Unhandled Page Error Detection', () => {
    test('catches unhandled page error with stack trace when uncaught exception is thrown', async ({ page }) => {
      // Initialize BasePage with failOnPageError: false to inspect captured errors
      const basePage = new BasePage(page, { failOnPageError: false });
      await setupAuth(page, { failOnPageError: false });

      const caughtErrors: Error[] = [];
      page.on('pageerror', (err) => {
        caughtErrors.push(err);
      });

      // Inject an uncaught runtime exception into component/window lifecycle
      await page.addInitScript(() => {
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            throw new Error('Component crashed: uncaught runtime exception during render');
          }, 10);
        });
      });

      // Navigate to the page
      await page.goto('/');

      // Verify that Playwright catches the error via page.on('pageerror')
      await expect.poll(() => caughtErrors.length, { timeout: 5000 }).toBeGreaterThan(0);
      const err = caughtErrors[0];
      expect(err.message).toContain('Component crashed: uncaught runtime exception during render');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('Component crashed: uncaught runtime exception');

      // Also verify BasePage tracked the error
      expect(basePage.getPageErrors().length).toBeGreaterThan(0);
      expect(basePage.getPageErrors()[0].message).toContain('Component crashed');
    });

    test('fails test immediately with stack trace when uncaught exception is thrown and failOnPageError is active', async ({ page }) => {
      test.fail(true, 'Test is expected to fail due to unhandled page error listener throwing');
      await setupAuth(page, { failOnPageError: true });

      await page.addInitScript(() => {
        window.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            throw new Error('Fatal unhandled runtime exception in UI component');
          }, 10);
        });
      });

      await page.goto('/');
      // Wait long enough for DOMContentLoaded and error to trigger listener
      await page.waitForTimeout(500);
    });
  });
});
