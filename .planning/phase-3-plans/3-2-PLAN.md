# Phase 3, Task 2: Tax Implications Analyzer (Pre-trade)

## Objective
Build the "TradeSmart" equivalent to evaluate tax impact before selling.

## Given
*   Real-time portfolio state and unit costs.
*   Core Tax Engine (Task 1).

## When
1.  Implement an API `POST /api/tax/simulate-sell`.
2.  Input: Folio ID, amount or units to sell.
3.  Logic:
    *   Use FIFO to determine which units would be sold.
    *   Calculate exactly how much STCG and LTCG tax would be triggered.
    *   Identify if any "grandfathered" units are being touched.
4.  Provide "Switch Analysis": If switching from Regular to Direct or one fund to another, show total exit load and tax costs.

## Then
*   The user can see the exact tax cost (in INR) before hitting "sell" on any asset.
