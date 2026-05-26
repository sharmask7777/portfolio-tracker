# Net Worth Daily Change Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate and verify the daily change amount and bracketed percentage display under the Current Net Worth card in both unit tests and E2E mocked environments.

**Architecture:** 
Update `mockMetrics` in the unit tests to include `dayChange` and `dayChangePercentage`, adding assertions to verify correct rendering. Update E2E mock endpoints in the 4 E2E/Responsiveness test suites to supply `dayChange` and `dayChangePercentage` in the mocked portfolio summary, ensuring they are rendered under the Current Net Worth card during Playwright test runs.

**Tech Stack:** React, Vitest, Playwright E2E

---

### Task 1: Update StatsGrid Unit Tests

**Files:**
- Modify: `frontend/src/components/Dashboard/StatsGrid.test.tsx`

- [ ] **Step 1: Write the updated test metrics and assertions**

Update the mock metrics and add assertions to verify that the daily change amount (`+₹1,500`) and the daily change percentage (`(1.00%)`) are rendered:

```typescript
// Modify: frontend/src/components/Dashboard/StatsGrid.test.tsx
  const mockMetrics = {
    totalInvested: 100000,
    totalValue: 150000,
    totalGain: 50000,
    absoluteReturn: 0.5,
    xirr: 0.25,
    postTaxTotalValue: 140000,
    postTaxXirr: 0.20,
    estimatedTax: 10000,
    dayChange: 1500,
    dayChangePercentage: 0.01
  };
```

And in the primary metrics render test, assert that the daily change is rendered:
```typescript
  it('renders primary pre-tax metrics', () => {
    render(<StatsGrid metrics={mockMetrics} performanceMode="XIRR" />);
    expect(screen.getByText(/Current Net Worth/)).toBeDefined();
    expect(screen.getByText(/Total Invested/)).toBeDefined();
    expect(screen.getByText(/25.00%/)).toBeDefined();
    // Daily Net Worth Change assertions
    expect(screen.getByText(/\+₹1,500/)).toBeDefined();
    expect(screen.getByText(/\(1.00%\)/)).toBeDefined();
  });
```

- [ ] **Step 2: Run unit tests to verify they pass**

Run: `cd frontend && npx vitest run src/components/Dashboard/StatsGrid.test.tsx`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Dashboard/StatsGrid.test.tsx
git commit -m "test(unit): verify net worth daily change and percentage display in StatsGrid"
```

---

### Task 2: Update E2E Mocks

**Files:**
- Modify: `frontend/tests/utils/auth-setup.ts`
- Modify: `frontend/tests/utils/cas-mock.ts`
- Modify: `frontend/tests/milestone-v2.spec.ts`
- Modify: `frontend/tests/responsiveness.spec.ts`

- [ ] **Step 1: Update auth-setup base mock summary**

In `frontend/tests/utils/auth-setup.ts`, update the mocked portfolio summary metrics:

```typescript
// Modify: frontend/tests/utils/auth-setup.ts
  await page.route('**/api/portfolio/summary*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-portfolio-id',
        name: 'Mock Portfolio',
        folios: [],
        metrics: { 
          totalInvested: 1000, 
          totalValue: 1200, 
          totalGain: 200, 
          absoluteReturn: 0.2, 
          xirr: 0.15, 
          postTaxAbsoluteReturn: 0.18, 
          postTaxXirr: 0.12,
          dayChange: 15,
          dayChangePercentage: 0.0125
        }
      }),
    });
  });
```

- [ ] **Step 2: Update CAMS upload mock summary**

In `frontend/tests/utils/cas-mock.ts`, update the mocked summary metrics:

```typescript
// Modify: frontend/tests/utils/cas-mock.ts
    metrics: {
      totalInvested: 100000,
      totalValue: 125000,
      totalGain: 25000,
      absoluteReturn: 0.25,
      xirr: 0.15,
      dayChange: 2500,
      dayChangePercentage: 0.025
    }
```

- [ ] **Step 3: Update milestone-v2 mock summary**

In `frontend/tests/milestone-v2.spec.ts`, update the mocked summary metrics:

```typescript
// Modify: frontend/tests/milestone-v2.spec.ts
        metrics: {
          totalInvested: 100000,
          totalValue: 150000,
          totalGain: 50000,
          absoluteReturn: 0.5,
          xirr: 0.20,
          dayChange: 1500,
          dayChangePercentage: 0.01
        }
```

- [ ] **Step 4: Update responsiveness mock summary**

In `frontend/tests/responsiveness.spec.ts`, update the mocked summary metrics:

```typescript
// Modify: frontend/tests/responsiveness.spec.ts
          metrics: {
            totalInvested: 100000,
            totalValue: 120000,
            totalGain: 20000,
            absoluteReturn: 0.2,
            xirr: 0.25,
            dayChange: 2000,
            dayChangePercentage: 0.02
          },
```

- [ ] **Step 5: Run Playwright E2E tests to verify everything passes**

Run: `cd frontend && npx playwright test`
Expected: 17 passed

- [ ] **Step 6: Commit**

```bash
git add frontend/tests/utils/auth-setup.ts frontend/tests/utils/cas-mock.ts frontend/tests/milestone-v2.spec.ts frontend/tests/responsiveness.spec.ts
git commit -m "test(e2e): populate dayChange and dayChangePercentage in E2E mocks"
```
