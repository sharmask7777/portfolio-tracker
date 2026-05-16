# Plan: Portfolio X-Ray View (Backend & Logic)

## Test Strategy
- **Unit Tests**:
    - Mock `MarketDataService` to return consistent sector and market cap data.
    - Test `getXRayData` and verify that percentages sum up correctly (or close to 100%).
    - Verify that different asset types (hybrid funds) are handled correctly if data allows.
- **Integration Tests**:
    - Verify the `/xray` endpoint returns the expected JSON structure.

## Implementation Plan
1.  **XRay Service (`backend/src/services/xray.service.ts`)**:
    - Define interfaces for `SectorAllocation`, `MarketCapBreakdown`, and `AssetAllocation`.
    - Implement `getXRayData(portfolioId: string)`:
        - Fetch portfolio, folios, and live values (reuse logic from `OverlapService` or `PerformanceService`).
        - For each folio, fetch `holdingsData` from `MarketDataService`.
        - Extract `sectors` and `portfolio.marketCapWeightage` from `holdingsData`.
        - Extract `portfolio.assetAllocation` (Equity vs Debt vs Cash).
        - Aggregate values weighted by the folio's current market value.
2.  **API Integration**:
    - Add `GET /api/portfolio/:id/xray` to `portfolio.routes.ts`.
3.  **Refactoring (Optional)**:
    - Extract common "Portfolio Value Calculator" logic used by `OverlapService` and `XRayService` to avoid duplication.
