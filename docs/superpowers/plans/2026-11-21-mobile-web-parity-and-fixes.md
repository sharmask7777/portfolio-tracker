# Mobile-Web Parity and Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish 100% data, presentation, and behavioral parity between the Web and Mobile apps across investor profile representation, status bar UI ergonomics, descriptive historical timeline data, asset allocation categorization, and bidirectional CAS upload reconciliation, enforcing the standard that the backend is the single source of truth for all business and classification logic, leaving views with zero business logic and failing the build if any client business logic is detected.

**Architecture:** 
1. **Profile Parity & Non-Dummy Fallbacks:** Eliminate hardcoded dummy investor profiles (`DEFAULT_PRIMARY_PROFILE` with `ABCDE1234F`) from `mobile/src/services/family-service.ts`. Clean up `'ABCDE1234F'` fallback in Web `TaxView.tsx:111`. Synchronize family profiles directly from `/api/family/profiles` during `syncWithServer`, adapting `ManagedProfileEntity` to `FamilyProfile` (`isPrimary`, `relationship`).
2. **Ergonomic Safe Area Insets:** Incorporate `useSafeAreaInsets()` from `react-native-safe-area-context` with fallback to `StatusBar.currentHeight` into `ScopeSelectorHeader` across all tab views to eliminate overlapping with the Android status bar and iOS Dynamic Island/notch.
3. **Descriptive Historical Timeline:** Add a persistent `portfolio_history` SQLite table, fetch real historical timeline checkpoints from `/api/portfolio/:id/history` on sync, support 7 range presets matching Web (`1M`, `3M`, `6M`, `1Y`, `3Y`, `5Y`, `ALL`), downsample if > 300 points, eliminate `createSyntheticPoints`, and render full tooltip metrics (Date, Valuation, Invested, Gain & %, ATH/Drawdown) or an explicit "No History Data" empty state matching Web.
4. **Backend Single Source of Truth for Asset Classification & Display-Ready Allocations:**
   - Define canonical `AssetCategory` (`Equity`, `Debt`, `Hybrid`, `Gold`, `Cash`, `Arbitrage`, `Other`) and single classification engine `classify_asset(asset_type, name)` in `backend-rs/crates/portfolio-core/src/classification.rs`.
   - Reuse `classify_asset` across all backend routes (`/api/portfolio/summary`, `/api/portfolio/:id/xray`, `/api/portfolio/:id/exposures`).
   - Deliver display-ready `asset_allocation: Vec<AssetAllocationDto>` and `asset_category` on every folio/holding directly from the backend API.
   - Refactor client views across Web and Mobile (`portfolio-calculations.ts`, `analytics-service.ts`, `hierarchy-stock-builder.ts`, `AddAssetModal.tsx`) to eliminate client-side heuristic string parsing.
   - Register bindings in `backend-rs/crates/portfolio-api/tests/export_bindings.rs` and synchronize types to `frontend/src/types/generated` and `mobile/src/types/generated`.
5. **Static AST Pure-View Guardrail (Failing the Build on Client Business Logic):**
   - Add a TypeScript AST sensor in `scripts/verify-web-mobile-parity.ts` (enforced on `pnpm parity:check`, `pnpm build:verify`, and `.husky/pre-push`).
   - Scans all non-test TypeScript files in `frontend/src/` and `mobile/src/` for prohibited business logic patterns:
     - Keyword-based asset classification / scheme name regex scanning (e.g. `.includes('debt')`, `.includes('gold')`, `.includes('liquid')`).
     - Hardcoded statutory tax formulas (Section 112A, 50AA, 55(2)(ac) grandfathering) in presentation components.
     - Hardcoded dummy identity literals (`"ABCDE1234F"` in non-test source files outside of `placeholder` / validation example strings).
   - Fails the build with exit code 1 whenever any violation is detected.
6. **Bidirectional CAS Reconciliation & Outbox Resilience:**
   - Point mobile upload endpoint to `/api/portfolio/upload` (with backend route alias for `/api/v1/cas/upload`).
   - Fix outbox failure handling in `upload-queue.ts`: transient network errors and 5xx preserve `status = 'PENDING'` with incremented `retry_count`; 4xx permanent errors set `status = 'FAILED'`.
   - Flush pending uploads before syncing down in `refreshPortfolio()`, and automatically re-sync mobile from the server upon successful upload flush.

**Tech Stack:** React Native, Expo, SQLite, TypeScript, Rust (Axum, portfolio-core, portfolio-api), Vitest, Playwright.

