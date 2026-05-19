import { Page } from '@playwright/test';

/**
 * Minimal auth setup for E2E tests.
 * Injects session data into localStorage so AuthContext treats the user as authenticated.
 */
export async function setupAuth(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('token', 'mock-jwt-token');
    window.localStorage.setItem('user', JSON.stringify({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
    }));
  });

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
        }
      }),
    });
  });
}
