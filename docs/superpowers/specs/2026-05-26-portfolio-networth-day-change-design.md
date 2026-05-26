# Design Spec: Daily Change Under Current Net Worth

This specification outlines the design and verification plan for displaying the 1-Day net worth daily change and percentage directly under the "Current Net Worth" card on the portfolio dashboard.

## Requirements

1. **Visual Display:**
   - Display daily change value formatted as currency under the net worth amount (e.g. `+₹1,500`).
   - Display bracketed daily change percentage (e.g. `(1.00%)`).
   - Dynamic coloring matching return status (green for positive change, red for negative change).
   - Show "Today" to clarify timeline.
2. **Quality & Stability:**
   - Zero-tolerance for `NaN` displays.
   - Graceful fallback (hidden display) if daily changes are not present or are invalid numbers.
3. **Test Synchronization:**
   - Update unit test mocks in `StatsGrid.test.tsx` to assert correct rendering.
   - Update E2E mocks to populate daily change metrics so they appear in all E2E test runs.

## Proposed Changes

### Frontend - Dashboard Card
No changes are required in `StatsGrid.tsx` itself because it already implements the visual card layout:
```typescript
        {isValidNumber(metrics.dayChange) && (
          <div style={{ fontSize: '0.875rem', color: getReturnColor(metrics.dayChange), fontWeight: '600' }}>
            {metrics.dayChange > 0 ? '+' : ''}{formatCurrency(metrics.dayChange)} {isValidNumber(metrics.dayChangePercentage) && `(${metrics.dayChangePercentage > 0 ? '+' : ''}${metrics.dayChangePercentage.toFixed(2)}%)`} Today
          </div>
        )}
```

### Frontend - Mocks & Tests
To populate this card with data across E2E and unit test scenarios:

#### [MODIFY] [StatsGrid.test.tsx](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/frontend/src/components/Dashboard/StatsGrid.test.tsx)
- Populate `mockMetrics` with `dayChange: 1500` and `dayChangePercentage: 0.01` (1.00%).
- Add assertions to verify that `+₹1,500` and `(1.00%)` are rendered.

#### [MODIFY] [auth-setup.ts](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/frontend/tests/utils/auth-setup.ts)
- Add `dayChange: 15` and `dayChangePercentage: 0.0125` to the mocked portfolio summary metrics.

#### [MODIFY] [cas-mock.ts](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/frontend/tests/utils/cas-mock.ts)
- Add `dayChange: 2500` and `dayChangePercentage: 0.025` to the mocked summary metrics.

#### [MODIFY] [milestone-v2.spec.ts](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/frontend/tests/milestone-v2.spec.ts)
- Add `dayChange: 1500` and `dayChangePercentage: 0.01` to the mocked summary metrics.

#### [MODIFY] [responsiveness.spec.ts](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/frontend/tests/responsiveness.spec.ts)
- Add `dayChange: 2000` and `dayChangePercentage: 0.02` to the mocked summary metrics.

## Verification Plan

### Unit Tests
- Run `cd frontend && npx vitest run src` and verify that unit tests pass successfully.

### E2E Tests
- Run `cd frontend && npx playwright test` and ensure all E2E specs pass without layout or element failure.
