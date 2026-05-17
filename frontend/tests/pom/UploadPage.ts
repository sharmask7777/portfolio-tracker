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
    this.importCASButton = page.getByRole('button', { name: 'Import CAS' });
    this.passwordInput = page.getByPlaceholder('PDF Password');
    this.fileInput = page.locator('input[type="file"]');
    this.uploadLabel = page.getByText('Select File & Upload');
    this.cancelButton = page.getByRole('button', { name: 'Cancel' });
  }

  async goto() {
    await this.page.goto('/');
  }

  async openUploadModal() {
    await this.importCASButton.click();
  }

  /**
   * Performs the upload flow.
   * Note: The app triggers upload immediately after file selection.
   */
  async uploadFile(filePath: string, password: string = 'TESTPAN123') {
    if (!(await this.passwordInput.isVisible())) {
      await this.openUploadModal();
    }
    await this.passwordInput.fill(password);
    await this.fileInput.setInputFiles(filePath);
  }
  
  async isUploading() {
    return await this.page.getByText('Parsing...').isVisible();
  }

  async waitForUploadComplete() {
    await this.page.waitForSelector('text=Parsing...', { state: 'detached' });
  }
}
