# Phase 14: UI/UX Refinement & Polish - Discussion Log

**Date:** 2026-05-18
**Phase:** 14 (UI/UX Refinement & Polish)

## Summary of Decisions

### Scheme Breakdown Visualization
- **Question:** How should we improve the 'Scheme Breakdown' visualization?
- **User Feedback:** "right now, it doesn't even render. so there is no baseline for me to say what to improve. Fix that."
- **Decision:** Prioritize fixing the rendering (height issue) and enabling axes before considering style changes.

### Dark Mode Fix
- **Question:** What approach should we take for fixing dark mode contrast?
- **Options Presented:** Semantic Input Vars, Surgical Fixes.
- **User Selection:** **Semantic Input Vars**.
- **Rationale:** A systematic approach using variables ensures consistency and easier maintenance across all current and future forms.

## Deferred / Backlog
- Evaluating alternative chart types (Pie, Donut, Treemap) for the scheme breakdown.

## Next Steps
1. Run `/gsd:plan-phase 14` to create the implementation plan.
2. Fix the height and axes of the Scheme Breakdown chart in `App.tsx`.
3. Introduce semantic input variables in `index.css`.
4. Update all input-heavy components (App.tsx, AddAssetModal.tsx, etc.) to use the new variables.
