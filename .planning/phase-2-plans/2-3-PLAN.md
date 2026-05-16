# Phase 2, Task 3: Portfolio X-Ray View (Backend & Logic)

## Objective
Implement the analytical backend for Morningstar-style Portfolio X-Ray (Sector, Market Cap, Asset Allocation).

## Given
*   Detailed holdings and sector data from `MarketDataService`.

## When
1.  Extend `PerformanceService` or create `AnalyticsService` to aggregate:
    *   **Sector Allocation**: % of total portfolio in Banking, Tech, Pharma, etc.
    *   **Asset Allocation**: % in Equity, Debt, and Cash.
    *   **Market Cap Breakdown**: % in Large Cap, Mid Cap, and Small Cap.
2.  Implement logic to handle the "Debt" portion of hybrid/liquid funds.
3.  Expose these aggregations via a new endpoint `GET /api/portfolio/xray`.

## Then
*   The backend should provide a comprehensive "X-Ray" JSON response summarizing the portfolio's structural risks and exposures.
