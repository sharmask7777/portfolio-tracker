# SDD ledger — plan: docs/superpowers/plans/2026-11-02-frontend-build-time-guardrails-and-pnpm.md

## Pre-flight Conflict Scan

| Task Pair / Task | Produces vs Consumes | Findings | Ruling |
| --- | --- | --- | --- |
| Task 1 -> Task 2 | Unified `pnpm` workspace & lockfile -> `pnpm --filter frontend typecheck` | Task 1 provides `pnpm` infrastructure; Task 2 uses `pnpm` to run strict TypeScript checks | Clean |
| Task 2 -> Task 3 | Type-safe indexed access in `src/` -> ESLint boundary & file conventions | Task 2 cleans typecheck; Task 3 adds boundary and naming lint rules | Clean |
| Task 3 -> Task 4 | ESLint boundary config -> `src/env.ts` with Zod | `src/env.ts` is in `src/` root or shared config; boundary rules must allow `src/api.ts` to import `src/env.ts` | Ruling: `src/env.ts` is classified as shared config/env, accessible by all elements — prevents circularity. |
| Task 4 -> Task 5 | `src/env.ts` & clean imports -> `knip` dead code sweep | Knip sweeps `src/main.tsx` and dependencies; must ignore generated Rust contracts | Ruling: Knip config ignores `src/types/generated/**` as mandated by Invariant Oracle Law and Zero-Any Mandate. |
| Task 5 -> Task 6 | `build:verify` script -> Documentation & Hermetic Sequence | Task 5 creates `build:verify`; Task 6 updates `AGENTS.md` and runs full test verification | Clean |

---

### Task 1: complete
- Commit: `c7e5434e65797ed18bbfabe9efcaa209a6f35fa8`
- Reviewer: c684ba4e-4ebc-41f8-8d2f-08a7d942d9cf (SPEC_APPROVED, QUALITY_APPROVED)

### Task 2: complete
- Commit: `eb570d8d1fd97f8ced23ec6fbe6b2eb7675e42dc`
- Reviewer: a46476e6-27ad-4310-ad9b-da79cc4d1417 (SPEC_APPROVED, QUALITY_APPROVED)

### Task 3: complete
- Commit: `05b6271`
- Reviewer: c8157bef-1fe7-45a6-8b37-c6f619c0a4ed (SPEC_APPROVED, QUALITY_APPROVED)

### Task 4: complete
- Commit: `a76f936`
- Reviewer: 5221c516-7b59-488f-8949-3d6c07515b51 (SPEC_APPROVED, QUALITY_APPROVED)

### Task 5: complete
- Commit: `cb6f527`
- Reviewer: b08fb445-2260-46af-a1ee-221f1a6d97b8 (SPEC_APPROVED, QUALITY_APPROVED)

### Task 6: complete
- Commit: `24b2c86`
- Reviewer: 6ad13b7a-a45f-4cfc-aabc-f68f48d3d208 (SPEC_APPROVED, QUALITY_APPROVED)
