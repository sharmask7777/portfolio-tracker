import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('Milestone v2.0 Features', () => {
  let currentTaxSlab = 0.3;

  test.beforeEach(async ({ page }) => {
    // Reset state before each test
    currentTaxSlab = 0.3;

    // Setup basic authentication mock
    await setupAuth(page);

    // Mock PATCH request to save tax slab changes
    await page.route('**/api/family/profile/*', async (route) => {
      const payload = route.request().postDataJSON();
      if (payload && payload.taxSlab !== undefined) {
        currentTaxSlab = payload.taxSlab;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success' }) });
    });
    
    // Mock basic portfolio data
    await page.route('**/api/portfolio/summary*', async (route) => {
      const taxSlab = currentTaxSlab;
      
      const summary = {
        id: 'v2-portfolio',
        folios: [
          {
            id: 'folio-1',
            asset: { name: 'HDFC Top 100 Fund', type: 'EQUITY_ORIENTED' },
            metrics: {
              investedAmount: 100000,
              currentValue: 150000,
              xirr: 0.20,
              postTaxXirr: 0.20 * (1 - taxSlab * 0.5), // Artificial reduction for testing
              currentPrice: 500
            }
          }
        ],
        metrics: {
          totalInvested: 100000,
          totalValue: 150000,
          totalGain: 50000,
          absoluteReturn: 0.5,
          xirr: 0.20
        }
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(summary) });
    });

    await page.route('**/api/portfolio/*/xray*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assetAllocation: [], sectorExposure: [] }) });
    });

    await page.route('**/api/portfolio/*/exposures*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/portfolio/*/tax-summary*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ details: [] }) });
    });

    await page.route('**/api/tax/harvesting-opportunities*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        totalPotentialHarvest: 50000,
        estimatedTaxSavings: 6250,
        opportunities: [
          { folioId: 'folio-1', schemeName: 'HDFC Top 100 Fund', unitsToHarvest: 100 }
        ]
      })});
    });
    
    await page.route('**/api/tax/simulate-sell', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        estimatedValue: 50000,
        totalGain: 10000,
        exitLoad: 0,
        taxBreakdown: {
          totalTax: 1250,
          ltcg: { amount: 10000, tax: 1250 },
          stcg: { amount: 0, tax: 0 },
          slab: { amount: 0, tax: 0 }
        }
      })});
    });

    await page.goto('/');
    // Ensure data is loaded
    await expect(page.locator('.data-table')).toBeVisible();
  });

  test('Slab Change Reactivity: Post-Tax XIRR updates when slab changes', async ({ page }) => {
    const postTaxCell = page.locator('.data-table tbody tr:first-child td').nth(6);
    const initialValue = await postTaxCell.innerText();
    
    // Open Rename Profile modal to access the tax slab input
    const editButton = page.locator('button[title="Rename Profile"]').first();
    await editButton.click();
    
    // Locate tax slab input inside the modal
    const slabInput = page.locator('input[type="number"]');
    await expect(slabInput).toBeVisible();
    
    // Change value from default 0.3 to 0.1
    await slabInput.fill('0.1');
    
    // Click Save Changes to apply and reload
    await page.click('button:text("Save Changes")');
    
    // Verify it updates (XIRR should increase)
    await expect(postTaxCell).not.toHaveText(initialValue);
    
    const newVal = await postTaxCell.innerText();
    const initialNum = parseFloat(initialValue.replace('%', ''));
    const finalNum = parseFloat(newVal.replace('%', ''));
    
    expect(finalNum).toBeGreaterThan(initialNum);
  });

  test('Integrated Harvesting Flow: Click harvesting scheme opens SimulationModal', async ({ page }) => {
    // Navigate to Tax Optimization tab
    const taxTab = page.locator('button.tab', { hasText: 'Tax Optimization' });
    await taxTab.click();
    
    // Find harvesting card and click the link
    const harvestLink = page.locator('.harvest-card .btn-link').first();
    await expect(harvestLink).toBeVisible();
    await harvestLink.click();
    
    // Verify modal is open
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Withdrawal Simulation');
    
    // Verify results are visible (SimulationModal triggers handleSimulate on mount if initialUnits provided)
    // Wait for "Total Deductions" to appear in results
    const taxLabel = modal.locator('.stat-label', { hasText: 'Total Deductions' });
    await expect(taxLabel).toBeVisible();
    
    const taxValue = modal.locator('.stat-value', { hasText: /₹/ }).nth(1);
    await expect(taxValue).toBeVisible();
    await expect(taxValue).toContainText('1,250');
  });

  test('Performance Invariant Check: Post-Tax XIRR <= Pre-Tax XIRR', async ({ page }) => {
    const rows = page.locator('.data-table tbody tr');
    const count = await rows.count();
    
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const preTaxText = await row.locator('td').nth(5).innerText();
      const postTaxText = await row.locator('td').nth(6).innerText();
      
      const preTax = parseFloat(preTaxText.replace('%', ''));
      const postTax = parseFloat(postTaxText.replace('%', ''));
      
      expect(postTax).toBeLessThanOrEqual(preTax);
    }
  });
});
