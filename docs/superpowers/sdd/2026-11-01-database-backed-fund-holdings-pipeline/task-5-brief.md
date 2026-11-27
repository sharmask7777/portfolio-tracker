# Task 5 Brief: Export Type Bindings, Parity Verification, & Full Hermetic Gate Execution

## Task Objective
Export generated TypeScript bindings, ensure zero contract drift, and execute the full Mandatory Hermetic Verification Sequence (backend tests, clippy, fmt, export_bindings, frontend build & tests, portfolio-parity, and test coverage).

## Plan Excerpt
**Files:**
- Modify: `frontend/src/types/generated/` (if bindings export updates anything)
- Test: Full Mandatory Hermetic Verification Sequence (Steps 1-7 from `AGENTS.md`)

## Steps
1. Export TypeScript bindings:
   `(cd backend-rs && cargo test --package portfolio-api --test export_bindings)`
   Check if any generated types changed: `git status frontend/src/types/generated`
2. Run backend full workspace tests, clippy, and fmt:
   `(cd backend-rs && cargo test --workspace)`
   `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`
   `(cd backend-rs && cargo fmt --check)`
3. Run parity harness:
   `(cd backend-rs && cargo run --package portfolio-parity)`
4. Run frontend build and unit tests:
   `(cd frontend && npm run build && npm run test:unit)`
5. Run test coverage:
   `npm run test:coverage`
6. If any generated bindings changed, commit them:
   `git add frontend/src/types/generated && git commit -m "chore: update generated typescript bindings and verify hermetic test suite"`
   (If no files changed, record that in the report).

## Constraints & Mandates
- Follow `AGENTS.md`: Zero-Any Mandate; Hermetic verification sequence; Invariant Oracle Law; Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
