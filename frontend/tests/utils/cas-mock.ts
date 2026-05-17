import { Page } from '@playwright/test';
import { MockCASGenerator, MockCAS } from '../../../backend/test-utils/MockCASGenerator';

/**
 * Mocks the CAS upload API response.
 * @param page Playwright Page object
 * @param mockData Optional mock data to return. If not provided, random data is generated.
 */
export async function mockCASUpload(page: Page, mockData?: MockCAS) {
  const data = mockData || MockCASGenerator.generate();
  
  await page.route('**/api/portfolio/upload', async (route) => {
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
