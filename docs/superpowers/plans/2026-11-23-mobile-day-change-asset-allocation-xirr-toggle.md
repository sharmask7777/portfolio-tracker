# Mobile Day Changes, Asset Allocation, and XIRR/ABS Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix day change rendering (eliminate 0.00%), establish granular asset allocation (eliminate rogue "Gold/Others 96.9%" and surface Large/Mid/Small cap and Arbitrage in mobile Analytics), and implement an accessible XIRR/ABS toggle across mobile Dashboard and Holdings in full parity with Web.

**Architecture:**
- **Data Pipeline & Persistence:** Extend mobile SQLite schema (`holdings` table) and repository with `day_change`, `day_change_pct`, `xirr`, `absolute_return`, and `asset_category`. Extract these server-computed metrics during payload synchronization in `portfolio-calculations.ts` / `portfolio-sync-service.ts` so offline-first holdings have instant parity with backend SSoT.
- **Asset Allocation & Market Cap:** Generalize `normalizeAssetClass` and `buildAssetAllocation` in `portfolio-calculations.ts` and `AssetAllocationCard.tsx` to handle canonical categories (`Equity`, `Debt`, `Arbitrage`, `Gold`, `Cash`, `Other`). In `analytics.tsx`, introduce a dedicated `MarketCapSection` (Large, Mid, Small, Other) and expand `AllocationCardsGrid` to dynamically display all non-zero asset categories including Arbitrage.
- **Performance Mode Toggle:** Add a shared `usePerformanceMode` hook (persisted via `expo-secure-store` or in-memory fallback), create a WCAG-compliant `PerformanceModeToggle` component, and integrate it into `mobile/app/(tabs)/index.tsx`, `mobile/app/(tabs)/holdings.tsx`, `NetWorthCard.tsx`, and `HoldingsFilterControls.tsx`. Wire `performanceMode` into `@portfolio/core-view`'s `useConsolidatedHoldings` for sorting and row metrics.

**Tech Stack:** React Native, Expo, TypeScript strict mode, expo-sqlite, expo-secure-store, `@portfolio/core-view`, Vitest, Playwright.

**Spec:** User prompt requirements:
1. Day changes in mobile app in parity with web (not showing ₹0.00 / 0.00%).
2. Asset allocation in parity with web: granular categories (`Large Cap`, `Mid Cap`, `Small Cap`, `Debt`, `Arbitrage`, `Equity`, `Cash`, `Gold`, `Other`) instead of collapsed `Gold/Others`.
3. XIRR / ABS toggle implemented across screens.
4. Autonomous inner dev loop with snapshot comparisons (`compare-web-mobile-ui.ts` / live emulator screenshots) and multi-specialist review crew before claiming completion.

## Global Constraints

- **The Invariant Oracle Law:** Numerical bounds (Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$) are strictly inviolable.
- **The Zero-Any Rule:** Zero `any` types allowed in TypeScript code (`mobile/src/`, `packages/core-view/`).
- **Maintainability Sensors:** Function lines $\le 50$, cyclomatic complexity $\le 10$, function parameters $\le 4$, file lines $\le 300$.
- **Accessibility:** Touch targets $\ge 44 \times 44\text{pt}$, WCAG 2.1 AA compliant labels and roles.
- **Synthetic Data Mandate:** Absolutely NO real PII or account identifiers. Use synthetic test entities only.
- **Never use `git push --no-verify`.**

## Review Focus

1. **Zero Day-Change Fallback:** When AMFI nav history is absent, holding metrics must fall back to backend-synced `day_change` and `day_change_pct` rather than silently rendering `₹0.00 (0.00%)`.
2. **Asset Allocation Precision:** Categories must sum to 100% ($\Delta \le 0.1\%$) and never misclassify equity schemes into "Gold/Others".
3. **Market Cap Breakdown Parity:** Analytics must present Large Cap, Mid Cap, and Small Cap breakdowns from `xrayData.marketCap` when look-through data is present.
4. **Performance Toggle State Consistency:** Toggling between XIRR and ABS must dynamically update the return labels, values, and sorting order across Dashboard NetWorthCard, SchemeMasterRows, and FolioChildRows.
5. **Offline & Startup Resilience:** Cold start from SQLite without network must immediately display persisted day changes, market cap, and performance values without flashing NaN or ₹0.00.

