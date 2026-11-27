# Task 5 Brief: Full Hermetic Gate Execution & Verification

## Task Objective
Run export bindings, commit any generated TypeScript changes, and execute the full Mandatory Hermetic Verification Sequence (backend tests, clippy, fmt, differential parity, frontend build & tests, and coverage gates).

## Plan Excerpt
- Step 1: Export TypeScript bindings and commit any updated generated types.
- Step 2: Backend full workspace tests, clippy, and fmt.
- Step 3: Parity validation harness (`cargo run --package portfolio-parity`).
- Step 4: Frontend build and unit tests (`npm run build && npm run test:unit`).
- Step 5: Test coverage check (`npm run test:coverage`).

## Constraints & Mandates
- Follow `AGENTS.md`: Full Hermetic Verification Sequence; Zero-Any Mandate; The Invariant Oracle Law; Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
