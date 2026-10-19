import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('Mock Portfolios E2E Suite (Multi-Member, Zero Holdings & Lifecycle)', () => {
  const mockProfiles = [
    { id: 'prof-alpha', name: 'Alpha Investor', pan: 'ALPAC1001A', taxSlab: 0.3 },
    { id: 'prof-beta', name: 'Beta Partner', pan: 'BETAB2002B', taxSlab: 0.3 },
    { id: 'prof-gamma', name: 'Gamma Retiring', pan: 'GAMMG3003C', taxSlab: 0.2 },
  ];

  test.beforeEach(async ({ page }) => {
    await setupAuth(page);

    await page.route('**/api/family/profiles*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockProfiles),
      });
    });

    await page.route('**/api/portfolio/summary*', async (route) => {
      const url = new URL(route.request().url());
      const profileId = url.searchParams.get('profileId');

      if (profileId === 'prof-alpha') {
        // Individual Profile Alpha: Only Folio 1
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'prof-alpha',
            name: 'Member View',
            folios: [
              {
                id: 'folio-alpha-1',
                number: 'AUR-101',
                pan: 'ALPAC1001A',
                asset: {
                  id: 'asset-aurora',
                  name: 'Apex Large & Mid Cap Fund - Direct Growth',
                  type: 'MUTUAL_FUND',
                  isin: 'INF999K01001',
                  amfiCode: '900101',
                },
                metrics: {
                  investedAmount: 80000,
                  currentValue: 100000,
                  dayChange: 500,
                  dayChangePercentage: 0.5,
                  xirr: 0.18,
                  absoluteReturn: 0.25,
                  postTaxXirr: 0.16,
                  postTaxAbsoluteReturn: 0.22,
                },
                transactions: [
                  { id: 'tx-1', date: '2023-01-10T00:00:00.000Z', type: 'PURCHASE', units: 1000, nav: 80, amount: 80000, balance: 1000 },
                ],
              },
            ],
            closedFolios: [],
            metrics: {
              totalInvested: 80000,
              totalValue: 100000,
              totalGain: 20000,
              absoluteReturn: 0.25,
              xirr: 0.18,
              postTaxXirr: 0.16,
              dayChange: 500,
              dayChangePercentage: 0.5,
            },
          }),
        });
      } else {
        // Consolidated View (both Alpha and Beta folios + Gamma closed folio)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'consolidated',
            name: 'Consolidated Portfolio',
            folios: [
              {
                id: 'folio-alpha-1',
                number: 'AUR-101',
                pan: 'ALPAC1001A',
                asset: {
                  id: 'asset-aurora',
                  name: 'Apex Large & Mid Cap Fund - Direct Growth',
                  type: 'MUTUAL_FUND',
                  isin: 'INF999K01001',
                  amfiCode: '900101',
                },
                metrics: {
                  investedAmount: 80000,
                  currentValue: 100000,
                  dayChange: 500,
                  dayChangePercentage: 0.5,
                  xirr: 0.18,
                  absoluteReturn: 0.25,
                  postTaxXirr: 0.16,
                  postTaxAbsoluteReturn: 0.22,
                },
                transactions: [
                  { id: 'tx-1', date: '2023-01-10T00:00:00.000Z', type: 'PURCHASE', units: 1000, nav: 80, amount: 80000, balance: 1000 },
                ],
              },
              {
                id: 'folio-beta-2',
                number: 'AUR-102',
                pan: 'BETAB2002B',
                asset: {
                  id: 'asset-aurora',
                  name: 'Apex Large & Mid Cap Fund - Direct Growth',
                  type: 'MUTUAL_FUND',
                  isin: 'INF999K01001',
                  amfiCode: '900101',
                },
                metrics: {
                  investedAmount: 40000,
                  currentValue: 50000,
                  dayChange: 250,
                  dayChangePercentage: 0.5,
                  xirr: 0.12,
                  absoluteReturn: 0.25,
                  postTaxXirr: 0.11,
                  postTaxAbsoluteReturn: 0.22,
                },
                transactions: [
                  { id: 'tx-2', date: '2023-03-15T00:00:00.000Z', type: 'PURCHASE', units: 500, nav: 80, amount: 40000, balance: 500 },
                ],
              },
              {
                id: 'folio-standalone',
                number: 'TITAN-301',
                pan: 'ALPAC1001A',
                asset: {
                  id: 'asset-titan',
                  name: 'Titan Bluechip Opportunities Fund',
                  type: 'MUTUAL_FUND',
                  isin: 'INF999K01003',
                },
                metrics: {
                  investedAmount: 50000,
                  currentValue: 65000,
                  dayChange: 300,
                  dayChangePercentage: 0.46,
                  xirr: 0.15,
                  absoluteReturn: 0.3,
                  postTaxXirr: 0.13,
                  postTaxAbsoluteReturn: 0.27,
                },
                transactions: [
                  { id: 'tx-3', date: '2023-05-01T00:00:00.000Z', type: 'PURCHASE', units: 500, nav: 100, amount: 50000, balance: 500 },
                ],
              },
            ],
            closedFolios: [
              {
                id: 'folio-gamma-closed',
                number: 'ZEPH-999',
                asset: {
                  id: 'asset-zephyr',
                  name: 'Zephyr Exited Momentum Fund',
                  type: 'MUTUAL_FUND',
                  isin: 'INF999K01002',
                },
                metrics: {
                  investedAmount: 0,
                  currentValue: 0,
                  xirr: 0.22,
                  absoluteReturn: 0,
                },
                transactions: [
                  { id: 'tx-z1', date: '2022-01-01T00:00:00.000Z', type: 'PURCHASE', units: 500, nav: 100, amount: 50000, balance: 500 },
                  { id: 'tx-z2', date: '2023-02-01T00:00:00.000Z', type: 'REDEMPTION', units: -500, nav: 120, amount: 60000, balance: 0 },
                ],
              },
            ],
            metrics: {
              totalInvested: 170000,
              totalValue: 215000,
              totalGain: 45000,
              absoluteReturn: 0.2647,
              xirr: 0.165,
              postTaxXirr: 0.145,
              dayChange: 1050,
              dayChangePercentage: 0.49,
            },
          }),
        });
      }
    });
  });

  test('Consolidated view shows aggregated scheme row with both member PANs, expandable child folios, and closed positions drawer', async ({ page }) => {
    await page.goto('/');

    // 1. Verify scheme consolidation with multiple PANs
    const apexRow = page.locator('tr:not(.bg-gray-50)', { hasText: 'Apex Large & Mid Cap Fund' });
    await expect(apexRow).toHaveCount(1);
    await expect(apexRow.locator('text=2 Folios')).toBeVisible();
    await expect(apexRow.locator('text=ALPAC1001A, BETAB2002B')).toBeVisible();
    await expect(apexRow).toContainText('₹1,20,000'); // Combined invested (80k + 40k)
    await expect(apexRow).toContainText('₹1,50,000'); // Combined current value (100k + 50k)

    // 2. Expand folios
    await apexRow.click();
    await expect(page.locator('tr', { hasText: 'AUR-101' })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'AUR-102' })).toBeVisible();

    // 3. Verify closed positions drawer excludes Zephyr from active table and displays in drawer
    const activeTable = page.locator('table').first();
    await expect(activeTable).not.toContainText('Zephyr Exited Momentum Fund');

    const closedDrawer = page.locator('text=Closed / Fully Redeemed Positions (1)');
    await expect(closedDrawer).toBeVisible();
    await closedDrawer.click();

    await expect(page.locator('text=Zephyr Exited Momentum Fund')).toBeVisible();
    await expect(page.getByText('Fully Redeemed', { exact: true })).toBeVisible();
  });

  test('Switching to a specific profile isolates holdings to that profile and persists in localStorage', async ({ page }) => {
    await page.goto('/');

    // Click on Alpha Investor chip
    const alphaChip = page.locator('button', { hasText: 'Alpha Investor' });
    await expect(alphaChip).toBeVisible();
    await alphaChip.click();

    // Verify localStorage has persisted the selected profile
    const storedId = await page.evaluate(() => localStorage.getItem('portfolio_selected_profile_id'));
    expect(storedId).toBe('prof-alpha');

    // In Alpha's isolated view, only 1 folio exists (not 2 Folios)
    const apexRow = page.locator('tr:not(.bg-gray-50)', { hasText: 'Apex Large & Mid Cap Fund' });
    await expect(apexRow).toHaveCount(1);
    await expect(apexRow.locator('text=2 Folios')).not.toBeVisible();
    await expect(apexRow).toContainText('₹80,000');
    await expect(apexRow).toContainText('₹1,00,000');
  });

  test('Does not show manual close button and allows deletion of a profile', async ({ page }) => {
    let deleteProfileCalled = false;

    await page.route('**/api/family/profile/prof-gamma', async (route) => {
      deleteProfileCalled = true;
      await route.fulfill({ status: 200, body: JSON.stringify({ status: 'success' }) });
    });

    page.on('dialog', dialog => dialog.accept());
    await page.goto('/');

    // Verify Mark Closed button is absent (closure is derived automatically from data)
    const closeBtns = page.locator('button[title="Mark Closed"]');
    await expect(closeBtns).toHaveCount(0);

    // Test Delete Profile button on Gamma Retiring chip in FamilySelector
    const deleteGammaBtn = page.locator('button[title="Delete Profile"]').last();
    await expect(deleteGammaBtn).toBeVisible();
    await deleteGammaBtn.click();
    await expect.poll(() => deleteProfileCalled).toBe(true);
  });
});
