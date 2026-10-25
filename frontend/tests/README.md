# Frontend Test Architecture & Domain Catalog

This directory contains the Playwright End-to-End (E2E) test suites and documentation for Portfolio Tracker's frontend verification, alongside the Vitest component and utility unit suites.

---

## 1. Architecture & Testing Principles

### 1.1 Four-Domain E2E Taxonomy
All Playwright E2E suites are organized across four financial and platform domains:
1. **Core Portfolio Operations:** Import flows, multi-folio consolidation, zero-holding isolation, stock look-through, and folio lifecycle management.
2. **Tax & Statutory Compliance:** Section 112A grandfathering, Schedule CG ITR export, Table F advance tax quarterly matrix, and tax simulation.
3. **Analytics & Reporting:** Marginal tax slab reactivity, tax loss/gain harvesting flows, and historical metric safeguards.
4. **Platform & UX Safeguards:** Smoke tests, unhandled exception interceptors, WCAG color contrast, mobile responsiveness, and session security.

### 1.2 Mandatory Data Anonymization (Zero Real Data Commitment)
- **Strict Privacy Guardrail:** Under no circumstances may real PANs, real investor names, real phone numbers, real emails, or real CAS statement files (`*.cas.json`, `parsed_cas.json`) be committed, mocked, or logged.
- All tests must use synthetic, fictitious investor identities (e.g., `Aarav Sharma`, `Neha Patel`, synthetic PAN `ABCDE1234F`).

### 1.3 Page Object Model (POM) Design
Common user interactions are encapsulated in Page Object Models located under [`pom/`](./pom):
- [`DashboardPage.ts`](./pom/DashboardPage.ts): Central holdings table, stats grid, profile switcher, and closed positions drawer.
- [`TaxPage.ts`](./pom/TaxPage.ts): Tax optimization tab, Schedule CG export trigger, and harvesting opportunity cards.
- [`UploadModal.ts`](./pom/UploadModal.ts): CAS upload modal, password input, and file attachment handling.

---

## 2. Playwright E2E Domain Catalog

### 2.1 Core Portfolio Operations

| Spec File | Scope & Invariants Tested |
| :--- | :--- |
| [`cas-upload.spec.ts`](./cas-upload.spec.ts) | CAS PDF upload flow, asynchronous job status polling (`/api/portfolio/upload-status/*`), error toast handling on 500 responses, and initial portfolio metrics rendering. |
| [`mock-portfolios.spec.ts`](./mock-portfolios.spec.ts) | Comprehensive validation of the 10 canonical synthetic portfolios in UI: multi-member aggregation, profile switching persistence via `localStorage`, zero-holdings drawer isolation, and profile deletion integrity. |
| [`consolidation-and-zero-holdings.spec.ts`](./consolidation-and-zero-holdings.spec.ts) | Scheme consolidation of multiple folios for the same fund (e.g., Parag Parikh Flexi Cap) into a single master row with folio badge, isolation of zero-balance funds in Closed Positions drawer, absence of manual close button, and closed folio deletion. |
| [`stock-intersection.spec.ts`](./stock-intersection.spec.ts) | Underlying company look-through, multi-fund stock overlap matrix, search filtering, column sorting, and top stock exposure overview widgets without NaN. |
| [`holdings-management.spec.ts`](./holdings-management.spec.ts) | Interactive portfolio history visualization with multi-horizon range controls (`1M`, `3M`, `6M`, `1Y`, `3Y`, `5Y`, `ALL`), All-Time High (ATH) corpus, maximum invested capital, and NaN-free yearly breakdown tables. *(Formerly `milestone-v4.spec.ts`)* |
| [`family-view.spec.ts`](./family-view.spec.ts) | Multi-member family profile splitting from multi-PAN statements, symmetric post-tax metric cards, and profile renaming workflows. |
| [`transaction-side-panel.spec.ts`](./transaction-side-panel.spec.ts) | Master table row click interaction, slide-out transaction drawer, chronological sorting, and buy/sell transaction ledger details. |
| [`e2e-integration.spec.ts`](./e2e-integration.spec.ts) | Live integration test verifying non-mocked PDF file handoff from backend API to BullMQ worker queue when services run locally. |

