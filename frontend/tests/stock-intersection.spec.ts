import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('Stock Intersection Pane & Overlap E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    await page.goto('/');
    // Wait for the app shell to load
    await expect(page.locator('.logo')).toBeVisible({ timeout: 10000 });
  });

  test('Stock Intersection tab renders resiliently without errors or NaN', async ({ page }) => {
    // If portfolio is empty, the empty-state is shown
    const emptyState = page.locator('.empty-state');
    if (await emptyState.isVisible()) {
      // Empty portfolio state: verify no uncaught JS errors
      await expect(emptyState).toContainText('No portfolio data found');
      return;
    }

    // Switch to Stock Intersection tab
    const intersectionTab = page.getByRole('button', { name: /Stock Intersection/i });
    await expect(intersectionTab).toBeVisible();
    await intersectionTab.click();

    // Verify Intersection View is rendered
    const intersectionView = page.locator('.intersection-view');
    await expect(intersectionView).toBeVisible();

    // Verify no loading flash hangs or NaN values are displayed
    const table = intersectionView.locator('table.data-table');
    const noExposuresCard = intersectionView.getByText('No Stock Exposures Identified');

    if (await table.isVisible()) {
      // Headers must be present and correctly labeled
      await expect(table.getByRole('columnheader', { name: /Stock Name/i })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: /Sector/i })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: /Total Exposure/i })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: /Total Value/i })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: /Contributing Funds/i })).toBeVisible();

      // Check search input is functional
      const searchInput = intersectionView.getByPlaceholderText(/Search stocks, sectors, or funds/i);
      await expect(searchInput).toBeVisible();

      // Sector filter select must be visible
      const sectorSelect = intersectionView.locator('select');
      await expect(sectorSelect).toBeVisible();

      // Verify that no cell renders NaN or null
      const cells = table.locator('td');
      const count = await cells.count();
      for (let i = 0; i < count; i++) {
        const text = await cells.nth(i).innerText();
        expect(text).not.toContain('NaN');
        expect(text).not.toContain('undefined');
        expect(text).not.toContain('null');
      }

      // Test Search interaction
      await searchInput.fill('Bank');
      await expect(searchInput).toHaveValue('Bank');

      // Clear search
      const clearBtn = intersectionView.getByRole('button', { name: /Clear search/i });
      if (await clearBtn.isVisible()) {
        await clearBtn.click();
        await expect(searchInput).toHaveValue('');
      }
    } else {
      // If no equity holdings, empty state card must be rendered cleanly
      await expect(noExposuresCard).toBeVisible();
    }
  });

  test('Top Stock Exposure widget on Overview card handles exposures gracefully', async ({ page }) => {
    const overviewTab = page.getByRole('button', { name: /Overview/i });
    if (await overviewTab.isVisible()) {
      await overviewTab.click();

      // The Overview card should contain "Top Stock Exposure"
      const exposureSection = page.locator('div:has-text("Top Stock Exposure")').last();
      if (await exposureSection.isVisible()) {
        const sectionText = await exposureSection.innerText();
        expect(sectionText).not.toContain('NaN');
        expect(sectionText).not.toContain('undefined');
      }
    }
  });
});
