import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';
import fs from 'fs';

test.describe('ITR Export & Schedule CG Compliance', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
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

  test('renders Table F Advance Tax Matrix, Budget 2024 badges, and exports Schedule CG CSV', async ({ page }) => {
    // Mock portfolio summary
    await page.route('**/api/portfolio/summary*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-portfolio-id',
          name: 'Mock Portfolio',
          folios: [],
          metrics: { totalInvested: 60000, totalValue: 75000, totalGain: 15000, absoluteReturn: 0.25, xirr: 0.2, postTaxAbsoluteReturn: 0.22, postTaxXirr: 0.18, dayChange: 100, dayChangePercentage: 0.5 },
          details: []
        }),
      });
    });

    // Mock tax summary with Schedule CG compliant details
    await page.route('**/api/portfolio/*/tax-summary*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          realized: { stcg: 3000, ltcg: 57500, slab: 1000, total: 61500 },
          unrealized: { stcg: 0, ltcg: 0, slab: 0, total: 0 },
          details: [
            {
              assetName: 'Parag Parikh Flexi Cap Fund',
              folioNumber: '12345',
              isin: 'INF879O01018',
              assetClass: 'EQUITY',
              section: '111A (15%)',
              buyDate: '2024-01-10',
              sellDate: '2024-05-20',
              holdingPeriodDays: 131,
              holdingType: 'Short-Term',
              units: 100,
              buyNav: 50.0,
              sellNav: 60.0,
              grossConsideration: 6000.0,
              costOfAcquisition: 5000.0,
              gain: 1000.0,
              taxType: 'STCG',
              taxRate: 0.15,
              taxBeforeCess: 150.0,
              cess: 6.0,
              estimatedTax: 156.0,
              advanceTaxQuarter: 'Q1 (01/04 - 15/06)',
              isGrandfathered: false,
              isAnchorDependent: false
            },
            {
              assetName: 'ICICI Prudential Bluechip',
              folioNumber: '55555',
              isin: 'INF109K011B1',
              assetClass: 'EQUITY',
              section: '112A (10%)',
              buyDate: '2017-06-01',
              sellDate: '2024-06-25',
              holdingPeriodDays: 2581,
              holdingType: 'Long-Term',
              units: 500,
              buyNav: 30.0,
              sellNav: 100.0,
              grossConsideration: 50000.0,
              costOfAcquisition: 15000.0,
              fmvAsOfJan31_2018: 45.0,
              totalFmvJan31_2018: 22500.0,
              deemedCostOfAcquisition: 22500.0,
              transferExpenses: 0,
              gain: 27500.0,
              taxType: 'LTCG',
              taxRate: 0.10,
              taxBeforeCess: 0,
              cess: 0,
              estimatedTax: 0,
              advanceTaxQuarter: 'Q2a (16/06 - 22/07)',
              isGrandfathered: true,
              isAnchorDependent: false
            }
          ]
        }),
      });
    });

    await page.goto('/');

    // Navigate to Tax Optimization tab
    await page.getByRole('button', { name: /Tax Optimization/i }).click();

    // Verify UI components: Table F Advance Tax Accrual Matrix
    await expect(page.getByText('Advance Tax Accrual Matrix')).toBeVisible();
    await expect(page.getByText(/Schedule CG Table F/i)).toBeVisible();

    // Verify Budget 2024 Badges & Cess
    await expect(page.getByText(/111A \(15% vs 20%\)/i)).toBeVisible();
    await expect(page.getByText(/112A \(10% vs 12.5%\)/i)).toBeVisible();
    await expect(page.getByText(/Health & Education Cess \(4%\)/i)).toBeVisible();

    // Trigger CSV export and verify download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export ITR Report/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/capital_gains_report_FY_.*\.csv/);

    const downloadPath = await download.path();
    if (downloadPath) {
      const content = fs.readFileSync(downloadPath, 'utf-8');
      expect(content).toContain('CAPITAL GAINS TAX AUDIT REPORT (SCHEDULE CG - ITR-2 / ITR-3 COMPLIANT)');
      expect(content).toContain('ADVANCE TAX ACCRUAL MATRIX (SECTION 234C / SCHEDULE CG TABLE F)');
      expect(content).toContain('Sr. No.,Folio Number,ISIN,Asset / Scheme Name');
      expect(content).toContain('Parag Parikh Flexi Cap Fund');
    }
  });
});
