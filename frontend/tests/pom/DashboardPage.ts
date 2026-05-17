import { Page, Locator } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly netWorth: Locator;
  readonly schemesTable: Locator;
  readonly emptyState: Locator;
  readonly loadingState: Locator;

  constructor(page: Page) {
    this.page = page;
    // Selects the stat-value that follows a stat-label containing "Net Worth"
    this.netWorth = page.locator('.card:has(.stat-label:has-text("Net Worth")) .stat-value');
    this.schemesTable = page.locator('.data-table');
    this.emptyState = page.locator('.empty-state');
    this.loadingState = page.locator('.loading-state');
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
}
