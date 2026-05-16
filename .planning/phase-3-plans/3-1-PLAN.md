# Phase 3, Task 1: Core Tax Calculation Engine (FIFO & Grandfathering)

## Objective
Implement a robust capital gains calculation engine following Indian tax laws.

## Given
*   Historical transactions (purchases/redemptions) in the database.
*   Asset master data with acquisition dates.

## When
1.  Implement a **FIFO (First-In, First-Out)** matching algorithm to pair redemptions with original purchases.
2.  Implement logic for **Equity Mutual Funds/Stocks**:
    *   LTCG: Holding period > 1 year. 12.5% tax (current rule).
    *   STCG: Holding period <= 1 year. 15% (or latest) tax.
    *   **Grandfathering**: Handle Jan 31, 2018 price rule for older equity assets.
3.  Implement logic for **Debt Mutual Funds**:
    *   Handle the post-April 2023 "slab rate" rule for new acquisitions.
    *   Handle grandfathered indexation benefits for older debt holdings.
4.  Calculate "Realized Gains" and "Unrealized Gains" breakdown.

## Then
*   The system should correctly identify which units are Long Term vs Short Term.
*   The backend should provide a precise gain/loss breakdown for every redemption.
