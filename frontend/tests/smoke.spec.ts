import { test, expect } from '@playwright/test';

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
    await route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) });
  });

  await page.goto('/');
  
  // Wait for loading to finish
  await expect(page.locator('.loading-state')).not.toBeVisible();
  
  // Should show empty state
  await expect(page.locator('.empty-state h2')).toContainText('No portfolio data found');
});
