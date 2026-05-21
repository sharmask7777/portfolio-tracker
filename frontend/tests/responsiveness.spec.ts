import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  test('header layout on mobile', async ({ page }) => {
    // Set viewport to a common mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Check if header is visible
    const header = page.locator('.header');
    await expect(header).toBeVisible();

    // In a broken layout, elements might overlap or be pushed out of bounds.
    // We can check if the header height is reasonable (not too large)
    // or if the logo is still visible.
    const headerBox = await header.boundingBox();
    console.log('Header height on mobile:', headerBox?.height);
    
    // If it's fixed to 64px, it might be clipping content.
    // Let's check if the Import CAS button is visible
    const importButton = page.getByRole('button', { name: /Import CAS/i });
    await expect(importButton).toBeVisible();
    
    // Check for horizontal overflow on the page level
    const pageOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    expect(pageOverflow, 'Page should not have horizontal scrollbar on mobile').toBe(false);
  });

  test('stats grid on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Mock data so we have a portfolio
    await page.route('**/api/portfolio/summary*', async route => {
      await route.fulfill({ 
        status: 200, 
        body: JSON.stringify({
          id: 'test-id',
          metrics: {
            totalInvested: 100000,
            totalValue: 120000,
            totalGain: 20000,
            absoluteReturn: 0.2,
            xirr: 0.25
          },
          folios: []
        }) 
      });
    });

    await page.goto('/');

    const statsGrid = page.locator('.stats-grid');
    await expect(statsGrid).toBeVisible();

    // Check if cards are stacked (mostly full width)
    const cards = page.locator('.stats-grid .card');
    const firstCardBox = await cards.nth(0).boundingBox();
    if (firstCardBox) {
      expect(firstCardBox.width).toBeGreaterThan(300); // 375 - padding
    }
  });

  test('modal responsiveness', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    await page.getByRole('button', { name: /Import CAS/i }).click();
    
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();
    
    const modalBox = await modal.boundingBox();
    if (modalBox) {
      // Modal should not exceed screen width
      expect(modalBox.width).toBeLessThanOrEqual(375);
      // It should have some padding/margin
      expect(modalBox.width).toBeGreaterThan(300);
    }
  });
});
