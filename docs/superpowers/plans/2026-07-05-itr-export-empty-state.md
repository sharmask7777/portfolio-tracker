# ITR Export Empty State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the UX issue where the "Export ITR Report (CSV)" button silently does nothing when clicked on an account with zero realized gains. Instead, display a browser alert explaining that there are no realized gains for the period.

**Architecture:** 
- Catch the empty realized gains condition (`filteredDetails.length === 0`) in the `exportCSV` function in `TaxView.tsx` and trigger `window.alert`.
- Add generic styling for disabled buttons in `App.css`.
- Add Vitest component unit test for checking the alert behavior in `TaxView.test.tsx`.
- Add Playwright E2E test to verify the user flow in `tests/itr-export.spec.ts`.

**Tech Stack:** React, TypeScript, Vitest, Playwright E2E

---

### Task 1: Component and Styling Modifications

**Files:**
- Modify: `frontend/src/components/Tax/TaxView.tsx`
- Modify: `frontend/src/App.css`

- [ ] **Step 1: Implement empty state alert in exportCSV**

Update `exportCSV` in `frontend/src/components/Tax/TaxView.tsx` to call `alert` when `filteredDetails` is empty:
```typescript
  const exportCSV = () => {
    if (filteredDetails.length === 0) {
      alert("No realized gains found for this period to export.");
      return;
    }
```

- [ ] **Step 2: Add global disabled button styling**

Add the following rule to the end of `frontend/src/App.css`:
```css
.btn:disabled, button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
  box-shadow: none !important;
}
```

- [ ] **Step 3: Verify the application builds successfully**

Run production build in `frontend`:
Run: `npm run build` inside `frontend/` directory.
Expected: Build passes with no TypeScript or Vite compiler errors.

- [ ] **Step 4: Commit changes**

Run:
```bash
git add frontend/src/components/Tax/TaxView.tsx frontend/src/App.css
git commit -m "feat(frontend): trigger alert when exporting empty ITR report and add disabled button styling"
```

---

### Task 2: Unit Testing (Vitest)

**Files:**
- Create: `frontend/src/components/Tax/TaxView.test.tsx`

- [ ] **Step 1: Create unit test file for TaxView**

Create `frontend/src/components/Tax/TaxView.test.tsx` with the following content:
```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { TaxView } from './TaxView';
import { describe, it, expect, vi } from 'vitest';

describe('TaxView', () => {
  const mockSummary = {
    hasSyntheticAnchors: false,
    details: []
  };

  it('shows alert when exporting with zero realized gains', () => {
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    
    render(<TaxView summary={mockSummary} harvesting={null} />);
    
    const exportBtn = screen.getByRole('button', { name: /Export ITR Report/i });
    fireEvent.click(exportBtn);
    
    expect(alertMock).toHaveBeenCalledWith('No realized gains found for this period to export.');
    alertMock.mockRestore();
  });
});
```

- [ ] **Step 2: Run component unit tests**

Run: `npm run test:unit` inside `frontend/` directory.
Expected: All unit tests (including the new `TaxView.test.tsx`) pass successfully.

- [ ] **Step 3: Commit changes**

Run:
```bash
git add frontend/src/components/Tax/TaxView.test.tsx
git commit -m "test(frontend): add unit test for TaxView empty export alert"
```

---

### Task 3: E2E Integration Testing (Playwright)

**Files:**
- Create: `frontend/tests/itr-export.spec.ts`

- [ ] **Step 1: Create Playwright E2E spec**

Create `frontend/tests/itr-export.spec.ts` with the following content:
```typescript
import { test, expect } from '@playwright/test';
import { setupAuth } from './utils/auth-setup';

test.describe('ITR Export Empty State', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuth(page);

    // Mock summary with empty details
    await page.route('**/api/portfolio/summary*', async (route) => {
      const summary = {
        id: 'empty-portfolio',
        folios: [],
        metrics: {
          totalInvested: 0,
          totalValue: 0,
          totalGain: 0,
          absoluteReturn: 0,
          xirr: 0,
          dayChange: 0,
          dayChangePercentage: 0
        }
      };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(summary) });
    });

    await page.route('**/api/portfolio/*/xray*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ assetAllocation: [], sectorExposure: [] }) });
    });

    await page.route('**/api/portfolio/*/exposures*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.route('**/api/portfolio/*/tax-summary*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ details: [] }) });
    });

    await page.route('**/api/tax/harvesting-opportunities*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        totalPotentialHarvest: 0,
        estimatedTaxSavings: 0,
        opportunities: []
      })});
    });
  });

  test('should trigger browser alert when clicked with zero transactions', async ({ page }) => {
    // 1. Go to page and click Tax tab
    await page.goto('/');
    const taxTab = page.locator('button.tab', { hasText: 'Tax Optimization' });
    await expect(taxTab).toBeVisible();
    await taxTab.click();

    // 2. Setup dialog handler
    let alertMessage = '';
    page.on('dialog', async dialog => {
      alertMessage = dialog.message();
      await dialog.accept();
    });

    // 3. Click export button
    const exportBtn = page.getByRole('button', { name: /Export ITR Report/i });
    await expect(exportBtn).toBeVisible();
    await exportBtn.click();

    // 4. Verify alert dialog was shown with correct message
    expect(alertMessage).toBe('No realized gains found for this period to export.');
  });
});
```

- [ ] **Step 2: Run E2E tests**

Run: `npx playwright test frontend/tests/itr-export.spec.ts`
Expected: Playwright E2E test runs and passes successfully.

- [ ] **Step 3: Commit changes**

Run:
```bash
git add frontend/tests/itr-export.spec.ts
git commit -m "test(e2e): add E2E test for empty ITR export state browser alert"
```
