# Plan: Tax Implications Analyzer (Pre-trade)

## Test Strategy
- **Unit Tests**:
    - Simulate selling half of a folio and verify which buy lots are matched (FIFO).
    - Verify tax calculation matches `TaxService` refined logic.
    - Test edge cases: selling more than owned, selling 0 units.
- **API Test**:
    - `POST /api/tax/simulate-sell`: Verify it returns a breakdown of units, gains, and estimated tax.

## Implementation Plan
1.  **Tax Analyzer Service (`backend/src/services/tax-analyzer.service.ts`)**:
    - Implement `simulateSell(folioId, unitsToSell)`:
        - Fetch folio and its transactions.
        - Fetch latest NAV.
        - Reuse `TaxService.calculatePortfolioTax` to get the current state of lots.
        - Implement logic to "slice" the lots based on `unitsToSell`.
        - Calculate tax on the selected slice using the `calculateGain` method (internalizing it or making it static/public).
2.  **API Integration**:
    - Add `POST /api/tax/simulate-sell` to a new `backend/src/routes/tax.routes.ts`.
    - Register `taxRoutes` in `backend/src/index.ts`.
3.  **Frontend Update (Optional but recommended)**:
    - Add a "Simulate Sell" button next to holdings.
    - Open a small sidebar or modal to enter units and see tax impact.