---

### Task 1: SQLite Schema, Repository & Data Sync Pipeline for Day Change and Returns

**Files:**
- Modify: `mobile/src/db/schema.ts`
- Modify: `mobile/src/db/client.ts`
- Modify: `mobile/src/db/repository.ts`
- Modify: `mobile/src/services/portfolio-calculations.ts`
- Modify: `mobile/src/services/portfolio-service.ts`
- Modify: `mobile/src/components/Holdings/holding-adapters.ts`
- Test: `mobile/src/db/repository.test.ts`
- Test: `mobile/src/services/portfolio-calculations.test.ts`

**Interfaces:**
- Consumes: Server payload `ServerFolioData` with `.metrics.dayChange`, `.metrics.dayChangePercentage`, `.metrics.xirr`, `.metrics.absoluteReturn`, and `.assetCategory`.
- Produces: `HoldingEntity` with `day_change`, `day_change_pct`, `xirr`, `absolute_return`, and `asset_category` persisted and populated in `getEnrichedHoldings()`.

- [ ] **Step 1: Write failing unit tests for schema persistence and mapping**

In `mobile/src/services/portfolio-calculations.test.ts`:
Verify that `mapRawFolioToHolding()` extracts `dayChange`, `dayChangePercentage`, `xirr`, `absoluteReturn`, and `assetCategory` from `ServerFolioData`.
Verify that `summarizeHoldings()` sums non-zero `dayChange` correctly and computes `dayGainPct`.

In `mobile/src/db/repository.test.ts`:
Verify that `upsertHolding()` and `getPortfolioHoldings()` persist and read `day_change`, `day_change_pct`, `xirr`, `absolute_return`, `asset_category`.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter mobile test:unit mobile/src/services/portfolio-calculations.test.ts mobile/src/db/repository.test.ts`
Expected: FAIL due to missing properties on `HoldingEntity`.

- [ ] **Step 3: Update `schema.ts`, `client.ts`, and `repository.ts`**

Add `day_change`, `day_change_pct`, `xirr`, `absolute_return`, and `asset_category` to `HoldingEntity` interface and `CREATE_HOLDINGS_TABLE` DDL.
In `client.ts`, add migration alters in `initDatabase` for backward compatibility on existing databases:
```sql
ALTER TABLE holdings ADD COLUMN day_change REAL DEFAULT 0;
ALTER TABLE holdings ADD COLUMN day_change_pct REAL DEFAULT 0;
ALTER TABLE holdings ADD COLUMN xirr REAL DEFAULT 0;
ALTER TABLE holdings ADD COLUMN absolute_return REAL DEFAULT 0;
ALTER TABLE holdings ADD COLUMN asset_category TEXT;
```
(wrapped in try-catch so duplicate column errors are safely ignored).
In `repository.ts`, bind the 5 new columns in `upsertHolding()`.

- [ ] **Step 4: Update `portfolio-calculations.ts`, `portfolio-service.ts`, and `holding-adapters.ts`**

In `portfolio-calculations.ts`:
- Extend `ServerFolioData` interface with `assetCategory?: string; metrics?: { dayChange?: number; dayChangePercentage?: number; xirr?: number; absoluteReturn?: number; ... }`.
- Update `mapRawFolioToHolding()` to store `f.metrics?.dayChange ?? 0`, `f.metrics?.dayChangePercentage ?? 0`, `f.metrics?.xirr ?? 0`, `f.metrics?.absoluteReturn ?? 0`, `f.assetCategory ?? meta.assetClass`.

In `portfolio-service.ts`:
- In `getEnrichedHoldings()`: check `h.day_change` and `h.day_change_pct`. If present and non-zero (or when backend provided it), use them directly; only fall back to `calculateHoldingDayChange(targetDb, h)` when both are 0.

In `holding-adapters.ts`:
- In `adaptHoldingToFolioInput()`: pass `xirr: holding.xirr ?? undefined`, `absoluteReturn: holding.absolute_return ?? (holding.gainLossPct !== undefined ? holding.gainLossPct / 100 : undefined)`, `dayChange: holding.dayChange`, `dayChangePercentage: holding.dayChangePct`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter mobile test:unit mobile/src/services/portfolio-calculations.test.ts mobile/src/db/repository.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/db/schema.ts mobile/src/db/client.ts mobile/src/db/repository.ts mobile/src/services/portfolio-calculations.ts mobile/src/services/portfolio-service.ts mobile/src/components/Holdings/holding-adapters.ts mobile/src/services/portfolio-calculations.test.ts mobile/src/db/repository.test.ts
git commit -m "fix(mobile): persist and map day change, returns, and asset category"
```

