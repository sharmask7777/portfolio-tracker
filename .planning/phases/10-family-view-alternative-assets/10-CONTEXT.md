# Phase 10: Family View & Alternative Assets - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Enable multi-member tracking by automatically splitting a single CAS statement into "Managed Profiles" based on PAN. This phase also introduces aggregate post-tax metrics for the entire family portfolio.

</domain>

<decisions>
## Implementation Decisions

### Multi-Member & Identity Model
- **D-01: Managed Profiles:** The system MUST implement "Managed Profiles" that live entirely under the primary user's account. No separate logins or emails are required for family members.
- **D-02: Auto-Splitting:** Upon CAS upload, the system MUST automatically detect unique PANs and create/assign folios to the corresponding Managed Profiles.
- **D-03: Member Naming:** Profiles should initially be identified by PAN (e.g., "PAN: ABC..."), allowing the user to rename them later (e.g., "Spouse", "Child").

### Aggregate Family Metrics
- **D-04: Post-Tax Priority:** High-level family aggregation MUST focus on Post-Tax metrics.
- **D-05: Global Stats Update:** The main dashboard "Stats Grid" (overall summary) MUST be updated to show:
    - **Post-Tax Total Value:** `Sum(Folio_Current_Value - Estimated_Tax)`.
    - **Overall Post-Tax XIRR:** Annualized return calculated using all family cashflows against the Post-Tax Total Value.
- **D-06: Symmetry:** The dashboard should still show Pre-Tax values for comparison, but Post-Tax is the primary verification target for this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Core
- `.planning/ROADMAP.md` — Phase 10 scope.
- `.planning/milestones/v3.0-REQUIREMENTS.md` — Milestone v3.0 requirements.

### Backend Services
- `backend/src/services/sync.service.ts` — Ingestion logic (to be modified for multi-PAN splitting).
- `backend/src/services/family.service.ts` — Existing family group logic (to be adapted for "Managed Profiles").
- `backend/src/services/performance.service.ts` — Core XIRR solver.

### Database
- `backend/prisma/schema.prisma` — Schema definitions for Folio, User, and Family.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SyncService`: Already extracts `investor.pan` from CAS data.
- `PerformanceService.calculateXIRR`: Can be called with aggregated transactions for family-level XIRR.

### Established Patterns
- **Folio Grouping:** Current `portfolio/summary` route aggregates folios. This logic needs to be extended to support `ManagedProfile` filtering.

### Integration Points
- **SyncService.syncPortfolio**: Needs to check for existing Managed Profiles for a PAN before creating new folios.
- **Dashboard Stats Grid**: Needs two new cards/slots for Post-Tax Total and Post-Tax XIRR.

</code_context>

<specifics>
## Specific Ideas
- "Managed Profiles" can be implemented as a new table or a lightweight grouping on the `Folio` table (e.g., a `profileId` or just grouping by `pan` if `User` links aren't strictly required for managed members).

</specifics>

<deferred>
## Deferred Ideas
- **EPF & PPF Tracking:** Explicitly moved out of scope for Phase 10 per user instruction.
- **Manual Asset Engine (SGB/Gold):** Deferred to a subsequent v3.0 phase.

</deferred>

---

*Phase: 10-Family View & Alternative Assets*
*Context gathered: 2026-05-17*
