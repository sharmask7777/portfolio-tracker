<!-- /autoplan restore point: "/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/.gstack/tmp/autoplan/feat-true-post-tax-xirr-and-zero-tax-rebalancing-autoplan-restore-20261108-105620.md" -->
# Implementation Plan: True Post-Tax XIRR & Zero-Tax Rebalancing Engine

Based on approved design: [`docs/designs/true-post-tax-xirr-and-zero-tax-rebalancing.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/designs/true-post-tax-xirr-and-zero-tax-rebalancing.md)  
Branch: `feat/true-post-tax-xirr-and-zero-tax-rebalancing`  
Status: DRAFT  

## Implementation plan

### Milestone 1: Reality Check Switch, Real Post-Tax XIRR & March Harvest Ticket

- [x] **Task 1: Core Mathematical Engine & Real Post-Tax XIRR in `portfolio-core`**
  - **Objective**: Implement pure, zero-I/O financial functions in `backend-rs/crates/portfolio-core/src/performance/metrics.rs` and `tax/harvesting.rs` to compute Fisher-adjusted real post-tax XIRR, sequential layer drag teardowns, and actionable Section 112A harvest tickets.
  - **Files to Modify**:
    - `backend-rs/crates/portfolio-core/src/performance/metrics.rs`: Add `calculate_post_tax_real_xirr(nominal_post_tax_xirr: Decimal, cpi_inflation_rate: Decimal) -> Decimal` and `calculate_drag_attribution`.
    - `backend-rs/crates/portfolio-core/src/performance/mod.rs`: Re-export the new functions.
    - `backend-rs/crates/portfolio-core/src/tax/harvesting.rs`: Create `generate_section_112a_harvest_ticket` (scanning active lots $>365$ days, greedy knapsack packing up to `₹1,25,000 - realized_fy_ltcg`).
    - `backend-rs/crates/portfolio-core/src/tax/mod.rs`: Re-export `harvesting` module.
  - **Watertight Invariant Oracle Tests**:
    - Property-based tests in `backend-rs/crates/portfolio-core/tests/proptests.rs`:
      - Realized/unrealized terminal net value is non-negative and monotonic.
      - When net gains are $\le 0$, tax drag is identically $0.00\%$.
      - When inflation is positive ($i > 0$), real XIRR is strictly less than nominal post-tax XIRR ($r_{\text{real}} < r_{\text{post-tax}}$).
      - Harvest ticket never recommends redeeming lots whose cumulative LTCG exceeds $\min(\text{unrealized\_ltcg}, ₹1,25,000 - \text{realized\_fy\_ltcg})$.
    - Mock portfolio suite in `backend-rs/crates/portfolio-core/tests/mock_portfolios.rs`: Add assertions certifying exact post-tax real returns across all 10 synthetic portfolios within $\Delta \le 10^{-6}$.

- [x] **Task 2: API Gateway Contract Parity & Bindings in `portfolio-api`**
  - **Objective**: Expose the reality check metrics, return drag decomposition, and harvest ticket via Axum REST endpoints with generated TypeScript bindings.
  - **Files to Modify**:
    - `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`:
      - Update `SummaryMetrics` to include `real_post_tax_xirr: Decimal` and `drags: DragDecomposition`.
      - Accept optional query parameter `cpi_inflation_rate` (default: 0.06).
    - `backend-rs/crates/portfolio-api/src/routes/tax.rs`:
      - Embed `harvest_ticket: Option<HarvestTicket>` in `TaxSummaryResponse`.
    - `backend-rs/crates/portfolio-api/tests/export_bindings.rs`: Export updated TypeScript bindings into `frontend/src/types/generated/`.
  - **Watertight Invariant Oracle Tests**:
    - Contract drift check: `(cd backend-rs && cargo test --package portfolio-api --test export_bindings) && git diff --exit-code frontend/src/types/generated`.
    - Unit tests in `backend-rs/crates/portfolio-api/tests/contract_tests.rs`: Validate camelCase JSON serialization, zero NaN outputs, and safe optionals.

- [x] **Task 3: Frontend Global Settings & State Integration**
  - **Objective**: Integrate `realityCheckMode` and `cpiInflationRate` into React context and persistent settings.
  - **Files to Modify**:
    - `frontend/src/contexts/SettingsContext.tsx`: Add `realityCheckMode: boolean` and `cpiInflationRate: number` to `Settings` interface with local storage persistence.
    - `frontend/src/contexts/SettingsContext.test.tsx`: Test toggle transitions and default fallback.

- [x] **Task 4: Frontend "Reality Check" Switch & Drag Teardown in `StatsGrid.tsx`**
  - **Objective**: Elevate after-tax returns to a primary dashboard toggle switch and render the Return Drag Teardown banner.
  - **Files to Modify**:
    - `frontend/src/components/Dashboard/StatsGrid.tsx`:
      - Add `[ 📊 Broker View | ⚡ Reality Check ]` toggle buttons.
      - When Reality Check is active, display `postTaxTotalValue` as net worth and Fisher-adjusted `realPostTaxXirr` as return rate.
      - Add the collapsible Return Drag Teardown banner showing intermediate step-downs: Nominal XIRR $\to$ Section 50AA Debt Drag $\to$ Section 112A/111A Equity Drag $\to$ Cess & Exit Drag $\to$ Inflation Drag $\to$ Real Purchasing Power XIRR.
      - Add assumptions modal/popover to adjust CPI inflation (0% - 12%).
    - `frontend/src/components/Dashboard/StatsGrid.test.tsx`: Test rendering under both Broker View and Reality Check modes with zero `NaN` displays.

- [x] **Task 5: Frontend Scheme Holdings Table Reaction in `App.tsx` & `consolidation.ts`**
  - **Objective**: Dynamically update holdings valuation and return columns to reflect net realizable proceeds and real purchasing-power returns.
  - **Files to Modify**:
    - `frontend/src/utils/consolidation.ts`: Update `consolidateFoliosIntoSchemes` to compute weighted real post-tax XIRR per scheme group.
    - `frontend/src/utils/consolidation.test.ts`: Verify weighted real post-tax XIRR math.
    - `frontend/src/App.tsx`: Toggle column headers ("Current Valuation" $\leftrightarrow$ "Net Realizable Value", "XIRR" $\leftrightarrow$ "Real XIRR") and style negative real returns on debt funds with clear amber warnings.

- [x] **Task 6: Frontend Actionable March Harvesting Ticket in `TaxView.tsx`**
  - **Objective**: Render the executable March Harvesting Ticket directly in the tax dashboard with copy-to-clipboard functionality.
  - **Files to Modify**:
    - `frontend/src/components/Tax/TaxView.tsx`:
      - Display the "March Tax-Free Harvesting Ticket" card under the ₹1.25L Section 112A exemption runway.
      - Add copy-to-clipboard button generating formatted instructions for MF Central / CAMS.
      - Link to existing `SimulationModal.tsx` pre-populated with ticket folio and units.
    - `frontend/src/components/Tax/TaxView.test.tsx`: Test card rendering with and without unutilized exemption runway.

- [x] **Task 7: Hermetic Verification & Playwright E2E Compliance Gates**
  - **Objective**: Enforce the full hermetic verification sequence and add Playwright E2E specs for regression prevention.
  - **Verification Steps**:
    - Backend: `(cd backend-rs && ./scripts/verify.sh)`
    - Contract drift check: `(cd backend-rs && cargo test --package portfolio-api --test export_bindings) && git diff --exit-code frontend/src/types/generated`
    - Frontend build & audit: `pnpm --filter frontend build` (executes `build:verify` = lint + typecheck + knip dead-code check)
    - Frontend unit tests: `pnpm --filter frontend test:unit`
    - Coverage gates: `pnpm test:coverage` (enforcing $\ge 80\%$ backend and $\ge 88\%$ frontend lines)
    - Playwright E2E suite: Add `frontend/tests/reality-check.spec.ts` testing the Reality Check toggle, drag teardown visibility, and March harvesting ticket copy interaction.



<!-- autoplan-accepted:ceo -->
- Mandatory Exclusion of Locked and Exit-Loaded Units in Harvesting: `generate_section_112a_harvest_ticket` in `portfolio-core/src/tax/harvesting.rs` must filter out ELSS funds with holding period < 1,095 days (statutory 3-year Section 80C lock-in) and exclude lots with active exit load schedules, with unit badges indicating lock-in and exit load status. Verified by unit tests in `portfolio-core/tests/tax_compliance_test.rs`.
- Strict Aggregate-Only Real Post-Tax XIRR: Calculate Real Post-Tax XIRR strictly at the aggregate portfolio cash flow level using Fisher indexation ($r_{\text{real}} = \frac{1 + r_{\text{post-tax}}}{1 + i_{\text{inflation}}} - 1$); do NOT linearly weight or arithmetically consolidate XIRR across individual schemes in `consolidation.ts`. Scheme holdings table will display nominal gross XIRR and net realizable proceeds (gross value minus lot-level unrealized tax liability before aggregate ₹1.25L exemption). Verified by property tests in `proptests.rs`.
- Configurable Marginal Tax Bracket for Section 50AA Debt Drag: Add `marginalTaxBracket: Decimal` (defaults to 30%, options: 0%, 10%, 15%, 20%, 30%, 39%) to `SettingsContext` and backend API query contracts so Section 50AA debt drag accurately reflects the investor's statutory tax slab. Verified by API contract tests and settings unit tests.
- Year-Round Section 112A Harvesting with Seasonal Urgency: Name the capability "Section 112A Tax-Free Harvesting Ticket" for year-round utility, while rendering a dynamic countdown banner during February–March ("FY 2024-25 Exemption runway expires in X days").
- Real Return Benchmark Comparison: Include a real post-tax risk-free benchmark spread ($r_{\text{real, portfolio}} - r_{\text{real, safe-asset}}$) in the Return Drag Teardown banner to provide essential asset-allocation context against inflation-eroded cash/FDs.
<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:design -->
- Reconcile Scheme Holdings Table with Pure Aggregate Math: Task 5 is updated to strictly preserve nominal gross XIRR in `consolidation.ts`. The holdings table will display "Net Realizable Value" (gross value minus lot-level unrealized tax before ₹1.25L exemption) and nominal gross XIRR with an informational `Nominal` badge, plus amber indicator dots on debt schemes yielding negative real returns after slab tax and inflation.
- Reality Check Performance Mode Lock: When Reality Check toggle is active in `StatsGrid.tsx`, disable the ABS return toggle and lock the performance card to Real Post-Tax XIRR, rendering an explanatory badge: "Reality Check operates on annual cash flows (XIRR) to calculate time-weighted purchasing power".
- Dual-Readout Grounding on Summary Cards: When Reality Check is active, summary cards display primary net values with secondary grounding captions below (e.g., Net Worth: ₹43.2L primary, `Gross: ₹50.0L · Est. Tax: -₹6.8L` caption; Performance: +7.1% primary, `Nominal: +18.2% · Drag: -11.1%` caption).
- Full-Width Drag Teardown Banner & Action Bridge: Render the Return Drag Teardown banner spanning full width (`grid-column: 1 / -1`) below the stats cards with horizontal stepped waterfall, real risk-free benchmark spread, and a direct action bridge CTA button (`[View Harvesting Ticket →]`) routing to `TaxView`.
- Multi-Scheme Harvesting Table & Empty States: In `TaxView.tsx`, render the Section 112A Harvesting Ticket as an itemized table of lots with per-scheme `Simulate` buttons (pre-populating single-folio `SimulationModal`), a master `Copy All Instructions` button formatted for MF Central/CAMS with clipboard success/fallback handling, and an explicit empty state when exemption runway exists but eligible lots are zero.
- Inline Assumptions Popover with Debounce: Standardize CPI inflation (0%-12% slider with RBI 4%, default 6%, conservative 8% presets) and Marginal Tax Slab (0%, 10%, 15%, 20%, 30%, 39% selector) into a lightweight popover anchored to the teardown banner with 300ms query debounce.
<!-- /autoplan-accepted:design -->

<!-- autoplan-accepted:dx -->
- Agent-Ready RFC 9457 Problem Details for Query Validation: Define custom query extraction in `portfolio-api` returning RFC 9457 `application/problem+json` format with structured fields on validation errors: `what` (invalid parameter name and received value), `fix` (actionable example on first/last line), `recovery` (`fix_and_retry`, `sideEffects: "none"`), `code` (stable error code anchor), and `context` (allowed numeric range `[0.0, 1.0]` for `cpiInflationRate`, statutory slab set `[0.0, 0.10, 0.15, 0.20, 0.30, 0.39]` for `marginalTaxBracket`). Verified by API contract tests in `portfolio-api/tests/contract_tests.rs`.
- Defensive Fisher Inflation Bounds & Zero-Panic Invariant: Guard `calculate_post_tax_real_xirr` in `portfolio-core/src/performance/metrics.rs` against division-by-zero or negative divisors when inflation $1 + i_{\text{inflation}} \le 0$ ($i \le -100\%$). Return a safe clamped floor or typed error to maintain zero-panic mathematical invariants. Verified by property test in `proptests.rs`.
- API Query Parameter Standardization & Aliasing: Standardize on camelCase query parameters (`cpiInflationRate`, `marginalTaxBracket`) across all API contracts and TypeScript bindings, while configuring Serde aliases (`#[serde(alias = "cpi_inflation_rate", alias = "tax_slab")]`) in Axum deserializers for backward compatibility. Verified by contract parity test.
- Resilient LocalStorage Persistence with In-Memory Fallback: Wrap `localStorage.setItem` in `SettingsContext.tsx` in a defensive try-catch block to handle `QuotaExceededError` or `SecurityError` (incognito/private browsing mode), gracefully falling back to in-memory React state with console warnings without crashing React components. Verified by unit test in `SettingsContext.test.tsx`.
- TaxView Clipboard Fallback Modal: When `navigator.clipboard.writeText` fails or clipboard access is denied, display a fallback accessible modal with the formatted MF Central/CAMS instructions in a `<textarea>` with an explicit manual-copy prompt (`Ctrl+C / Cmd+C`). Verified by unit test in `TaxView.test.tsx`.
- Popover Numeric Input Escape Hatch: Add an editable numeric input box alongside the 0%–12% slider in the assumptions popover, allowing users and analysts to input custom non-negative inflation rates without restriction.
<!-- /autoplan-accepted:dx -->

<!-- autoplan-accepted:eng -->
- Reconcile Task 5 with Pure Domain Invariants: Strictly preserve nominal gross XIRR in `consolidation.ts` and remove any attempt to calculate linearly-weighted scheme XIRRs. Compute scheme `netRealizableValue` by aggregating backend-computed `folio.metrics.currentValue - folio.metrics.estimatedTax` across constituent folios, ensuring zero-any TypeScript compliance. Verified by `consolidation.test.ts`.
- Strongly-Typed `HarvestTicketResponse` & Contract Parity: Define a strongly-typed, TS-exported DTO `HarvestTicketResponse` in `portfolio-api/src/routes/tax.rs` exported via `cargo test --package portfolio-api --test export_bindings` into `frontend/src/types/generated/`. Type `harvesting` in `frontend/src/App.tsx` strictly as `HarvestTicketResponse | null`, eliminating `any` types in compliance with Mandate 2. Verified by contract drift test `git diff --exit-code frontend/src/types/generated`.
- Exit Load Schedule Inspection & Parag Parikh Safeguard: Add `exit_load_metadata: Option<&'a str>` to `FolioHarvestingInput` in `portfolio-core/src/tax/harvesting.rs` and invoke `get_exit_load` to exclude lots with active exit load schedules (specifically guarding against equity funds like Parag Parikh Flexi Cap which enforce a 1% exit load between 365 and 730 days). Verified by unit test in `portfolio-core/tests/tax_compliance_test.rs`.
- Fisher Math Solver Safety & Undefined Cash Flow Handling: In `portfolio-core/src/performance/metrics.rs`, update `calculate_post_tax_real_xirr` to accept `Option<Decimal>` and return `Result<Option<Decimal>, PortfolioError>`, properly handling portfolios where cash flows have no internal rate of return (`None`). Display `—` in `StatsGrid.tsx` when `realPostTaxXirr` is `null`/`undefined`. Verified by unit tests.
- Closed-Form Proportional Drag Waterfall: In `calculate_drag_attribution`, allocate intermediate step-downs proportionally from total tax drag ($\Delta_{\text{tax}} = \text{XIRR}_{\text{nominal}} - \text{XIRR}_{\text{post-tax}}$) and inflation drag ($\text{XIRR}_{\text{post-tax}} - \text{XIRR}_{\text{real}}$), guaranteeing the exact mathematical identity $\text{XIRR}_{\text{nominal}} - \sum \text{drags} \equiv \text{XIRR}_{\text{real}}$ without multiple Brent root-finding calls. Verified by property test in `proptests.rs`.
- Watertight CBDT Statutory Invariant Oracles: Implement property-based and compliance tests in `portfolio-core/tests/proptests.rs` and `tax_compliance_test.rs` enforcing 5 statutory invariants: (1) Zero tax drag when net gains $\le 0$, (2) Harvest LTCG $\le \min(₹1,25,000 - \text{realized\_fy\_ltcg}, \text{unrealized\_ltcg})$, (3) ELSS 1,095-day lock-in exclusion, (4) Exemption exhaustion returning 0 opportunities when realized LTCG $\ge ₹1,25,000$, (5) Monotonic decrease of real return with increasing inflation. Verified by `cargo test --workspace`.
- Query Cancellation & IST Financial Year-End Precision: In `frontend/src/App.tsx`, use `AbortController` signals to cancel in-flight queries during debounced parameter updates. In `frontend/src/components/Tax/TaxView.tsx`, compute FY expiration countdown against March 31 23:59:59 using `timeZone: 'Asia/Kolkata'`.
<!-- /autoplan-accepted:eng -->
## Review record

<!-- autoplan-accepted:ceo -->
- Mandatory Exclusion of Locked and Exit-Loaded Units in Harvesting: `generate_section_112a_harvest_ticket` in `portfolio-core/src/tax/harvesting.rs` must filter out ELSS funds with holding period < 1,095 days (statutory 3-year Section 80C lock-in) and exclude lots with active exit load schedules, with unit badges indicating lock-in and exit load status. Verified by unit tests in `portfolio-core/tests/tax_compliance_test.rs`.
- Strict Aggregate-Only Real Post-Tax XIRR: Calculate Real Post-Tax XIRR strictly at the aggregate portfolio cash flow level using Fisher indexation ($r_{\text{real}} = \frac{1 + r_{\text{post-tax}}}{1 + i_{\text{inflation}}} - 1$); do NOT linearly weight or arithmetically consolidate XIRR across individual schemes in `consolidation.ts`. Scheme holdings table will display nominal gross XIRR and net realizable proceeds (gross value minus lot-level unrealized tax liability before aggregate ₹1.25L exemption). Verified by property tests in `proptests.rs`.
- Configurable Marginal Tax Bracket for Section 50AA Debt Drag: Add `marginalTaxBracket: Decimal` (defaults to 30%, options: 0%, 10%, 15%, 20%, 30%, 39%) to `SettingsContext` and backend API query contracts so Section 50AA debt drag accurately reflects the investor's statutory tax slab. Verified by API contract tests and settings unit tests.
- Year-Round Section 112A Harvesting with Seasonal Urgency: Name the capability "Section 112A Tax-Free Harvesting Ticket" for year-round utility, while rendering a dynamic countdown banner during February–March ("FY 2024-25 Exemption runway expires in X days").
- Real Return Benchmark Comparison: Include a real post-tax risk-free benchmark spread ($r_{\text{real, portfolio}} - r_{\text{real, safe-asset}}$) in the Return Drag Teardown banner to provide essential asset-allocation context against inflation-eroded cash/FDs.
<!-- /autoplan-accepted:ceo -->

<!-- autoplan-accepted:design -->
- Reconcile Scheme Holdings Table with Pure Aggregate Math: Task 5 is updated to strictly preserve nominal gross XIRR in `consolidation.ts`. The holdings table will display "Net Realizable Value" (gross value minus lot-level unrealized tax before ₹1.25L exemption) and nominal gross XIRR with an informational `Nominal` badge, plus amber indicator dots on debt schemes yielding negative real returns after slab tax and inflation.
- Reality Check Performance Mode Lock: When Reality Check toggle is active in `StatsGrid.tsx`, disable the ABS return toggle and lock the performance card to Real Post-Tax XIRR, rendering an explanatory badge: "Reality Check operates on annual cash flows (XIRR) to calculate time-weighted purchasing power".
- Dual-Readout Grounding on Summary Cards: When Reality Check is active, summary cards display primary net values with secondary grounding captions below (e.g., Net Worth: ₹43.2L primary, `Gross: ₹50.0L · Est. Tax: -₹6.8L` caption; Performance: +7.1% primary, `Nominal: +18.2% · Drag: -11.1%` caption).
- Full-Width Drag Teardown Banner & Action Bridge: Render the Return Drag Teardown banner spanning full width (`grid-column: 1 / -1`) below the stats cards with horizontal stepped waterfall, real risk-free benchmark spread, and a direct action bridge CTA button (`[View Harvesting Ticket →]`) routing to `TaxView`.
- Multi-Scheme Harvesting Table & Empty States: In `TaxView.tsx`, render the Section 112A Harvesting Ticket as an itemized table of lots with per-scheme `Simulate` buttons (pre-populating single-folio `SimulationModal`), a master `Copy All Instructions` button formatted for MF Central/CAMS with clipboard success/fallback handling, and an explicit empty state when exemption runway exists but eligible lots are zero.
- Inline Assumptions Popover with Debounce: Standardize CPI inflation (0%-12% slider with RBI 4%, default 6%, conservative 8% presets) and Marginal Tax Slab (0%, 10%, 15%, 20%, 30%, 39% selector) into a lightweight popover anchored to the teardown banner with 300ms query debounce.
<!-- /autoplan-accepted:design -->

<!-- autoplan-accepted:dx -->
- Agent-Ready RFC 9457 Problem Details for Query Validation: Define custom query extraction in `portfolio-api` returning RFC 9457 `application/problem+json` format with structured fields on validation errors: `what` (invalid parameter name and received value), `fix` (actionable example on first/last line), `recovery` (`fix_and_retry`, `sideEffects: "none"`), `code` (stable error code anchor), and `context` (allowed numeric range `[0.0, 1.0]` for `cpiInflationRate`, statutory slab set `[0.0, 0.10, 0.15, 0.20, 0.30, 0.39]` for `marginalTaxBracket`). Verified by API contract tests in `portfolio-api/tests/contract_tests.rs`.
- Defensive Fisher Inflation Bounds & Zero-Panic Invariant: Guard `calculate_post_tax_real_xirr` in `portfolio-core/src/performance/metrics.rs` against division-by-zero or negative divisors when inflation $1 + i_{\text{inflation}} \le 0$ ($i \le -100\%$). Return a safe clamped floor or typed error to maintain zero-panic mathematical invariants. Verified by property test in `proptests.rs`.
- API Query Parameter Standardization & Aliasing: Standardize on camelCase query parameters (`cpiInflationRate`, `marginalTaxBracket`) across all API contracts and TypeScript bindings, while configuring Serde aliases (`#[serde(alias = "cpi_inflation_rate", alias = "tax_slab")]`) in Axum deserializers for backward compatibility. Verified by contract parity test.
- Resilient LocalStorage Persistence with In-Memory Fallback: Wrap `localStorage.setItem` in `SettingsContext.tsx` in a defensive try-catch block to handle `QuotaExceededError` or `SecurityError` (incognito/private browsing mode), gracefully falling back to in-memory React state with console warnings without crashing React components. Verified by unit test in `SettingsContext.test.tsx`.
- TaxView Clipboard Fallback Modal: When `navigator.clipboard.writeText` fails or clipboard access is denied, display a fallback accessible modal with the formatted MF Central/CAMS instructions in a `<textarea>` with an explicit manual-copy prompt (`Ctrl+C / Cmd+C`). Verified by unit test in `TaxView.test.tsx`.
- Popover Numeric Input Escape Hatch: Add an editable numeric input box alongside the 0%–12% slider in the assumptions popover, allowing users and analysts to input custom non-negative inflation rates without restriction.
<!-- /autoplan-accepted:dx -->

<!-- autoplan-accepted:eng -->
- Reconcile Task 5 with Pure Domain Invariants: Strictly preserve nominal gross XIRR in `consolidation.ts` and remove any attempt to calculate linearly-weighted scheme XIRRs. Compute scheme `netRealizableValue` by aggregating backend-computed `folio.metrics.currentValue - folio.metrics.estimatedTax` across constituent folios, ensuring zero-any TypeScript compliance. Verified by `consolidation.test.ts`.
- Strongly-Typed `HarvestTicketResponse` & Contract Parity: Define a strongly-typed, TS-exported DTO `HarvestTicketResponse` in `portfolio-api/src/routes/tax.rs` exported via `cargo test --package portfolio-api --test export_bindings` into `frontend/src/types/generated/`. Type `harvesting` in `frontend/src/App.tsx` strictly as `HarvestTicketResponse | null`, eliminating `any` types in compliance with Mandate 2. Verified by contract drift test `git diff --exit-code frontend/src/types/generated`.
- Exit Load Schedule Inspection & Parag Parikh Safeguard: Add `exit_load_metadata: Option<&'a str>` to `FolioHarvestingInput` in `portfolio-core/src/tax/harvesting.rs` and invoke `get_exit_load` to exclude lots with active exit load schedules (specifically guarding against equity funds like Parag Parikh Flexi Cap which enforce a 1% exit load between 365 and 730 days). Verified by unit test in `portfolio-core/tests/tax_compliance_test.rs`.
- Fisher Math Solver Safety & Undefined Cash Flow Handling: In `portfolio-core/src/performance/metrics.rs`, update `calculate_post_tax_real_xirr` to accept `Option<Decimal>` and return `Result<Option<Decimal>, PortfolioError>`, properly handling portfolios where cash flows have no internal rate of return (`None`). Display `—` in `StatsGrid.tsx` when `realPostTaxXirr` is `null`/`undefined`. Verified by unit tests.
- Closed-Form Proportional Drag Waterfall: In `calculate_drag_attribution`, allocate intermediate step-downs proportionally from total tax drag ($\Delta_{\text{tax}} = \text{XIRR}_{\text{nominal}} - \text{XIRR}_{\text{post-tax}}$) and inflation drag ($\text{XIRR}_{\text{post-tax}} - \text{XIRR}_{\text{real}}$), guaranteeing the exact mathematical identity $\text{XIRR}_{\text{nominal}} - \sum \text{drags} \equiv \text{XIRR}_{\text{real}}$ without multiple Brent root-finding calls. Verified by property test in `proptests.rs`.
- Watertight CBDT Statutory Invariant Oracles: Implement property-based and compliance tests in `portfolio-core/tests/proptests.rs` and `tax_compliance_test.rs` enforcing 5 statutory invariants: (1) Zero tax drag when net gains $\le 0$, (2) Harvest LTCG $\le \min(₹1,25,000 - \text{realized\_fy\_ltcg}, \text{unrealized\_ltcg})$, (3) ELSS 1,095-day lock-in exclusion, (4) Exemption exhaustion returning 0 opportunities when realized LTCG $\ge ₹1,25,000$, (5) Monotonic decrease of real return with increasing inflation. Verified by `cargo test --workspace`.
- Query Cancellation & IST Financial Year-End Precision: In `frontend/src/App.tsx`, use `AbortController` signals to cancel in-flight queries during debounced parameter updates. In `frontend/src/components/Tax/TaxView.tsx`, compute FY expiration countdown against March 31 23:59:59 using `timeZone: 'Asia/Kolkata'`.
<!-- /autoplan-accepted:eng -->

### Phase 1: CEO Review Findings & Consensus

#### Dual Voices Consensus Table
```
CEO DUAL VOICES — CONSENSUS TABLE:
  Dimension                             agy (in-host)     Codex        Consensus
  1. Premises valid?                    Finding (2 gaps)  unavailable  N/A
  2. Right problem to solve?            PASS              unavailable  N/A
  3. Scope calibration correct?         Finding (lock-in) unavailable  N/A
  4. Alternatives sufficiently explored?PASS              unavailable  N/A
  5. Competitive/market risks covered?  PASS              unavailable  N/A
  6. 6-month trajectory sound?          PASS              unavailable  N/A
```
*Note: Codex outside CLI was unavailable (not_installed). agy (in-host) subagent executed independent adversarial review.*

#### Reality Rows
```text
REALITY: premise-table pass Terminal post-tax cash flows exist in PerformanceMetrics backend-rs/crates/portfolio-core/src/performance/metrics.rs:25
REALITY: already-done pass Post-tax total value is computed in API summary backend-rs/crates/portfolio-api/src/routes/portfolio.rs:18
REALITY: surface-check pass Portfolio summary route is registered backend-rs/crates/portfolio-api/src/routes/portfolio.rs:10
REALITY: binding-decisions pass The Invariant Oracle Law is codified AGENTS.md:5
REALITY: numbers pass Statutory tax rates and thresholds codified backend-rs/crates/portfolio-core/src/tax/mod.rs:1
REALITY: deferred-asks pass Autoplan and watertight gates requested docs/superpowers/plans/2026-11-08-true-post-tax-xirr-and-zero-tax-rebalancing.md:1
REALITY: pr-count pass Single feature PR planned docs/superpowers/plans/2026-11-08-true-post-tax-xirr-and-zero-tax-rebalancing.md:72
```

#### What Already Exists
- `backend-rs/crates/portfolio-core/src/performance/metrics.rs`: `PerformanceMetrics` struct already defines `post_tax_xirr`, `post_tax_absolute_return`, and `estimated_tax`. `get_metrics` computes terminal cash flows using `crate::tax::calculate_unrealized_tax`.
- `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`: `get_portfolio_summary` already executes `solve_terminal_xirr(post_tax_total_value)` and serializes `post_tax_xirr` in `SummaryMetrics`.
- `frontend/src/components/Dashboard/StatsGrid.tsx`: Contains optional `postTaxTotalValue` and `postTaxXirr` props.
- `frontend/src/utils/consolidation.ts`: Consolidation logic exists for multi-folio grouping.

#### NOT In Scope
- Automatic trade order execution (direct broker API placement): Rejected for regulatory compliance; copy-to-clipboard instructions for MF Central/CAMS only.
- Tax-Loss Harvesting (STCL/LTCL) knapsack packing: Deferred to separate feature wave; focus on Section 112A ₹1.25L LTCG runway first.

#### Dream State Delta
- **Current State**: Portfolio analytics celebrate gross nominal returns while obscuring after-tax and real purchasing-power degradation.
- **This Plan**: Gives users an honest "Reality Check" dashboard switch, granular drag attribution breakdown, real risk-free benchmark spread, and a guaranteed lock-in-safe Section 112A tax-free harvesting ticket.
- **12-Month Ideal**: Automated multi-asset tax-loss harvesting, cross-family tax rebalancing, and optimal asset-location optimization.

#### Error & Rescue Registry
| Method / Boundary | Failure Mechanism | Exception / Error | Rescued? | Rescue Action | User Impact |
|---|---|---|---|---|---|
| `calculate_post_tax_real_xirr` | Deflator $(1 + i) \le 0$ | DivisionByZero / Underflow | Y | Bound $i \ge -0.99$, clamp to $-100\%$ | Prevents NaN panic |
| `generate_section_112a_harvest_ticket` | ELSS $<1095$d or exit load | LockedUnitsError | Y | Skip locked lots, pack only free units | Avoids RTA rejection |
| `get_portfolio_summary` | Fisher deflation divergence | XirrError | Y | Fallback to nominal post-tax XIRR with warning | Graceful degradation |

#### Failure Modes Registry
| Codepath | Failure Mode | Rescued? | Test? | User Sees? | Logged? | Status |
|---|---|---|---|---|---|---|
| Harvesting Engine | Locked ELSS lots redeemed | Y | Y | Locked badge & excluded | Y | OK |
| Drag Teardown | Non-30% slab investor receives wrong debt drag | Y | Y | User-adjusted slab rate | Y | OK |
| Fisher Math | Hyperinflation input causing overflow | Y | Y | Capped input bound [0, 100%] | Y | OK |

#### Completion Summary
```
+====================================================================+
|            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
+====================================================================+
| Mode selected        | SELECTIVE EXPANSION                         |
| System Audit         | 7 existing files leveraged; zero new crates |
| Step 0               | Hardened lock-in checks & aggregate XIRR    |
| Section 1  (Arch)    | 0 issues found                              |
| Section 2  (Errors)  | 3 error paths mapped, 0 GAPS                |
| Section 3  (Security)| 0 issues found, 0 High severity             |
| Section 4  (Data/UX) | 4 edge cases mapped, 0 unhandled            |
| Section 5  (Quality) | 0 issues found                              |
| Section 6  (Tests)   | Diagram produced, 0 gaps                    |
| Section 7  (Perf)    | 0 issues found (pure zero-I/O root finding) |
| Section 8  (Observ)  | 0 gaps found                                |
| Section 9  (Deploy)  | 0 risks flagged                             |
| Section 10 (Future)  | Reversibility: 5/5, debt items: 0           |
| Section 11 (Design)  | 0 issues / UI scope detected                |
+--------------------------------------------------------------------+
| NOT in scope         | written (2 items)                           |
| What already exists  | written                                     |
| Dream state delta    | written                                     |
| Error/rescue registry| 3 rows, 0 CRITICAL GAPS                     |
| Failure modes        | 3 total, 0 CRITICAL GAPS                    |
| TODOS.md updates     | 0 items proposed                            |
| Scope proposals      | 5 proposed, 5 accepted                      |
| CEO plan             | written                                     |
| Outside voice        | codex unavailable (in-host subagent only)   |
| Lake Score           | 5/5 recommendations chose complete option   |
| Diagrams produced    | Data flow, Drag teardown                    |
| Stale diagrams found | 0                                           |
| Unresolved decisions | 0                                           |
| Reality rows         | 7/7 rows (PLAN_REALITY), 0 unverified       |
+====================================================================+
```

<!-- AUTONOMOUS DECISION LOG -->
## Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|----------------|-----------|-----------|----------|
| 1 | CEO | Filter ELSS < 1,095d & exit loads in harvest ticket | Mechanical | P1 Choose completeness | Prevent AMC/RTA order rejection & penalties | Naive >365d filter |
| 2 | CEO | Aggregate-only portfolio real post-tax XIRR; no scheme weighting | Mechanical | P1 Choose completeness | XIRR is non-linear cash flow equation; ₹1.25L exemption is aggregate | Linear scheme XIRR weighting |
| 3 | CEO | Configurable marginal tax slab for Section 50AA debt drag | Mechanical | P1 Choose completeness | Section 50AA taxes gains at slab rate | Fixed 30% assumption |
| 4 | CEO | Year-round ticket naming with seasonal urgency banner | Taste | P5 Explicit over clever | Ensure 12-month utility with Feb-March countdown | March-only feature |
| 5 | CEO | Real risk-free benchmark spread in drag teardown | Taste | P1 Choose completeness | Provide equity risk premium context against real FD/cash returns | Isolated real XIRR |
| 6 | Design | Strip weighted scheme XIRR from Task 5; show Net Realizable Value | Mechanical | P1 Choose completeness & DRY | Reconcile Task 5 with Note 92 and statutory oracle | Fake linear scheme XIRR |
| 7 | Design | Lock performance mode to XIRR under Reality Check; disable ABS | Mechanical | P5 Explicit over clever | Fisher indexation is undefined for absolute return without holding period cash flows | Displaying real XIRR with ABS label |
| 8 | Design | Dual-readout grounding on summary cards | Mechanical | P5 Explicit over clever | Prevent context collapse and loss-aversion panic when net worth updates | Abrupt ungrounded value replacement |
| 9 | Design | Full-width drag teardown with action bridge to TaxView | Taste | P1 Choose completeness | Bridge the diagnostic dashboard to the curative tax harvesting ticket | Disconnected tabs |
| 10 | Design | Multi-scheme harvesting table with per-scheme simulate and master copy | Mechanical | P1 Choose completeness | SimulationModal is single-folio while knapsack packing spans multiple folios | Single simulate button for batch ticket |
| 11 | Design | Explicit empty state when runway exists but eligible lots = 0 | Mechanical | P1 Choose completeness | Reassure investor when equity is locked in ELSS, <365d, or in loss | Blank or broken card |
| 12 | Design | Lightweight popover for CPI and marginal tax bracket adjustments | Taste | P3 Pragmatic | Avoid disruptive full modal dialogs for simple parameter adjustments | Full modal dialog |
| 13 | DX | RFC 9457 Agent-Ready error contract for query parameters | Mechanical | P1 Choose completeness | Compliant error handling with actionable fix, recovery and context | Unstructured 400 Bad Request |
| 14 | DX | Guard Fisher deflation against 1+i <= 0 | Mechanical | P1 Choose completeness | Zero-panic invariant in portfolio-core | Unchecked division panic |
| 15 | DX | Standardize camelCase query params with aliases | Mechanical | P5 Explicit over clever | Consistent API ergonomics and TS binding parity | Mixed snake_case / camelCase |
| 16 | DX | Safe localStorage try-catch with in-memory fallback | Mechanical | P3 Pragmatic | Prevent app crash in incognito or restricted storage | Uncaught DOMException |
| 17 | DX | Clipboard writeText rejection fallback dialog | Mechanical | P5 Explicit over clever | Reliable instruction retrieval regardless of clipboard permissions | Silent copy failure |
| 18 | DX | Numeric input alongside inflation slider in popover | Taste | P1 Choose completeness | Allow custom and stress-test inflation scenarios beyond 12% | Hardcoded 12% max slider |
| 19 | Eng | Reconcile Task 5; no weighted scheme XIRR; aggregate backend estimatedTax | Mechanical | P1 Choose completeness | Prevent linear XIRR aggregation fallacy; preserve statutory oracle | Arithmetically weighted scheme XIRR |
| 20 | Eng | Strongly-typed HarvestTicketResponse & zero-any in App.tsx | Mechanical | P1 Choose completeness | Eliminate phantom struct and resolve Mandate 2 Zero-Any contract parity | Untyped JSON / any in App.tsx |
| 21 | Eng | Exit load schedule inspection with Parag Parikh 365-730d safeguard | Mechanical | P1 Choose completeness | Prevent recommending lots with active exit loads (e.g. Parag Parikh 1% exit load in year 2) | Blind >365d LTCG check |
| 22 | Eng | Accept Option<Decimal> in calculate_post_tax_real_xirr | Mechanical | P1 Choose completeness | Safely handle portfolios with undefined/non-convergent XIRR | False 0.00% display or panics |
| 23 | Eng | Closed-form proportional drag allocation | Mechanical | P1 Choose completeness | Guarantee mathematical identity XIRR_nom - sum(drags) = XIRR_real and avoid solver storm | Multiple Brent solver calls |
| 24 | Eng | Codify 5 CBDT statutory property tests in proptests.rs | Mechanical | P1 Choose completeness | Enforce Mandate 1 & 5 with watertight financial invariant oracles | Happy-path unit tests only |
| 25 | Eng | AbortController query cancellation on debounced settings change | Mechanical | P3 Pragmatic | Avoid backend thread storms and race conditions on rapid slider adjustments | Unbounded parallel requests |

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---|---|---|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | ISSUES OPEN | 5 proposals, 5 accepted, 0 deferred |
| Outside Review | Codex via autoplan | Independent 2nd opinion | 0 | unavailable | codex CLI not installed; native subagent in-host |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES OPEN | 11 issues, 0 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | ISSUES OPEN | 6 decisions, 0 unresolved |
| DX Review | `/plan-devex-review` | Developer experience gaps | 1 | ISSUES OPEN | 6 High, 4 Medium findings, TTHW 15m → <1m |

OUTSIDE COVERAGE: codex outside review unavailable (codex CLI not installed); in-host native subagents executed adversarial review for all phases.
VERDICT: CEO + DESIGN + DX + ENG CLEARED — ready to implement

NO UNRESOLVED DECISIONS

