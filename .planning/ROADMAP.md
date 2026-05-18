# Project Roadmap

## v1.0 Milestone - [Archived Roadmap](./milestones/v1.0-ROADMAP.md)

## v2.0 Milestone

## Phase 6: E2E Testing Foundation
**Goal:** Establish a robust End-to-End testing suite for the frontend.
**Plans:** 4/4 plans executed

- [x] 06-01-PLAN.md — Playwright Infrastructure & Setup
- [x] 06-02-PLAN.md — Mocking Infrastructure & POMs
- [x] 06-03-PLAN.md — Core E2E Flow - CAS Upload
- [x] 06-04-PLAN.md — CI Integration

## Phase 7: Dynamic Returns & UX
**Goal:** Implement the ability to toggle between performance metrics.
**Plans:** 2/2 plans executed

- [x] 07-01-PLAN.md — Infrastructure & Settings Context
- [x] 07-02-PLAN.md — Header Toggle & Reactive Swapping

## Phase 8: Advanced Metrics: Post-Tax XIRR
**Goal:** Introduce tax-aware performance tracking.
**Plans:** 2/2 plans executed

- [x] 08-01-PLAN.md — Backend Extension: Tax Service & XIRR Logic
- [x] 08-02-PLAN.md — Frontend Integration: Marginal Slab Setting & Table Updates

## Phase 9: Milestone v2.0 Polish & Verification
**Goal:** Finalize v2.0 features and ensure E2E coverage.
**Plans:** 2/2 plans executed

- [x] 09-01-PLAN.md — UI Polish & Harvesting Flow
- [x] 09-02-PLAN.md — Augmented Verification & Audit

## Milestone v3.0: Family & Alternatives

## Phase 10: Family View & Managed Profiles
**Goal:** Enable multi-member tracking from a single CAS via automatically created Managed Profiles and aggregated post-tax metrics.
**Plans:** 3 plans

- [ ] 10-01-PLAN.md — Managed Profiles Schema & Backend Service
- [ ] 10-02-PLAN.md — Multi-PAN CAS Splitting & Aggregation
- [ ] 10-03-PLAN.md — Family Dashboard & Navigation

## 1. Family View: Multi-Member Tracking
*   **Single CAS Splitting**: The system MUST detect different PANs in a single CAS upload and group folios accordingly.
*   **Member Mapping**: The user SHOULD be able to assign a "Name" to each unique PAN found in their data.
*   **Consolidated vs Individual View**: The dashboard MUST allow toggling between "Consolidated Family View" and individual "Member Views".

## 2. Alternative Assets
*   **Manual Assets**: Support for adding and tracking non-CAS assets:
    *   **EPF**: Annual compounding interest based on statutory rates.
    *   **PPF**: Annual compounding interest with a 15-year lock-in tracker.
    *   **SGB**: Half-yearly interest tracking and secondary market price integration.
    *   **Physical Gold**: Tracking by weight (grams) with live spot prices.

## 3. Documentation & Traceability
| Req ID | Requirement | Milestone | Status |
|---|---|---|---|
| V3-FAM-01 | Group folios by PAN (Multi-Member detection) | v3.0 | [ ] |
| V3-FAM-02 | Family Member Assignment UI | v3.0 | [ ] |
| V3-FAM-03 | Dashboard filtering by Member | v3.0 | [ ] |
| V3-ALT-01 | EPF Tracking (Compounding Interest) | v3.0 | [ ] |
| V3-ALT-02 | PPF Tracking (15-year lifecycle) | v3.0 | [ ] |
| V3-ALT-03 | Live Gold Price Integration | v3.0 | [ ] |
