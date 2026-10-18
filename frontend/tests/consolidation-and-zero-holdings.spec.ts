import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('Scheme Consolidation and Zero-Holdings Isolation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);

    await page.route('**/api/portfolio/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-p-id',
          name: 'My Investment Portfolio',
          folios: [
            {
              id: 'folio-ppfc-1',
              number: '10396016',
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
                { id: 'tx-1', date: '2023-01-01T00:00:00.000Z', type: 'PURCHASE', units: 500, nav: 50, amount: 25000, balance: 500 },
                { id: 'tx-2', date: '2023-06-01T00:00:00.000Z', type: 'PURCHASE_SIP', units: 400, nav: 62.5, amount: 25000, balance: 900 },
              ],
            },
            {
              id: 'folio-ppfc-2',
              number: '18377890',
              asset: {
                id: 'asset-1',
                name: 'Parag Parikh Flexi Cap Fund',
                type: 'MUTUAL_FUND',
                isin: 'INF879O01027',
                amfiCode: '122639',
              },
              metrics: {
                investedAmount: 30000,
                currentValue: 45000,
                currentPrice: 90.0,
                dayChange: 150,
                dayChangePercentage: 0.33,
                xirr: 0.20,
                absoluteReturn: 0.5,
                postTaxXirr: 0.18,
                postTaxAbsoluteReturn: 0.45,
              },
              transactions: [
                { id: 'tx-3', date: '2023-03-01T00:00:00.000Z', type: 'PURCHASE', units: 300, nav: 60, amount: 18000, balance: 300 },
                { id: 'tx-4', date: '2023-07-01T00:00:00.000Z', type: 'PURCHASE', units: 200, nav: 60, amount: 12000, balance: 500 },
              ],
            },
            {
              id: 'folio-hdfc',
              number: '98765432',
              asset: {
                id: 'asset-2',
                name: 'HDFC Mid-Cap Opportunities Fund',
                type: 'MUTUAL_FUND',
                isin: 'INF179K01BE2',
                amfiCode: '101614',
              },
              metrics: {
                investedAmount: 40000,
                currentValue: 60000,
                currentPrice: 150.0,
                dayChange: 300,
                dayChangePercentage: 0.5,
                xirr: 0.15,
                absoluteReturn: 0.5,
                postTaxXirr: 0.13,
                postTaxAbsoluteReturn: 0.45,
              },
              transactions: [
                { id: 'tx-5', date: '2023-02-01T00:00:00.000Z', type: 'PURCHASE', units: 400, nav: 100, amount: 40000, balance: 400 },
              ],
            },
          ],
          closedFolios: [
            {
              id: 'folio-nippon-sold',
              number: '457159707423 / 0',
              asset: {
                id: 'asset-3',
                name: 'NIPPON INDIA ELSS TAX SAVER FUND - GROWTH PLAN - GROWTH OPTION',
                type: 'MUTUAL_FUND',
                isin: 'INF204K01GK4',
                amfiCode: '103196',
              },
              metrics: {
                investedAmount: 0,
                currentValue: 0,
                currentPrice: 85.0,
                dayChange: 0,
                dayChangePercentage: 0,
                xirr: 0,
                absoluteReturn: 0,
                postTaxXirr: 0,
                postTaxAbsoluteReturn: 0,
              },
              transactions: [
                { id: 'tx-6', date: '2020-01-01T00:00:00.000Z', type: 'PURCHASE', units: 1000, nav: 50, amount: 50000, balance: 1000 },
                { id: 'tx-7', date: '2023-05-01T00:00:00.000Z', type: 'REDEMPTION', units: -1000, nav: 80, amount: 80000, balance: 0 },
              ],
            },
          ],
          metrics: {
            totalInvested: 120000,
            totalValue: 180000,
            totalGain: 60000,
            absoluteReturn: 0.5,
            xirr: 0.17,
            postTaxXirr: 0.15,
            dayChange: 700,
            dayChangePercentage: 0.39,
          },
        }),
      });
    });
  });

  test('Consolidates multiple folios of Parag Parikh Flexi Cap Fund into a single master row with folio badge and expandable drawer', async ({ page }) => {
    await page.goto('/');

    // Verify only ONE master row for Parag Parikh exists in the active holdings table
    const ppfcRows = page.locator('tr:not(.bg-gray-50)', { hasText: 'Parag Parikh Flexi Cap Fund' });
    await expect(ppfcRows).toHaveCount(1);

    // Verify the master row displays the badge indicating 2 folios
    await expect(ppfcRows.locator('text=2 Folios')).toBeVisible();

    // Verify consolidated totals: Invested ₹80,000, Current ₹1,20,000, Day Change ₹400
    await expect(ppfcRows).toContainText('₹80,000');
    await expect(ppfcRows).toContainText('₹1,20,000');
    await expect(ppfcRows).toContainText('+₹400');

    // Individual folios should not be visible before clicking expand
    await expect(page.locator('tr', { hasText: '10396016' })).not.toBeVisible();
    await expect(page.locator('tr', { hasText: '18377890' })).not.toBeVisible();

    // Click on the scheme row to expand constituent folios
    await ppfcRows.click();

    // Now both child folios should be visible in expanded state
    await expect(page.locator('tr', { hasText: '10396016' })).toBeVisible();
    await expect(page.locator('tr', { hasText: '18377890' })).toBeVisible();

    // Single folio scheme (HDFC) should NOT show multiple folios badge
    const hdfcRow = page.locator('tr', { hasText: 'HDFC Mid-Cap Opportunities Fund' });
    await expect(hdfcRow).toHaveCount(1);
    await expect(hdfcRow.locator('text=Folios')).not.toBeVisible();
  });

  test('Excludes fully sold / zero-holding funds (Nippon ELSS) from active table and places them in Closed Positions drawer', async ({ page }) => {
    await page.goto('/');

    // Active table should NOT contain Nippon India ELSS
    const activeTable = page.locator('table').first();
    await expect(activeTable).not.toContainText('NIPPON INDIA ELSS TAX SAVER');

    // Closed / Fully Redeemed drawer should be present at bottom of holdings
    const closedDrawer = page.locator('text=Closed / Fully Redeemed Positions (1)');
    await expect(closedDrawer).toBeVisible();

    // Expand the closed positions drawer
    await closedDrawer.click();

    // Verify Nippon India ELSS appears inside closed positions with 0 units and Fully Redeemed badge
    await expect(page.locator('text=NIPPON INDIA ELSS TAX SAVER FUND')).toBeVisible();
    await expect(page.getByText('Fully Redeemed', { exact: true })).toBeVisible();
    await expect(page.locator('text=457159707423 / 0')).toBeVisible();
  });
});
