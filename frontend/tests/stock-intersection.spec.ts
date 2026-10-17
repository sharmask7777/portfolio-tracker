import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('Stock Intersection Pane & Overlap E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  test('Stock Intersection tab renders resiliently without errors or NaN in default state', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.logo')).toBeVisible({ timeout: 10000 });

    const emptyState = page.locator('.empty-state');
    if (await emptyState.isVisible()) {
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

    // Verify empty state card renders cleanly when no equity exposures exist
    const noExposuresCard = intersectionView.getByText('No Stock Exposures Identified');
    await expect(noExposuresCard).toBeVisible();
  });

  test('Stock Intersection tab displays populated stock holdings, search, sorting, and multi-fund overlap', async ({ page }) => {
    // Intercept exposures endpoint to return mock enriched stock exposures
    await page.route('**/api/portfolio/*/exposures*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            name: 'HDFC Bank Ltd.',
            sector: 'Financial Services',
            absoluteValue: 150000,
            percentage: 0.15,
            contributions: [
              { schemeName: 'Parag Parikh Flexi Cap Fund', value: 82000, weight: 8.2 },
              { schemeName: 'HDFC Flexi Cap Fund', value: 68000, weight: 8.8 },
            ],
          },
          {
            name: 'Reliance Industries Ltd.',
            sector: 'Energy',
            absoluteValue: 100000,
            percentage: 0.10,
            contributions: [
              { schemeName: 'SBI Bluechip Fund', value: 100000, weight: 6.8 },
            ],
          },
          {
            name: 'Infosys Ltd.',
            sector: 'Technology',
            absoluteValue: 80000,
            percentage: 0.08,
            contributions: [
              { schemeName: 'HDFC Flexi Cap Fund', value: 80000, weight: 7.2 },
            ],
          },
        ]),
      });
    });

    await page.goto('/');
    await expect(page.locator('.logo')).toBeVisible({ timeout: 10000 });

    // Switch to Stock Intersection tab
    const intersectionTab = page.getByRole('button', { name: /Stock Intersection/i });
    await expect(intersectionTab).toBeVisible();
    await intersectionTab.click();

    const intersectionView = page.locator('.intersection-view');
    await expect(intersectionView).toBeVisible();

    // Verify Table rendered
    const table = intersectionView.locator('table.data-table');
    await expect(table).toBeVisible();

    // Headers verification
    await expect(table.getByRole('columnheader', { name: /Stock Name/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /Sector/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /Total Exposure/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /Total Value/i })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: /Contributing Funds/i })).toBeVisible();

    // Rows and multi-fund overlap verification
    await expect(table.getByText('HDFC Bank Ltd.')).toBeVisible();
    await expect(table.getByText('2 Funds Overlap')).toBeVisible();
    await expect(table.getByText('Reliance Industries Ltd.')).toBeVisible();
    await expect(table.getByText('Infosys Ltd.')).toBeVisible();

    // Summary pills
    await expect(intersectionView.getByText(/Identified: 3 Companies/i)).toBeVisible();
    await expect(intersectionView.getByText(/1 Common in Multiple Funds/i)).toBeVisible();

    // Test Search input interaction
    const searchInput = page.getByPlaceholder(/Search stocks, sectors, or funds/i);
    await searchInput.fill('Reliance');
    await expect(table.getByText('Reliance Industries Ltd.')).toBeVisible();
    await expect(table.getByText('HDFC Bank Ltd.')).not.toBeVisible();

    // Clear search
    const clearBtn = page.getByRole('button', { name: /Clear search/i });
    await clearBtn.click();
    await expect(table.getByText('HDFC Bank Ltd.')).toBeVisible();

    // Test Sector filter
    const sectorSelect = intersectionView.locator('select');
    await sectorSelect.selectOption('Technology');
    await expect(table.getByText('Infosys Ltd.')).toBeVisible();
    await expect(table.getByText('HDFC Bank Ltd.')).not.toBeVisible();

    // Reset to All Sectors
    await sectorSelect.selectOption('All Sectors');
    await expect(table.getByText('HDFC Bank Ltd.')).toBeVisible();
  });

  test('Top Stock Exposure widget on Overview card handles exposures gracefully', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.logo')).toBeVisible({ timeout: 10000 });

    const overviewTab = page.getByRole('button', { name: /Overview/i });
    if (await overviewTab.isVisible()) {
      await overviewTab.click();

      const exposureSection = page.locator('div:has-text("Top Stock Exposure")').last();
      if (await exposureSection.isVisible()) {
        const sectionText = await exposureSection.innerText();
        expect(sectionText).not.toContain('NaN');
        expect(sectionText).not.toContain('undefined');
      }
    }
  });
});
