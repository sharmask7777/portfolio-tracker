import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupAuth } from './utils/auth-setup';

test.describe('Multi-Level Portfolio X-Ray & Drilldown E2E Suite', () => {
  const mockXRayData = {
    totalValue: 500000,
    sectors: [
      { name: 'Financial Services', percentage: 0.40, value: 200000 },
      { name: 'Technology', percentage: 0.30, value: 150000 },
      { name: 'Energy', percentage: 0.20, value: 100000 },
      { name: 'Consumer Cyclical', percentage: 0.10, value: 50000 },
    ],
    marketCap: {
      large: { percentage: 0.70, value: 350000 },
      mid: { percentage: 0.20, value: 100000 },
      small: { percentage: 0.10, value: 50000 },
    },
    assetAllocation: {
      equity: { percentage: 0.80, value: 400000 },
      debt: { percentage: 0.15, value: 75000 },
      cash: { percentage: 0.05, value: 25000 },
      gold: { percentage: 0.0, value: 0 },
      other: { percentage: 0.0, value: 0 },
    },
    expenseAnalysis: {
      totalAnnualFees: 3500,
      weightedAvgTer: 0.70,
      categoryBreakdown: [
        { category: 'Equity', totalFees: 3000, avgTer: 0.75, percentage: 0.80, value: 400000 },
        { category: 'Debt', totalFees: 500, avgTer: 0.50, percentage: 0.20, value: 100000 },
      ],
      fundBreakdown: [
        { name: 'Parag Parikh Flexi Cap Fund', isin: 'INF879O01027', category: 'Equity', ter: 0.75, annualizedFee: 2250, value: 300000 },
        { name: 'HDFC Corporate Bond Fund', isin: 'INF179K01987', category: 'Debt', ter: 0.50, annualizedFee: 500, value: 100000 },
      ],
    },
    fundCategoryAllocation: {
      active: { percentage: 0.80, value: 400000 },
      index: { percentage: 0.0, value: 0 },
      arbitrage: { percentage: 0.0, value: 0 },
      other: { percentage: 0.20, value: 100000 },
    },
  };

  const mockExposures = [
    {
      name: 'HDFC Bank Ltd.',
      sector: 'Financial Services',
      absoluteValue: 120000,
      percentage: 0.24,
      contributions: [
        { schemeName: 'Parag Parikh Flexi Cap Fund', value: 80000, weight: 8.0 },
        { schemeName: 'HDFC Top 100 Fund', value: 40000, weight: 4.0 },
      ],
    },
    {
      name: 'ICICI Bank Ltd.',
      sector: 'Financial Services',
      absoluteValue: 80000,
      percentage: 0.16,
      contributions: [
        { schemeName: 'Parag Parikh Flexi Cap Fund', value: 80000, weight: 8.0 },
      ],
    },
    {
      name: 'Infosys Ltd.',
      sector: 'Technology',
      absoluteValue: 90000,
      percentage: 0.18,
      contributions: [
        { schemeName: 'Parag Parikh Flexi Cap Fund', value: 90000, weight: 9.0 },
      ],
    },
  ];

  test.beforeEach(async ({ page }) => {
    await setupAuth(page);

    // Mock X-Ray endpoint with explicit mockXRayData
    await page.route('**/api/portfolio/*/xray*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockXRayData),
      });
    });

    // Mock Exposures endpoint with explicit mockExposures
    await page.route('**/api/portfolio/*/exposures*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockExposures),
      });
    });

    // Mock summary with corresponding non-zero portfolio value
    await page.route('**/api/portfolio/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-portfolio-xray',
          name: 'Synthetic X-Ray Portfolio',
          taxSlab: 0.3,
          metrics: {
            totalInvested: 400000,
            totalValue: 500000,
            totalGain: 100000,
            absoluteReturn: 0.25,
            xirr: 0.18,
            dayChange: 2500,
            dayChangePercentage: 0.5,
          },
          folios: [
            {
              id: 'folio-ppfc',
              number: '10396016',
              pan: 'ABCDE1234F',
              asset: {
                id: 'asset-ppfc',
                name: 'Parag Parikh Flexi Cap Fund',
                type: 'MUTUAL_FUND',
                isin: 'INF879O01027',
              },
              metrics: {
                investedAmount: 250000,
                currentValue: 350000,
                xirr: 0.20,
                absoluteReturn: 0.40,
              },
            },
          ],
          closedFolios: [],
        }),
      });
    });

    // Navigate to / so that the newly registered routes are queried on fetchSummary
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('X-Ray drilldown: segmented view modes, Treemap zoom, StockDetailDrawer and cross-tab navigation', async ({ page }) => {
    await page.goto('/');

    // 1. Navigate to Portfolio Analytics -> X-Ray tab
    const xrayTabButton = page.getByRole('button', { name: /X-Ray/i });
    await expect(xrayTabButton).toBeVisible();
    await xrayTabButton.click();

    // Verify X-Ray view container is visible
    const xrayView = page.locator('.xray-view');
    await expect(xrayView).toBeVisible();

    // 2. Verify segmented view mode switcher renders and Treemap is active by default
    const modeControl = xrayView.getByRole('tablist', { name: 'X-Ray View Mode' });
    await expect(modeControl).toBeVisible();

    const treemapTab = modeControl.getByRole('tab', { name: 'Zoomable Treemap' });
    const sunburstTab = modeControl.getByRole('tab', { name: 'Concentric Sunburst' });
    const classicTab = modeControl.getByRole('tab', { name: 'Classic Grid' });

    await expect(treemapTab).toBeVisible();
    await expect(sunburstTab).toBeVisible();
    await expect(classicTab).toBeVisible();

    // Treemap should be selected by default
    await expect(treemapTab).toHaveAttribute('aria-selected', 'true');

    // Breadcrumb navigation starts at "All Assets"
    const breadcrumbNav = page.locator('nav[aria-label="Hierarchy Breadcrumbs"]');
    await expect(breadcrumbNav).toBeVisible();
    await expect(breadcrumbNav).toContainText('All Assets');

    // 3. Drill down into Equity -> Financial Services
    // In Treemap, top level displays macro asset classes (Equity, Debt, Cash).
    // Click on Equity tile
    const equityTile = page.locator('[role="button"][aria-label*="Equity"]');
    await expect(equityTile).toBeVisible();
    await equityTile.click();

    // Verify breadcrumb updates to include Equity
    await expect(breadcrumbNav).toContainText('Equity');

    // Now click Financial Services sector tile to zoom in further
    const finServicesTile = page.locator('[role="button"][aria-label*="Financial Services"]');
    await expect(finServicesTile).toBeVisible();
    await finServicesTile.click();

    // Verify breadcrumbs update to include Financial Services
    await expect(breadcrumbNav).toContainText('Financial Services');

    // Child stock tiles should now appear (HDFC Bank Ltd., ICICI Bank Ltd.)
    const hdfcBankTile = page.locator('[role="button"][aria-label*="HDFC Bank Ltd."]');
    await expect(hdfcBankTile).toBeVisible();

    // 4. Click on a stock tile (HDFC Bank Ltd.) to open StockDetailDrawer
    await hdfcBankTile.click();

    // 5. Verify StockDetailDrawer shows contributing mutual funds and CTA button
    const stockDrawer = page.locator('div[role="dialog"][aria-modal="true"]');
    await expect(stockDrawer).toBeVisible();
    await expect(stockDrawer.locator('#stock-drawer-title')).toContainText('HDFC Bank Ltd.');
    await expect(stockDrawer.getByText('Contributing Mutual Funds')).toBeVisible();
    await expect(stockDrawer.getByText('Parag Parikh Flexi Cap Fund')).toBeVisible();
    await expect(stockDrawer.getByText('HDFC Top 100 Fund')).toBeVisible();

    const inspectBtn = stockDrawer.getByRole('button', { name: /Inspect in Stock Intersection/i });
    await expect(inspectBtn).toBeVisible();

    // 6. Click "Inspect in Stock Intersection"
    await inspectBtn.click();

    // Drawer should close
    await expect(stockDrawer).not.toBeVisible();

    // Active tab should switch to Stock Intersection
    const intersectionView = page.locator('.intersection-view');
    await expect(intersectionView).toBeVisible();

    // Search input should be populated with 'HDFC Bank Ltd.'
    const searchInput = page.getByPlaceholder(/Search stocks, sectors, or funds/i);
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue('HDFC Bank Ltd.');

    // 7. Switch back to X-Ray tab and switch view mode to Concentric Sunburst
    await xrayTabButton.click();
    await expect(xrayView).toBeVisible();

    await sunburstTab.click();
    await expect(sunburstTab).toHaveAttribute('aria-selected', 'true');

    // Verify SVG concentric rings and center summary hub render
    const sunburstSvg = page.locator('svg[aria-label="Portfolio Sunburst"]');
    await expect(sunburstSvg).toBeVisible();

    const centerHub = page.locator('[data-testid="center-summary-hub"]');
    await expect(centerHub).toBeVisible();
    await expect(centerHub).toContainText('Total Net Worth');

    // Also verify Classic Grid mode switches cleanly
    await classicTab.click();
    await expect(classicTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.xray-dashboard')).toBeVisible();
  });

  test('Responsive viewport verification (Mobile 375x667 vs Desktop 1280x800)', async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    const xrayTabButton = page.getByRole('button', { name: /X-Ray/i });
    await xrayTabButton.click();

    const xrayView = page.locator('.xray-view');
    await expect(xrayView).toBeVisible();

    // Mobile Viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(xrayView).toBeVisible();

    // Ensure mode switcher and segmented controls remain accessible without horizontal page overflow
    const pageOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(pageOverflow, 'X-Ray page should not trigger horizontal scroll on mobile 375px').toBe(false);

    // Switch to Concentric Sunburst on mobile
    const modeControl = xrayView.getByRole('tablist', { name: 'X-Ray View Mode' });
    const sunburstTab = modeControl.getByRole('tab', { name: 'Concentric Sunburst' });
    await sunburstTab.click();

    const centerHub = page.locator('[data-testid="center-summary-hub"]');
    await expect(centerHub).toBeVisible();
  });

  test('Accessibility audit on X-Ray drilldown view using AxeBuilder', async ({ page }) => {
    await page.goto('/');

    const xrayTabButton = page.getByRole('button', { name: /X-Ray/i });
    await xrayTabButton.click();

    await page.waitForSelector('.xray-view');

    // Run axe accessibility analysis on the X-Ray view
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('.xray-view')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast', 'label-content-name-mismatch']) // Color contrast is checked in font-visibility.spec.ts; Treemap tiles expand aria-label with rupee value and percentage
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
