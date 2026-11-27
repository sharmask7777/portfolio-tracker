# Task 2 Report: TypeScript Strictness Guardrails & Indexed Access Remediation

## Execution Summary
- **Target**: Enforce strict TypeScript compiler flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `isolatedModules`), add `"typecheck": "tsc -b --noEmit"` to `frontend/package.json`, and remediate all type errors across `frontend/src/` safely without `any` or loose `!` assertions.
- **Commit**: `eb570d8d1fd97f8ced23ec6fbe6b2eb7675e42dc`
- **Result**: 100% clean typecheck (`tsc -b --noEmit` exits with 0 errors), 100% unit test pass rate (22/22 test files, 113/113 tests), and all Vitest coverage thresholds exceeded.

## Modifications

1. **`frontend/tsconfig.app.json`**:
   - Added strict compiler options:
     - `"noUncheckedIndexedAccess": true`
     - `"exactOptionalPropertyTypes": true`
     - `"noImplicitReturns": true`
     - `"isolatedModules": true`

2. **`frontend/package.json`**:
   - Added `"typecheck": "tsc -b --noEmit"` script.

3. **Compiler Error Remediation in `frontend/src/`**:
   - `src/api.test.ts`: Added explicit undefined guards for axios request and response interceptor handlers instead of unverified indexed accesses.
   - `src/App.tsx`: Added safe guard check for `top` performing asset group before accessing its metrics.
   - `src/components/Analytics/XRayDashboard.tsx`: Added fallback color string for `COLORS[index % COLORS.length] ?? '#3b82f6'`.
   - `src/components/Family/FamilySelector.test.tsx`: Narrowed button elements from `screen.getAllByTitle` before dispatching click events.
   - `src/components/Insights/GoalTracker.tsx`: Added null-coalescing fallback string for ISO date split array index.
   - `src/components/Tax/SimulationModal.tsx`: Updated `SimulationModalProps.initialUnits` to `number | undefined` for strict compatibility with `exactOptionalPropertyTypes`.
   - `src/components/Tax/SimulationModal.test.tsx`: Used typed cast for regression test case without `any`.
   - `src/components/Tax/TaxView.tsx`: Safely coalesced `fy.split('-')[0] ?? ''` and `selectedFY.split('-')[0] ?? ''` in year integer parsing.
   - `src/components/Tax/TaxView.test.tsx`: Safely checked presence of `mockSummary.details[0]` and replaced `as any` with `as unknown as number`.
   - `src/utils/consolidation.ts`:
     - Added `| undefined` across optional interfaces (`FolioAssetInfo`, `FolioMetricsInput`, `FolioInput`, `ConsolidatedSchemeGroup`) to conform with `exactOptionalPropertyTypes`.
     - Narrowed `firstFolio` and single-folio fast path with safe checks.
   - `src/utils/consolidation.test.ts`:
     - Narrowed index access in consolidation assertions.
     - Replaced `as any` with `as unknown as number` and `undefined`.
   - `src/utils/itrReportGenerator.ts`: Added safe coalescing `split('-')[0] ?? ''` in `computeAY`, tax calculation, `verifyItrInvariants`, and report generation.
   - `src/utils/mock-portfolios.test.ts`: Narrowed array elements and replaced `any[]` with `FolioInput[]`.
   - `src/utils/sorting.test.ts`: Used safe optional chaining and index access checks in sort unit test assertions.

## Verification
- `pnpm --filter frontend typecheck`: 0 errors.
- `pnpm --filter frontend test:unit`: 22/22 test files passed (113/113 tests passed).
  - Lines: 90.04% (Gate >= 88%)
  - Statements: 88.13% (Gate >= 86%)
  - Functions: 87.82% (Gate >= 85%)
  - Branches: 67.37% (Gate >= 65%)
- `pnpm --filter frontend build`: Passed cleanly (`tsc -b && vite build`).
