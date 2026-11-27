# Task 4 Brief: Frontend TypeScript Documentation, JSDoc & Type Cleansing (frontend/src)

## Task Objective
Enhance documentation, JSDoc (`/** ... */`), explanatory comments, eliminate `any` types, and refactor cryptic variable names across `frontend/src`:
1. `frontend/src/utils/consolidation.ts`:
   - Eliminate all `any` types: define strong interfaces for folio items (`FolioInput` or use `FolioView`) and internal maps.
   - Add comprehensive JSDoc for `consolidateFoliosIntoSchemes`, `sanitizeReturnRate`, and `ConsolidatedSchemeGroup`.
   - Explain value-weighted XIRR formula, day change percentage derivation, and multi-PAN deduplication.
   - Refactor short variables: `f` -> `folio`, `val` -> `folioValue`, `key` -> `groupKey`.
2. `frontend/src/utils/itrReportGenerator.ts`:
   - Add comprehensive JSDoc for `generateITRReport`, `AdvanceTaxAccrualMatrix`, `TableFQuarterData`, and Schedule CG data structures.
   - Add inline comments detailing statutory Section 55(2)(ac) grandfathering computations (`Math.max(cost, Math.min(fmv, salePrice))`), Table F quarterly symmetry invariants (sum of quarters must equal annual net capital gain), and post-Budget 2024 cutoff (July 23, 2024) split (`Q2a` vs `Q2b`).
   - Refactor short variables where appropriate to self-documenting names.
3. `frontend/src/components/Analytics/IntersectionView.tsx`:
   - Add JSDoc for `IntersectionView` component and props.
   - Add comments explaining look-through stock exposure calculation, multi-fund overlap badge logic, sector sorting, and the `excludeArbitrage` toggle effect on portfolio value denominators.

## Plan Excerpt
**Files:**
- Modify: `frontend/src/utils/consolidation.ts`
- Modify: `frontend/src/utils/itrReportGenerator.ts`
- Modify: `frontend/src/components/Analytics/IntersectionView.tsx`

## Steps
1. Refactor `frontend/src/utils/consolidation.ts`:
   - Eliminate `any[]` and replace with strongly-typed interfaces.
   - Rename `f` -> `folio`, `val` -> `folioValue`, etc.
   - Add JSDoc and explanatory comments.
2. Refactor `frontend/src/utils/itrReportGenerator.ts`:
   - Add JSDoc for types and helper functions.
   - Add statutory comments explaining Schedule CG Table F accrual calculations, loss set-offs, and Section 55(2)(ac) Fair Market Value bounds.
3. Update `frontend/src/components/Analytics/IntersectionView.tsx`:
   - Add JSDoc and explanatory comments for look-through stock exposure and arbitrage exclusion.
4. Verify frontend build and tests:
   - `(cd frontend && npm run build)` (must pass with zero TypeScript errors and zero warnings)
   - `(cd frontend && npm run test:unit)` (all 113 tests must pass)
5. Commit: `git add frontend/src && git commit -m "docs(frontend): add comprehensive JSDoc, eliminate any types in consolidation, and enhance code clarity"`.

## Constraints & Mandates
- Follow `AGENTS.md`: The Zero-Any Mandate (strict zero `any`); Universal Generality Mandate; The Invariant Oracle Law; Synthetic data only.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
