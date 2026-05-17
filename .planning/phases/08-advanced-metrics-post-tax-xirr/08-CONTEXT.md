# Phase 8: Advanced Metrics: Post-Tax XIRR - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduce tax-aware performance tracking by calculating and displaying "Post-Tax" returns (XIRR and Absolute) for all holdings. This involves backend calculation logic integration and UI updates to display these "money-in-pocket" metrics.

</domain>

<decisions>
## Implementation Decisions

### Metric Scope & Calculation
- **D-01: Symmetrical Post-Tax Metrics:** Implement Post-Tax variants for both **XIRR** and **Absolute Return**. The UI will toggle between these pairs based on the Phase 7 Performance Mode.
- **D-02: Formula:** `Post-Tax Metric = Metric(Transactions, Current Value - Estimated Tax Liability)`.
- **D-03: Aggregated Backend:** Calculation logic resides in the backend. The `PortfolioService` will call `TaxService` to get unrealized tax for each folio and then call `PerformanceService` with the adjusted current value.

### Tax Assumptions & Settings
- **D-04: Configurable Tax Slab:** Add a `taxSlab` setting to `SettingsContext` (persisted to `localStorage`). 
- **D-05: Slab Application:** This rate will be applied to assets classified as **"SLAB"** in `TaxService` (e.g., Debt MFs bought after April 2023). 
- **D-06: Research-backed Default:** Default the Tax Slab to **30%**. Note that the highest effective rate in India can reach **42.744%** (Old Regime) or **39%** (New Regime), but for Capital Gains, the surcharge is capped at 15% (effective max ≈ **35.88%**). The setting should allow user input for these specific cases.

### UI Layout
- **D-07: Dedicated Column:** Add a permanent "Post-Tax" column to the holdings table. 
- **D-08: Reactive Labels:** The column header will swap between "Post-Tax XIRR" and "Post-Tax Return" based on the global Performance Mode toggle.
- **D-09: Stats Grid Exclusion:** The main stats cards (Net Worth, Overall Gain) will remain **Pre-Tax** for now to avoid complexity in global re-aggregation, focusing the post-tax view on individual holdings.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Core
- `.planning/ROADMAP.md` — Phase 8 scope.
- `.planning/REQUIREMENTS.md` §2 — Advanced Returns: Post-Tax XIRR.

### Backend Services
- `backend/src/services/tax.service.ts` — Existing tax calculation and lot depletion logic.
- `backend/src/services/performance.service.ts` — XIRR and Absolute return calculation methods.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TaxService.calculatePortfolioTax`: Already calculates unrealized tax components.
- `PerformanceService.calculateXIRR`: The core solver integration.
- `SettingsContext`: Needs to be expanded with the new `taxSlab` setting.

### Established Patterns
- **Backend JSON Response:** The `portfolio/summary` endpoint structure should be extended to include `postTaxXirr` and `postTaxAbsoluteReturn` inside the `metrics` object of each folio.

### Integration Points
- **Settings Modal/Header:** Needs a way for users to adjust their Tax Slab.
- **Holdings Table (`App.tsx`):** Needs the new column and reactive logic.

</code_context>

<specifics>
## Specific Ideas

- The backend should ensure that if an asset has zero unrealized gain (or a loss), the Post-Tax metric equals the Pre-Tax metric.
- Estimated Tax Liability should consider grandfathering and Budget 2024 rules already implemented in `TaxService`.

</specifics>

<deferred>
## Deferred Ideas

- **Post-Tax Net Worth:** Globally aggregating post-tax values for the main net worth card is deferred to future UX polish.
- **Detailed Tax Breakdowns in Table:** Hovering over the Post-Tax metric to see the tax breakdown (LTCG/STCG components) is deferred.

</deferred>

---

*Phase: 8-Advanced Metrics: Post-Tax XIRR*
*Context gathered: 2026-05-18*
