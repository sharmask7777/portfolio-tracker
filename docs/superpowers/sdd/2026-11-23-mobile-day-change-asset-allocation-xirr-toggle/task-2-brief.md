### Task 2: Granular Asset Allocation and Market Cap Parity

**Files:**
- Modify: `mobile/src/services/portfolio-calculations.ts`
- Modify: `mobile/src/components/AssetAllocationCard.tsx`
- Modify: `mobile/src/services/hierarchy-types.ts`
- Modify: `mobile/src/services/analytics-service.ts`
- Modify: `mobile/app/(tabs)/analytics.tsx`
- Test: `mobile/src/services/portfolio-calculations.test.ts`
- Test: `mobile/src/services/analytics-service.test.ts`
- Test: `mobile/src/components/AssetAllocationCard.test.tsx`

**Interfaces:**
- Consumes: `HoldingEntity.asset_category`, `XRayData.assetAllocation`, `XRayData.marketCap`.
- Produces: Granular `AssetAllocationItem[]` (`Equity`, `Debt`, `Arbitrage`, `Gold`, `Cash`, `Other`) and Market Cap component on Analytics.

- [ ] **Step 1: Write failing unit tests for canonical asset classification and Market Cap**

In `portfolio-calculations.test.ts`:
- Test that schemes with `AssetCategory` `ARBITRAGE` or names containing `Arbitrage` map to `Arbitrage`.
- Test that schemes with `AssetCategory` `EQUITY`, `DEBT`, `GOLD`, `CASH` map to their respective classes.
- Test that unknown schemes map to `Other` (never `Gold/Others`), preventing the 96.9% rogue gold bug.

In `analytics-service.test.ts`:
- Test that `deriveAnalyticsFromHoldings()` produces non-empty `marketCap` (large, mid, small) and non-empty `assetAllocation` with `arbitrage`.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter mobile test:unit mobile/src/services/portfolio-calculations.test.ts mobile/src/services/analytics-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `portfolio-calculations.ts` and `AssetAllocationCard.tsx`**

In `portfolio-calculations.ts`:
- Define canonical asset class union: `'Equity' | 'Debt' | 'Arbitrage' | 'Gold' | 'Cash' | 'Other'`.
- Update `normalizeAssetClass(raw: string, category?: string)`:
  - If `category` is provided, map `EQUITY` -> `Equity`, `DEBT` -> `Debt`, `ARBITRAGE` -> `Arbitrage`, `GOLD` -> `Gold`, `CASH` -> `Cash`, `OTHER` -> `Other`.
  - Check string tokens: `arbitrage` -> `Arbitrage`, `equity`/`stock`/`index` -> `Equity`, `debt`/`bond`/`liquid` -> `Debt`, `gold`/`sgb`/`silver` -> `Gold`, `cash` -> `Cash`, fallback -> `Other`.
- In `buildAssetAllocation()`: map the 6 canonical categories with standard palette:
  - `Equity`: `#38bdf8`
  - `Debt`: `#10b981`
  - `Arbitrage`: `#ec4899`
  - `Gold`: `#f59e0b`
  - `Cash`: `#06b6d4`
  - `Other`: `#71717a`

In `AssetAllocationCard.tsx`:
- Support the 6 canonical categories with matching color definitions.

- [ ] **Step 4: Update `hierarchy-types.ts`, `analytics-service.ts`, and `mobile/app/(tabs)/analytics.tsx`**

In `hierarchy-types.ts`:
- Add `arbitrage?: { percentage: number; value: number }` to `XRayData.assetAllocation`.

In `mobile/app/(tabs)/analytics.tsx`:
- Create `MarketCapSection` component rendering cards for Large Cap, Mid Cap, Small Cap, and Other (if > 0) with distinct color badges.
- Expand `AllocationCardsGrid` to dynamically render non-zero categories (`Equity`, `Debt`, `Arbitrage`, `Cash`, `Gold`, `Other`) from `xrayData.assetAllocation`.
- Insert `MarketCapSection` right above or below `AllocationCardsGrid`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter mobile test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/services/portfolio-calculations.ts mobile/src/components/AssetAllocationCard.tsx mobile/src/services/hierarchy-types.ts mobile/src/services/analytics-service.ts mobile/app/(tabs)/analytics.tsx mobile/src/services/portfolio-calculations.test.ts mobile/src/services/analytics-service.test.ts
git commit -m "feat(mobile): granular asset allocation and market cap breakdown"
```

---

