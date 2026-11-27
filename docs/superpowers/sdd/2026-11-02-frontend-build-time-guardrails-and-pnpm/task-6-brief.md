# Task 6 Brief: Documentation Updates & Full Hermetic Certification

## Task Objective
Update `AGENTS.md`, `README.md`, and `frontend/tests/README.md` to document the pnpm workspace architecture and the full frontend static build-time guardrails paradigm, and execute the complete end-to-end hermetic verification sequence.

## Plan Excerpt
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `frontend/tests/README.md`

## Steps
1. Update `AGENTS.md`:
   - In Section 2 ("The Zero-Any Mandate"), update build command to `pnpm --filter frontend build` (`pnpm build:verify && vite build`).
   - In Section 4 ("Mandatory Hermetic Verification Sequence"), update stage 9 to `pnpm --filter frontend build && pnpm --filter frontend test:unit` and stage 10 to `pnpm test:coverage`.
   - Add a new section or update Section 2 with the Frontend Static Build-Time Guardrails Mandate:
     - TypeScript compiler strictness (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `isolatedModules`, `noEmit`).
     - Architectural boundaries (`eslint-plugin-boundaries`) and file naming conventions (`eslint-plugin-check-file`).
     - Schema-validated environment variables (`@t3-oss/env-core` + `zod` via `src/env.ts`).
     - Dead-code and dependency auditing (`knip`) with explicit preservation of Rust generated contract types (`src/types/generated/**`).
     - Verification gate `pnpm --filter frontend build:verify` (`pnpm lint && pnpm typecheck && pnpm knip`).
2. Update `README.md`:
   - Update quickstart, installation, dev, test, and build instructions to use `pnpm` (e.g. `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm build`).
   - Add a dedicated "Static Build-Time Guardrails Paradigm" section describing both the Rust backend guardrails (`verify.sh`, clippy denies, rustdocs, cargo-deny) and the Frontend guardrails (pnpm, strict TS, boundaries, env-core, knip).
3. Update `frontend/tests/README.md` with `pnpm` command references.
4. Execute full hermetic sequence:
   - `(cd backend-rs && ./scripts/verify.sh)`
   - `(cd backend-rs && cargo test --package portfolio-api --test export_bindings) && git diff --exit-code frontend/src/types/generated`
   - `pnpm --filter frontend build:verify`
   - `pnpm --filter frontend test:unit`
   - `(cd backend-rs && cargo run --package portfolio-parity)`
5. Commit:
   `git add AGENTS.md README.md frontend/tests/README.md`
   `git commit -m "docs: document frontend static guardrails paradigm and update instructions for pnpm"`
6. Write report to `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/.superpowers/sdd/2026-11-02-frontend-build-time-guardrails-and-pnpm/task-6-report.md`.
7. Return short summary with commit hash. Do NOT dispatch any subagents.

## Constraints & Mandates
- Follow `AGENTS.md`: The Zero-Any Mandate; The Invariant Oracle Law; Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
