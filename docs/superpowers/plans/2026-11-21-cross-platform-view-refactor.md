# Cross-Platform View Architecture & Display-Ready API Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish true cross-platform parity and shared core view implementation between Web and Mobile by (1) elevating the backend API to return display-ready PAN and consolidated breakdowns directly, (2) creating a shared view-logic workspace package (`packages/core-view`), (3) retiring the disconnected "Family" view tab into a top-level global PAN/Member scope selector that controls all views uniformly across Web and Mobile, and (4) refactoring Mobile Holdings and Dashboard to render multi-folio/PAN expandable breakdowns identical to the Web experience.

**Architecture:** 
1. **Display-Ready API**: Enhance `GET /api/portfolio/summary` and related endpoints in `backend-rs` to include a first-class `pan_breakdowns: Vec<PanBreakdownDto>` with pre-computed values, invested cost, day gain, XIRR, and scheme allocations per PAN, plus pre-grouped `consolidated_schemes` so clients do not reimplement consolidation heuristics independently.
2. **Shared View Package (`packages/core-view`)**: Establish a shared TypeScript package in the pnpm workspace (`packages/core-view`) holding framework-agnostic presentation models, formatting, sorting, filtering, and cross-platform state hooks (`usePortfolioScope`, `useConsolidatedHoldings`, `usePanBreakdown`). Both `frontend/` and `mobile/` consume this shared package directly.
3. **Unified Global Scope (Consolidated vs. Individual PAN)**: Eliminate the isolated "Family Tab" paradigm in mobile. Replace it with a persistent, top-level `ScopeSelector` (header bar on mobile, action bar on web) that sets the active PAN/Profile across Dashboard, Holdings, Analytics, and Tax tabs.
4. **Expandable Multi-Folio/PAN Holdings on Mobile**: Refactor mobile Holdings to support scheme-level consolidation with nested expandable folio/PAN child rows, matching Web's `isMultiFolio` expandable table UX.

