import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

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

test('alerts when exporting empty realized gains', async ({ page }) => {
  // Mock summary API to return a portfolio, but no realized gains details
  await page.route('**/api/portfolio/summary*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-portfolio-id',
        name: 'Mock Portfolio',
        folios: [],
        metrics: { totalInvested: 1000, totalValue: 1200, totalGain: 200, absoluteReturn: 0.2, xirr: 0.15, postTaxAbsoluteReturn: 0.18, postTaxXirr: 0.12, dayChange: 15, dayChangePercentage: 1.25 },
        details: []
      }),
    });
  });

  await page.goto('/');
  
  // Click on the Tax Optimization tab
  await page.getByRole('button', { name: /Tax Optimization/i }).click();

  // Listen for the dialog trigger
  let alertMessage = '';
  page.on('dialog', async dialog => {
    alertMessage = dialog.message();
    await dialog.accept();
  });

  // Click the export button
  await page.getByRole('button', { name: /Export ITR Report/i }).click();

  // Assert that alert was called with correct message
  expect(alertMessage).toBe('No realized gains found for this period to export.');
});

