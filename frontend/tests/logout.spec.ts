import { test, expect } from '@playwright/test';
import { DashboardPage } from './pom/DashboardPage';
import { UploadPage } from './pom/UploadPage';
import { setupAuth } from './utils/auth-setup';
import { mockCASUpload, mockPortfolioSummary } from './utils/cas-mock';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Logout Flow', () => {
  let dummyPdfPath: string;

  test.beforeEach(async ({ page }, testInfo) => {
    await setupAuth(page);
    dummyPdfPath = path.join(__dirname, `logout-dummy-${testInfo.workerIndex}.pdf`);
    fs.writeFileSync(dummyPdfPath, 'dummy pdf content');
  });

  test.afterEach(async () => {
    if (fs.existsSync(dummyPdfPath)) {
      fs.unlinkSync(dummyPdfPath);
    }
  });

  test('should clear session and return to empty state on logout', async ({ page }) => {
    const dashboardPage = new DashboardPage(page);
    const uploadPage = new UploadPage(page);
    
    // 1. Setup: Upload data first to be on dashboard
    const mockData = await mockCASUpload(page);
    await mockPortfolioSummary(page, mockData);
    
    await uploadPage.goto();
    await uploadPage.uploadFile(dummyPdfPath);
    await dashboardPage.waitForData();
    
    // 2. Perform Logout
    await dashboardPage.logout();
    
    // 3. Verify user is redirected to the login page
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.locator('text="Welcome Back"')).toBeVisible();
    await expect(page.locator('text="Sign In"')).toBeVisible();
    
    // 4. Verify schemes table is gone
    await expect(dashboardPage.schemesTable).not.toBeVisible();
  });
});
