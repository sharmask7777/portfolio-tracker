import { test, expect } from '@playwright/test';
import { UploadPage } from './pom/UploadPage';
import { DashboardPage } from './pom/DashboardPage';
import { mockCASUpload, mockPortfolioSummary, mockAPIError } from './utils/cas-mock';
import { setupAuth } from './utils/auth-setup';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('CAS Upload Flow', () => {
  let dummyPdfPath: string;

  test.beforeEach(async ({ page }, testInfo) => {
    await setupAuth(page);
    dummyPdfPath = path.join(__dirname, `dummy-${testInfo.workerIndex}.pdf`);
    fs.writeFileSync(dummyPdfPath, 'dummy pdf content');
  });

  test.afterEach(async () => {
    if (fs.existsSync(dummyPdfPath)) {
      fs.unlinkSync(dummyPdfPath);
    }
  });

  test('happy path: upload CAS and see dashboard metrics', async ({ page }) => {
    const uploadPage = new UploadPage(page);
    const dashboardPage = new DashboardPage(page);
    
    // 1. Mock the CAS upload and subsequent summary fetch
    const mockData = await mockCASUpload(page);
    await mockPortfolioSummary(page, mockData);
    
    // 2. Navigate and upload
    await uploadPage.goto();
    await uploadPage.uploadFile(dummyPdfPath);
    
    // 3. Wait for upload to complete
    await uploadPage.waitForUploadComplete();
    
    // 4. Verify Dashboard displays data
    await dashboardPage.waitForData();
    const netWorth = await dashboardPage.getNetWorth();
    
    // Verify net worth is present (contains currency symbol)
    expect(netWorth).toContain('₹');
    
    // Verify scheme count matches mock data
    const schemeCount = await dashboardPage.getSchemesCount();
    const expectedSchemes = mockData.folios.reduce((acc, f) => acc + f.schemes.length, 0);
    expect(schemeCount).toBe(expectedSchemes);
  });

  test('error handling: show message on 500 error', async ({ page }) => {
    const uploadPage = new UploadPage(page);
    
    // 1. Mock a 500 error
    await mockAPIError(page, '**/api/portfolio/upload*', 500, 'Invalid PDF format');
    
    // 2. Setup dialog listener (App.tsx uses alert())
    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });
    
    // 3. Navigate and upload
    await uploadPage.goto();
    await uploadPage.uploadFile(dummyPdfPath);
    
    // 4. Verify error message
    await expect.poll(() => alertMessage).toContain('Invalid PDF format');
  });
});