---

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

### Task 3: Performance Mode (XIRR / ABS) Toggle Implementation

**Files:**
- Create: `mobile/src/services/settings-service.ts`
- Create: `mobile/src/components/Common/PerformanceModeToggle.tsx`
- Modify: `mobile/src/components/NetWorthCard.tsx`
- Modify: `mobile/src/components/Holdings/holdings-controls.tsx`
- Modify: `mobile/app/(tabs)/use-holdings-screen.ts`
- Modify: `mobile/app/(tabs)/holdings.tsx`
- Modify: `mobile/app/(tabs)/index.tsx`
- Test: `mobile/src/services/settings-service.test.ts`
- Test: `mobile/src/components/Common/PerformanceModeToggle.test.tsx`

**Interfaces:**
- Consumes: `@portfolio/core-view` `PerformanceMode` ('XIRR' | 'ABS').
- Produces: `usePerformanceMode()` hook, `PerformanceModeToggle` component, and integration into Dashboard and Holdings.

- [ ] **Step 1: Write failing unit test for `settings-service` and `PerformanceModeToggle`**

Create `mobile/src/services/settings-service.test.ts`:
- Test getting and setting `performanceMode` with SecureStore persistence and default `'XIRR'`.

Create `mobile/src/components/Common/PerformanceModeToggle.test.tsx`:
- Test rendering buttons for 'XIRR' and 'ABS'.
- Test triggering `onToggle` callback when pressing the non-active option.
- Test accessibility role "button" and min touch target.

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm --filter mobile test:unit mobile/src/services/settings-service.test.ts mobile/src/components/Common/PerformanceModeToggle.test.tsx`
Expected: FAIL (files do not exist).

- [ ] **Step 3: Implement `settings-service.ts` and `PerformanceModeToggle.tsx`**

In `mobile/src/services/settings-service.ts`:
- Implement `getStoredPerformanceMode()` and `setStoredPerformanceMode(mode: PerformanceMode)` using `expo-secure-store` with in-memory fallback.
- Implement React hook `usePerformanceMode()` returning `[mode, setMode]`.

In `mobile/src/components/Common/PerformanceModeToggle.tsx`:
- Render segmented control with `[ XIRR | ABS ]`.
- Style active button with `#2563eb` background, inactive with `#18181b` and `#27272a` border.
- Ensure $\ge 44 \times 44\text{pt}$ touch target and `accessibilityRole="button"`.
- Set `testID="performance-mode-toggle"`, `testID="toggle-mode-xirr"`, `testID="toggle-mode-abs"`.

- [ ] **Step 4: Integrate toggle into `NetWorthCard`, `HoldingsFilterControls`, and screens**

In `mobile/src/components/NetWorthCard.tsx`:
- Accept optional `performanceMode?: PerformanceMode`, `overallXirr?: number`, and `onTogglePerformanceMode?: (mode: PerformanceMode) => void`.
- When `performanceMode` is supplied, display `PerformanceModeToggle` in the top right of the card or alongside Total Net Worth, and render the return metric formatted as XIRR vs ABS.

In `mobile/src/components/Holdings/holdings-controls.tsx`:
- Add `performanceMode: PerformanceMode` and `onTogglePerformanceMode: (mode: PerformanceMode) => void` to `HoldingsFilterControlsProps`.
- Render `PerformanceModeToggle` next to sort chips.

In `mobile/app/(tabs)/use-holdings-screen.ts`:
- Add `performanceMode` state to `useHoldingsFilters` and pass it to `useConsolidatedHoldings({ ..., performanceMode })`.

In `mobile/app/(tabs)/holdings.tsx`:
- Pass `performanceMode` to `HoldingsFilterControls` and `SchemeGroupCard`.

