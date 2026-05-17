# Project Roadmap

## v1.0 Milestone - [Archived Roadmap](./milestones/v1.0-ROADMAP.md)

## Phase 6: E2E Testing Foundation
**Goal:** Establish a robust End-to-End testing suite for the frontend.
**Plans:** 4 plans

- [ ] 06-01-PLAN.md — Playwright Infrastructure & Setup
- [ ] 06-02-PLAN.md — Mocking Infrastructure & POMs
- [ ] 06-03-PLAN.md — Core E2E Flow - CAS Upload
- [ ] 06-04-PLAN.md — CI Integration

## Phase 7: Dynamic Returns & UX
**Goal:** Implement the ability to toggle between performance metrics.
*   Add a global "Performance Mode" toggle to the main dashboard.
*   Refactor frontend components to reactively switch between XIRR and Absolute Return.
*   Implement local storage persistence for user metric preferences.

## Phase 8: Advanced Metrics: Post-Tax XIRR
**Goal:** Introduce tax-aware performance tracking.
*   Extend the `TaxService` to calculate estimated tax liability on current holdings.
*   Implement the "Post-Tax XIRR" calculation logic in the backend.
*   Update the frontend holdings table to include the new Post-Tax XIRR metric.

## Phase 9: Milestone v2.0 Polish & Verification
**Goal:** Finalize v2.0 features and ensure E2E coverage.
*   Complete E2E test coverage for Tax and Family views.
*   Final UI/UX refinements for the new metric columns.
*   Milestone audit and completion.
