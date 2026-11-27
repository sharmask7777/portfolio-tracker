# Task 1 Report: Strict Workspace Lints Configuration & #![forbid(unsafe_code)]

## Executive Summary
- **Status:** DONE
- **Commit:** `c7c987dd7882e13acee85e5a1113d3650e80c74f` - `feat(cargo): configure strict workspace clippy, rustdoc, and compiler lints`
- **Scope:** Configured strict compiler, rustdoc, and clippy lints at workspace level in `backend-rs/Cargo.toml`, propagated `[lints] workspace = true` across all 5 member crates, and enforced `#![forbid(unsafe_code)]` at the root of all production crates and binaries (with allowed unwraps/panics in `portfolio-parity`).

## Changes Made
1. **`backend-rs/Cargo.toml`**:
   - Added `[workspace.lints.rust]`:
     - `missing_docs = "warn"`
     - `rust_2018_idioms = "warn"`
     - `unreachable_pub = "warn"`
     - `unexpected_cfgs = { level = "warn", check-cfg = ['cfg(tarpaulin_include)'] }`
   - Added `[workspace.lints.rustdoc]`:
     - `broken_intra_doc_links = "deny"`
     - `bare_urls = "warn"`
   - Added `[workspace.lints.clippy]`:
     - `all = { level = "deny", priority = -1 }`
     - `pedantic = { level = "warn", priority = -1 }`
     - `unwrap_used = "deny"`, `panic = "deny"`, `todo = "deny"`, `redundant_clone = "deny"`, `undocumented_unsafe_blocks = "deny"`
     - `doc_markdown = "warn"`, `missing_errors_doc = "warn"`
     - Benign pedantic allowances (`module_name_repetitions`, `must_use_candidate`, `cast_possible_truncation`, `cast_precision_loss`, `cast_sign_loss`, `similar_names`, `too_many_lines`, `match_same_arms`, `struct_excessive_bools`, `needless_pass_by_value`).
2. **Propagated `[lints] workspace = true`**:
   - `backend-rs/crates/portfolio-core/Cargo.toml`
   - `backend-rs/crates/portfolio-db/Cargo.toml`
   - `backend-rs/crates/portfolio-api/Cargo.toml`
   - `backend-rs/crates/portfolio-worker/Cargo.toml`
   - `backend-rs/crates/portfolio-parity/Cargo.toml`
3. **Enforced `#![forbid(unsafe_code)]`**:
   - `backend-rs/crates/portfolio-core/src/lib.rs`
   - `backend-rs/crates/portfolio-db/src/lib.rs`
   - `backend-rs/crates/portfolio-api/src/lib.rs` and `src/main.rs`
   - `backend-rs/crates/portfolio-worker/src/lib.rs` and `src/main.rs`
   - `backend-rs/crates/portfolio-parity/src/lib.rs` and `src/main.rs` (with `#![allow(clippy::unwrap_used, clippy::panic)]`)

## Verification
- `(cd backend-rs && cargo check --workspace --all-targets)`: Passed cleanly with 0 errors.
- `(cd backend-rs && cargo clippy --workspace --all-targets)`: Correctly surfaced unwrap calls in production source code, setting up Task 2 for production remediation.
