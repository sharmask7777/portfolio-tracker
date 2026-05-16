# Plan: Core Tax Calculation Engine (FIFO & Grandfathering)

## Test Strategy
- **Unit Tests**:
    - Test FIFO matching with simple buy/sell sequences.
    - Test STCG/LTCG classification for equity (> 1yr).
    - Test Grandfathering: Buy before 2018, sell after.
    - Test Debt Fund Rules: Buy before and after April 2023.
- **Integration Tests**:
    - Verify the API returns correctly aggregated realized gains for a portfolio.

## Implementation Plan
1.  **Tax Service (`backend/src/services/tax.service.ts`)**:
    - Define interfaces for `TaxRecord` and `GainsSummary`.
    - Implement `calculateGains(transactions: any[], assetType: AssetType)`:
        - Sort transactions by date.
        - Maintain a queue of "buy" lots.
        - For every "sell", consume from the queue using FIFO.
        - Classify each matched pair as STCG or LTCG.
        - Apply grandfathering prices if buy date < Feb 2018.
    - Implement `getUnrealizedGains(buyLots: any[], currentPrice: number)`:
        - Evaluate remaining lots in the queue against current price.
2.  **API Integration**:
    - Add `GET /api/portfolio/:id/tax-summary` to `portfolio.routes.ts`.
3.  **Grandfathering Data**:
    - Add a mock or constant for Jan 31, 2018 prices (or allow passing it as a parameter).
