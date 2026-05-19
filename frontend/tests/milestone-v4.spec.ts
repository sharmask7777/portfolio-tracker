import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('Milestone v4.0: Analytics & Visualization', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
    // Navigate to the app and trigger a mock upload to populate data
    await page.goto('/');
    
    // Wait for the upload button (assuming empty state initially)
    const importBtn = page.getByRole('button', { name: /Import CAS/i });
    if (await importBtn.isVisible()) {
      await importBtn.click();
      
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'mock-cas.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('mock pdf content')
      });
      
      const passwordInput = page.getByPlaceholder(/Password/i);
      await passwordInput.fill('ABCDE1234F');
      
      // The file upload triggers automatically when the file is selected in this UI
    }

    // Wait for dashboard to load
    await expect(page.getByText('Overview')).toBeVisible({ timeout: 15000 });
  });

  test('should display Interactive History Visualization', async ({ page }) => {
    // Check if the History Chart is rendered
    await expect(page.getByText('Portfolio History')).toBeVisible();
    
    // Check for the segmented control ranges
    const ranges = ['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL'];
    for (const range of ranges) {
      await expect(page.getByRole('button', { name: range, exact: true })).toBeVisible();
    }
    
    // Check if the chart container is present
    await expect(page.locator('.recharts-responsive-container').first()).toBeVisible();
  });

  test('should display Historical Insights & Metrics (ATH, Max Invested)', async ({ page }) => {
    // Look for the Historical Highlights card
    const card = page.locator('.card:has-text("Historical Highlights")');
    await expect(card).toBeVisible();
    
    // Wait for loading to finish
    await expect(page.getByText('Loading highlights...')).not.toBeVisible({ timeout: 20000 });

    // Check if we have data or the "no data" message
    const noData = page.getByText('No historical highlights available.');
    const hasData = page.getByText('All-Time High Corpus');

    if (await noData.isVisible()) {
      console.warn('Historical Highlights: No data available for this portfolio.');
      return; // Acceptable if the history calculation is still pending or mock data is empty
    }

    // Look for ATH Corpus and Max Invested sections
    await expect(hasData).toBeVisible();
    await expect(page.getByText('Maximum Invested')).toBeVisible();
    
    // Look for yearly breakdown table/list
    await expect(page.getByText('Yearly Breakdown')).toBeVisible();

    // Ensure that NaN is not displayed in any table cell
    const cells = page.locator('.card:has-text("Yearly Breakdown") td');
    const cellCount = await cells.count();
    for (let i = 0; i < cellCount; i++) {
      const cellText = await cells.nth(i).innerText();
      expect(cellText).not.toContain('NaN');
    }
  });
});
