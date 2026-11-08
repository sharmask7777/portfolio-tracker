import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('True Post-Tax XIRR & Zero-Tax Rebalancing Engine (Reality Check Suite)', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);

    // Mock summary with active equity and debt folios
    await page.route('**/api/portfolio/summary*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'port-reality-e2e',
          name: 'Synthetic E2E Portfolio',
          taxSlab: 0.3,
          metrics: {
            totalInvested: 400000,
            totalValue: 500000,
            postTaxTotalValue: 475000,
            totalGain: 100000,
            absoluteReturn: 0.25,
            xirr: 0.182,
            postTaxXirr: 0.158,
            realPostTaxXirr: 0.098,
            estimatedTax: 25000,
            dayChange: 1200,
            dayChangePercentage: 0.24,
            drags: {
              nominalXirr: 0.182,
              debtDrag: 0.015,
              equityDrag: 0.008,
              cessDrag: 0.001,
              inflationDrag: 0.060,
              realPostTaxXirr: 0.098,
              benchmarkSpread: 0.078,
            },
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
                amfiCode: '122639',
              },
              metrics: {
                investedAmount: 250000,
                currentValue: 350000,
                currentPrice: 90.0,
                dayChange: 1000,
                dayChangePercentage: 0.29,
                xirr: 0.20,
                absoluteReturn: 0.40,
                postTaxXirr: 0.175,
                postTaxAbsoluteReturn: 0.35,
                estimatedTax: 12500,
                netRealizableValue: 337500,
              },
              transactions: [
                {
                  id: 'tx-1',
                  date: '2023-01-01T00:00:00.000Z',
                  type: 'PURCHASE',
                  units: 2500,
                  nav: 100,
                  amount: 250000,
                  balance: 2500,
                },
              ],
            },
            {
              id: 'folio-debt',
              number: '98765432',
              pan: 'ABCDE1234F',
              asset: {
                id: 'asset-debt',
                name: 'HDFC Corporate Bond Fund',
                type: 'DEBT',
                isin: 'INF179K01987',
                amfiCode: '101234',
              },
              metrics: {
                investedAmount: 150000,
                currentValue: 150000,
                currentPrice: 25.0,
                dayChange: 200,
                dayChangePercentage: 0.13,
                xirr: 0.06,
                absoluteReturn: 0.06,
                postTaxXirr: 0.042,
                postTaxAbsoluteReturn: 0.042,
                estimatedTax: 12500,
                netRealizableValue: 137500,
              },
              transactions: [
                {
                  id: 'tx-2',
                  date: '2023-06-01T00:00:00.000Z',
                  type: 'PURCHASE',
                  units: 6000,
                  nav: 25,
                  amount: 150000,
                  balance: 6000,
                },
              ],
            },
          ],
          closedFolios: [],
        }),
      });
    });

    // Mock family profiles
    await page.route('**/api/family/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock exposures
    await page.route('**/api/portfolio/*/exposures*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    // Mock xray
    await page.route('**/api/portfolio/*/xray*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          assetAllocation: { equity: 70, debt: 30, cash: 0, other: 0 },
        }),
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

    // Mock Section 112A harvesting opportunities
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
              folioId: 'folio-ppfc',
              schemeName: 'Parag Parikh Flexi Cap Fund',
              unitsToHarvest: 120.5,
              currentValue: 150000,
              unrealizedGain: 60000,
            },
          ],
          unrealizedSummary: {
            stcg: 0,
            ltcg: 60000,
            losses: 0,
            netGain: 60000,
            lots: [],
          },
        }),
      });
    });
  });

  test('toggle transitions smoothly between Broker View and Reality Check mode with dual grounding', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Verify Broker View is active by default
    const brokerBtn = page.getByRole('button', { name: 'Broker View' });
    await expect(brokerBtn).toBeVisible();

    // Verify gross valuation is shown
    await expect(page.locator('.stats-grid')).toContainText('₹5,00,000');
    await expect(page.locator('.stats-grid')).toContainText('18.20%');

    // Return Drag Waterfall should not be visible in Broker View
    await expect(page.getByText(/Return Drag Teardown:/i)).not.toBeVisible();

    // 2. Click Reality Check switch
    const realityBtn = page.getByRole('button', { name: 'Reality Check' });
    await realityBtn.click();

    // 3. Verify Reality Check valuation and real post-tax XIRR
    await expect(page.locator('.stats-grid')).toContainText('₹4,75,000');
    await expect(page.locator('.stats-grid')).toContainText('9.80%');

    // Verify dual-readout grounding subtext
    await expect(page.getByText(/Gross: ₹5,00,000/i)).toBeVisible();
    await expect(page.getByText(/Nominal: 18.20%/i)).toBeVisible();

    // 4. Verify Stepped Return Drag Teardown Banner is now rendered
    await expect(page.getByText(/Return Drag Teardown:/i)).toBeVisible();
    await expect(page.getByText('Inflation Drag')).toBeVisible();
    await expect(page.getByText(/Real Purchasing XIRR/i)).toBeVisible();
    await expect(page.getByText(/Safe-Asset Benchmark Comparison/i)).toBeVisible();
  });

  test('assumptions popover and navigation bridge to Tax Optimization work seamlessly', async ({
    page,
  }) => {
    await page.goto('/');

    // Activate Reality Check
    await page.getByRole('button', { name: 'Reality Check' }).click();

    // Click Assumptions button
    const assumptionsBtn = page.getByRole('button', { name: /Assumptions/i });
    await assumptionsBtn.click();

    // Popover content should be visible
    await expect(page.getByText('Reality Check Assumptions')).toBeVisible();
    await expect(page.getByText(/Annual CPI Inflation/i)).toBeVisible();
    await expect(page.getByText(/Marginal Income Tax Slab/i)).toBeVisible();

    // Close popover
    await page.getByRole('button', { name: '✕' }).click();
    await expect(page.getByText('Reality Check Assumptions')).not.toBeVisible();

    // Click View Harvesting Ticket link in the waterfall banner
    const harvestLink = page.getByRole('button', { name: /View Harvesting Ticket/i });
    await harvestLink.click();

    // Verify navigated to Tax Optimization tab
    const taxTab = page.getByRole('button', { name: /Tax Optimization/i });
    await expect(taxTab).toHaveClass(/active/);

    // Section 112A Tax Harvesting Opportunity card is visible
    await expect(page.getByText(/Tax Harvesting Opportunity/i)).toBeVisible();
    await expect(page.getByText(/CBDT Sec 112A Compliant/i)).toBeVisible();
    await expect(page.getByText('₹85,000').first()).toBeVisible();
    await expect(page.getByText('₹60,000').first()).toBeVisible();
  });

  test('copies harvesting instructions and opens simulation modal', async ({ page }) => {
    await page.goto('/');

    // Navigate to Tax Optimization tab
    await page.getByRole('button', { name: /Tax Optimization/i }).click();

    // Verify harvesting lot item is rendered
    await expect(page.getByText('Parag Parikh Flexi Cap Fund').first()).toBeVisible();
    await expect(page.getByText(/120.500 units/i)).toBeVisible();

    // Click Copy MF Central Instructions button
    const copyBtn = page.getByRole('button', { name: /Copy MF Central Instructions/i });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Either copied toast shows or fallback dialog opens
    const dialogOrCopied = page.locator('text=Copied Instructions!').or(page.getByRole('dialog'));
    await expect(dialogOrCopied).toBeVisible();

    // If modal opened, click Done to close
    const doneBtn = page.getByRole('button', { name: 'Done' });
    if (await doneBtn.isVisible()) {
      await doneBtn.click();
    }

    // Click Simulate button in harvesting ticket table
    const simulateBtn = page.getByRole('button', { name: 'Simulate' }).first();
    await simulateBtn.click();

    // Verify Simulation Modal opened pre-populated
    await expect(page.getByText(/Withdrawal Simulation/i)).toBeVisible();
  });

  test('scheme holdings table displays Net Realizable Value and Nominal tags in Reality Check mode', async ({
    page,
  }) => {
    await page.goto('/');

    // Verify default column header
    await expect(page.getByText('Current Value')).toBeVisible();

    // Activate Reality Check
    await page.getByRole('button', { name: 'Reality Check' }).click();

    // Header updates to Net Realizable Value
    await expect(page.getByText('Net Realizable Value')).toBeVisible();

    // Holdings row reflects net realizable value (₹3,37,500)
    await expect(page.getByText('₹3,37,500')).toBeVisible();

    // Nominal badges are visible in return column
    await expect(page.getByText('Nominal').first()).toBeVisible();

    // Debt scheme has negative real return indicator dot
    const warningDot = page.locator('span[title*="Negative real return"]');
    await expect(warningDot).toBeVisible();
  });
});
