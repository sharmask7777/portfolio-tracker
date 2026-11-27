# Task 5 Brief: Verification Pipeline Script, `AGENTS.md` Update & Hermetic Certification

## Task Objective
Create the unified verification pipeline script `backend-rs/scripts/verify.sh`, update `AGENTS.md` with the new verification steps (doc guardrails and cargo-deny check), update `.husky/pre-push`, and verify the complete hermetic sequence.

## Plan Excerpt
- Create: `backend-rs/scripts/verify.sh`
- Modify: `AGENTS.md`
- Modify: `.husky/pre-push`

## Steps
1. Create `backend-rs/scripts/verify.sh`:
   - Shebang `#!/usr/bin/env bash` with `set -euo pipefail`.
   - Run from `backend-rs/` repository root or auto-cd to it.
   - Steps:
     1. Formatting: `cargo fmt --check`
     2. Type checking: `cargo check --workspace --all-targets`
     3. Strict clippy: `cargo clippy --workspace --all-targets -- -D warnings`
     4. Static rustdoc guardrails: `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps`
     5. Workspace tests: `cargo test --workspace`
     6. Dependency auditing: if `cargo-deny` command is found, run `cargo deny check` (otherwise warn or check brew/cargo path `/opt/homebrew/bin/cargo-deny`).
     7. Unused dependency checking: if `cargo-machete` command is found, run `cargo machete` (otherwise notify that machete is optional).
     8. Parity validation harness: `cargo run --package portfolio-parity`
   - Make executable with `chmod +x backend-rs/scripts/verify.sh`.
2. Update `AGENTS.md`:
   - In Section 4 ("Mandatory Hermetic Verification Sequence"), update the sequence to include:
     - `(cd backend-rs && cargo fmt --check)`
     - `(cd backend-rs && cargo check --workspace --all-targets)`
     - `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`
     - `(cd backend-rs && RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps)`
     - `(cd backend-rs && cargo test --workspace)`
     - `(cd backend-rs && cargo deny check)`
     - `(cd backend-rs && cargo test --package portfolio-api --test export_bindings) && git diff --exit-code frontend/src/types/generated`
     - `(cd backend-rs && cargo run --package portfolio-parity)`
     - `(cd frontend && npm run build && npm run test:unit)`
     - `npm run test:coverage`
3. Update `.husky/pre-push`:
   - Incorporate `(cd backend-rs && ./scripts/verify.sh)` or add the rustdoc guardrails and cargo deny checks to the pre-push script.
4. Execute `backend-rs/scripts/verify.sh` to ensure it passes cleanly from start to finish.
5. Verify frontend build and unit tests pass: `(cd frontend && npm run build && npm run test:unit)`.
6. Commit:
   `git add backend-rs/scripts/verify.sh AGENTS.md .husky/pre-push && git commit -m "chore(ci): establish unified verify.sh pipeline script and update verification sequence in AGENTS.md"`

## Constraints & Mandates
- Follow `AGENTS.md`: The Invariant Oracle Law (never alter test assertion values or numerical bounds); Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
