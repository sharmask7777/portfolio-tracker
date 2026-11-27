# Task 2 Report: Granular Asset Allocation and Market Cap Parity

**Date:** 2026-11-23  
**Status:** Completed  
**Commit:** `83527fa` (`feat(mobile): granular asset allocation and market cap breakdown`)  

---

## 1. Executive Summary

Task 2 resolves user finding #2:
> *"2. I still see gold/others whereas the asset allocation in the web view is infinitely more correct at large cap/mid cap/ small cap/ debt/ arbitrage."*

Previously, `mobile/src/services/portfolio-calculations.ts` collapsed any non-equity/debt/hybrid asset into `'Gold/Others'` (`ASSET_CLASSES = ['Equity', 'Debt', 'Hybrid', 'Gold/Others']`), producing the rogue 96.9% gold/others bug whenever arbitrage or unclassified instruments were encountered. Additionally, `mobile/app/(tabs)/analytics.tsx` only displayed 4 hardcoded cards without Arbitrage or Market Cap breakdown (`Large Cap`, `Mid Cap`, `Small Cap`).

This implementation:
1. Replaced legacy `'Gold/Others'` with the 6 canonical categories: `'Equity' | 'Debt' | 'Arbitrage' | 'Gold' | 'Cash' | 'Other'`.
2. Updated `normalizeAssetClass(raw: string, category?: string | null)` to use declared `HoldingEntity.asset_category` and token parsing, mapping unknown holdings to `'Other'` (never `'Gold/Others'`).
3. Standardized palette colors across calculation, card, and grid presentation:
   - `Equity`: `#38bdf8`
   - `Debt`: `#10b981`
   - `Arbitrage`: `#ec4899`
   - `Gold`: `#f59e0b`
   - `Cash`: `#06b6d4`
   - `Other`: `#71717a`
4. Added `arbitrage?: { percentage: number; value: number }` to `XRayData.assetAllocation` in `hierarchy-types.ts`, and updated `analytics-service.ts` to separate arbitrage holdings without double-counting.
5. Added `MarketCapSection` on `AnalyticsScreen` displaying Large Cap, Mid Cap, Small Cap, and Other cards with distinct color badges, and updated `AllocationCardsGrid` to dynamically render all non-zero categories.

---

## 2. Files Modified & Created

### Created:
- [analytics-service.test.ts](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/mobile/src/services/analytics-service.test.ts) (101 lines, <= 300) - Unit tests asserting `deriveAnalyticsFromHoldings` produces non-empty `marketCap` and non-empty `assetAllocation` with `arbitrage`.
- [AssetAllocationCard.test.tsx](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/mobile/src/components/AssetAllocationCard.test.tsx) (51 lines, <= 300) - Component unit tests for empty allocation, segmented bars with 6 canonical categories, and `ASSET_CLASS_COLORS`.

### Modified:
- [portfolio-calculations.ts](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/mobile/src/services/portfolio-calculations.ts) (299 lines, <= 300) - Canonical `CanonicalAssetClass` union, `normalizeAssetClass`, `ALLOCATION_COLORS`, `ASSET_CLASSES`, and `buildAssetAllocation`.
- [AssetAllocationCard.tsx](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/mobile/src/components/AssetAllocationCard.tsx) (148 lines, <= 300) - Added `ASSET_CLASS_COLORS` and updated row/bar rendering for canonical asset classes.
- [hierarchy-types.ts](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/mobile/src/services/hierarchy-types.ts) (124 lines, <= 300) - Added `arbitrage?: { percentage: number; value: number }` to `XRayData.assetAllocation`.
- [analytics-service.ts](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/mobile/src/services/analytics-service.ts) (193 lines, <= 300) - Updated `categorizeHolding`, `accumulateVal`, and `buildXRayData` to include `arbitrage` in `assetAllocation` and ensure correct `marketCap`.
- [analytics.tsx](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/mobile/app/(tabs)/analytics.tsx) (278 lines, <= 300) - Added `MarketCapSection` and updated `AllocationCardsGrid` to dynamically render all non-zero categories.
- [portfolio-calculations.test.ts](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/mobile/src/services/portfolio-calculations.test.ts) (215 lines, <= 300) - Tests for canonical `normalizeAssetClass` and `buildAssetAllocation`.
- [portfolio-service.test.ts](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/mobile/src/services/portfolio-service.test.ts) (449 lines) - Updated asset normalization assertions to canonical categories.
- [analytics-tab.test.tsx](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/mobile/tests/analytics-tab.test.tsx) (652 lines) - Added `MarketCapSection` assertions.

