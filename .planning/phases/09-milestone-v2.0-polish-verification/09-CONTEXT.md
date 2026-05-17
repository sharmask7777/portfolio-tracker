# Phase 9: Milestone v2.0 Polish & Verification - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Finalize v2.0 features and ensure E2E coverage. This includes polishing the Tax Harvesting simulation, ensuring slab-change reactivity, and augmenting UI tests for the new metric columns.

</domain>

<decisions>
## Implementation Decisions

### Tax Harvesting Simulation
- **D-01: Integrated Flow:** Clicking a scheme in the Tax Harvesting card (Tax Optimization tab) MUST open the `SimulationModal` with the "Units to Harvest" pre-filled for that folio.
- **D-02: Instant Analysis:** The modal should ideally trigger the simulation calculation immediately upon opening when pre-filled.

### Tax Slab Reactivity
- **D-03: Global Scope:** The Tax Slab setting remains global for v2.0 (persisted in `SettingsContext`). Per-family-member slabs are deferred.
- **D-04: Visual Feedback:** Add a subtle "Calculating..." overlay or opacity reduction to the "Post-Tax" column in the holdings table while the portfolio re-fetch (triggered by slab change) is in progress.

### Augmented UI Testing (E2E)
- **D-05: Priority Scenarios:**
    - **Scenario A:** Update Tax Slab in header → verify "Post-Tax XIRR" column in table updates correctly.
    - **Scenario B:** Click "Harvesting" scheme → verify `SimulationModal` opens with correct pre-filled values.
    - **Scenario C:** Invariant check: Verify "Post-Tax XIRR" is always less than or equal to "Pre-Tax XIRR".
- **D-06: Skill Delegation:** Implementation of these tests should be guided by `gsd-nyquist-auditor` to ensure robust coverage of the new v2.0 flows.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Core
- `.planning/ROADMAP.md` — Phase 9 scope.
- `.planning/REQUIREMENTS.md` — Milestone v2.0 requirements.

### Backend Logic
- `backend/src/services/harvesting.service.ts` — Harvesting opportunity logic.
- `backend/src/services/tax.service.ts` — Core tax calculation engine.

### Frontend Components & State
- `frontend/src/App.tsx` — Main dashboard hub and metric toggle logic.
- `frontend/src/contexts/SettingsContext.tsx` — Global settings for performance mode and tax slab.
- `frontend/src/components/Tax/SimulationModal.tsx` — Tax simulation UI.
- `frontend/src/components/Tax/TaxView.tsx` — Tax optimization dashboard.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SimulationModal`: To be triggered from `TaxView`'s harvesting list.
- `useSettings`: Used to track `taxSlab` changes in `App.tsx`.

### Established Patterns
- **Re-fetching on State Change:** `App.tsx` already uses `useEffect` to re-fetch when `taxSlab` or `selectedFamilyId` changes.

### Integration Points
- **TaxHarvesting Card:** Needs click handlers for the listed schemes.
- **Holdings Table:** Needs a loading state for the Post-Tax column.

</code_context>

<specifics>
## Specific Ideas

- The "Calculating..." overlay on the Post-Tax column should be minimal (e.g., `opacity: 0.5` or a small spinner) to not disrupt the user's view of existing data while updating.

</specifics>

<deferred>
## Deferred Ideas

- **Per-Family-Member Tax Slab:** Decided to keep it global for v2.0 simplicity.
- **Post-Tax Net Worth:** Deferred from Phase 8.
- **Detailed Tax Breakdowns in Table:** Deferred from Phase 8.

</deferred>

---

*Phase: 9-Milestone v2.0 Polish & Verification*
*Context gathered: 2026-05-17*
