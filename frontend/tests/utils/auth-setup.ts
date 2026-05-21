import { Page } from '@playwright/test';

/**
 * Minimal auth setup for E2E tests.
 * localStorage injection is now handled by playwright.config.ts storageState.
 */
export async function setupAuth(page: Page) {
  // 1. Mock the auth check endpoint to prevent any network-based session invalidation
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: { id: 'test-user', email: 'test@example.com', name: 'Test User' }
      }),
    });
  });

  // Mock family profiles
  await page.route('**/api/family/profiles*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 'profile1', name: 'Member 1', pan: 'ABCDE1234F' },
        { id: 'profile2', name: 'Member 2', pan: 'VWXYZ5678G' }
      ]),
    });
  });

  // Mock portfolio summary to prevent endless loading state
  await page.route('**/api/portfolio/summary*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-portfolio-id',
        name: 'Mock Portfolio',
        folios: [],
        metrics: { totalInvested: 1000, totalValue: 1200, totalGain: 200, absoluteReturn: 0.2, xirr: 0.15, postTaxAbsoluteReturn: 0.18, postTaxXirr: 0.12 }
      }),
    });
  });

  // Mock other required endpoints for the dashboard
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

  await page.route('**/api/portfolio/*/stats', async (route) => {
    await route.fulfill({ 
      status: 200, 
      contentType: 'application/json', 
      body: JSON.stringify({ 
        ath: { value: 130000, date: '2026-01-01' }, 
        maxInvested: { value: 110000, date: '2025-12-01' },
        yearly: [
          { year: 2026, ath: { value: 130000, date: '2026-01-01' }, maxInvested: { value: 110000, date: '2026-01-01' } },
          { year: 2025, ath: { value: 115000, date: '2025-12-31' }, maxInvested: { value: 100000, date: '2025-12-31' } }
        ]
      }) 
    });
  });

  // 2. Navigate to root explicitly
  await page.goto('/');
  await page.waitForLoadState('networkidle');
}

/**
 * Setup auth specifically for tests that disable global storageState (like logout).
 */
export async function setupAuthLogout(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('bypass-auth', 'true');
    window.localStorage.setItem('token', 'mock-token');
    window.localStorage.setItem('user', JSON.stringify({
      id: 'test-user',
      email: 'test@example.com',
      name: 'Test User'
    }));
  });
  await setupAuth(page);
}
