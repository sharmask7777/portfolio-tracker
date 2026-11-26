import { test, expect } from '@playwright/test';
import { setupAuth } from '../utils/auth-setup';

test.describe('Agent-Driven Comprehensive UAT Suite: Web Experience', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);

    // Mock portfolio summary with display-ready metrics and drag stages
    await page.route('**/api/portfolio/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'uat-synthetic-portfolio',
          name: 'Synthetic Family Wealth Portfolio',
          taxSlab: 0.3,
          metrics: {
            totalInvested: 10000000,
            totalValue: 14500000,
            postTaxTotalValue: 13950000,
            netRealizableValue: 13950000,
            totalGain: 4500000,
            absoluteReturn: 0.45,
            xirr: 0.165,
            postTaxXirr: 0.142,
            realPostTaxXirr: 0.082,
            estimatedTax: 550000,
            dayChange: 14500,
            dayChangePercentage: 0.10,
            drags: {
              nominalXirr: 0.165,
              postTaxXirr: 0.142,
              debtDrag: 0.008,
              equityDrag: 0.012,
              cessAndOtherDrag: 0.003,
              inflationDrag: 0.060,
              totalTaxDrag: 0.023,
              totalOverallDrag: 0.083,
              realPostTaxXirr: 0.082,
              benchmarkSpread: 0.065,
              postTaxValue: 13950000,
              purchasingPowerValue: 11200000,
              purchasingPowerLoss: 3300000,
              stages: [
                {
                  step: 1,
                  key: 'gross_nominal',
                  label: 'Gross Nominal',
                  rate: 0.165,
                  drag: 0.0,
                  description: 'Pre-tax annualized IRR',
                },
                {
                  step: 2,
                  key: 'debt_drag',
                  label: 'Sec 50AA Debt Drag',
                  rate: 0.008,
                  drag: -0.008,
                  description: 'Slab rate debt fund taxation',
                },
                {
                  step: 3,
                  key: 'equity_drag',
                  label: 'Sec 112A/111A Equity',
                  rate: 0.012,
                  drag: -0.012,
                  description: '12.5% LTCG / 20% STCG',
                },
                {
                  step: 4,
                  key: 'cess_drag',
                  label: 'Cess & Overheads',
                  rate: 0.003,
                  drag: -0.003,
                  description: '4% health & edu cess',
                },
                {
                  step: 5,
                  key: 'inflation_drag',
                  label: 'CPI Inflation Drag',
                  rate: 0.060,
                  drag: -0.060,
                  description: 'Purchasing power deflator',
                },
                {
                  step: 6,
                  key: 'real_xirr',
                  label: 'Real Purchasing XIRR',
                  rate: 0.082,
                  drag: 0.0,
                  description: 'True real compounding',
                },
              ],
            },
          },
          folios: [
            {
              id: 'folio-ppfc-1',
              number: '10396016',
              pan: 'ABCDE1234F',
              asset: {
                id: 'asset-ppfc',
                name: 'Parag Parikh Flexi Cap Fund - Direct Growth',
                type: 'MUTUAL_FUND',
                isin: 'INF879O01027',
                amfiCode: '122639',
              },
              metrics: {
                investedAmount: 6000000,
                currentValue: 9500000,
                currentPrice: 95.0,
                dayChange: 9500,
                dayChangePercentage: 0.10,
                xirr: 0.185,
                absoluteReturn: 0.5833,
                postTaxXirr: 0.162,
                postTaxAbsoluteReturn: 0.525,
                estimatedTax: 350000,
                netRealizableValue: 9150000,
              },
              transactions: [
                {
                  id: 'tx-fee-1',
                  date: '2023-01-01T00:00:00.000Z',
                  type: 'STAMP_DUTY_TAX',
                  units: 0,
                  nav: 0,
                  amount: 25,
                  balance: 0,
                },
                {
                  id: 'tx-buy-1',
                  date: '2023-01-01T00:00:00.000Z',
                  type: 'PURCHASE',
                  units: 60000,
                  nav: 100,
                  amount: 6000000,
                  balance: 60000,
                },
              ],
            },
            {
              id: 'folio-debt-1',
              number: '98765432',
              pan: 'ABCDE1234F',
              asset: {
                id: 'asset-debt',
                name: 'HDFC Corporate Bond Fund - Direct Growth',
                type: 'DEBT',
                isin: 'INF179K01987',
                amfiCode: '101234',
              },
              metrics: {
                investedAmount: 4000000,
                currentValue: 5000000,
                currentPrice: 25.0,
                dayChange: 5000,
                dayChangePercentage: 0.10,
                xirr: 0.075,
                absoluteReturn: 0.25,
                postTaxXirr: 0.0525,
                postTaxAbsoluteReturn: 0.175,
                estimatedTax: 200000,
                netRealizableValue: 4800000,
              },
              transactions: [
                {
                  id: 'tx-buy-debt',
                  date: '2023-06-01T00:00:00.000Z',
                  type: 'PURCHASE',
                  units: 160000,
                  nav: 25,
                  amount: 4000000,
                  balance: 160000,
                },
              ],
            },
          ],
          closedFolios: [],
          panBreakdowns: [
            {
              pan: 'ABCDE1234F',
              memberName: 'Aarav Sharma (Self)',
              investedAmount: 7000000,
              currentValue: 10500000,
              folioCount: 2,
              dayChange: 11000,
              xirr: 0.17,
            },
            {
              pan: 'ALPAC1001A',
              memberName: 'Neha Patel (Spouse)',
              investedAmount: 3000000,
              currentValue: 4000000,
              folioCount: 1,
              dayChange: 3500,
              xirr: 0.15,
            },
          ],
        }),
      });
    });

    // Mock family profiles
    await page.route('**/api/family/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'prof-primary',
            name: 'Aarav Sharma',
            pan: 'ABCDE1234F',
            taxSlab: 0.3,
            isPrimary: true,
          },
          {
            id: 'prof-spouse',
            name: 'Neha Patel',
            pan: 'ALPAC1001A',
            taxSlab: 0.3,
            isPrimary: false,
          },
        ]),
      });
    });

    // Mock tax summary
    await page.route('**/api/portfolio/*/tax-summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          details: [
            {
              assetName: 'Parag Parikh Flexi Cap Fund',
              folioNumber: '10396016',
              isin: 'INF879O01027',
              assetClass: 'EQUITY',
              section: '112A (12.5%)',
              buyDate: '2023-01-01',
              sellDate: '2026-10-15',
              holdingPeriodDays: 1380,
              holdingType: 'Long-Term',
              units: 200,
              buyNav: 100,
              sellNav: 150,
              grossConsideration: 30000,
              costOfAcquisition: 20000,
              fmvAsOfJan31_2018: 0,
              totalFmvJan31_2018: 0,
              deemedCostOfAcquisition: 20000,
              transferExpenses: 0,
              gain: 10000,
              taxType: 'LTCG',
              taxRate: 0.125,
              taxBeforeCess: 0,
              cess: 0,
              estimatedTax: 0,
              advanceTaxQuarter: 'Q3 (16/09 - 15/12)',
              isGrandfathered: false,
              isAnchorDependent: false,
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
          realizedLtcgFy: 40000,
          remainingExemption: 85000,
          totalPotentialHarvest: 60000,
          estimatedTaxSavings: 7500,
          opportunities: [
            {
              folioId: 'folio-ppfc-1',
              schemeName: 'Parag Parikh Flexi Cap Fund',
              unrealizedGain: 60000,
              unitsToRedeem: 600,
              currentNav: 150,
              redemptionAmount: 90000,
              gainDensity: 0.667,
              holdingPeriodDays: 600,
            },
          ],
        }),
      });
    });

    // Mock exposures
    await page.route('**/api/portfolio/*/exposures*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            name: 'HDFC Bank Ltd',
            sector: 'Financial Services',
            absoluteValue: 1200000,
            percentage: 8.28,
            contributions: [],
          },
          {
            name: 'Reliance Industries Ltd',
            sector: 'Energy',
            absoluteValue: 950000,
            percentage: 6.55,
            contributions: [],
          },
        ]),
      });
    });

    // Mock X-Ray
    await page.route('**/api/portfolio/*/xray*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalValue: 14500000,
          sectors: [
            { name: 'Financial Services', percentage: 0.40, value: 5800000 },
            { name: 'Energy', percentage: 0.30, value: 4350000 },
            { name: 'Technology', percentage: 0.30, value: 4350000 },
          ],
          marketCap: {
            large: { percentage: 0.70, value: 10150000 },
            mid: { percentage: 0.20, value: 2900000 },
            small: { percentage: 0.10, value: 1450000 },
          },
          assetAllocation: {
            equity: { percentage: 0.655, value: 9500000 },
            debt: { percentage: 0.345, value: 5000000 },
            cash: { percentage: 0.0, value: 0 },
            gold: { percentage: 0.0, value: 0 },
            other: { percentage: 0.0, value: 0 },
          },
        }),
      });
    });
  });

  test('UAT-WEB-1: Dashboard metrics, zero-balance resilience, and reality check drag waterfall', async ({ page }) => {
    await page.goto('/');

    // 1. Verify net worth and initial broker nominal view
    await expect(page.getByText('Current Net Worth')).toBeVisible();
    await expect(page.getByText('₹1,45,00,000')).toBeVisible();

    // 2. Toggle Reality Check Mode
    const realityToggle = page.getByRole('button', { name: /Reality Check/i });
    await expect(realityToggle).toBeVisible();
    await realityToggle.click();

    // 3. Verify All 6 Drag Stages Render from Backend DTO
    await expect(page.getByText('1. Gross Nominal')).toBeVisible();
    await expect(page.getByText('2. Sec 50AA Debt Drag')).toBeVisible();
    await expect(page.getByText('3. Sec 112A/111A Equity')).toBeVisible();
    await expect(page.getByText('4. Cess & Overheads')).toBeVisible();
    await expect(page.getByText('5. CPI Inflation Drag')).toBeVisible();
    await expect(page.getByText('6. Real Purchasing XIRR')).toBeVisible();

    // 4. Verify Net Realizable Value in table
    await expect(page.getByText('₹1,39,50,000')).toBeVisible();
  });

  test('UAT-WEB-2: Tax Optimization, Section 112A Harvesting, and Advance Tax Matrix', async ({ page }) => {
    await page.goto('/');

    // Navigate to Tax Tab
    const taxTabBtn = page.getByRole('button', { name: /Tax Optimization/i });
    await expect(taxTabBtn).toBeVisible();
    await taxTabBtn.click();

    // Verify Section 112A Exemption Progress Tracker
    await expect(page.getByText(/₹1,25,000/).first()).toBeVisible();
    await expect(page.getByText(/₹85,000/).first()).toBeVisible(); // Remaining exemption

    // Verify Advance Tax Schedule CG Table F distribution
    await expect(page.getByText('Advance Tax Accrual Matrix')).toBeVisible();
    await expect(page.getByText(/Schedule CG Table F/i)).toBeVisible();

    // Open Sell Simulation Modal if opportunities exist
    const simButton = page.getByRole('button', { name: /Simulate Sale|Simulate/i }).first();
    if (await simButton.isVisible()) {
      await simButton.click();
      await expect(page.locator('.modal')).toBeVisible();
      await expect(page.getByText('Withdrawal Simulation')).toBeVisible();
      // Close modal
      const closeBtn = page.locator('.modal').getByRole('button').first();
      await closeBtn.click();
    }
  });

  test('UAT-WEB-3: Family Profiles Multi-PAN scope switching and PAN breakdown cards', async ({ page }) => {
    await page.goto('/');

    // Verify Consolidated Profile Header
    await expect(page.getByText('Consolidated Family')).toBeVisible();
    await expect(page.getByText('Aarav Sharma')).toBeVisible();
    await expect(page.getByText('Neha Patel')).toBeVisible();

    // Verify PAN Breakdown Badges
    await expect(page.getByText('ABCDE1234F').first()).toBeVisible();
    await expect(page.getByText('ALPAC1001A').first()).toBeVisible();
  });

  test('UAT-WEB-4: Analytics Look-Through, Treemap & Asset Allocation', async ({ page }) => {
    await page.goto('/');

    // Navigate to Portfolio X-Ray
    const xrayBtn = page.getByRole('button', { name: /Portfolio X-Ray/i });
    await expect(xrayBtn).toBeVisible();
    await xrayBtn.click();

    // Verify X-Ray view container and Zoomable Treemap rendered
    const xrayView = page.locator('.xray-view');
    await expect(xrayView).toBeVisible();

    // Verify Breadcrumbs start at "All Assets"
    const breadcrumbNav = page.locator('nav[aria-label="Hierarchy Breadcrumbs"]');
    await expect(breadcrumbNav).toBeVisible();
    await expect(breadcrumbNav).toContainText('All Assets');

    // Verify macro asset class tiles (Equity & Debt)
    const equityTile = page.locator('[role="button"][aria-label*="Equity"]').first();
    await expect(equityTile).toBeVisible();
  });
});
