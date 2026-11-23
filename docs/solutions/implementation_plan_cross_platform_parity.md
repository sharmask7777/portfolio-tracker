# Implementation Plan: Cross-Platform Parity, Static Guardrails & Visual Invariants

## Phase 1: Pipeline & Parity Gate Hardening (Immediate P0)
- Task 1.1: Synchronize `.husky/pre-push` with mobile verify (`pnpm --filter mobile build:verify`), mobile e2e (`pnpm --filter mobile test:e2e`), and parity gates (`pnpm parity:check`, `pnpm parity:visual`).
- Task 1.2: Synchronize `backend-rs/scripts/verify.sh` with contract drift check (`cargo test --package portfolio-api --test export_bindings && git diff --exit-code frontend/src/types/generated mobile/src/types/generated`).
- Task 1.3: Update `scripts/verify-web-mobile-parity.ts`:
  - Fix `cas-upload` domain to point to `App.tsx` / `CasUploadModal.tsx`.
  - Add missing domains to `CORE_DOMAIN_SPECS`: `authentication`, `transactions`, `closed-positions`, `tax-export`, `expense-ter`, `manual-assets`.
  - Add `insights.tsx` to `verifyScopeSelectorMounting`.
- Task 1.4: Add `--max-warnings=0` to `frontend/package.json` and `mobile/package.json` lint commands.

## Phase 2: Static Guardrail Unification & App.tsx Refactoring (P0)
- Task 2.1: Enforce Zero-Any on Web:
  - Update `frontend/eslint.config.js`: set `@typescript-eslint/no-explicit-any: 'error'`, `@typescript-eslint/no-unused-vars: 'error'`.
  - Update Fowler sensors in `frontend/eslint.config.js`: align with mobile or strict caps (`complexity: ['error', 10]`, `max-lines: ['error', 300]`, `max-lines-per-function: ['error', 50]`, `max-params: ['error', 3]`).
- Task 2.2: Refactor `frontend/src/App.tsx`:
  - Replace all 20 `any` types with generated Rust contracts (`HoldingsSummaryResponse`, `TaxViewResponse`, etc.).
  - Decompose `Dashboard` component into focused sub-components (`HoldingsTableSection.tsx`, `DashboardHeaderBar.tsx`, `ProfileManagementModal.tsx`, `TransactionHistoryModal.tsx`, `CasUploadModal.tsx`) satisfying max lines & function lines caps.
- Task 2.3: Clean up mobile types and shadow duplicates:
  - In `mobile/src/services/tax-types.ts`, replace duplicate shadow interfaces with imports from generated Rust contracts (`SimulationSellRequest`, `AdvanceTaxQuarter`, `HarvestOpportunityDto`).
  - Move handcrafted `FolioView.ts` and `index.ts` out of `types/generated/` to `types/views/` and update imports.
- Task 2.4: Clean up Knip suppressions:
  - Remove ignore entry for `FamilyManager.tsx` in `frontend/knip.json`, integrating or removing dead code.
  - Add `mobile/src/env.ts` schema validation using `@t3-oss/env-core` and `zod`.

## Phase 3: Quantitative Financial Calculation Parity (P1)
- Task 3.1: Mobile FIFO lot preservation:
  - In `mobile/app/(tabs)/tax.tsx`, eliminate hardcoded `'2023-04-01'` buy dates in `mapHoldingsToHarvestInputs`. Use actual purchase dates/lots from backend sync or SQLite holdings.
- Task 3.2: Debt LTCG mapping:
  - In `mobile/src/services/tax-summary-mapper.ts`, map `'112 Debt (12.5%)'` and `'112 Debt (20% Indexed)'` in `extractSectionTotals`. Populate `totalDebtLTCG`, `debtLtcg20Gain`, `debtLtcg12_5Gain`, `debtTotalTax`, and include in `grandTotalTax`.
- Task 3.3: Section 70 loss clamping fix:
  - In `mobile/src/services/tax-calculations.ts`, remove `Math.max(0, ltcg10)` and apply statutory Section 70 loss set-offs before exemptions.
- Task 3.4: Reality Check waterfall alignment:
  - Align `mobile/src/services/reality-check-service.ts` and `RealityCheckBanner.tsx` to 6 stages driven by `DragDecompositionDto` from backend sync instead of flat 15% tax model.
- Task 3.5: ELSS calendar-year expiry:
  - Replace `days < 1095` in `mobile/src/services/tax-calculations.ts` with calendar-year date math matching backend `elss_lock_in_expiry`.

## Phase 4: Core Mobile Feature Parity Implementation (P1)
- Task 4.1: Transaction Ledger Sheet:
  - Make `FolioChildRow.tsx` interactive (`TouchableOpacity`), opening `TransactionLedgerSheet.tsx` (or modal) displaying chronological transactions matching Web's `TransactionSidePanel.tsx`.
- Task 4.2: Closed Positions Drawer:
  - Add `ClosedPositionsDrawer` to `mobile/app/(tabs)/holdings.tsx` isolating zero-unit funds with fully redeemed badges and deletion actions.
- Task 4.3: Schedule CG CSV Export:
  - Implement `exportScheduleCgCsv` in mobile using `expo-file-system` and `expo-sharing`.
- Task 4.4: Manual Asset Onboarding:
  - Create `mobile/src/components/Holdings/AddAssetModal.tsx` to onboard SGBs, Gold, Real Estate, and EPF.
- Task 4.5: Expense Ratio Analysis:
  - Create `ExpenseAnalysisCard.tsx` on Mobile Analytics tab displaying fund TER and fee drag.

## Phase 5: Visual Invariants & Multi-Platform Verification (P2)
- Task 5.1: Expand `scripts/compare-web-mobile-ui.ts` to 14 screenshot pairs and concrete DOM/visual checks.
- Task 5.2: Fix Denominator Clarity in Mobile Analytics:
  - In `mobile/src/components/Analytics/StockDetailModal.tsx`, render `weightOfPortfolio = absoluteValue / totalPortfolioValue` labeled as `% of Portfolio` rather than `% of Equity`.
  - Add `% of Sector` or `% of Portfolio` explicit labels to treemap tiles in `SvgTreemap.tsx` and `TreemapSvgCanvas.tsx`.
- Task 5.3: Render Hedging Stripes on Mobile:
  - In `SvgTreemap.tsx`, check `node.isHedged` and render striped pattern overlay matching Web.
- Task 5.4: Touch targets & keyboard avoiding view:
  - Ensure minimum 44pt touch targets on sort chips, scope chips, expand chevrons.
  - Wrap mobile modals (`AddMemberModal.tsx`, `AddGoalModal.tsx`, `SimulationModal.tsx`, `ManualPairForm.tsx`) in `KeyboardAvoidingView`.
  - Standardize screen top padding to 16px below `ScopeSelectorHeader` and use `insets.top` on screens without header.
- Task 5.5: Port 10 Canonical Mock Portfolios to Mobile:
  - Implement `mobile/tests/mock-portfolios.test.ts` executing the 10 scenarios against mobile SQLite repositories and services.
