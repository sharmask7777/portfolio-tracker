# Task 2 Brief: TypeScript Strictness Guardrails & Indexed Access Remediation

## Task Objective
Enforce strict TypeScript compiler flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `isolatedModules`) in `frontend/tsconfig.app.json`, add `"typecheck": "tsc -b --noEmit"` to `frontend/package.json`, and remediate any type errors across `frontend/src/` safely without using `any` or `!` assertion shortcuts.

## Plan Excerpt
- Modify: `frontend/tsconfig.app.json`
- Modify: `frontend/package.json`
- Modify: `frontend/src/` (remediate any indexed-access type errors)

## Steps
1. Update `frontend/tsconfig.app.json` `compilerOptions`:
   ```json
   "noUncheckedIndexedAccess": true,
   "exactOptionalPropertyTypes": true,
   "noImplicitReturns": true,
   "isolatedModules": true
   ```
2. Add `"typecheck": "tsc -b --noEmit"` to `frontend/package.json` `scripts`.
3. Run `pnpm --filter frontend typecheck` to detect all violations caused by `noUncheckedIndexedAccess` (e.g. `items[0]` having type `T | undefined`) or optional properties.
4. Safely remediate every violation in `frontend/src/`:
   - Use safe type narrowing: e.g. `const item = items[0]; if (!item) return;` or optional chaining `items[0]?.prop` or default fallback `items[0] ?? defaultValue`.
   - Never use `any` (violates Zero-Any Mandate).
   - Never use `!` non-null assertion shortcuts without safe prior check.
5. Verify clean typecheck: `pnpm --filter frontend typecheck` passes with 0 errors.
6. Verify unit tests and coverage: `pnpm --filter frontend test:unit` passes with 100% test pass rate and all coverage gates met.
7. Commit:
   `git add frontend/tsconfig.app.json frontend/package.json frontend/src`
   `git commit -m "feat(types): enforce strict typescript compiler guardrails with noUncheckedIndexedAccess"`
8. Write your report to `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/.superpowers/sdd/2026-11-02-frontend-build-time-guardrails-and-pnpm/task-2-report.md`.
9. Return a short message with your commit hash and summary of changed files. Do NOT dispatch any subagents.

## Constraints & Mandates
- Follow `AGENTS.md`: The Zero-Any Mandate (no `any` in TypeScript); The Invariant Oracle Law (do not alter assertion values or numerical bounds); Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
