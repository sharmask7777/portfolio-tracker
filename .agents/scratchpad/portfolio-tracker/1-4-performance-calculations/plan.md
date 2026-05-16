# Plan: Core Performance Calculations (XIRR/CAGR)

## Test Strategy
- **Unit Tests**:
    - Test XIRR with known cash flows (e.g., -100 at T0, 110 at T1 -> 10% XIRR).
    - Test CAGR (e.g., 100 to 121 in 2 years -> 10% CAGR).
    - Test edge cases: single transaction, zero returns, negative returns.
- **Integration Tests**:
    - Verify `PerformanceService` correctly processes Prisma transaction objects.

## Implementation Plan
1.  **Dependencies**:
    - Install `xirr` in the backend.
2.  **Performance Service (`backend/src/services/performance.service.ts`)**:
    - Implement `calculateXIRR(transactions, currentValue)`:
        - Map transactions to `{ amount, when }`.
        - Add a final "mock" transaction representing the current valuation (as a positive inflow).
        - Handle cases where XIRR cannot be computed (e.g., not enough data).
    - Implement `calculateCAGR(investedAmount, currentValue, years)`.
    - Implement `calculateAbsoluteReturn(investedAmount, currentValue)`.
3.  **Data Processing**:
    - Create a wrapper that aggregates transactions from the DB and fetches/mocks current market prices to pass into the calculation methods.
4.  **API Integration**:
    - Update `portfolio.routes.ts` or create a new `performance.routes.ts` to expose these metrics.
    - Alternatively, enrich the `GET /summary` response with these values.