In `mobile/app/(tabs)/index.tsx`:
- Connect `usePerformanceMode()` and pass to `NetWorthCard`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter mobile test:unit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile/src/services/settings-service.ts mobile/src/components/Common/PerformanceModeToggle.tsx mobile/src/components/NetWorthCard.tsx mobile/src/components/Holdings/holdings-controls.tsx mobile/app/(tabs)/use-holdings-screen.ts mobile/app/(tabs)/holdings.tsx mobile/app/(tabs)/index.tsx mobile/src/services/settings-service.test.ts mobile/src/components/Common/PerformanceModeToggle.test.tsx
git commit -m "feat(mobile): add XIRR/ABS performance mode toggle across dashboard and holdings"
```

---

### Task 4: Autonomous Inner Dev Loop, Multimodal Screenshot Verification & Review Crew

**Files:**
- Modify: `scripts/compare-web-mobile-ui.ts`
- Modify: `screenshots/visual-parity-report.md`
- Test: Playwright E2E and Maestro E2E flows

**Interfaces:**
- Consumes: Running Docker container (`http://localhost:8082`) and running Android emulator (`emulator-5554`).
- Produces: Multimodal screenshots of Dashboard, Holdings, and Analytics, and verification report in `screenshots/visual-parity-report.md`.

- [ ] **Step 1: Rebuild and deploy updated mobile APK to Android emulator**

Run: `export PATH="$HOME/Library/Android/sdk/platform-tools:$PATH" && (cd mobile && ./scripts/emulate-android.sh)`
Expected: APK builds and installs cleanly on `emulator-5554`.

- [ ] **Step 2: Trigger portfolio sync on device to pull fresh server data with day changes and returns**

Send touch inputs or reload the app so `refreshPortfolio()` executes `syncWithServer()`, populating SQLite with day change, XIRR, and asset categories.

- [ ] **Step 3: Capture live screenshots of Dashboard, Holdings, and Analytics on emulator**

Capture:
- `adb exec-out screencap -p > .gemini/antigravity/brain/<conv-id>/screenshots/emulator-dash-fixed.png`
- Scroll down and capture asset allocation: `adb exec-out screencap -p > .gemini/antigravity/brain/<conv-id>/screenshots/emulator-dash-allocation-fixed.png`
- Switch to Holdings tab: `adb shell input tap 324 2315` and capture: `adb exec-out screencap -p > .gemini/antigravity/brain/<conv-id>/screenshots/emulator-holdings-fixed.png`
- Toggle ABS mode: `adb shell input tap ...` and capture toggled view.
- Switch to Analytics tab: `adb shell input tap 540 2315` and capture: `adb exec-out screencap -p > .gemini/antigravity/brain/<conv-id>/screenshots/emulator-analytics-fixed.png`

- [ ] **Step 4: Execute Multimodal Visual Inspection**

Inspect captured screenshots to verify:
1. Day change displays non-zero live values (`+₹6,236.69 (+0.55%)` on Dashboard, positive/negative live values on scheme cards).
2. Asset allocation displays granular categories without rogue `Gold/Others 96.9%`.
3. Analytics tab renders Market Cap breakdown (Large, Mid, Small) and Arbitrage.
4. XIRR/ABS toggle is clearly visible, operable, and toggles return representations.

- [ ] **Step 5: Run full hermetic verification sequence**

Run:
- `pnpm --filter mobile build:verify`
- `pnpm --filter mobile test:unit`
- `pnpm parity:check`
- `pnpm parity:visual`
- `scripts/check-privacy-and-pii.py`

- [ ] **Step 6: Dispatch Multi-Specialist Review Crew**

Dispatch specialized review subagents:
- CX & Frontend Specialist (`cx-frontend-auditor`)
- Quantitative Finance & Visual Invariant Specialist (`finance-visual-auditor`)
- Architecture & Code Quality Auditor (`code-quality-auditor`)
- Mobile & Offline Invariant Auditor (`mobile-offline-auditor`)

- [ ] **Step 7: Commit verification reports and changes**

```bash
git add screenshots/ scripts/
git commit -m "chore(parity): visual verification and cross-platform parity report"
```
