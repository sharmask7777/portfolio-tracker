import { test, expect } from '@playwright/test';
import { DashboardPage } from './pom/DashboardPage';
import { UploadPage } from './pom/UploadPage';
import { setupAuth } from './utils/auth-setup';
import { mockCASUpload } from './utils/cas-mock';
import * as fs from 'fs';
import * as path from 'path';

const DUMMY_PDF = path.join(__dirname, 'logout-dummy.pdf');

test.beforeAll(async () => {
  fs.writeFileSync(DUMMY_PDF, 'dummy pdf content');
});

test.afterAll(async () => {
  if (fs.existsSync(DUMMY_PDF)) {
    fs.unlinkSync(DUMMY_PDF);
  }
});

test.describe('Logout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);
  });

  test('should clear session and return to empty state on logout', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const uploadPage = new UploadPage(page);
    
    // 1. Setup: Upload data first to be on dashboard
    await mockCASUpload(page);
    await uploadPage.goto();
    await uploadPage.uploadFile(DUMMY_PDF);
    await dashboardPage.waitForData();
    
    // 2. Perform Logout
    await dashboardPage.logout();
    
    // 3. Verify empty state is shown (app returns to "No portfolio data found")
    await expect(dashboardPage.emptyState).toBeVisible();
    await expect(page.getByText('No portfolio data found')).toBeVisible();
    
    // 4. Verify schemes table is gone
    await expect(dashboardPage.schemesTable).not.toBeVisible();
  });
});
