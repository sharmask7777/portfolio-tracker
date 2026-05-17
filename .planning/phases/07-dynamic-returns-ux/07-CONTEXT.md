# Phase 7: Dynamic Returns & UX - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement a global performance metric toggle (XIRR vs. Absolute Return) with state persistence and React Context integration. This phase focuses on the UI/UX infrastructure to swap metrics reactively across the entire dashboard.

</domain>

<decisions>
## Implementation Decisions

### Toggle Placement & UI
- **D-01:** The primary toggle will live in the **Global Header**, next to the Theme Toggle.
- **D-02:** Use a segmented control or button group (e.g., [ XIRR | ABS ]) for clarity.

### State Management & Persistence
- **D-03:** Introduce a `SettingsContext` to manage global UI preferences (Theme, Performance Metric).
- **D-04:** **Default Metric:** XIRR.
- **D-05:** **Persistence:** Save preferences to `localStorage` immediately upon change.

### Visual Feedback & UX
- **D-06:** **Transition:** Use an "Instant Swap" approach (no animations) to maintain a fast, professional feel.
- **D-07:** Titles and labels in the Stats Grid and Data Table MUST update dynamically based on the active metric (e.g., "Overall XIRR" becomes "Total Return").

### Granularity
- **D-08:** **Exclusive Toggle:** The UI will show only the selected metric at a time to keep the interface clean and data-dense.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core Requirements
- `.planning/REQUIREMENTS.md` §1 — Dynamic Performance View requirements.
- `.planning/ROADMAP.md` — Phase 7 scope.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `App.tsx`: Current hub of state; needs to be refactored to use `SettingsContext`.
- `formatPercent`: Utility function to be used for both metrics.

### Established Patterns
- **Theme Toggling:** The existing theme toggle pattern (setting `data-theme` on `documentElement`) should be mirrored or integrated into the `SettingsContext`.

### Integration Points
- **Stats Cards:** Individual card values and labels must be made reactive to the context.
- **Data Table:** The "XIRR" column header and cell values must swap based on context.

</code_context>

<specifics>
## Specific Ideas

- Implement a custom hook `useSettings()` to easily access `performanceMode` and `setPerformanceMode`.
- Ensure the `BarChart` in the breakdown section also updates its tooltips and axis labels (if any) to reflect the chosen metric if applicable (though currently it shows Current Value).

</specifics>

<deferred>
## Deferred Ideas

- **Post-Tax XIRR:** This is scoped for Phase 8.
- **Per-Card Overrides:** Strictly global toggle for now; per-card granularity deferred to future UX polish.

</deferred>

---

*Phase: 7-Dynamic Returns & UX*
*Context gathered: 2026-05-18*