**Tech Stack:** Rust (Axum, portfolio-api, portfolio-core), TypeScript, React 19, React Native / Expo, TanStack Query, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-21-cross-platform-view-refactor.md`

## Global Constraints
- Strictly Zero-Any: No `any` types in any TypeScript code (`frontend/`, `mobile/`, `packages/core-view/`).
- Invariant Oracle Law: Numerical bounds ($\Delta \le ₹0.01$, XIRR $\Delta \le 10^{-6}$) and golden tax vectors are inviolable.
- Fowler Maintainability Sensors: Cyclomatic complexity $\le 10$, max function lines $\le 50$, parameters $\le 3$, file lines $\le 300$.
- Privacy Mandate: Synthetic test data only; zero real PII or non-synthetic PANs.
- Parity Gate & Static Architectural Guardrails:
  - `scripts/verify-web-mobile-parity.ts` is enforced in `pnpm parity:check`, `scripts/pre-merge-check.sh`, and `.husky/pre-push`.
  - Static AST and boundary rules forbid `frontend/` and `mobile/` from implementing divergent custom consolidation, formatting, or scope reduction logic: any presentation and calculation logic MUST be imported from `@portfolio/core-view`.
  - Static AST guardrail asserts 100% of core views consume the shared `usePortfolioScope` and `useConsolidatedHoldings` contracts. Any new view failing to bind to the shared scope fails `pnpm parity:check` at build time.

## Review Focus
1. Switching between Consolidated and an individual PAN correctly filters all portfolio tabs (Dashboard, Holdings, Tax, Analytics) without page reload or stale cache.
2. In Consolidated view, multi-folio schemes display member PAN badges and expand into nested folio rows on both Web and Mobile.
3. In individual PAN view, only folios belonging to that specific PAN are displayed, and PAN badges on single folios are cleanly hidden or contextualized.
4. Offline mobile fallback uses SQLite and local storage while preserving identical grouping and PAN breakdown contracts when disconnected from backend-rs.
5. Deleting or renaming a profile from the ScopeSelector propagates instantaneously to all tabs without breaking active tab state.

---

### Task 1: Display-Ready API Contracts in `backend-rs`

**Files:**
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Modify: `backend-rs/crates/portfolio-core/src/performance/mod.rs`
- Test: `backend-rs/crates/portfolio-api/tests/contract_tests.rs`
- Generated Types: `frontend/src/types/generated/` and `mobile/src/types/generated/`

- [ ] **Step 1: Define `PanBreakdownDto` and `DisplayReadySchemeGroupDto` in `portfolio-api`**
  Add `PanBreakdownDto` containing `pan: String`, `member_name: String`, `invested_amount: Decimal`, `current_value: Decimal`, `day_change: Decimal`, `xirr: Decimal`, and `folio_count: usize`. Add `pan_breakdowns: Vec<PanBreakdownDto>` and `consolidated_schemes: Vec<ConsolidatedSchemeDto>` to `ConsolidatedSummaryResponse`.

- [ ] **Step 2: Implement aggregation logic in `get_portfolio_summary`**
  Group active folios by PAN and compute per-PAN totals, weights, and return metrics directly in the backend handler.

- [ ] **Step 3: Export generated TypeScript bindings**
  Run `cargo test --package portfolio-api --test export_bindings` and verify `git diff --exit-code frontend/src/types/generated`. Sync bindings to `mobile/src/types/generated/`.

- [ ] **Step 4: Write backend integration tests for display-ready response**
  Add test cases in `contract_tests.rs` asserting `pan_breakdowns` has correct multi-PAN values on consolidated queries and single-PAN on member queries.

- [ ] **Step 5: Run backend verification**
  Run `(cd backend-rs && ./scripts/verify.sh)` and commit changes.

---

### Task 2: Create Shared View Logic Workspace Package (`packages/core-view`)

**Files:**
- Create: `packages/core-view/package.json`
- Create: `packages/core-view/tsconfig.json`
- Create: `packages/core-view/src/index.ts`
- Create: `packages/core-view/src/scope/usePortfolioScope.ts`
- Create: `packages/core-view/src/holdings/useConsolidatedHoldings.ts`
- Create: `packages/core-view/src/formatters/currency.ts`
- Create: `packages/core-view/src/formatters/returns.ts`
- Modify: `pnpm-workspace.yaml`
- Test: `packages/core-view/src/**/*.test.ts`

- [ ] **Step 1: Scaffold `packages/core-view` package in pnpm workspace**
  Configure `packages/core-view` with TypeScript, Vitest, and export common formatting and consolidation models. Add `'packages/*'` to `pnpm-workspace.yaml`.

- [ ] **Step 2: Extract shared presentation logic from `frontend` and `mobile` into `core-view`**
  Move `consolidateFoliosIntoSchemes`, return sanitization, and currency/percent formatting into `packages/core-view`. Ensure zero React Native or DOM dependencies.

- [ ] **Step 3: Implement `usePortfolioScope` state management**
  Provide shared state hook and controller for active scope (`consolidated` vs `profileId`/`pan`), including persistent storage adapter (localStorage on Web, SecureStore/AsyncStorage on Mobile).

- [ ] **Step 4: Implement `useConsolidatedHoldings` hook**
  Provide shared filtering, search, sorting, and multi-folio expansion tracking logic.

- [ ] **Step 5: Add comprehensive unit tests in `packages/core-view`**
  Write tests covering scope switching, multi-PAN aggregation, and consolidation invariants.

- [ ] **Step 6: Verify build and linking**
  Run `pnpm --filter @portfolio/core-view test && pnpm --filter @portfolio/core-view typecheck`. Commit changes.

---

### Task 3: Refactor Web Frontend to Consume `core-view` and Shared Scope

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Family/FamilySelector.tsx`
- Test: `frontend/src/App.test.tsx`
- Test: `frontend/tests/mock-portfolios.spec.ts`

- [ ] **Step 1: Link `@portfolio/core-view` in `frontend/package.json`**
  Add `"@portfolio/core-view": "workspace:*"` and run `pnpm install`.

- [ ] **Step 2: Refactor `App.tsx` to use shared `usePortfolioScope` and `useConsolidatedHoldings`**
  Replace duplicate consolidation and formatting logic with shared functions from `@portfolio/core-view`.

- [ ] **Step 3: Enhance `FamilySelector` into a persistent `ScopeSelector`**
  Display PAN badges directly alongside member names and show a breakdown pill with member portfolio share % derived from `pan_breakdowns`.

- [ ] **Step 4: Verify Web test suite**
  Run `pnpm --filter frontend build && pnpm --filter frontend test:unit`. Run Playwright E2E specs to ensure zero regression. Commit changes.

---

### Task 4: Retire Mobile Family Tab into a Global Top-Level `ScopeSelector`

