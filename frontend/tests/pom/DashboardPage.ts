import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly netWorth: Locator;
  readonly schemesTable: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;
  readonly logoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Selects the div containing the value inside the card that has the text "Current Net Worth"
    this.netWorth = page.locator('.card:has-text("Current Net Worth")').locator('div').nth(1);
    this.schemesTable = page.locator('.data-table');
    this.emptyState = page.locator('.empty-state');
    this.loadingState = page.locator('.loading-state');
    this.logoutButton = page.getByRole('button', { name: 'Logout' });
  }

  async getNetWorth() {
    return await this.netWorth.textContent();
  }

  async getSchemesCount() {
    return await this.page.locator('.data-table tbody tr').count();
  }

  async switchTab(tabName: string) {
    await this.page.getByRole('button', { name: tabName, exact: false }).click();
  }

  async waitForData() {
    await this.schemesTable.waitFor({ state: 'visible' });
  }

  async logout() {
    await this.logoutButton.click();
  }
}
