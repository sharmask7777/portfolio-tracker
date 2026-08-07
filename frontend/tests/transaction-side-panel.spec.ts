import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('Transaction Side Panel', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    
    // Mock profiles
    await page.route('**/api/family/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'p1', name: 'Test User' }]),
      });
    });

    // Mock portfolio summary
    const summary = {
      id: 'mock-portfolio-id',
      name: 'Mock Portfolio',
      folios: [
        {
          id: 'mock-folio-1',
          asset: {
            name: 'HDFC Midcap Opportunities Fund',
            type: 'MUTUAL_FUND',
          },
          metrics: {
            investedAmount: 10000,
            currentValue: 12000,
            xirr: 0.15,
            postTaxXirr: 0.12,
            absoluteReturn: 0.20,
            postTaxAbsoluteReturn: 0.18,
            dayChange: 200,
            dayChangePercentage: 1.5,
          },
          transactions: [
            {
              id: 'tx-1',
              date: '2026-08-01',
              type: 'PURCHASE',
              amount: 10000,
              units: 100,
              nav: 100
            }
          ]
        }
      ],
      metrics: {
        totalInvested: 10000,
        totalValue: 12000,
        totalGain: 2000,
        absoluteReturn: 0.20,
        xirr: 0.15,
        dayChange: 200,
        dayChangePercentage: 1.5,
      }
    };

    await page.route('**/api/portfolio/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(summary),
      });
    });

    // Mock other endpoints that dashboard needs
    await page.route('**/api/portfolio/*/xray*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assetAllocation: [], sectorExposure: [] }) });
    });
    await page.route('**/api/portfolio/*/exposures*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/portfolio/*/tax-summary*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ realized: { total: 0 }, unrealized: { total: 0 } }) });
    });
    await page.route('**/api/tax/harvesting-opportunities*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/portfolio/*/history', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/portfolio/*/insights', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ allTimeHigh: { value: 12000, date: '2026-08-01' }, maxDrawdown: { percentage: 0 } }) });
    });
  });

  test('should open side panel when clicking on a portfolio row and display transactions', async ({ page }) => {
    await page.goto('/');

    // Wait for the table row to be visible
    const row = page.getByRole('cell', { name: 'HDFC Midcap Opportunities Fund' });
    await expect(row).toBeVisible();

    // Click on the row to open the side panel
    await row.click();

    // Verify side panel opens and has the correct header
    const sidePanelHeader = page.locator('.side-panel-header h2');
    await expect(sidePanelHeader).toHaveText('HDFC Midcap Opportunities Fund');

    const sidePanel = page.locator('.side-panel');
    
    // Verify transaction details are visible
    await expect(sidePanel.getByText('PURCHASE')).toBeVisible();
    await expect(sidePanel.getByText('₹10,000')).toBeVisible();
    await expect(sidePanel.getByText('100 units @ ₹100')).toBeVisible();

    // Verify side panel CSS (the bug we just fixed)
    await expect(sidePanel).toHaveCSS('background-color', /rgb|var/); // Should have background color applied

    // Close the panel
    await page.getByLabel('Close panel').click();
    await expect(sidePanel).not.toBeVisible();
  });
});
