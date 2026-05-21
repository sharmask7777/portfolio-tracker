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
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ jobId: 'mock-job-id-123', message: 'PDF upload accepted' }),
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
    id: 'mock-portfolio-id', // Crucial: Dashboard relies on this ID to fetch other data
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
        postTaxXirr: 0.12,
        absoluteReturn: 0.25,
        postTaxAbsoluteReturn: 0.20
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

  // Mock all subsequent calls that Dashboard makes when it gets a valid portfolio ID
  await page.route('**/api/portfolio/*/xray*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ assetAllocation: [], sectorExposure: [] }),
    });
  });

  await page.route('**/api/portfolio/*/exposures*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ name: 'Mock Exposure', percentage: 0.1 }]),
    });
  });

  await page.route('**/api/portfolio/*/tax-summary*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ realized: { total: 0 }, unrealized: { total: 0 } }),
    });
  });

  await page.route('**/api/tax/harvesting-opportunities*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
  
  // Historical data mock for the chart
  await page.route('**/api/portfolio/*/history', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ date: '2026-05-20', value: 125000, invested: 100000 }]),
    });
  });

  // Insights / highlights mock
  await page.route('**/api/portfolio/*/insights', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ allTimeHigh: { value: 130000, date: '2026-01-01' }, maxDrawdown: { percentage: -0.1 } }),
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
