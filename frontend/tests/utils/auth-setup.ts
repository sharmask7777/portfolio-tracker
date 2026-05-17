import { Page } from '@playwright/test';

/**
 * Minimal auth setup for E2E tests.
 * Currently mocks the session as the application doesn't have a full login flow yet.
 */
export async function setupAuth(page: Page) {
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      }),
    });
  });
}
