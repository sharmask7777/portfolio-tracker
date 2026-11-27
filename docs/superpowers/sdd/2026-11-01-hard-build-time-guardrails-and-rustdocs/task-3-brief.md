# Task 3 Brief: Static Rustdoc Guardrails & Intra-Doc Link Verification

## Task Objective
Ensure all public items across the Rust workspace satisfy static rustdoc standards and that `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps` passes cleanly with zero warnings, zero broken intra-doc links, and zero doc errors.

## Plan Excerpt
- Modify: `backend-rs/Cargo.toml` (if doc flags adjustment needed)
- Modify: `backend-rs/crates/*/src/` (any items flagged by `missing_docs`, broken doc links, or doc tests)

## Steps
1. Run `(cd backend-rs && RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps)` to detect any documentation warnings, broken intra-doc links (`broken_intra_doc_links`), private intra-doc links, or invalid code blocks in docs.
2. Fix any flagged doc comments or missing docs in workspace crates.
3. Verify clean rustdoc build: `(cd backend-rs && RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps)`.
4. Verify clippy and tests still pass:
   - `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`
   - `(cd backend-rs && cargo test --workspace)`
5. Commit:
   `git add backend-rs && git commit -m "docs(rustdoc): verify and enforce static rustdoc guardrails with zero doc warnings"`

## Constraints & Mandates
- Follow `AGENTS.md`: The Invariant Oracle Law (never alter test assertion values or numerical bounds); Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
