# Phase 13: Historical Insights & Metrics - Discussion Log

**Date:** 2026-05-18
**Phase:** 13 (Historical Insights & Metrics)

## Summary of Decisions

### Yearly Breakdown UI
- **Question:** How should the yearly ATH/Max Invested breakdown be presented?
- **Options Presented:** Toggle/Dropdown, Integrated List, Dedicated Tab.
- **User Selection:** **Integrated List**.
- **Rationale:** Keeps the data dense and visible without requiring extra clicks, fitting the "Bloomberg Terminal" aesthetic.

### Member-Level Stats
- **Question:** Should ATH/Max Invested metrics be specific to the selected family member?
- **Options Presented:** Profile-Aware, Consolidated-Only.
- **User Selection:** **Profile-Aware**.
- **Rationale:** Users want to see individual milestones for their family members (e.g., spouse's personal ATH) as well as the family total.

### Dashboard Integration
- **Question:** Where should these historical metrics be placed on the dashboard?
- **Options Presented:** New Overview Card, Insights Sidebar, StatsGrid Integration.
- **User Selection:** **New Overview Card**.
- **Rationale:** These milestones are significant enough to deserve dedicated visual space in the primary overview.

## Deferred / Backlog
- Year-on-Year growth comparisons.
- Benchmark comparisons for historical peaks.

## Next Steps
1. Run `/gsd:plan-phase 13` to create the implementation plan.
2. Extend `HistoryService` to include peak-finding logic.
3. Create the `HistoricalHighlights` card component in the frontend.