### 2.2 Tax & Statutory Compliance

| Spec File | Scope & Invariants Tested |
| :--- | :--- |
| [`itr-export.spec.ts`](./itr-export.spec.ts) | Section 112A Schedule CG compliance, Table F Advance Tax quarterly breakdown (Q1 to Q4), Budget 2024 rate badges (12.5% LTCG, 20% STCG), Schedule CG CSV export, missing transaction type resilience, and infinite units harvesting guardrails. |
| [`asset-allocation-and-calculator.spec.ts`](./asset-allocation-and-calculator.spec.ts) | Asset class allocation (Equity, Debt, Hybrid, Cash), withdrawal simulation calculations, and estimated capital gains tax breakdown. |

### 2.3 Analytics & Reporting

| Spec File | Scope & Invariants Tested |
| :--- | :--- |
| [`analytics-reporting.spec.ts`](./analytics-reporting.spec.ts) | Marginal tax slab reactivity (dynamic recalculation of Post-Tax XIRR on slab updates), integrated harvesting flow opening `SimulationModal`, and Post-Tax XIRR $\le$ Pre-Tax XIRR invariant check across all holdings. *(Formerly `milestone-v2.spec.ts`)* |
| [`dashboard-regression-verification.spec.ts`](./dashboard-regression-verification.spec.ts) | 7-bug regression gate: manual close button elimination, zero-holding isolation, simulate sell modal rendering, stock exposure look-through visibility, tax optimization summary, health/goals insights, and bounded return percentages (no runaway values like 1685111%). |

### 2.4 Platform & UX Safeguards

| Spec File | Scope & Invariants Tested |
| :--- | :--- |
| [`smoke.spec.ts`](./smoke.spec.ts) | Application boot cleanliness, logo and branding presence, empty-state landing view, and unhandled exception interceptor (catches and reports uncaught JavaScript runtime exceptions with stack traces). |
| [`font-visibility.spec.ts`](./font-visibility.spec.ts) | Exhaustive WCAG AA/AAA color contrast audit across light mode, dark mode, system vs local theme conflicts, and forced colors / high-contrast modes, plus synchronous theme transition verification. |
| [`responsiveness.spec.ts`](./responsiveness.spec.ts) | Viewport responsiveness on mobile, tablet, and desktop viewports; header layout wrapping, stats grid column adaptation, and modal responsiveness. |
| [`logout.spec.ts`](./logout.spec.ts) | User session termination, complete `localStorage` state purge, and redirection to unauthenticated empty state. |

---

## 3. Vitest Component & Utility Unit Test Catalog

Located under `frontend/src/`:

