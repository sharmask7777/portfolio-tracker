# Phase 14: UI/UX Refinement & Polish - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Resolve critical UI/UX bugs identified in Milestone v4.0. This includes fixing the non-rendering "Scheme Breakdown" chart and standardizing dark mode accessibility through semantic CSS variables for input elements.

</domain>

<decisions>
## Implementation Decisions

### Scheme Breakdown Fix
- **D-01: Fix Rendering:** Add a mandatory height (e.g., `300px`) to the chart container in `App.tsx` to enable `ResponsiveContainer`.
- **D-02: Enable Axes:** Remove `hide` from `XAxis` and `YAxis` to provide a baseline for the user to evaluate the visualization.
- **D-03: Labels:** Rotate or truncate XAxis labels if they overlap due to long scheme names.

### Dark Mode & Accessibility
- **D-04: Semantic Input Variables:** Introduce `--input-bg`, `--input-border`, and `--input-text` in `index.css`.
- **D-05: Global Application:** Update all `input`, `select`, and `textarea` elements (and their respective modal wrappers) to use these variables, ensuring high contrast in dark mode.
- **D-06: Badge Contrast:** Review and fix any badge components (e.g., `badge-slab`) that have poor contrast in dark mode.

### Claude's Discretion
- Exact height for the breakdown chart.
- Specific color values for the new semantic input variables (aligning with `ui-brand.md`).
- Tooltip styling refinements for the breakdown chart.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone v4.0 Planning
- `.planning/milestones/v4.0-REQUIREMENTS.md` — Detailed requirements for UI/UX polish.
- `.planning/ROADMAP.md` — Phase 14 goal and description.

### Design System
- `.gemini/get-shit-done/references/ui-brand.md` — Color variables and styling guidelines.
- `frontend/src/index.css` — Central theme definition.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `index.css`: The place to add semantic variables.
- `App.tsx`: The location of the broken Scheme Breakdown chart.

### Integration Points
- `Modals`: Several modals (AddAsset, Rename, etc.) use custom input styling that needs to be updated.

</code_context>

<deferred>
## Deferred Ideas

- Switching to Pie/Donut/Treemap for the breakdown—postponed until the baseline fix is verified.
- Full UI audit—deferred to post-v4.0 stabilization.

</deferred>

---

*Phase: 14-ui-ux-refinement-polish*
*Context gathered: 2026-05-18*
