# Phase 11: Portfolio History Engine - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement backend logic to calculate and serve daily historical portfolio values. This involves building an engine that tracks cumulative unit balances and pairs them with historical NAVs to produce a day-by-day "Invested vs Current" history for the entire portfolio duration.

</domain>

<decisions>
## Implementation Decisions

### Data Granularity & Performance
- **D-01: Full Daily History:** The engine MUST produce a data point for every single calendar day since the first transaction in the portfolio. Sampling or aggregation for older data was rejected in favor of maximum precision.
- **D-02: DB-backed Cache Table:** To ensure instant retrieval for the frontend, daily history totals MUST be stored in a dedicated database table (e.g., `PortfolioHistory`). This table will act as a cache that is updated upon new CAS uploads or manual asset additions.

### Market Data & Sources
- **D-03: AMFI Direct (Text Files):** Historical Mutual Fund NAVs MUST be sourced directly from official AMFI daily text files for maximum reliability. The system needs a robust ingestion pipeline to download, parse, and cache these historical rates.
- **D-04: Gold Price History:** Historical gold prices should be fetched from a reliable provider (e.g., Gold-API) or interpolated if daily precision is unavailable for older dates.

### Handling Alternative Assets
- **D-05: Step Jumps for EPF/PPF:** For non-market assets like EPF and PPF, the historical growth MUST be visualized as "Step Jumps" on the actual dates interest is credited, rather than linear daily accrual.

### Claude's Discretion
- **D-06: API Endpoint Design:** Exact structure of the `/portfolio/history` response (e.g., nesting of member/family data).
- **D-07: Background Sync Logic:** How and when the history table is populated (e.g., immediate sync vs queued background job).
- **D-08: Historical NAV Missing Data:** Strategy for handling missing dates in AMFI files (e.g., previous day carry-forward).

</decisions>

<specifics>
## Specific Ideas

- "I want maximum precision for the interactive graph, so every day matters."
- Use official AMFI sources because reliability is a priority over simple API calls.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Core
- `.planning/ROADMAP.md` — Phase 11 scope.
- `.planning/milestones/v4.0-REQUIREMENTS.md` — Milestone v4.0 requirements (Analytics & Visualization).

### Backend Logic
- `backend/src/services/market-data.service.ts` — Current market data fetching (to be extended for historical NAVs).
- `backend/src/services/performance.service.ts` — Core return calculation logic.
- `backend/src/utils/portfolio.utils.ts` — Transaction sorting and unit tracking utilities.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PortfolioUtils.sortTransactions`: Essential for chronological unit tracking.
- `CacheService`: Can be used to cache downloaded AMFI files before parsing.

### Established Patterns
- **Prisma Transactions:** Used in `purge` and `sync` routes. History population should likely be part of a transaction or a robust post-sync job.

### Integration Points
- **SyncService**: Needs to trigger history re-calculation after a successful CAS import.
- **Portfolio Routes**: New `GET /portfolio/history` endpoint to be added.

</code_context>

<deferred>
## Deferred Ideas

- **Interactive Zoom/Pan (Frontend):** This is a Phase 12 (Visualization) concern.
- **Historical Insights (ATH/Max Invested):** Deferred to Phase 13.

</deferred>

---

*Phase: 11-portfolio-history-engine*
*Context gathered: 2026-05-18*