**Files:**
- Create: `mobile/src/components/Navigation/ScopeSelectorHeader.tsx`
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Delete/Retire: `mobile/app/(tabs)/family.tsx` (repurpose into Profile Management modal under Settings or ScopeSelector)
- Modify: `mobile/app/(tabs)/index.tsx` (Dashboard)
- Modify: `mobile/app/(tabs)/settings.tsx`
- Test: `mobile/tests/tabs.test.tsx`
- Test: `mobile/src/e2e/family-management.test.tsx`

- [ ] **Step 1: Create `ScopeSelectorHeader` in Mobile**
  Build horizontal pill selector header component displaying "Consolidated" and individual PAN member chips. When tapped, updates the active global scope in SecureStore and notifies all tabs.

- [ ] **Step 2: Update `mobile/app/(tabs)/_layout.tsx`**
  Remove `family` from bottom navigation tabs. Integrate `ScopeSelectorHeader` across the top of the main app views or as a persistent screen header.

- [ ] **Step 3: Move Family Profile CRUD into Settings**
  Add a "Family Members & Profiles" management card in Settings so users can still add, edit, or delete member profiles without cluttering the primary bottom navigation.

- [ ] **Step 4: Update Mobile Dashboard to respect active scope**
  Filter summary metrics, day gains, and asset allocation by the active PAN/Profile from `usePortfolioScope`.

- [ ] **Step 5: Update tests**
  Update `mobile/tests/tabs.test.tsx` and `mobile/src/e2e/family-management.test.tsx` to reflect the global scope header and settings management. Run `pnpm --filter mobile test:unit`. Commit changes.

---

### Task 5: Mobile Expandable Holdings & Multi-PAN Breakdown

**Files:**
- Create: `mobile/src/components/Holdings/SchemeGroupCard.tsx`
- Create: `mobile/src/components/Holdings/FolioChildRow.tsx`
- Modify: `mobile/src/components/HoldingCard.tsx`
- Modify: `mobile/app/(tabs)/holdings.tsx`
- Test: `mobile/tests/holdings-breakdown.test.tsx`
- Test: `mobile/src/e2e/offline-navigation.test.tsx`

- [ ] **Step 1: Create `SchemeGroupCard` and `FolioChildRow` for Mobile**
  Build an expandable card matching the Web experience:
  - Top row: Master scheme name, type badge, total current value, day change.
  - Sub-row: Member PAN tags (e.g. `ALPAC1001A`, `BETAB2002B`) when in Consolidated view.
  - Expand/collapse toggle revealing nested individual folio rows (`FolioChildRow`) with individual units, NAV, PAN, and folio number.

- [ ] **Step 2: Refactor `mobile/app/(tabs)/holdings.tsx`**
  Use `useConsolidatedHoldings` from `@portfolio/core-view` to group holdings by scheme. In Consolidated view, show all member folios; in Individual PAN view, filter to that PAN only.

- [ ] **Step 3: Add unit tests for Holdings breakdown**
  Add `mobile/tests/holdings-breakdown.test.tsx` validating expansion, multi-PAN badge rendering, and filtering.

- [ ] **Step 4: Run verification**
  Run `pnpm --filter mobile build:verify`. Commit changes.

---

### Task 6: Static Parity Gate Update & End-to-End Verification

**Files:**
- Modify: `scripts/verify-web-mobile-parity.ts`
- Modify: `mobile/src/e2e/e2e-runner.test.tsx`

- [ ] **Step 1: Update parity verification script**
  Update domain specifications in `scripts/verify-web-mobile-parity.ts` to reflect the unified `ScopeSelector`, shared `@portfolio/core-view` package, and expandable holdings breakdown.

- [ ] **Step 2: Update master sequential E2E runner**
  Ensure all 11 stages pass against the new shared navigation and scope switching architecture.

- [ ] **Step 3: Run full pre-push & hermetic verification**
  Execute:
  1. `pnpm parity:check`
  2. `pnpm --filter @portfolio/core-view test`
  3. `pnpm --filter frontend build && pnpm --filter frontend test:unit`
  4. `pnpm --filter mobile build:verify`
  5. `python3 scripts/check-privacy-and-pii.py`
  6. Backend `./scripts/verify.sh`

- [ ] **Step 4: Final commit and upsert PR**
  Commit all verified changes and open/update the PR on GitHub.
