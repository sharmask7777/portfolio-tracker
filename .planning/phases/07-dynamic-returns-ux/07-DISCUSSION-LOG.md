# Phase 7: Dynamic Returns & UX - Discussion Log

> **Audit trail only. Do not use as input to planning, research, or execution agents.**
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 7-Dynamic Returns & UX
**Areas discussed:** Toggle Placement, State Management, Visual Feedback & UX, Granularity of Toggles

---

## Toggle Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Global Header | Highest visibility, affects all tabs immediately. Consistent with Theme toggle. | ✓ |
| Overview Tab Only | Contextual; only visible when viewing metrics. Keeps the header clean. | |

**User's choice:** Global Header

---

## State Management

| Option | Description | Selected |
|--------|-------------|----------|
| React Context | Cleaner than prop-drilling; makes it easy for any component to read the active metric. | ✓ |
| Prop Drilling | Continue current pattern in App.tsx. | |

**User's choice:** React Context

---

## Default Metric

| Option | Description | Selected |
|--------|-------------|----------|
| XIRR (Default) | Industry standard for mutual funds. | ✓ |
| Absolute Return | Simpler for basic users. | |

**User's choice:** XIRR (Default)

---

## Transition Style

| Option | Description | Selected |
|--------|-------------|----------|
| Instant Swap | Feels faster and more "Bloomberg-like". | ✓ |
| Subtle Fade (CSS) | Softer transition. | |

**User's choice:** Instant Swap

---

## Metric Display

| Option | Description | Selected |
|--------|-------------|----------|
| Exclusive Toggle | Strictly one or the other. UI stays focused. | ✓ |
| Primary/Secondary View | Selected metric is primary, other metric is shown as secondary text. | |

**User's choice:** Exclusive Toggle

---

## Claude's Discretion

- Use segmented control [ XIRR | ABS ] in the header.
- Immediate localStorage sync.

## Deferred Ideas

- Post-Tax XIRR (Phase 8).
- Per-card metric overrides.
