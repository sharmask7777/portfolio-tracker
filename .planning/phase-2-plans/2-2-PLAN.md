# Phase 2, Task 2: Stock Intersection (Overlap) Engine

## Objective
Develop the logic to identify overlapping stock holdings across multiple mutual funds.

## Given
*   Portfolio holdings data (stocks and their weights) available via `MarketDataService`.
*   User's mutual fund quantities from the database.

## When
1.  Implement an `OverlapService` that takes a portfolio ID.
2.  For each mutual fund in the portfolio, fetch its underlying stock holdings and weights.
3.  Calculate the absolute value of each stock holding (Fund Value * Stock Weight).
4.  Aggregate these values across all funds to find the "True Exposure" to each individual stock.
5.  Identify "Overlap" cases where multiple funds hold the same stock.
6.  Calculate the "Portfolio Overlap Percentage" between any two funds.

## Then
*   The system should be able to tell the user: "You have 12% exposure to HDFC Bank across 4 different mutual funds."
*   The engine should provide data suitable for a "Stock Intersection" visualization.
