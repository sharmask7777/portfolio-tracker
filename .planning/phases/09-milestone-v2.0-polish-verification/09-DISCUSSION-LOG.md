# Phase 9: Milestone v2.0 Polish & Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 9-Milestone v2.0 Polish & Verification
**Areas discussed:** Harvesting Simulation UX, Tax Slab Scope, UI Testing Scenarios, Slab Reactivity Polish

---

## Harvesting Simulation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Manual Trigger | User opens modal and types amount | |
| Integrated Trigger | Clicking harvesting list pre-fills and opens modal | ✓ |

**User's choice:** Integrated Trigger.
**Notes:** Clicking a scheme in the list should automatically open the Simulation Modal with "Units to Harvest" pre-filled.

---

## Tax Slab Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Global Slab | Single setting for all members (v2.0) | ✓ |
| Per-Member Slab | Custom slab per family member | |

**User's choice:** Global Slab.
**Notes:** Solve family view (per-member slabs) in a later phase.

---

## UI Testing Scenarios

| Option | Description | Selected |
|--------|-------------|----------|
| Approved Scenarios | Scenarios A, B, and C as proposed | ✓ |

**User's choice:** Approved.
**Notes:** Augmented and enhanced UI tests are a priority. Delegation to relevant GSD skills is requested.

---

## Slab Reactivity Polish

| Option | Description | Selected |
|--------|-------------|----------|
| Instant Re-fetch | No extra UI feedback | |
| Calculating Overlay | Visual cue during Post-Tax re-calculation | ✓ |

**User's choice:** Calculating Overlay.
**Notes:** Subtle overlay sounds good to indicate the Post-Tax columns are updating.

---

## Deferred Ideas

- Per-family-member Tax Slab settings.
- Integration of deferred ideas from Phases 7-8 (Post-Tax Net Worth, etc.).