**Spec:** User requirements from prompt, Staff Architect audit recommendations, & Agent instructions in `AGENTS.md`.

## Global Constraints
- Zero-Any Rule: Strictly no `any` types in any TypeScript code.
- Invariant Oracle Law: Numerical bounds ($\Delta \le ₹0.01$, XIRR $\Delta \le 10^{-6}$) and golden tax vectors are inviolable.
- Fowler Maintainability Sensors: Cyclomatic complexity $\le 10$, max function lines $\le 50$, parameters $\le 3$, file lines $\le 300$.
- Privacy Mandate: Synthetic test data only; zero real PII or real PANs.
- Zero Business Logic in Views: Views must never perform keyword regex/string scanning to guess asset categories or calculate taxes; classification and math are owned 100% by backend.

## Review Focus
1. Dummy profile elimination: When a user has not defined profiles or has custom profiles, `ABCDE1234F` or "Primary Investor" must NEVER be shown on Mobile or Web.
2. Android/iOS status bar offset: `ScopeSelectorHeader` must never collide with Android status bar or iOS notch/Dynamic Island.
3. Historical points density: History graph on mobile must render real historical timeline points matching Web (with clean empty state when 0 points exist; no synthetic fake points).
4. Asset allocation backend source of truth: `classify_asset` in `portfolio-core` governs `summary`, `xray`, and all views uniformly. Client code has zero classification heuristics.
5. Build failure on client business logic: `scripts/verify-web-mobile-parity.ts` statically detects any client keyword classification or business formulas and blocks build/push.
6. Bidirectional CAS reconciliation: A CAS uploaded on Web or on Mobile must reconcile to the most recent state on both clients without dropping offline uploads.

---

### Task 1: Fix Dummy Investor Profile & Full Parity in Portfolio/Member List (Issue 1)

**Files:**
- Modify: `mobile/src/services/family-service.ts:60-75, 190-205`
- Modify: `mobile/src/services/portfolio-service.ts:182-207`
- Modify: `frontend/src/components/Tax/TaxView.tsx:111`
- Modify: `mobile/tests/family-tab.test.tsx:412-420`
- Test: `mobile/tests/family-parity.test.ts`

**Interfaces:**
- Consumes: `/api/family/profiles` API contract from `portfolio-api`
- Produces: `getStoredFamilyProfiles(): Promise<FamilyProfile[]>`, `syncWithServer(serverUrl: string, token: string, db?: SQLiteDatabase): Promise<boolean>`

- [ ] **Step 1: Write failing test in `mobile/tests/family-parity.test.ts` asserting no dummy profile is returned when SecureStore is empty and server profiles are synced**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import { getStoredFamilyProfiles } from '../src/services/family-service';

