# Plan: Tax Harvesting Engine

## Test Strategy
- **Unit Tests**:
    - Test calculation of remaining exemption limit.
    - Test identification of LTCG lots (> 1yr).
    - Test recommendation logic: Ensure it doesn't exceed the exemption limit and prioritizes high-gain lots.
- **API Test**:
    - `GET /api/tax/harvesting-opportunities`: Verify it returns a list of recommendations and potential tax savings.

## Implementation Plan
1.  **Harvesting Service (`backend/src/services/harvesting.service.ts`)**:
    - Implement `getHarvestingOpportunities(userId: string)`:
        - Determine current Financial Year (April 1 to March 31).
        - Fetch all folios for the user.
        - Calculate total realized LTCG for the current FY.
        - Calculate remaining exemption limit (₹1,25,000 - realizedLTCG).
        - If remaining limit <= 0, return no opportunities.
        - Scan all equity folios for active buy lots.
        - Filter lots with holding period > 1 year and current price > buy price.
        - Rank lots by unrealized gain percentage.
        - Select units to sell from these lots to fill up the remaining exemption limit.
        - Return recommendations with units, current value, and estimated tax savings.
2.  **API Integration**:
    - Add `GET /api/tax/harvesting-opportunities` to `backend/src/routes/tax.routes.ts`.
3.  **Frontend Hook**:
    - The API will be consumed by the "Tax" tab in Phase 3, Task 4.