### Maintainability Sensors Check:
- Zero `any` types: PASS (verified by `tsc --noEmit` and strict ESLint).
- Function lines <= 50: PASS.
- Cyclomatic complexity <= 10: PASS (all functions <= 6, verified by ESLint `complexity` rule).
- File lines <= 300 for source files: PASS (`portfolio-calculations.ts` = 299 lines, `analytics.tsx` = 278 lines, `AssetAllocationCard.tsx` = 148 lines).
- Parameter counts <= 4: PASS.
- Synthetic data only: PASS.

---

## 3. Detailed Changes

1. **Canonical Asset Class Union (`portfolio-calculations.ts`):**
   - Defined `export type CanonicalAssetClass = 'Equity' | 'Debt' | 'Arbitrage' | 'Gold' | 'Cash' | 'Other';`.
   - Updated `AssetAllocationItem.name` and `GroupedHoldings.assetClass` to `CanonicalAssetClass`.
   - Updated `ASSET_CLASSES` and `ALLOCATION_COLORS`:
     ```ts
     export const ALLOCATION_COLORS: Record<CanonicalAssetClass, string> = {
       Equity: '#38bdf8',
       Debt: '#10b981',
       Arbitrage: '#ec4899',
       Gold: '#f59e0b',
       Cash: '#06b6d4',
       Other: '#71717a',
     };
     ```
   - Updated `normalizeAssetClass(raw: string, category?: string | null)`:
     - Checks `category` first (`ARBITRAGE`, `EQUITY`, `DEBT`, `GOLD`, `CASH`, `OTHER`).
     - Uses token matching without branching (`hasToken` via array `some` to maintain complexity <= 6):
       - Arbitrage -> `'Arbitrage'`
       - Equity / Stock / Index -> `'Equity'`
       - Debt / Bond / Liquid / Gilt / Treasury -> `'Debt'`
       - Gold / SGB / Silver -> `'Gold'`
       - Cash / Overnight -> `'Cash'`
       - Fallback -> `'Other'` (never `'Gold/Others'`).

2. **Asset Allocation Card (`AssetAllocationCard.tsx`):**
   - Exported `ASSET_CLASS_COLORS` with standard hex codes.
   - Updated `renderAllocationRow` and progress bar segments to look up canonical colors.
   - Updated import to `../services/portfolio-calculations` to prevent circular dependencies and unnecessary native module bundling.

3. **Hierarchy Data Contract (`hierarchy-types.ts`):**
   - Added `arbitrage?: { percentage: number; value: number } | undefined` to `XRayData.assetAllocation`.

4. **Analytics Service (`analytics-service.ts`):**
   - Added `matchHoldingCategory` and `matchHoldingTokens` (complexity <= 6) in `categorizeHolding`.
   - Updated `accumulateVal` so `cat === 'arbitrage'` accumulates into `acc.arbitrage` directly.
   - In `buildXRayData`, populated `xrayData.assetAllocation.arbitrage` and ensured `marketCap` reflects positive equity values.

5. **Analytics Tab UI (`mobile/app/(tabs)/analytics.tsx`):**
   - Created `MarketCapSection` component rendering `Large Cap`, `Mid Cap`, `Small Cap`, and `Other` (if > 0) with distinct color badges (`#38bdf8`, `#a855f7`, `#f59e0b`, `#71717a`).
   - Expanded `AllocationCardsGrid` to dynamically render all non-zero categories (`Equity`, `Debt`, `Arbitrage`, `Cash`, `Gold`, `Other`) alongside baseline pillars.
   - Inserted `<MarketCapSection marketCap={xrayData.marketCap} />` directly below `AllocationCardsGrid`.

---

## 4. Verification Evidence

### Test Execution:
```
pnpm --filter mobile build:verify
$ eslint . --max-warnings=0 -> 0 errors, 0 warnings
$ tsc --noEmit -> 0 type errors
$ knip --production -> Excellent, Knip found no issues.
$ vitest run --coverage -> 40 test files passed (388 tests passed)
```

### Coverage Results:
- Lines: 89.9% (>= 85% requirement)
- Statements: 89.16% (>= 85% requirement)
- Functions: 84.87% (>= 80% requirement)
- Branches: 76.99% (>= 70% requirement)

### Git Commit:
- Commit: `83527fa`
- Message: `feat(mobile): granular asset allocation and market cap breakdown`
- 10 files changed, 427 insertions(+), 107 deletions(-)
