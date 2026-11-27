# Task 5 Brief: Dead Code Auditing (`knip`) & Build Verification Pipeline

## Task Objective
Install `knip` as a devDependency in `frontend/`, configure `frontend/knip.json` for a Vite React SPA ensuring `src/types/generated/**` (the Rust contract parity files) are explicitly ignored from dead-code deletion, add `"knip": "knip --production"` and `"build:verify": "pnpm lint && pnpm typecheck && pnpm knip"` scripts to `frontend/package.json`, update `"build": "pnpm build:verify && vite build"`, and verify that `build:verify` and `build` execute with 0 errors.

## Plan Excerpt
- Modify: `frontend/package.json`
- Create: `frontend/knip.json`

## Steps
1. Install `knip` in `frontend`:
   `pnpm --filter frontend add -D knip`
2. Configure `frontend/knip.json`:
   ```json
   {
     "$schema": "https://unpkg.com/knip@5/overview/configuration-schema.json",
     "entry": [
       "src/main.tsx!",
       "src/test/setup.ts"
     ],
     "project": [
       "src/**/*.{ts,tsx}!"
     ],
     "ignore": [
       "src/types/generated/**"
     ],
     "ignoreDependencies": [
       "@vitest/ui",
       "@testing-library/jest-dom",
       "@axe-core/playwright"
     ]
   }
   ```
3. Update `frontend/package.json` scripts:
   - `"knip": "knip --production"`
   - `"build:verify": "pnpm lint && pnpm typecheck && pnpm knip"`
   - `"build": "pnpm build:verify && vite build"`
4. Run `pnpm --filter frontend knip` and resolve any genuine dead code or configure necessary ignore entries.
5. Verify:
   - `pnpm --filter frontend build:verify` passes with exit code 0.
   - `pnpm --filter frontend build` passes with exit code 0.
   - `pnpm --filter frontend test:unit` passes with 100% tests and coverage thresholds met.
6. Commit:
   `git add frontend/package.json frontend/knip.json pnpm-lock.yaml` (plus any remediated files)
   `git commit -m "feat(ci): add knip dead-code sweeper and configure build:verify pipeline"`
7. Write report to `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/.superpowers/sdd/2026-11-02-frontend-build-time-guardrails-and-pnpm/task-5-report.md`.
8. Return short summary with commit hash. Do NOT dispatch any subagents.

## Constraints & Mandates
- Follow `AGENTS.md`: The Zero-Any Mandate; The Invariant Oracle Law; Knip Preservation Invariant (`src/types/generated/**` must NOT be deleted or flagged as dead code); Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
