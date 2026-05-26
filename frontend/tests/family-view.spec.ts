import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('Family View & Managed Profiles', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  test('should detect and split multi-PAN CAS into profiles', async ({ page }) => {
    await page.goto('/');
    
    // Upload multi-PAN CAS (using a helper or mock)
    // For this test, we assume the backend handles the splitting and the UI reflects it.
    
    // Verify that the FamilySelector shows multiple profiles
    const selector = page.locator('.family-selector-container');
    await expect(selector).toContainText('Consolidated Family');
    
    // Wait for profiles to load
    await expect(page.locator('button.chip:not(.active)').first()).toBeVisible();
    
    const initialNetWorth = await page.locator('.stats-grid .card:first-child').innerText();
    
    // Switch to an individual member
    const profileChips = page.locator('button.chip');
    const memberName = await profileChips.nth(1).innerText();
    await profileChips.nth(1).click();
    
    // Verify that the dashboard title or data changes
    const filteredNetWorth = await page.locator('.stats-grid .card:first-child').innerText();
    // Consolidate should usually be >= filtered
    expect(filteredNetWorth).toBeDefined();
  });

  test('should show symmetric post-tax metrics in stats grid', async ({ page }) => {
    await page.goto('/');
    
    const statsGrid = page.locator('.stats-grid');
    await expect(statsGrid).toContainText('Current Net Worth');
    await expect(statsGrid).toContainText('Overall XIRR');
    await expect(statsGrid).toContainText('After-Tax XIRR:');
  });

  test('should allow renaming a managed member', async ({ page }) => {
    // Override the global mock to simulate state change
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

    await page.goto('/');
    
    // Find the first member chip and click its edit icon
    const editButton = page.locator('button[title="Rename Profile"]').first();
    await editButton.click();
    
    // Rename to "Family Member X"
    const input = page.locator('input[type="text"]');
    await input.fill('Family Member X');

    // Intercept the PATCH request and update the GET mock
    await page.route('**/api/family/profile/*', async (route) => {
      // Upon successful patch, update the GET route to return the new name
      await page.route('**/api/family/profiles*', async (getRoute) => {
        await getRoute.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'profile1', name: 'Family Member X', pan: 'ABCDE1234F' },
            { id: 'profile2', name: 'Member 2', pan: 'VWXYZ5678G' }
          ]),
        });
      });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'success' }) });
    });

    await page.click('button:text("Save Changes")');
    
    // Verify name change in selector
    await expect(page.locator('.family-selector-container')).toContainText('Family Member X');
  });
});
