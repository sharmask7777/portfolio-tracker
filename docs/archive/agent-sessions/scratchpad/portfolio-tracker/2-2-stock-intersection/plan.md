# Plan: Stock Intersection (Overlap) Engine

## Test Strategy
- **Unit Tests**:
    - Mock `MarketDataService` to provide consistent holdings data.
    - Test `getPortfolioOverlap` with a set of folios and verify the aggregated stock exposures.
    - Test fund-to-fund overlap calculation (intersection over union or similar metric).
- **Integration Tests**:
    - Verify the API returns correctly structured data for a given portfolio.

## Implementation Plan
1.  **Overlap Service (`backend/src/services/overlap.service.ts`)**:
    - Define types for `StockExposure` and `FundOverlap`.
    - Implement `getPortfolioExposures(portfolioId: string)`:
        - Fetch portfolio from DB with folios and assets.
        - For each MF, fetch current value and holdings (via `MarketDataService`).
        - Multiply weight by total fund value to get absolute exposure.
        - Sum exposures for the same stock (using name/ISIN).
    - Implement `calculateFundOverlap(fundA_isin: string, fundB_isin: string)`:
        - Fetch holdings for both.
        - Calculate common holdings % (min of weights for common stocks).
2.  **API Integration**:
    - Add `GET /api/portfolio/:id/overlap` to `portfolio.routes.ts`.
    - Add `GET /api/portfolio/:id/exposures` for aggregated stock data.
3.  **Refactoring**:
    - Ensure `MarketDataService` returns a consistent format for holdings (FinAPI response parsing).
