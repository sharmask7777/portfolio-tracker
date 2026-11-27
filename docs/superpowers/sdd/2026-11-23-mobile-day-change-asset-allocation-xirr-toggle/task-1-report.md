# Task 1 Report: SQLite Schema, Repository & Data Sync Pipeline for Day Change and Returns

**Date:** 2026-11-23  
**Status:** Completed  
**Commit:** `cf309ef` (`fix(mobile): persist and map day change, returns, and asset category`)

---

## 1. Executive Summary

Task 1 establishes data parity between backend Single Source of Truth (SSoT) and the mobile offline SQLite database.
Previously, `HoldingEntity` lacked columns for `day_change`, `day_change_pct`, `xirr`, `absolute_return`, and `asset_category`, causing `mapRawFolioToHolding()` to drop these server-provided fields and `getEnrichedHoldings()` to fall back to `0.00%` when NAV history was unavailable.

All 5 columns have been added to `HoldingEntity`, `CREATE_HOLDINGS_TABLE` DDL, safe non-destructive migration alters in `initDatabase`, repository upsert bindings, mapping logic in `mapRawFolioToHolding()`, enrichment caching in `getEnrichedHoldings()`, and core-view adaptation in `holding-adapters.ts`.

---

## 2. Files Modified & Created

### Created:
- `mobile/src/services/portfolio-calculations.test.ts` (128 lines) - Unit tests for `mapRawFolioToHolding` and `summarizeHoldings`.
- `mobile/src/components/Holdings/holding-adapters.test.ts` (68 lines) - Unit tests for `adaptHoldingToFolioInput` metrics and fallback returns.

### Modified:
- `mobile/src/db/schema.ts` (196 lines, <= 300) - Added `day_change`, `day_change_pct`, `xirr`, `absolute_return`, `asset_category` to `HoldingEntity` and `CREATE_HOLDINGS_TABLE`.
- `mobile/src/db/client.ts` (53 lines, <= 300) - Added `runSafeMigrations` with `ALTER TABLE` statements inside `initDatabase`.
- `mobile/src/db/repository.ts` (209 lines, <= 300) - Bound 5 new columns in `upsertHolding`.
- `mobile/src/services/portfolio-calculations.ts` (295 lines, <= 300) - Extended `ServerFolioData` and extracted metrics in `mapRawFolioToHolding`.
- `mobile/src/services/portfolio-service.ts` (257 lines, <= 300) - Updated `getEnrichedHoldings` to use server-provided `day_change` and `day_change_pct` when non-zero.
- `mobile/src/components/Holdings/holding-adapters.ts` (102 lines, <= 300) - Passed `xirr`, `absoluteReturn`, `dayChange`, `dayChangePercentage` in `adaptHoldingToFolioInput`.
- `mobile/src/db/repository.test.ts` - Added tests for persisting and querying the 5 new columns.
- `mobile/src/services/portfolio-service.test.ts` - Added test verifying `getEnrichedHoldings` uses server day change directly without `nav_history`.

---

## 3. Detailed Changes

1. **Schema & Migration (`schema.ts`, `client.ts`):**
   - Added `day_change?: number | undefined`, `day_change_pct?: number | undefined`, `xirr?: number | undefined`, `absolute_return?: number | undefined`, `asset_category?: string | null | undefined` to `HoldingEntity`.
   - Updated `CREATE_HOLDINGS_TABLE` DDL with `day_change REAL DEFAULT 0`, `day_change_pct REAL DEFAULT 0`, `xirr REAL DEFAULT 0`, `absolute_return REAL DEFAULT 0`, `asset_category TEXT`.
   - Added idempotent `runSafeMigrations()` in `initDatabase()` to safely apply `ALTER TABLE holdings ADD COLUMN ...` on existing databases.

2. **Repository (`repository.ts`):**
   - Updated `upsertHolding()` SQL query and parameters to bind `day_change`, `day_change_pct`, `xirr`, `absolute_return`, and `asset_category`.

3. **Data Mapping (`portfolio-calculations.ts`):**
   - Extended `ServerFolioData` with `assetCategory?: string | undefined` and `metrics?: { dayChange?: number; dayChangePercentage?: number; xirr?: number; absoluteReturn?: number }`.
   - Created `extractHoldingMetrics()` helper with low cyclomatic complexity (complexity <= 6) to safely map server metrics into `HoldingEntity`.

4. **Service Enrichment (`portfolio-service.ts`):**
   - Extracted `resolveHoldingDayChange()` and `computeHoldingGainLoss()`.
   - `getEnrichedHoldings()` uses `h.day_change` and `h.day_change_pct` directly when present and non-zero, only falling back to `calculateHoldingDayChange()` when both are 0.

5. **Adapter (`holding-adapters.ts`):**
   - In `adaptHoldingToFolioInput()`, passed `xirr: holding.xirr ?? undefined`, `absoluteReturn: holding.absolute_return ?? fallbackAbsReturn`, `dayChange: holding.dayChange`, and `dayChangePercentage: holding.dayChangePct`.

---

## 4. Verification Evidence

### Step 2: TDD Failure Evidence
Initially, tests in `src/db/repository.test.ts` and `src/services/portfolio-calculations.test.ts` failed as expected due to missing properties:
```
FAIL  src/db/repository.test.ts > persists and reads day_change, day_change_pct, xirr, absolute_return, asset_category
AssertionError: expected undefined to be 250.5

FAIL  src/services/portfolio-calculations.test.ts > mapRawFolioToHolding > extracts dayChange, dayChangePercentage, xirr, absoluteReturn, and assetCategory from ServerFolioData
AssertionError: expected undefined to be 250.5

FAIL  src/services/portfolio-calculations.test.ts > mapRawFolioToHolding > falls back to defaults when metrics or assetCategory are missing
AssertionError: expected undefined to be +0
```

### Step 5: Unit & Integration Test Verification
Ran unit test suites:
```
✓ src/components/Holdings/holding-adapters.test.ts (3 tests)
✓ src/services/portfolio-calculations.test.ts (3 tests)
✓ src/db/repository.test.ts (16 tests)
✓ src/services/portfolio-service.test.ts (17 tests)
Test Files  4 passed (4)
Tests  39 passed (39)
```

### Full Build & Invariant Checks
1. `pnpm --filter mobile lint` (`eslint . --max-warnings=0`): PASS (0 errors, 0 warnings).
2. `pnpm --filter mobile typecheck` (`tsc --noEmit`): PASS (0 errors).
3. `pnpm --filter mobile knip` (`knip --production`): PASS (no unused exports or dependencies).
4. `pnpm --filter mobile test:coverage`: PASS (38 test files, 379 tests passed, all global coverage gates satisfied: Lines >= 85%, Statements >= 85%, Funcs >= 80%, Branches >= 70%).
5. `pnpm --filter mobile test:e2e`: PASS (10 test files, 22 tests passed).
6. Anti-PII & Synthetic Data Check: `python3 scripts/check-privacy-and-pii.py` passed with zero violations.
7. File Length Sensor: All modified source files strictly <= 300 lines (`schema.ts`: 196, `client.ts`: 53, `repository.ts`: 209, `portfolio-calculations.ts`: 295, `portfolio-service.ts`: 257, `holding-adapters.ts`: 102).

---

## 5. Git Commit

Commit `cf309ef9527df36ac58755fedd4d137a684e6fcf` created on branch `fix/mobile-day-change-asset-allocation-xirr-toggle`.
