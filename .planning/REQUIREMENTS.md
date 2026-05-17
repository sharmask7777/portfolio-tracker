# Requirements: Milestone v2.0

## 1. Dynamic Performance View
*   **Metric Toggle:** The UI MUST provide a global toggle (and per-asset override) to switch between Absolute Return (Gain/Invested) and XIRR.
*   **State Persistence:** The user's choice of performance metric SHOULD be persisted (local storage or user settings).

## 2. Advanced Returns: Post-Tax XIRR
*   **Net-of-Tax Calculation:** The system MUST calculate a "Post-Tax XIRR" for all holdings.
    *   Formula: `XIRR(cashflows + (current_value - estimated_tax_liability))`.
    *   Estimated tax must account for STCG/LTCG rates and grandfathering rules established in v1.0.
*   **Visual Distinction:** The Post-Tax XIRR SHOULD be displayed as a distinct column or a secondary metric to avoid confusion with Pre-Tax XIRR.

## 3. Quality Assurance: E2E UI Testing
*   **E2E Framework:** The project MUST integrate an E2E testing framework (Playwright preferred).
*   **Core Flow Coverage:**
    *   CAS Upload and Parsing flow.
    *   Dashboard rendering and metric toggling.
    *   Tax simulation and harvesting flows.
    *   Family aggregation views.
*   **CI Integration:** The E2E suite SHOULD run as part of the CI pipeline.

## 4. Documentation & Traceability
| Req ID | Requirement | Milestone | Status |
|---|---|---|---|
| V2-DYN-01 | Global XIRR/Absolute toggle | v2.0 | [x] |
| V2-TAX-01 | Post-Tax XIRR Calculation | v2.0 | [x] |
| V2-TAX-02 | Tax liability deduction from final value | v2.0 | [ ] |
| V2-E2E-01 | Playwright Integration | v2.0 | [ ] |
| V2-E2E-02 | CAS Upload E2E Test | v2.0 | [ ] |
| V2-E2E-03 | Dashboard/Tax View E2E Tests | v2.0 | [ ] |