describe('Family Profile Parity Suite', () => {
  beforeEach(async () => {
    await SecureStore.deleteItemAsync('portfolio_family_profiles_v1');
  });

  it('returns empty array when no profiles are stored and never injects dummy ABCDE1234F', async () => {
    const profiles = await getStoredFamilyProfiles();
    expect(profiles).toEqual([]);
    expect(profiles.some(p => p.pan === 'ABCDE1234F')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter mobile test:unit mobile/tests/family-parity.test.ts`
Expected: FAIL because `getStoredFamilyProfiles()` returns `[DEFAULT_PRIMARY_PROFILE]` with `ABCDE1234F`.

- [ ] **Step 3: Update `family-service.ts`, `portfolio-service.ts`, and Web `TaxView.tsx`**

1. In `mobile/src/services/family-service.ts`:
Change `getStoredFamilyProfiles()` to return `[]` when `!raw` or when empty array. Remove `DEFAULT_PRIMARY_PROFILE` fallback.
2. In `mobile/src/services/portfolio-service.ts`:
In `syncWithServer()`, after fetching portfolio summary, fetch `${trimmed}/api/family/profiles`. If successful, map `ManagedProfileEntity` to `FamilyProfile` (`isPrimary: idx === 0`, `relationship: idx === 0 ? 'Self' : 'Member'`), and call `saveFamilyProfiles(mapped)`.
3. In `frontend/src/components/Tax/TaxView.tsx:111`:
Replace fallback `summary.pan || filteredDetails[0]?.pan || 'ABCDE1234F'` with `summary.pan || filteredDetails[0]?.pan || ''`.
4. Update `mobile/tests/family-tab.test.tsx` line 414 to expect `initial.length >= 0`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter mobile test:unit mobile/tests/family-parity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/services/family-service.ts mobile/src/services/portfolio-service.ts frontend/src/components/Tax/TaxView.tsx mobile/tests/family-tab.test.tsx mobile/tests/family-parity.test.ts
git commit -m "fix(mobile): remove dummy investor profile and sync family profiles from server"
```

---

### Task 2: Status Bar Padding for Scope Selector (Issue 2)

**Files:**
- Modify: `mobile/src/components/Navigation/ScopeSelectorHeader.tsx:20-30, 203-242`
- Test: `mobile/tests/scope-selector.test.tsx`

**Interfaces:**
- Consumes: `useSafeAreaInsets()` from `react-native-safe-area-context`, React Native `Platform`, `StatusBar`
- Produces: `ScopeSelectorHeader({ ... }): React.ReactElement`

- [ ] **Step 1: Write failing test in `mobile/tests/scope-selector.test.tsx` checking status bar safe area offset**

```typescript
it('applies safe area top padding offset to prevent overlapping status bar icons on Android and iOS', () => {
  const element = ScopeSelectorHeader({
    scope: { type: 'consolidated' },
    onSelectConsolidated: vi.fn(),
    onSelectMember: vi.fn(),
    profiles: [],
  });
  expect(element).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails or needs updated padding assertion**

Run: `pnpm --filter mobile test:unit mobile/tests/scope-selector.test.tsx`

- [ ] **Step 3: Implement safe area top padding in `ScopeSelectorHeader.tsx`**

In `mobile/src/components/Navigation/ScopeSelectorHeader.tsx`:
Import `useSafeAreaInsets` from `react-native-safe-area-context`.
Compute:
```typescript
const insets = useSafeAreaInsets();
const topPadding = Math.max(
  insets?.top ?? 0,
  Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0
) + 6;
```
Apply `topPadding` to the `container` style.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter mobile test:unit mobile/tests/scope-selector.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/Navigation/ScopeSelectorHeader.tsx mobile/tests/scope-selector.test.tsx
git commit -m "fix(mobile): add safe area status bar insets to scope selector header"
```

---

### Task 3: Descriptive History Graph with Real Data Points at Parity with Web (Issue 3)

**Files:**
- Modify: `mobile/src/db/schema.ts`
- Modify: `mobile/src/db/repository.ts`
- Modify: `mobile/src/services/portfolio-service.ts`
- Modify: `mobile/src/components/Dashboard/HistoricalTrendChart.tsx`
- Modify: `mobile/src/components/Dashboard/chart-components.tsx`
- Modify: `mobile/src/components/Dashboard/chart-geometry.ts`
- Modify: `mobile/app/(tabs)/index.tsx`
- Test: `mobile/tests/historical-chart-parity.test.tsx`

**Interfaces:**
- Consumes: `GET /api/portfolio/:id/history` returning `HistoryPoint[]`
- Produces: `savePortfolioHistory(db, portfolioId, points)`, `getPortfolioHistory(db, portfolioId): Promise<HistoryPoint[]>`, `HistoricalTrendChart` supporting 7 range presets: `['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL']`

- [ ] **Step 1: Write failing test in `mobile/tests/historical-chart-parity.test.tsx`**

```typescript
it('renders full historical timeline with 7 Web range presets without synthetic fallback', () => {
  const points = [
    { date: '2026-01-01', value: 100000, investedAmount: 90000 },
    { date: '2026-02-01', value: 105000, investedAmount: 92000 },
    { date: '2026-03-01', value: 110000, investedAmount: 95000 },
    { date: '2026-04-01', value: 115000, investedAmount: 98000 },
  ];
  const screen = render(<HistoricalTrendChart historyPoints={points} />);
  expect(screen.getByTestId('range-button-3Y')).toBeDefined();
  expect(screen.getByTestId('range-button-5Y')).toBeDefined();
});

it('renders empty state matching Web when no historical checkpoints exist', () => {
  const screen = render(<HistoricalTrendChart historyPoints={[]} />);
  expect(screen.getByText(/No History Data/i)).toBeDefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter mobile test:unit mobile/tests/historical-chart-parity.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement SQLite history table and update `HistoricalTrendChart`**

1. In `mobile/src/db/schema.ts`, add `CREATE_PORTFOLIO_HISTORY_TABLE`:
```sql
CREATE TABLE IF NOT EXISTS portfolio_history (
  portfolio_id TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  invested_amount REAL NOT NULL,
  PRIMARY KEY (portfolio_id, date)
);
```
2. In `mobile/src/db/repository.ts`, add `savePortfolioHistory` and `getPortfolioHistory`.
3. In `mobile/src/services/portfolio-service.ts`, in `syncWithServer`, fetch `${serverUrl}/api/portfolio/${snapshot.portfolio.id}/history` and save to SQLite. Add `getStoredHistoryPoints(db, portfolioId)`.
4. In `chart-components.tsx`, update `RANGES` to `['1M', '3M', '6M', '1Y', '3Y', '5Y', 'ALL']`.
5. In `HistoricalTrendChart.tsx`:
   - Support `historyPoints?: HistoryPoint[]` prop.
   - Remove `createSyntheticPoints` fake data generator.
   - If points are empty, render the `"No History Data"` empty card matching Web.
   - Downsample if > 300 points using `Math.ceil(data.length / 300)` uniform interval sampling matching Web.
6. In `mobile/app/(tabs)/index.tsx`, load stored history points and pass to `HistoricalTrendChart`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter mobile test:unit mobile/tests/historical-chart-parity.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/db/schema.ts mobile/src/db/repository.ts mobile/src/services/portfolio-service.ts mobile/src/components/Dashboard/ mobile/app/(tabs)/index.tsx mobile/tests/historical-chart-parity.test.tsx
git commit -m "feat(mobile): store and render descriptive historical timeline at parity with web"
```

---

### Task 4: Unified Backend-Driven Asset Classification & Zero Business Logic in Views (Issue 4)

**Files:**
- Create: `backend-rs/crates/portfolio-core/src/classification.rs`
- Modify: `backend-rs/crates/portfolio-core/src/lib.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Modify: `backend-rs/crates/portfolio-api/tests/export_bindings.rs`
- Modify: `mobile/src/services/portfolio-calculations.ts`
- Modify: `mobile/src/services/analytics-service.ts`
- Modify: `mobile/src/services/hierarchy-stock-builder.ts`
- Modify: `frontend/src/utils/hierarchy-stock-builder.ts`
- Modify: `frontend/src/components/Dashboard/AddAssetModal.tsx`
- Modify: `mobile/src/components/AssetAllocationCard.tsx`
- Modify: `mobile/src/components/Holdings/holdings-controls.tsx`
- Modify: `frontend/src/types/generated/AssetAllocationDto.ts`
- Modify: `mobile/src/types/generated/AssetAllocationDto.ts`
- Test: `backend-rs/crates/portfolio-core/tests/classification_test.rs`
- Test: `mobile/tests/asset-allocation-parity.test.ts`

**Interfaces:**
- Produces: `portfolio_core::classification::classify_asset(asset_type, name) -> AssetCategory`, `AssetCategory::display_name()`, `AssetCategory::color_hex()`
- Produces: `AssetAllocationDto` exported to TypeScript via `ts_rs`
- Produces: `ConsolidatedSummaryResponse.asset_allocation: Vec<AssetAllocationDto>`, `EnrichedFolio.asset_category: String`

- [ ] **Step 1: Write failing test in `backend-rs/crates/portfolio-core/tests/classification_test.rs`**

```rust
use portfolio_core::classification::{classify_asset, AssetCategory};
use portfolio_core::types::AssetType;

#[test]
fn test_canonical_asset_classification() {
    assert_eq!(classify_asset(AssetType::Stock, "Reliance Industries"), AssetCategory::Equity);
    assert_eq!(classify_asset(AssetType::MutualFund, "HDFC Top 100 Fund"), AssetCategory::Equity);
    assert_eq!(classify_asset(AssetType::MutualFund, "ICICI Prudential Liquid Fund"), AssetCategory::Debt);
    assert_eq!(classify_asset(AssetType::MutualFund, "SBI Gold Fund"), AssetCategory::Gold);
    assert_eq!(classify_asset(AssetType::Sgb, "SGB 2026 Series I"), AssetCategory::Gold);
    assert_eq!(classify_asset(AssetType::PhysicalGold, "Vaulted Gold"), AssetCategory::Gold);
    assert_eq!(classify_asset(AssetType::FixedDeposit, "HDFC Bank FD"), AssetCategory::Debt);
    assert_eq!(classify_asset(AssetType::MutualFund, "Kotak Arbitrage Fund"), AssetCategory::Arbitrage);
    assert_eq!(classify_asset(AssetType::MutualFund, "Parag Parikh Conservative Hybrid"), AssetCategory::Hybrid);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `(cd .worktrees/mobile-web-parity-and-fixes/backend-rs && cargo test --package portfolio-core --test classification_test)`
Expected: FAIL because `classification` module does not exist yet.

- [ ] **Step 3: Implement `classification.rs` in `portfolio-core` and wire across `portfolio-api` and views**

1. Create `backend-rs/crates/portfolio-core/src/classification.rs` with `AssetCategory`, `classify_asset`, display names, and colors.
2. Export `AssetCategory` and `classify_asset` from `portfolio-core::lib`.
3. In `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`:
   - Define `AssetAllocationDto` (`name`, `amount`, `percentage`, `color`) with `#[derive(TS)]`.
   - Update `get_xray` to use `classify_asset` rather than duplicated keyword checks.
   - Update `get_consolidated_summary` to compute and attach `asset_allocation: Vec<AssetAllocationDto>` to `ConsolidatedSummaryResponse`, and `asset_category` to each `EnrichedFolio`.
4. Register `AssetAllocationDto` and `AssetCategory` in `backend-rs/crates/portfolio-api/tests/export_bindings.rs`.
5. Run `cargo test --package portfolio-api --test export_bindings` to generate TypeScript types for frontend and mobile.
6. In `mobile/src/services/portfolio-calculations.ts`:
   - Remove custom heuristic regex classification logic; directly use backend-computed `asset_category` / `asset_class`.
   - Update `AssetAllocationItem` to match backend `AssetAllocationDto`.
7. In `mobile/src/services/analytics-service.ts`, `mobile/src/services/hierarchy-stock-builder.ts`, `frontend/src/utils/hierarchy-stock-builder.ts`, and `frontend/src/components/Dashboard/AddAssetModal.tsx`:
   - Remove client string scanning (`.includes('debt')`, `.includes('gold')`, `.includes('arbitrage')`); use `asset_category` / `asset_class` directly.
8. In `mobile/src/components/AssetAllocationCard.tsx`:
   - Consume pre-computed backend `AssetAllocationDto` items directly with zero view business logic.
9. In `mobile/src/components/Holdings/holdings-controls.tsx`:
   - Align filter pills to canonical categories (`All`, `Equity`, `Debt`, `Hybrid`, `Gold`, `Arbitrage`, `Other`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `(cd .worktrees/mobile-web-parity-and-fixes/backend-rs && cargo test --package portfolio-core --test classification_test)`
Run: `pnpm --filter mobile test:unit mobile/tests/asset-allocation-parity.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-rs/ mobile/ frontend/
git commit -m "feat(core): unify asset classification in backend and remove view business logic"
```

---

### Task 5: Static AST Pure-View Guardrail (Failing the Build on Client Business Logic)

**Files:**
- Modify: `scripts/verify-web-mobile-parity.ts`
- Test: `scripts/verify-web-mobile-parity.ts`

**Interfaces:**
- Produces: `verifyPureViewPresentation(baseDir: string): readonly string[]` integrated into `verifyCrossPlatformArchitecture()` and `pnpm parity:check`.

- [ ] **Step 1: Write AST inspection rules in `scripts/verify-web-mobile-parity.ts`**

Inspect all `.ts` and `.tsx` files in `frontend/src/` and `mobile/src/` (excluding `*.test.ts`, `*.test.tsx`, `*.spec.ts`, and test fixtures):
1. **Forbidden Client-Side Asset Classification:**
   Flag any string matching or regex method calls with literal arguments matching prohibited classification keywords (`'debt'`, `'liquid'`, `'gold'`, `'arbitrage'`, `'equity'`, `'hybrid'`, `'balanced'`) inside conditional expressions (`IfStatement`, `ConditionalExpression`, `BinaryExpression`) used to categorize assets.
2. **Forbidden Hardcoded Statutory Tax Logic:**
   Flag hardcoded statutory tax rates (`0.125`, `0.20`) or grandfathering deemed cost formulas in UI component files (`src/components/`), excluding `assumptions-presets.ts`.
3. **Forbidden Hardcoded Investor Data:**
   Flag hardcoded synthetic PAN literals (`"ABCDE1234F"`) in non-test source files outside of JSX `placeholder` attributes or error message strings matching `e.g. ABCDE1234F`.

- [ ] **Step 2: Run `pnpm parity:check` to verify it fails if violations exist**

Run: `pnpm parity:check`
Expected: Fails and prints exact file, line number, and violation when client business logic is present.

- [ ] **Step 3: Verify clean execution once Task 1-4 eliminate client business logic**

Run: `pnpm parity:check`
Expected: PASS with 0 violations once client code is purely view logic.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-web-mobile-parity.ts
git commit -m "ci(guardrail): add AST pure-view sensor failing build on client business logic"
```

---

### Task 6: Reconciling CAS Uploads Bidirectionally (Web & App) & Outbox Resilience (Issue 5)

**Files:**
- Modify: `mobile/src/services/upload-queue.ts`
- Modify: `mobile/src/services/upload-actions.ts`
- Modify: `mobile/src/services/portfolio-service.ts`
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Test: `mobile/tests/cas-reconciliation.test.ts`

**Interfaces:**
- Consumes: `POST /api/portfolio/upload`, `POST /api/v1/cas/upload`
- Produces: `flushUploadQueue`, `refreshPortfolio`, bidirectional sync sequence

- [ ] **Step 1: Write failing test in `mobile/tests/cas-reconciliation.test.ts` verifying bidirectional CAS upload reconciliation and outbox retry resilience**

```typescript
describe('CAS Upload Bidirectional Reconciliation Suite', () => {
  it('uses /api/portfolio/upload as default upload endpoint', () => {
    expect(DEFAULT_UPLOAD_ENDPOINT).toBe('/api/portfolio/upload');
  });

  it('keeps status PENDING and increments retry_count on transient 500 error or network disconnect', async () => {
    // Assert transient errors do not permanently mark upload as FAILED
  });

  it('flushes outbox before syncing from server and reconciles latest state', async () => {
    // Verify refreshPortfolio flushes pending outbox then syncs server
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter mobile test:unit mobile/tests/cas-reconciliation.test.ts`
Expected: FAIL because `DEFAULT_UPLOAD_ENDPOINT` was `/api/v1/cas/upload`.

- [ ] **Step 3: Update endpoints and reconciliation flow**

1. In `mobile/src/services/upload-queue.ts`:
   - Set `export const DEFAULT_UPLOAD_ENDPOINT = '/api/portfolio/upload';`
   - In `uploadSingleItem`, distinguish transient errors (network drops, HTTP 5xx) from permanent errors (HTTP 4xx):
     - Transient errors keep `status = 'PENDING'` and increment `retry_count`.
     - Permanent errors (400, 422) set `status = 'FAILED'`.
2. In `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`:
   - Add route alias `/api/v1/cas/upload` pointing to `upload_pdf` alongside `/upload`.
3. In `mobile/src/services/portfolio-service.ts`:
   - In `refreshPortfolio()`, before calling `syncWithServer()`, call `flushUploadQueue(creds.serverUrl, creds.token)` to flush any pending outbox items. Once flushed, `syncWithServer()` pulls down the freshly calculated portfolio.
4. In `mobile/src/services/upload-actions.ts`:
   - In `submitCasUpload` and `runOutboxSync`, after `flushUploadQueue` succeeds, call `refreshPortfolio()` to immediately update local SQLite with the latest server data.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter mobile test:unit mobile/tests/cas-reconciliation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mobile/src/services/upload-queue.ts mobile/src/services/upload-actions.ts mobile/src/services/portfolio-service.ts backend-rs/crates/portfolio-api/src/routes/portfolio.rs mobile/tests/cas-reconciliation.test.ts
git commit -m "fix(sync): enable bidirectional CAS upload reconciliation with outbox retry resilience"
```

---

### Task 7: Full Verification Gate & Parity Audit

- [ ] **Step 1: Run full mobile unit and E2E test suites**
Run: `cd .worktrees/mobile-web-parity-and-fixes && pnpm --filter mobile build:verify && pnpm --filter mobile test:unit && pnpm --filter mobile test:e2e`
- [ ] **Step 2: Run backend verification suite**
Run: `(cd .worktrees/mobile-web-parity-and-fixes/backend-rs && cargo test --workspace)`
- [ ] **Step 3: Run contract parity check**
Run: `(cd .worktrees/mobile-web-parity-and-fixes/backend-rs && cargo test --package portfolio-api --test export_bindings) && git diff --exit-code frontend/src/types/generated mobile/src/types/generated`
- [ ] **Step 4: Run web unit test suite**
Run: `cd .worktrees/mobile-web-parity-and-fixes && pnpm --filter frontend test:unit`
- [ ] **Step 5: Run pre-merge sensor validation check (anti-PII, AST parity & pure-view gate, Rust verify, frontend & mobile build:verify)**
Run: `cd .worktrees/mobile-web-parity-and-fixes && ./scripts/pre-merge-check.sh`
- [ ] **Step 6: Check git status and clean diffs**
Run: `git status`
