# Phase 5, Task 3: PBT for Core Math & Taxation

## Objective
Write extensive property tests to validate the stability of XIRR, CAGR, and the Indian Capital Gains Engine.

## Given
*   `PerformanceService` and `TaxService`.
*   `fast-check` arbitraries.

## When
1.  **XIRR PBT:** Verify that `PerformanceService.calculateXIRR` never throws or returns `NaN` for any valid sequence of cash flows (using `node-irr` fallback).
2.  **Tax FIFO PBT:** Verify that `TaxService.calculatePortfolioTax` never sells more units than acquired across thousands of random buy/sell sequences.
3.  **Tax Set-off PBT:** Verify the invariant: `Taxable STCG + Taxable LTCG <= Raw STCG + Raw LTCG` (ensure set-off never increases tax liability).
4.  **Grandfathering PBT:** Verify that for equity lots bought before Jan 31, 2018, the effective buy NAV is always `>=` the original buy NAV (assuming FMV > buy NAV).

## Then
*   The financial math and tax logic are mathematically proven to be robust against all possible user transaction patterns.
