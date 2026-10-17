import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('Asset Allocation and Tax Calculator Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);

    // Mock portfolio summary with a mutual fund with clean transaction history
    await page.route('**/api/portfolio/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-p-id',
          name: 'My Investment Portfolio',
          folios: [
            {
              id: 'folio-ppfc',
              number: '12345678',
              asset: {
                id: 'asset-1',
                name: 'Parag Parikh Flexi Cap Fund',
                type: 'MUTUAL_FUND',
                isin: 'INF879O01027',
                amfiCode: '122639',
              },
              metrics: {
                investedAmount: 50000,
                currentValue: 75000,
                currentPrice: 90.0,
                dayChange: 250,
                dayChangePercentage: 0.33,
                xirr: 0.18,
                absoluteReturn: 0.5,
                postTaxXirr: 0.16,
                postTaxAbsoluteReturn: 0.45,
              },
              transactions: [
                {
                  id: 'tx-1',
                  date: '2023-01-01T00:00:00.000Z',
                  type: 'PURCHASE',
                  units: 500,
                  nav: 50,
                  amount: 25000,
                  balance: 500,
                },
                {
                  id: 'tx-2',
                  date: '2023-06-01T00:00:00.000Z',
                  type: 'PURCHASE_SIP',
                  units: 400,
                  nav: 62.5,
                  amount: 25000,
                  balance: 900,
                },
                // 0-unit anchor from potential stamp-duty discrepancy should NOT trigger warning
                {
                  id: 'tx-3',
                  date: '2023-01-01T00:00:00.000Z',
                  type: 'OPENING_BALANCE',
                  units: 0,
                  nav: 0,
                  amount: 1.5,
                  balance: 0,
                },
              ],
            },
          ],
          metrics: {
            totalInvested: 50000,
            totalValue: 75000,
            totalGain: 25000,
            absoluteReturn: 0.5,
            xirr: 0.18,
            postTaxXirr: 0.16,
            dayChange: 250,
            dayChangePercentage: 0.33,
          },
        }),
      });
    });

    // Mock X-Ray endpoint returning asset allocation containing Equity
    await page.route('**/api/portfolio/*/xray*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          sectors: [
            { name: 'Financial Services', percentage: 0.35, value: 26250 },
            { name: 'Technology', percentage: 0.30, value: 22500 },
            { name: 'Consumer Goods', percentage: 0.35, value: 26250 },
          ],
          marketCap: {
            large: { percentage: 0.65, value: 48750 },
            mid: { percentage: 0.25, value: 18750 },
            small: { percentage: 0.10, value: 7500 },
          },
          assetAllocation: {
            equity: { percentage: 0.90, value: 67500 },
            debt: { percentage: 0.05, value: 3750 },
            cash: { percentage: 0.05, value: 3750 },
            gold: { percentage: 0, value: 0 },
            other: { percentage: 0, value: 0 },
          },
          totalValue: 75000,
          expenseAnalysis: {
            totalAnnualFees: 450,
            weightedAvgTer: 0.6,
            categoryBreakdown: [],
            fundBreakdown: [],
          },
          fundCategoryAllocation: {
            active: { percentage: 1.0, value: 75000 },
            index: { percentage: 0, value: 0 },
            arbitrage: { percentage: 0, value: 0 },
            other: { percentage: 0, value: 0 },
          },
        }),
      });
    });
  });

  test('Asset Allocation Pie Chart on X-Ray tab displays Equity allocation and not only debt or arbitrage', async ({ page }) => {
    await page.goto('/');

    // Navigate to X-Ray tab
    const xrayTab = page.locator('button.tab', { hasText: 'Portfolio X-Ray' });
    await expect(xrayTab).toBeVisible();
    await xrayTab.click();

    // Verify Asset Allocation section appears
    await expect(page.locator('h3', { hasText: 'Asset Allocation' })).toBeVisible();

    // Check that Recharts legend or text displays Equity
    const equityLegend = page.locator('.recharts-legend-item-text', { hasText: 'Equity' });
    await expect(equityLegend).toBeVisible();
  });

  test('Calculator button in Overview section opens simulation modal without showing "Incomplete History" warning when history is complete', async ({ page }) => {
    await page.goto('/');

    // Locate the calculator button for the mutual fund
    const calcButton = page.locator('button[title="Simulate Sell Tax"]').first();
    await expect(calcButton).toBeVisible();
    await calcButton.click();

    // Verify withdrawal simulation modal opened
    await expect(page.locator('.modal h2', { hasText: 'Withdrawal Simulation' })).toBeVisible();
    await expect(page.locator('.modal', { hasText: 'Parag Parikh Flexi Cap Fund' })).toBeVisible();

    // Verify "Incomplete History" warning is NOT displayed
    await expect(page.locator('.modal').getByText('Incomplete History:')).not.toBeVisible();
  });

  test('Net Worth card and Holdings Table display Day Change accurately without anomalous inflation', async ({ page }) => {
    await page.goto('/');

    // Check Net Worth card displays day change: +₹250 (0.33%) Today
    const netWorthCard = page.locator('.stats-grid .card').first();
    await expect(netWorthCard).toContainText('+₹250');
    await expect(netWorthCard).toContainText('(0.33%) Today');

    // Check holdings table row displays folio day change: +₹250 (+0.33%)
    const folioRow = page.locator('tr', { hasText: 'Parag Parikh Flexi Cap Fund' });
    await expect(folioRow).toContainText('+₹250');
    await expect(folioRow).toContainText('(+0.33%)');
  });
});

