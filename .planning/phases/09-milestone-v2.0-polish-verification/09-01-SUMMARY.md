---
phase: 9
plan: 01
subsystem: frontend
tags: [tax, simulation, ux, reactivity]
dependency_graph:
  requires: [Phase 8]
  provides: [Integrated Harvesting Flow, Metric Reactivity]
  affects: [TaxView, App, SimulationModal]
tech_stack:
  added: []
  patterns: [Auto-simulation on mount, Visual feedback for re-fetching]
key_files:
  - frontend/src/App.tsx
  - frontend/src/components/Tax/TaxView.tsx
  - frontend/src/components/Tax/SimulationModal.tsx
decisions:
  - Added initialUnits prop to SimulationModal to support auto-triggering from external flows.
  - Implemented isRefetching state in App.tsx to distinguish between initial load and background updates.
metrics:
  duration: 15m
  completed_date: "2026-05-17"
---

# Phase 9 Plan 01: Milestone v2.0 Polish & Verification Summary

Integrated Tax Harvesting flow and UI polish for metric reactivity. Users can now click harvesting opportunities to see instant tax simulations, and the dashboard provides clear visual feedback when tax slab changes trigger background re-calculations.

## Key Changes

### Integrated Tax Harvesting Flow
- **TaxView.tsx**: Added `onSimulateHarvest` callback. Harvesting opportunities are now clickable links that trigger the simulation.
- **SimulationModal.tsx**: Added `initialUnits` prop. When present on mount, the modal automatically calculates the sell amount and triggers the simulation analysis API immediately.
- **App.tsx**: Added `simUnits` state to track units being passed to the simulation modal. Wired `TaxView`'s harvesting clicks to open the modal with pre-filled units.

### Tax Slab Reactivity & Loading Visuals
- **App.tsx**: Added `isRefetching` state.
- **Metric Feedback**: The "Post-Tax XIRR / Return" column in the main holdings table now dims (opacity 0.5) while data is being re-fetched after a Tax Slab change, providing immediate visual feedback to the user.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- [x] Clicking a harvesting opportunity in the Tax tab opens SimulationModal.
- [x] SimulationModal triggers analysis immediately when opened via harvesting click.
- [x] Post-Tax column shows reduced opacity while re-fetching data after a Tax Slab change.
- [x] Each task committed individually with proper format.
- [x] STATE.md and ROADMAP.md updated.