| Unit Test File | Target Component / Module | Scope & Invariants Tested |
| :--- | :--- | :--- |
| [`src/utils/consolidation.test.ts`](../src/utils/consolidation.test.ts) | Scheme Consolidation Engine | Aggregating multiple folios by ISIN/name, summing invested amounts and current values, filtering zero-balance positions, and closed position extraction. |
| [`src/utils/mock-portfolios.test.ts`](../src/utils/mock-portfolios.test.ts) | Synthetic Mock Portfolios | Integrity verification of the 10 reference synthetic portfolios (units conservation, non-negative values, valid mock PANs). |
| [`src/utils/itrReportGenerator.test.ts`](../src/utils/itrReportGenerator.test.ts) | ITR Schedule CG Generator | CSV row generation matching official Income Tax Department Schedule CG format, Table F quarterly columns, and statutory rate columns. |
| [`src/utils/sorting.test.ts`](../src/utils/sorting.test.ts) | Table Sorting Utilities | Multi-column ascending/descending sorting for numbers, currencies, dates, and scheme strings. |
| [`src/components/Tax/TaxView.test.tsx`](../src/components/Tax/TaxView.test.tsx) | `TaxView` Component | Rendering tax overview cards, Advance Tax quarterly matrix, CSV export button, and empty gains alert state. |
| [`src/components/Tax/SimulationModal.test.tsx`](../src/components/Tax/SimulationModal.test.tsx) | `SimulationModal` Component | Real-time withdrawal calculations, LTCG 12.5% and STCG 20% breakdown, exit load deductions, and net proceeds calculation. |
| [`src/components/Analytics/XRayDashboard.test.tsx`](../src/components/Analytics/XRayDashboard.test.tsx) | `XRayDashboard` Component | Asset class distribution pie chart, top sector exposure bar charts, and data loading states. |
| [`src/components/Analytics/IntersectionView.test.tsx`](../src/components/Analytics/IntersectionView.test.tsx) | `IntersectionView` Component | Multi-fund stock overlap matrix, search input filtering, and common company holdings display. |
| [`src/components/Dashboard/StatsGrid.test.tsx`](../src/components/Dashboard/StatsGrid.test.tsx) | `StatsGrid` Component | Portfolio summary metrics: Total Value, Invested, Total Gain, Absolute Return, XIRR, Post-Tax XIRR, and Day Change. |
| [`src/components/Dashboard/TransactionSidePanel.test.tsx`](../src/components/Dashboard/TransactionSidePanel.test.tsx) | `TransactionSidePanel` Component | Slide-out transaction ledger, chronological purchase/redemption display, units, NAV, and amount formatting. |
| [`src/components/Family/FamilySelector.test.tsx`](../src/components/Family/FamilySelector.test.tsx) | `FamilySelector` Component | Profile dropdown selector, member switching, add member, rename profile, and delete profile triggers. |
| [`src/components/ErrorBoundary.test.tsx`](../src/components/ErrorBoundary.test.tsx) | `ErrorBoundary` Component | Graceful catch of unhandled rendering errors and display of fallback UI with retry action. |

---

## 4. Test Execution Guide

### 4.1 Running Playwright E2E Tests
From the `frontend/` directory:
```bash
# List all discovered tests across suites
npx playwright test --list

# Run all E2E tests
npm run test:e2e

# Run a specific domain suite
npx playwright test tests/holdings-management.spec.ts
npx playwright test tests/analytics-reporting.spec.ts
npx playwright test tests/itr-export.spec.ts

# Run in headed mode for visual inspection
npx playwright test tests/smoke.spec.ts --headed
```

From repository root:
```bash
npm run test:e2e --prefix frontend
```

### 4.2 Running Vitest Unit Tests
From the `frontend/` directory:
```bash
# Run all unit tests once
npm run test:unit

# Run a specific unit test
npx vitest run src/utils/consolidation.test.ts
npx vitest run src/components/Tax/TaxView.test.tsx

# Run with interactive watch mode
npx vitest
```

From repository root:
```bash
npm run test:unit --prefix frontend
```

---

## 5. Adding New Tests

### 5.1 Adding a New E2E Test
1. Identify the appropriate domain spec file (or create a semantically named spec file under [`tests/`](.) if defining a new domain).
2. Utilize Page Object Models from [`pom/`](./pom) for existing workflows or extend the POMs for new controls.
3. Always use synthetic test data:
   - Name: Fictitious names (`Aarav Sharma`, `Priya Patel`).
   - PAN: Valid pattern synthetic PAN (`ABCDE1234F`).
   - Numbers: Deterministic amounts without hardcoding transient dates.
4. Ensure `storageState` or `setupAuth(page)` is invoked in `test.beforeEach` so authentication is handled hermetically.

### 5.2 Adding a New Vitest Unit Test
1. Co-locate the test file next to the implementation (`<ComponentName>.test.tsx` or `<utility>.test.ts`).
2. Mock external dependencies using `vi.fn()` and `@testing-library/react`.
3. Assert both positive paths and edge cases (e.g., zero holdings, missing metadata, empty arrays).
