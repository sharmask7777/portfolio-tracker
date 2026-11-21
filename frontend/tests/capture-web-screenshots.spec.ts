import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';
import path from 'node:path';
import fs from 'node:fs';

test.describe('Web Dashboard Screenshot Capture for Cross-Platform Parity', () => {
  const rootScreenshotsDir = path.resolve(process.cwd(), '../screenshots');

  test.beforeAll(() => {
    fs.mkdirSync(rootScreenshotsDir, { recursive: true });
  });

  interface ScreenshotTarget {
    screenshot(options: { path: string }): Promise<Buffer>;
  }

  const saveToBoth = async (target: ScreenshotTarget, filename: string) => {
    const rootPath = path.join(rootScreenshotsDir, filename);
    await target.screenshot({ path: rootPath });
  };

  test('captures matching web screenshots for visual parity audit', async ({ page }) => {
    await setupAuth(page);

    // Mock summary with active equity and debt holdings
    await page.route('**/api/portfolio/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'port-parity-1',
          name: 'Primary Portfolio',
          folios: [
            {
              id: 'folio-1',
              number: '12345678',
              pan: 'ALPAC1001A',
              asset: {
                id: 'asset-1',
                name: 'Parag Parikh Flexi Cap Fund',
                type: 'MUTUAL_FUND',
                isin: 'INF879O01027',
                amfiCode: '122639',
              },
              metrics: {
                investedAmount: 150000,
                currentValue: 245000,
                currentPrice: 95.5,
                dayChange: 1250,
                dayChangePercentage: 0.51,
                xirr: 0.195,
                absoluteReturn: 0.633,
                postTaxXirr: 0.172,
                postTaxAbsoluteReturn: 0.558,
              },
              transactions: [
                {
                  id: 'tx-1',
                  date: '2023-01-15T00:00:00.000Z',
                  type: 'PURCHASE',
                  units: 1570.68,
                  nav: 95.5,
                  amount: 150000,
                  balance: 1570.68,
                },
              ],
            },
          ],
          closedFolios: [],
          taxSlab: 0.3,
          metrics: {
            totalInvested: 150000,
            totalValue: 245000,
            postTaxTotalValue: 245000,
            totalGain: 95000,
            absoluteReturn: 0.633,
            xirr: 0.195,
            postTaxXirr: 0.172,
            dayChange: 1250,
            dayChangePercentage: 0.51,
          },
        }),
      });
    });

    // Mock portfolio history points
    await page.route('**/api/portfolio/*/history*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { date: '2025-01-01', value: 150000, investedAmount: 150000 },
          { date: '2025-06-01', value: 185000, investedAmount: 150000 },
          { date: '2025-12-01', value: 220000, investedAmount: 150000 },
          { date: '2026-02-01', value: 245000, investedAmount: 150000 },
        ]),
      });
    });

    // Mock asset allocation SSoT categories
    await page.route('**/api/portfolio/*/xray*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assetAllocation: [
            { name: 'Equity', percentage: 75.5, amount: 184975, color: '#3b82f6' },
            { name: 'Debt', percentage: 14.5, amount: 35525, color: '#10b981' },
            { name: 'Cash', percentage: 10.0, amount: 24500, color: '#f59e0b' },
          ],
          sectorExposure: [],
        }),
      });
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    // Wait for Dashboard to settle
    await expect(page.locator('text=Total Value').or(page.locator('text=Current Net Worth')).first()).toBeVisible({ timeout: 15000 });

    // 1. Dashboard Overview Screenshot
    await saveToBoth(page, 'web-dashboard-overview.png');

    // 2. Scope Selector Screenshot
    const scopeArea = page.locator('header').first();
    if (await scopeArea.isVisible()) {
      await saveToBoth(scopeArea, 'web-scope-selector.png');
    }

    // 3. Historical Chart Screenshot (if card exists)
    const historyCard = page.locator('.card:has-text("Value Over Time"), .card:has-text("Historical"), [data-testid="historical-chart"]').first();
    if (await historyCard.isVisible()) {
      await saveToBoth(historyCard, 'web-historical-chart.png');
    }

    // 4. Asset Allocation Screenshot
    const xrayTab = page.locator('button.tab:has-text("X-Ray"), .tab:has-text("X-Ray")').first();
    if (await xrayTab.isVisible()) {
      await xrayTab.click();
      await page.waitForTimeout(500);

      // Switch to Classic view mode if button is present
      const classicBtn = page.locator('button:has-text("Classic")').first();
      if (await classicBtn.isVisible()) {
        await classicBtn.click();
        await page.waitForTimeout(500);
      }

      const assetCard = page.locator('.card:has-text("Asset Allocation"), [data-testid="asset-allocation-card"]').first();
      if (await assetCard.isVisible()) {
        await saveToBoth(assetCard, 'web-asset-allocation.png');
      } else {
        await saveToBoth(page, 'web-asset-allocation.png');
      }
    }
  });
});
