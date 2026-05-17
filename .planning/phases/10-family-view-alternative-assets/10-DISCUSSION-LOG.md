# Phase 10: Family View & Alternative Assets - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 10-Family View & Alternative Assets
**Areas discussed:** Multi-PAN Splitting, Identity Model, Alternative Assets Scope, Aggregate Metrics

---

## Multi-PAN Splitting Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic Managed Profiles | System creates profiles per PAN instantly | ✓ |
| Manual Mapping Pause | System asks user to map PANs during upload | |

**User's choice:** Automatic.
**Notes:** System should just handle it and create the profiles.

---

## Identity Model

| Option | Description | Selected |
|--------|-------------|----------|
| User-Account Based | Separate logins/emails for family members | |
| Managed Profiles | Sub-profiles under a single primary account | ✓ |

**User's choice:** Managed Profiles.
**Notes:** Avoid the friction of separate logins.

---

## Alternative Asset Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Include EPF/PPF | SIP or Balance updates for fixed income | |
| Defer EPF/PPF | Focus purely on CAS Family View splitting | ✓ |

**User's choice:** Defer.
**Notes:** Keep EPF and PPF out of scope for now.

---

## Family Aggregate Metrics

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-Tax High Level | Keep dashboard summary simple | |
| Post-Tax High Level | Show Post-Tax Total and Post-Tax XIRR for family | ✓ |

**User's choice:** Post-Tax High Level.
**Notes:** Specifically show Post-Tax Total and Post-Tax XIRR for the entire portfolio in the global view.

---

## Deferred Ideas
- EPF/PPF Tracking.
- SGB/Gold Integration.
- Manual contribution entry flow.
