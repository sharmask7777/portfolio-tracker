# Phase 1, Task 4: Core Performance Calculations (XIRR/CAGR)

## Objective
Implement the logic to calculate precise performance metrics for the portfolio.

## Given
*   Historical transaction data in the database.
*   Current market data (initial mock or basic API integration).

## When
1.  Implement an XIRR calculation algorithm (using Newton-Raphson method or a library like `finance.js` / `bisection-method`).
2.  Implement CAGR (Compound Annual Growth Rate) logic.
3.  Calculate Absolute Returns and Point-to-Point returns.
4.  Implement these calculations at three levels: Asset, Folio, and Total Portfolio.
5.  Add support for calculating metrics over different time horizons (1Y, 3Y, 5Y, All-time).
6.  Validate the results against standard financial calculators.

## Then
*   The backend should provide accurate XIRR and CAGR values for any given asset or group.
*   Calculations must account for all cash flows (investments and redemptions).
