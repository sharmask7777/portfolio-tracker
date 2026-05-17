# Phase 8: Advanced Metrics: Post-Tax XIRR - Discussion Log

> **Audit trail only. Do not use as input to planning, research, or execution agents.**
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 8-Advanced Metrics: Post-Tax XIRR
**Areas discussed:** Metric Scope, UI Layout, Tax Assumptions, API Integration

---

## Metric Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Symmetrical (Both) | Implement Post-Tax for both XIRR and Absolute Return. | ✓ |
| XIRR Only | Only implement Post-Tax for XIRR. | |

**User's choice:** Symmetrical (Both)

---

## UI Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Extra Column Only | Add a dedicated "Post-Tax" column to the holdings table. | ✓ |
| Global Net-of-Tax Mode | A toggle that converts all dashboard metrics to post-tax. | |

**User's choice:** Extra Column Only

---

## Tax Assumptions

| Option | Description | Selected |
|--------|-------------|----------|
| Assume 30% | Highest standard slab. | |
| Configurable Setting | Add a "Tax Slab" setting in SettingsContext. | ✓ |

**User's choice:** Configurable Setting. Research conducted on highest effective rates (39% - 42.7%).

---

## API Integration

| Option | Description | Selected |
|--------|-------------|----------|
| Aggregated Backend | Backend calculates and returns metrics in the main summary. | ✓ |
| Frontend Calculation | Frontend calculates using raw tax/transaction data. | |

**User's choice:** Aggregated Backend

---

## Claude's Discretion

- Default Tax Slab: 30%.
- Formula consistency: `Metric(Txs, Adjusted Value)`.

## Deferred Ideas

- Post-Tax Net Worth (Stats Cards).
- Tooltip tax breakdowns.
