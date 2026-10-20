import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('Dashboard 6 Regressions Verification Suite', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);

    // Mock summary with active equity folio and fully redeemed liquid folio
    await page.route('**/api/portfolio/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'port-regression-1',
          name: 'Main Portfolio',
          folios: [
            {
              id: 'folio-ppfc-active',
              number: '10396016',
              pan: 'ABCDE1234F',
              asset: {
                id: 'asset-ppfc',
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
                { id: 'tx-1', date: '2023-01-01T00:00:00.000Z', type: 'PURCHASE', units: 500, nav: 50, amount: 25000, balance: 500 },
                { id: 'tx-2', date: '2023-06-01T00:00:00.000Z', type: 'PURCHASE_SIP', units: 400, nav: 62.5, amount: 25000, balance: 900 },
              ],
            },
          ],
          closedFolios: [
            {
              id: 'folio-axis-liquid-closed',
              number: '91028374',
              pan: 'ABCDE1234F',
              asset: {
                id: 'asset-axis-liquid',
                name: 'Axis Liquid Fund - Growth',
                type: 'MUTUAL_FUND',
                isin: 'INF846K01CX4',
                amfiCode: '112090',
              },
              metrics: {
                investedAmount: 0,
                currentValue: 0,
                currentPrice: 2500.0,
                dayChange: 0,
                dayChangePercentage: 0,
                xirr: null,
                absoluteReturn: 0,
              },
              transactions: [
                { id: 'tx-l1', date: '2023-01-10T00:00:00.000Z', type: 'PURCHASE', units: 40, nav: 2500, amount: 100000, balance: 40 },
                { id: 'tx-l2', date: '2023-04-10T00:00:00.000Z', type: 'REDEMPTION', units: -40, nav: 2550, amount: 102000, balance: 0 },
              ],
            },
          ],
          taxSlab: 0.3,
          metrics: {
            totalInvested: 50000,
            totalValue: 75000,
            postTaxTotalValue: 75000,
            totalGain: 25000,
            absoluteReturn: 0.5,
            xirr: 0.18,
            postTaxXirr: 0.16,
            estimatedTax: 0,
            dayChange: 250,
            dayChangePercentage: 0.33,
          },
        }),
      });
    });

    // Mock stock exposures endpoint
    await page.route('**/api/portfolio/*/exposures*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            name: 'HDFC Bank Ltd.',
            sector: 'Financial Services',
            absoluteValue: 12000,
            percentage: 0.16,
            contributions: [
              { schemeName: 'Parag Parikh Flexi Cap Fund', value: 12000, weight: 16.0 },
            ],
          },
          {
            name: 'ITC Ltd.',
            sector: 'Consumer Goods',
            absoluteValue: 8000,
            percentage: 0.106,
            contributions: [
              { schemeName: 'Parag Parikh Flexi Cap Fund', value: 8000, weight: 10.6 },
            ],
          },
        ]),
      });
    });

    // Mock tax summary endpoint
    await page.route('**/api/portfolio/*/tax-summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          realized: {
            total: 2000,
            stcg: 2000,
            ltcg: 0,
            slab: 2000,
            details: [
              {
                assetName: 'Axis Liquid Fund - Growth',
                folioNumber: '91028374',
                buyDate: '2023-01-10',
                sellDate: '2023-04-10',
                units: 40,
                grossConsideration: 102000,
                costOfAcquisition: 100000,
                gain: 2000,
                taxType: 'SLAB',
                taxRate: 0.3,
                estimatedTax: 624,
              },
            ],
          },
          unrealized: {
            total: 25000,
            stcg: 0,
            ltcg: 25000,
            slab: 0,
          },
          details: [
            {
              assetName: 'Axis Liquid Fund - Growth',
              folioNumber: '91028374',
              buyDate: '2023-01-10',
              sellDate: '2023-04-10',
              units: 40,
              grossConsideration: 102000,
              costOfAcquisition: 100000,
              gain: 2000,
              taxType: 'SLAB',
              taxRate: 0.3,
              estimatedTax: 624,
            },
          ],
        }),
      });
    });

    // Mock harvesting opportunities
    await page.route('**/api/tax/harvesting-opportunities*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalPotentialHarvest: 25000,
          estimatedTaxSavings: 3125,
          opportunities: [
            {
              folioId: 'folio-ppfc-active',
              schemeName: 'Parag Parikh Flexi Cap Fund',
              unitsToHarvest: 300,
            },
          ],
        }),
      });
    });

    // Mock health insights endpoint
    await page.route('**/api/health/*/insights*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            type: 'CONCENTRATION',
            severity: 'MEDIUM',
            message: 'High concentration in Financial Services sector (32.5%).',
            recommendation: 'Consider diversifying into other sectors to reduce structural risk.',
          },
          {
            type: 'OVERLAP',
            severity: 'MEDIUM',
            message: 'Significant exposure to HDFC Bank Ltd. (16.0%).',
            recommendation: 'This stock is held across 1 funds. Review if you are over-exposed.',
          },
        ]),
      });
    });

    // Mock simulate-sell
    await page.route('**/api/tax/simulate-sell*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          unitsToSell: 100,
          estimatedValue: 9000,
          totalCost: 5000,
          totalGain: 4000,
          totalTax: 500,
          netProceeds: 8500,
          exitLoad: 0,
          taxBreakdown: {
            stcg: { amount: 0, tax: 0, cess: 0 },
            ltcg: { amount: 4000, tax: 500, cess: 20 },
            slab: { amount: 0, tax: 0, cess: 0 },
            totalTax: 500,
          },
        }),
      });
    });
  });

  test('Bug 1: Manual Close button is never rendered (position closure is determined automatically)', async ({ page }) => {
    await page.goto('/');

    const activeRow = page.locator('tr', { hasText: 'Parag Parikh Flexi Cap Fund' });
    await expect(activeRow).toBeVisible();

    // Verify Mark Closed / Close button does not exist anywhere on the active table
    await expect(page.locator('button[title="Mark Closed"]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Close$/i })).toHaveCount(0);
  });

  test('Bug 2: Zero-holding funds (Axis Liquid) are cleanly isolated in closed positions with zero value', async ({ page }) => {
    await page.goto('/');

    // Active table must NOT contain Axis Liquid Fund
    const activeTable = page.locator('table').first();
    await expect(activeTable).not.toContainText('Axis Liquid Fund');

    // Closed positions accordion must exist and contain Axis Liquid Fund
    const closedAccordion = page.locator('text=Closed / Fully Redeemed Positions (1)');
    await expect(closedAccordion).toBeVisible();

    await closedAccordion.click();
    await expect(page.locator('text=Axis Liquid Fund - Growth')).toBeVisible();
    await expect(page.getByText('Fully Redeemed', { exact: true })).toBeVisible();
  });

  test('Bug 3: Simulate Sell Tax opens simulation modal with breakdown and does not open blank page', async ({ page }) => {
    await page.goto('/');

    // Click the simulate button directly
    const simulateBtn = page.locator('button[title="Simulate Sell Tax"]').first();
    await expect(simulateBtn).toBeVisible();
    await simulateBtn.click();

    // Verify modal appears with header and impact breakdown
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Withdrawal Simulation')).toBeVisible();

    // Fill an amount and click Analyze Impact
    const amountInput = modal.locator('input[type="number"]');
    await amountInput.fill('9000');
    await modal.getByRole('button', { name: /Analyze Impact/i }).click();

    // Verify market value and deductions are rendered without crashing
    await expect(modal.getByText('Market Value')).toBeVisible();
    await expect(modal.getByText('Total Deductions')).toBeVisible();
    await expect(modal.getByText('Impact Breakdown')).toBeVisible();
  });

  test('Bug 4: Stock intersection pane displays stock exposures and does not say "No stock exposures identified"', async ({ page }) => {
    await page.goto('/');

    // Navigate to Stock Intersection tab
    const intersectionTab = page.getByRole('button', { name: /Stock Intersection/i });
    await intersectionTab.click();

    const intersectionView = page.locator('.intersection-view');
    await expect(intersectionView).toBeVisible();

    // Must NOT show empty state card
    await expect(intersectionView.getByText('No Stock Exposures Identified')).toHaveCount(0);

    // Must show identified stocks
    await expect(intersectionView.getByText('HDFC Bank Ltd.')).toBeVisible();
    await expect(intersectionView.getByText('ITC Ltd.')).toBeVisible();
    await expect(intersectionView.locator('table').getByText('Financial Services')).toBeVisible();
  });

  test('Bug 5: Tax optimization page displays full tax summary and does not show an empty page', async ({ page }) => {
    await page.goto('/');

    // Navigate to Tax tab
    const taxTab = page.getByRole('button', { name: /Tax Optimization/i });
    await taxTab.click();

    // Verify tax optimization views are rendered and page is not empty
    await expect(page.getByText(/LTCG Exemption Tracker/)).toBeVisible();
    await expect(page.getByText('Realized Gains Summary')).toBeVisible();
    await expect(page.getByText(/Recent Tax-Impactful Transactions/)).toBeVisible();
  });

  test('Bug 6: Health and goals tab displays smart insights cards', async ({ page }) => {
    await page.goto('/');

    // Navigate to Insights tab
    const insightsTab = page.getByRole('button', { name: /Health & Goals|Insights/i });
    await insightsTab.click();

    // Verify Smart Insights sidebar is rendered with insights
    await expect(page.getByText('Smart Insights')).toBeVisible();
    await expect(page.getByText(/High concentration in Financial Services sector/)).toBeVisible();
    await expect(page.getByText(/Significant exposure to HDFC Bank Ltd./)).toBeVisible();
  });

  test('Bug 7: Returns percentage displays are bounded and realistic without runaway figures like 1685111%', async ({ page }) => {
    // Override summary mock to include multiple folios with an anomalous raw return that gets sanitized
    await page.route('**/api/portfolio/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'port-invesco-test',
          name: 'Arbitrage Test Portfolio',
          folios: [
            {
              id: 'folio-invesco-1',
              number: '31040701585',
              pan: 'ABCDE1234F',
              asset: {
                id: 'asset-invesco',
                name: 'Invesco India Arbitrage Fund - Direct Plan Growth (Non Demat)',
                type: 'MUTUAL_FUND',
                isin: 'INF205K01KR8',
              },
              metrics: {
                investedAmount: 49997.52,
                currentValue: 51971.31,
                currentPrice: 37.04,
                dayChange: 0,
                dayChangePercentage: 0,
                xirr: 0.0497,
                absoluteReturn: 0.0395,
                postTaxXirr: 0.0497,
                postTaxAbsoluteReturn: 0.0395,
              },
              transactions: [],
            },
            {
              id: 'folio-invesco-2',
              number: '31040731356',
              pan: 'ABCDE1234F',
              asset: {
                id: 'asset-invesco',
                name: 'Invesco India Arbitrage Fund - Direct Plan Growth (Non Demat)',
                type: 'MUTUAL_FUND',
                isin: 'INF205K01KR8',
              },
              metrics: {
                investedAmount: 4129793.48,
                currentValue: 4259982.65,
                currentPrice: 37.04,
                dayChange: 0,
                dayChangePercentage: 0,
                xirr: 0.049,
                absoluteReturn: 0.0315,
                postTaxXirr: 0.049,
                postTaxAbsoluteReturn: 0.0315,
              },
              transactions: [],
            },
          ],
          closedFolios: [],
          taxSlab: 0.3,
          metrics: {
            totalInvested: 4179791.0,
            totalValue: 4311953.96,
            postTaxTotalValue: 4311953.96,
            totalGain: 132162.96,
            absoluteReturn: 0.0316,
            xirr: 0.049,
            postTaxXirr: 0.049,
            estimatedTax: 0,
            dayChange: 0,
            dayChangePercentage: 0,
          },
        }),
      });
    });

    await page.goto('/');

    // Check consolidated scheme row for Invesco India Arbitrage Fund
    const schemeRow = page.locator('tr').filter({ hasText: /Invesco India Arbitrage Fund/i });
    await expect(schemeRow).toBeVisible();

    // Verify invested and current value
    await expect(schemeRow).toContainText('₹41,79,791');
    await expect(schemeRow).toContainText('₹43,11,954');

    // Verify percentages are NOT astronomical (no 1685111% anywhere on the page!)
    const pageText = await page.textContent('body');
    expect(pageText).not.toContain('1685111');
    expect(pageText).not.toContain('1398099');

    // Both XIRR and Post-tax XIRR should be realistic numbers like 4.90%
    await expect(schemeRow).toContainText('4.90%');
  });
});
