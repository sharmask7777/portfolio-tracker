import { Page, Locator } from '@playwright/test';

export class UploadPage {
  readonly page: Page;
  readonly importCASButton: Locator;
  readonly passwordInput: Locator;
  readonly fileInput: Locator;
  readonly uploadLabel: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.importCASButton = page.getByRole('button', { name: /Import CAS/i });
    this.passwordInput = page.getByPlaceholder('PDF Password');
    this.fileInput = page.locator('input[type="file"]');
    this.uploadLabel = page.getByText('Select File & Upload');
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  async goto() {
    await this.page.goto('/');
    // Add an explicit wait for the dashboard to be ready
    await this.page.waitForLoadState('networkidle');
  }

  async openUploadModal() {
    try {
      await this.importCASButton.waitFor({ state: 'visible', timeout: 10000 });
      await this.importCASButton.click();
    } catch (e) {
      console.log('Failed to click Import CAS button. Current page URL:', this.page.url());
      console.log('Page content preview:', await this.page.content());
      throw e;
    }
  }

  /**
   * Performs the upload flow.
   */
  async uploadFile(filePath: string, password: string = 'TESTPAN123') {
    // Force open modal
    await this.openUploadModal();
    await this.passwordInput.waitFor({ state: 'visible' });
    await this.passwordInput.fill(password);
    await this.fileInput.setInputFiles(filePath);
  }
  
  async isUploading() {
    return await this.page.getByText('Parsing...').isVisible();
  }

  async waitForUploadComplete() {
    // Wait for the modal/overlay to disappear, which happens when uploading is done
    await this.page.waitForSelector('.loading-state', { state: 'detached' });
  }
}
