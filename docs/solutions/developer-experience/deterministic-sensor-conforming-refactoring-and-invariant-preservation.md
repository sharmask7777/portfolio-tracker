---
title: "Deterministic Sensor-Conforming Refactoring & Invariant Preservation"
date: "2026-11-17"
category: "developer-experience"
problem_type: "best_practice"
module: "frontend"
component: "maintainability-sensors"
tags:
  - "maintainability-sensors"
  - "code-quality"
  - "cyclomatic-complexity"
  - "zero-any"
  - "exact-optional-properties"
  - "hermetic-verification"
  - "invariants"
status: "verified"
applies_when:
  - "Refactoring dense frontends with strict TypeScript compiler options (such as exactOptionalPropertyTypes: true)"
  - "Enforcing maintainability sensors (function length, file length, cyclomatic complexity, no-explicit-any) across large existing codebases"
  - "Decomposing high-complexity utility files into single-responsibility submodules while maintaining public contract parity"
---

# Deterministic Sensor-Conforming Refactoring & Invariant Preservation

## Context
When large, multi-domain web applications evolve rapidly under AI-assisted development, components and utilities often accumulate excessive responsibilities, unchecked cyclomatic complexity, and large file lengths. To enforce long-term code quality, the repository adopted strict maintainability sensors inspired by Martin Fowler and Birgitta Böckeler's *Sensors for Coding Agents*:
- Maximum lines per function: $\le 120$
- Maximum cyclomatic complexity per function: $\le 15$
- Maximum lines per file: $\le 600$
- Maximum parameters per function: $\le 4$
- Zero `any` types (`@typescript-eslint/no-explicit-any`: error)

Applying these sensors across 70+ interconnected frontend files in `frontend/src/` risked subtle regressions in financial domain math, UI reactivity, and compilation breaks unless executed deterministically.

## Guidance

### 1. Atomic Decomposition with Contract Parity
When breaking apart monolithic domain utilities (e.g. `hierarchy-builder.ts`, `itr-report-generator.ts`, `sorting.ts`) into specialized submodules (`-types.ts`, `-invariants.ts`, `-formatters.ts`, `-builder.ts`):
- Maintain public re-exports on the original entry point. External modules and existing test suites should not suffer `TS2305: Module has no exported member` breakage.
- Keep Knip production audits clean by configuring known entry-point re-export exceptions in `knip.json` under `ignoreIssues`.

### 2. Navigating `exactOptionalPropertyTypes: true`
With strict TypeScript compiler flags (`exactOptionalPropertyTypes: true`), an optional property `other?: T` does **not** allow assigning `undefined` unless explicitly declared as `other?: T | undefined`:
- In domain data models and UI props, declare optional subfields as `other?: T | undefined` when consumer transformations pass optional or partial structures.
- In event callbacks returning optional strings (`(id?: string) => void`), explicitly narrow before calling state updaters (`if (id) setState(id)`), preventing `TS2345: Argument of type 'string | undefined' is not assignable to 'SetStateAction<string>'`.

### 3. The 4-Tier Component Extraction Hierarchy
Deconstruct complex React components exceeding 120 lines or complexity $> 15$ into single-responsibility tiers:
1. **Container / Orchestrator:** Manages top-level hooks, routing, and high-level layout.
2. **Presentational Subcomponents:** Pure visual views receiving narrow, typed props (e.g. `InvestedCapitalCard`, `HistoryChartArea`).
3. **Dedicated Interactive Modals & Forms:** Isolated state machines (e.g. `SimulationForm`, `GoalEditForm`).
4. **Pure Calculation & Helper Utilities:** Extracted to co-located `*-calculations.ts` or `*-utils.ts` with zero JSX dependencies, allowing isolated unit testing.

### 4. Hermetic Deterministic Verification Sequence
Never declare a refactor complete without verifying financial and behavioral invariants across both frontend and backend boundaries:
- **Static Privacy & PII:** Run `scripts/check-privacy-and-pii.py` to prevent synthetic or real data leaks.
- **Backend Differential Parity:** Run `backend-rs/scripts/verify.sh` to ensure statutory tax rates (Budget 2024 LTCG 12.5%, Section 112A ₹1.25L exemption, grandfathering Section 55(2)(ac)) and portfolio parity match within precision limits ($\Delta \le ₹0.01$).
- **Frontend Determinism E2E:** Execute Playwright E2E tests validating that UI state transitions, sorting stability, and metric calculations produce identical outputs regardless of sorting order or display mode toggles (`XIRR` vs `ABS`).

## Examples

### Before: Monolithic Component with High Complexity and Explicit Any
```tsx
// Exceeds max-lines, max-lines-per-function (900+ lines), complexity 46, and uses any
export function StatsGrid({ portfolio, onSimulate, ...props }: any) {
  // Mixed state, inline modal logic, complex drag calculations, and multiple JSX tables
  ...
}
```

### After: Modular Single-Responsibility Composition
```tsx
// StatsGrid.tsx decomposes into clean, typed subcomponents
export function StatsGrid({ portfolio, onSimulate, ...props }: StatsGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <NetWorthCard metrics={portfolio.metrics} />
      <InvestedCapitalCard metrics={portfolio.metrics} />
      <PerformanceCard metrics={portfolio.metrics} />
      <RealityCheckModeToggle />
    </div>
  );
}
```

## Why This Matters
- **AI Agent Modifiability:** Future agent turns and human engineers can reason about, modify, and test subcomponents without navigating 1,000-line files or hitting cross-domain side effects.
- **Invariant Safety:** The refactoring does not alter runtime behavior or calculation results, maintaining 100% compliance with financial and statutory invariants codified in golden tests.
- **Continuous Enforcement:** Sensor rules enforced at build time (`pnpm build:verify`) prevent gradual entropy and stop complex, monolithic code patterns from being reintroduced.
