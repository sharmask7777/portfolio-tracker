# UI Behavior & Consistency Specification

This reference defines the expected reactive behaviors and state transitions for the Portfolio Tracker UI. Audit these during quality reviews.

## 1. Performance Metric Toggle
- **Trigger**: Header toggle (XIRR / ABS).
- **Expectation**: 
  - Table columns `Return` or `XIRR` update across all rows.
  - Summary cards (Net Worth, Total Gain) remain consistent with the selection.
  - State is persisted in `localStorage` via `SettingsContext`.

## 2. Tax Slab Reactivity
- **Trigger**: Header input change.
- **Expectation**:
  - `Post-Tax XIRR` and `Estimated Tax` values are re-fetched.
  - **Visual Feedback**: Targeted columns show `opacity: 0.5` during the fetch.
  - Verification: If Slab increases, `Post-Tax XIRR` MUST decrease or stay equal.

## 3. Tax Harvesting Flow
- **Trigger**: Click on a scheme in the "Tax Optimization" tab.
- **Expectation**:
  - `SimulationModal` opens automatically.
  - `Units to Harvest` is pre-filled.
  - Results are displayed immediately (Automatic "Analyze Tax" trigger).

## 4. Family View Aggregation
- **Trigger**: Switching family members in the sidebar/header.
- **Expectation**:
  - Holdings table filtered to member-specific folios.
  - Summary Grid aggregates only the selected member's data.
  - Transition: No data "leakage" between members during re-render.

## 5. Error & Loading States
- **API Failure**: Global error toast or inline alert in the affected card.
- **Empty State**: CAS Upload prompt visible if no data exists for the selected user.
- **Loading Skeleton**: Visible during initial dashboard mount.
