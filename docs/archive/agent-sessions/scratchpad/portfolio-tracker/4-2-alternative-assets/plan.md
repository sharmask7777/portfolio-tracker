# Plan: Alternative Assets (EPF, PPF, SGB, Gold)

## Test Strategy
- **Unit Tests**:
    - `AlternativeAssetService`: Test EPF (8.25%) and PPF (7.1%) compounding over 1 year and 5 years.
    - `AlternativeAssetService`: Test Gold valuation with mocked live prices.
- **Integration Tests**:
    - Verify `POST /api/portfolio/manual-asset` persists the asset and folio correctly.
    - Verify `XRayService` aggregates alternative assets into the correct categories (Debt/Gold).

## Implementation Plan
1.  **Schema Update**: Add EPF, PPF, SGB, PHYSICAL_GOLD to `AssetType` in Prisma.
2.  **Market Data**: Add `getGoldPrice` to `MarketDataService` using Gold-API.com.
3.  **Alternative Service**: Implement compounding interest logic for retirement accounts.
4.  **Backend API**: Add `/manual-asset` endpoint for manual portfolio additions.
5.  **Analytics**: Update `XRayService` and `summary` API to correctly calculate and categorize these assets.
6.  **Frontend**: Build `AddAssetModal` and integrate into the main dashboard header.
