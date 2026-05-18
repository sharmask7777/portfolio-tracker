# Phase 11: Portfolio History Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 11-portfolio-history-engine
**Areas discussed:** Data Granularity & Sampling, Historical NAV Source, Calculation Strategy, Handling Alternative Assets

---

## Data Granularity & Sampling

| Option | Description | Selected |
|--------|-------------|----------|
| Daily (Full) | Every single day. Maximum precision for the interactive graph. | ✓ |
| Dynamic Sampling | Daily for last year, weekly/monthly for older data. Fast performance. | |
| Event-based + Periodic | Only on days where a transaction occurred + month-ends. | |

**User's choice:** Daily (Full)
**Notes:** User wants maximum precision for the interactive graph; every day matters.

---

## Historical NAV Source

| Option | Description | Selected |
|--------|-------------|----------|
| MFAPI.in (Historical) | Single call to get all history. Lightweight but depends on mfapi stability. | |
| AMFI Direct (Text Files) | Download and parse official NAV files. Highly reliable but high overhead. | ✓ |
| Other API | Fetch on-demand from a different provider. | |

**User's choice:** AMFI Direct (Text Files)
**Notes:** Preferred for reliability over simplicity.

---

## Calculation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| DB-backed Cache Table | Store calculated daily totals in DB for instant retrieval. Requires sync logic. | ✓ |
| Optimized On-the-fly | Calculate using in-memory unit tracking + cached historical NAVs. No DB sync needed. | |

**User's choice:** DB-backed Cache Table
**Notes:** To ensure performance for long-history calculations.

---

## Handling Alternative Assets

| Option | Description | Selected |
|--------|-------------|----------|
| Linear Accrual | Calculate daily accrued interest to show a smooth curve. | |
| Step Jumps (Actuals) | Show value jumps only on the actual date interest is credited. | ✓ |

**User's choice:** Step Jumps (Actuals)
**Notes:** For market-independent assets like EPF/PPF.

---

## Claude's Discretion

- **API Endpoint Design:** Nesting of member/family data in the history response.
- **Background Sync Logic:** Orchestration of the history population job.
- **Historical NAV Missing Data:** Interpolation/carry-forward strategy for missing dates.

## Deferred Ideas

- **Interactive Zoom/Pan:** Deferred to Phase 12 (Frontend).
- **Historical Insights (ATH/Max Invested):** Deferred to Phase 13.

---

*Phase: 11-portfolio-history-engine*
*Discussion log generated: 2026-05-18*
