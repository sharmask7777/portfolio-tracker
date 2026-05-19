import { Page } from '@playwright/test';
import { MockCASGenerator, MockCAS } from './MockCASGenerator';

/**
 * Mocks the CAS upload API response.
 * @param page Playwright Page object
 * @param mockData Optional mock data to return. If not provided, random data is generated.
 */
export async function mockCASUpload(page: Page, mockData?: MockCAS) {
  const data = mockData || MockCASGenerator.generate();
  
  await page.route('**/api/portfolio/upload*', async (route) => {
    // Check if it's a POST request
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    } else {
      await route.continue();
    }
  });

  return data;
}

/**
 * Mocks the portfolio summary API response.
 * @param page Playwright Page object
 * @param mockData The MockCAS data to transform into summary format
 */
export async function mockPortfolioSummary(page: Page, mockData: MockCAS) {
  const summary = {
    id: 'mock-portfolio-id',
    name: 'Mock Portfolio',
    folios: mockData.folios.flatMap(f => f.schemes.map(s => ({
      id: `mock-folio-${s.isin}`,
      asset: {
        name: s.scheme,
        type: 'MUTUAL_FUND',
      },
      metrics: {
        investedAmount: s.transactions.reduce((acc, t) => acc + (t.type.includes('PURCHASE') ? t.amount : 0), 0),
        currentValue: s.transactions[s.transactions.length - 1].balance * s.transactions[s.transactions.length - 1].nav,
        xirr: 0.15,
      }
    }))),
    metrics: {
      totalInvested: 100000,
      totalValue: 125000,
      totalGain: 25000,
      absoluteReturn: 0.25,
      xirr: 0.15,
    }
  };

  await page.route('**/api/portfolio/summary*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(summary),
    });
  });

  // Also mock other required endpoints for the dashboard
  await page.route('**/api/portfolio/*/xray', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ assetAllocation: [], sectorExposure: [] }),
    });
  });

  await page.route('**/api/portfolio/*/exposures', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/portfolio/*/tax-summary', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ realized: { total: 0 }, unrealized: { total: 0 } }),
    });
  });

  await page.route('**/api/tax/harvesting-opportunities', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  return summary;
}

/**
 * Mocks an API error response.
 * @param page Playwright Page object
 * @param endpoint Endpoint pattern to intercept
 * @param status HTTP status code (default 500)
 * @param message Error message
 */
export async function mockAPIError(page: Page, endpoint: string, status: number = 500, message: string = 'Internal Server Error') {
  await page.route(endpoint, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    });
  });
}
