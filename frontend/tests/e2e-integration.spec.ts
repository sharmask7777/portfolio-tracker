import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setupAuth } from './utils/auth-setup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * INTEGRATION TEST: This test does NOT mock the API.
 * It requires the backend, worker, redis, and postgres to be running locally.
 * It verifies the actual file-sharing and processing logic between Backend and Worker.
 */
test.describe('E2E Integration: Real PDF Processing', () => {
  let dummyPdfPath: string;

  test.beforeEach(async ({ page }, testInfo) => {
    // We still use setupAuth to bypass the UI login, but we expect the backend to accept the session
    await setupAuth(page);
    
    // Create a very small valid-looking dummy file
    dummyPdfPath = path.join(__dirname, `integration-test-${testInfo.workerIndex}.pdf`);
    // Note: This won't actually "parse" correctly since it's not a real CAS PDF, 
    // but it will test the File-Not-Found and Job Queueing logic perfectly.
    fs.writeFileSync(dummyPdfPath, 'dummy pdf content');
  });

  test.afterEach(async () => {
    if (fs.existsSync(dummyPdfPath)) {
      fs.unlinkSync(dummyPdfPath);
    }
  });

  test('should successfully hand off file from backend to worker', async ({ page }) => {
    // 1. Open the upload modal
    await page.goto('/');
    await page.getByRole('button', { name: /Import CAS/i }).click();

    // 2. Fill password and upload
    await page.getByPlaceholder('PDF Password').fill('TEST1234');
    
    // Start watching for the upload-status network call
    const statusPromise = page.waitForResponse(response => 
      response.url().includes('/api/portfolio/upload-status/') && response.status() === 200,
      { timeout: 15000 }
    );

    await page.locator('input[type="file"]').setInputFiles(dummyPdfPath);

    // 3. Verify the UI moves to "Processing"
    // This confirms the backend successfully received the file and enqueued the job
    await expect(page.getByText(/Processing|Uploading/)).toBeVisible();

    // 4. Wait for the first status poll
    const response = await statusPromise;
    const body = await response.json();
    
    // 5. Assertions
    expect(body).toHaveProperty('status');
    // We expect it to be either PROCESSING (success) or FAILED (because the PDF is dummy)
    // BUT, it should NOT be "FileNotFound" anymore!
    expect(body.message).not.toContain('No such file or directory');
    expect(body.message).not.toContain('File not found');
  });
});
