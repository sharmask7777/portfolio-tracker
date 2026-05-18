# Phase 12: Interactive History Visualization - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Create a responsive, interactive AreaChart on the frontend to visualize historical corpus movement (Invested vs Current Value). Includes data fetching from the `/portfolios/:id/history` endpoint and time-range navigation.

</domain>

<decisions>
## Implementation Decisions

### Time Range Selection
- **D-01:** Standard presets only (1M, 3M, 6M, 1Y, 3Y, 5Y, ALL).
- **D-02:** No custom date picker or Brush slider to keep the UI clean and mobile-friendly.

### Chart Presentation
- **D-03:** Overlapping Areas for 'Invested Amount' and 'Current Value'.
- **D-04:** Use transparent fills for both areas so the Profit/Loss gap is always visible.
- **D-05:** Recharts `AreaChart` component is the standard.

### Tooltip Interactivity
- **D-06:** Comprehensive Tooltip showing: Date, Current Value, Invested Amount, Unrealized Gain/Loss (₹), and Gain Percentage (%).

### Performance/Sampling
- **D-07:** Dynamic Sampling on the frontend. If the selected range is long (e.g., ALL), reduce resolution (e.g., weekly/monthly points) before rendering to Recharts to ensure smooth interactions.

### Claude's Discretion
- Exact color palette (should align with existing brand colors in `ui-brand.md`).
- Tooltip styling and exact placement.
- Empty state handling if history is unavailable.

</decisions>

<specifics>
## Specific Ideas

- "I want it to feel like Zerodha's or Kuvera's history charts — clean and informative."

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone v4.0 Planning
- `.planning/milestones/v4.0-REQUIREMENTS.md` — Detailed requirements for analytics milestones.
- `.planning/ROADMAP.md` — Phase 12 goal and description.

### Backend API
- `.planning/phases/11-portfolio-history-engine/11-CONTEXT.md` — Defines the history API endpoint and data format.

### Design System
- `.gemini/get-shit-done/references/ui-brand.md` — Color variables and styling guidelines.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/Analytics/XRayView.tsx`: Demonstrates Recharts usage (BarChart, PieChart, Treemap) and `ResponsiveContainer`.
- `Card` component: For wrapping the chart.

### Established Patterns
- Data fetching using `axios`.
- Thematic styling using CSS variables (e.g., `var(--accent-color)`, `var(--text-primary)`).

### Integration Points
- `Dashboard`: The history chart should likely be placed prominently on the main dashboard.
- `SettingsContext`: May be needed for currency or return type preferences if they affect the chart.

</code_context>

<deferred>
## Deferred Ideas

- Custom date range picker — add to backlog.
- Chart syncing across different metrics — future analytics phase.

</deferred>

---

*Phase: 12-interactive-history-visualization*
*Context gathered: 2026-05-18*
