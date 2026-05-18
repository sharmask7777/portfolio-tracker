# Phase 13: Historical Insights & Metrics - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement a statistics engine to identify portfolio milestones (ATH Corpus, Max Invested) and surface them in a high-fidelity "Historical Highlights" card on the dashboard. This includes both the backend calculation logic and the frontend UI components.

</domain>

<decisions>
## Implementation Decisions

### Dashboard Integration
- **D-01: New Overview Card:** A dedicated "Historical Highlights" card will be added to the main `Overview` tab, placed near the History Chart and Scheme Breakdown.
- **D-02: Profile-Aware Stats:** Metrics (ATH, Max Invested) MUST change based on the selected family member or consolidated view. This ensures consistency with the `StatsGrid` and `HistoryChart`.

### Metric Presentation
- **D-03: Primary Milestones:** The top of the card will prominently display the "All-Time High Corpus" (Value & Date) and "Maximum Invested" (Value & Date).
- **D-04: Integrated Yearly List:** Below the primary milestones, the card will include an integrated, scrollable list/table showing the ATH and Max Invested for the last 3-5 calendar years.

### Backend & Calculation
- **D-05: Calculation Source:** The statistics engine MUST use the `PortfolioHistory` database table as its source of truth. It will scan the historical values to find global and yearly local maxima.
- **D-06: Endpoint:** A new endpoint `GET /portfolios/:id/stats` (or similar) will be created to serve these metrics.

### Claude's Discretion
- Visual styling of the milestones (e.g., using icons like `TrendingUp` or `Trophy`).
- Exact layout and spacing of the yearly breakdown list.
- Handling of "Max Invested" peak logic—ensuring it reflects the highest point on the invested curve.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone v4.0 Planning
- `.planning/milestones/v4.0-REQUIREMENTS.md` — Detailed requirements for analytics milestones.
- `.planning/ROADMAP.md` — Phase 13 goal and description.

### Existing Backend Services
- `backend/src/services/history.service.ts` — Provides the `PortfolioHistory` data.
- `backend/src/routes/portfolio.routes.ts` — Existing portfolio endpoints.

### Design System
- `.gemini/get-shit-done/references/ui-brand.md` — Color variables and styling guidelines.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Card` component and `StatsGrid` styling for consistency.
- `HistoryService`: The foundation for all historical calculations.

### Integration Points
- `Dashboard`: The card needs to be placed in the `Overview` layout in `App.tsx`.
- `PortfolioRoutes`: Needs a new route to serve the stats.

</code_context>

<deferred>
## Deferred Ideas

- Comparative "Year-on-Year" growth metrics (CAGR per year).
- Benchmarking against indices (e.g., Nifty 50) for historical peaks.

</deferred>

---

*Phase: 13-historical-insights-metrics*
*Context gathered: 2026-05-18*
