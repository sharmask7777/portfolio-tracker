# Task 1 Brief: Strict Workspace Lints Configuration & #![forbid(unsafe_code)]

## Task Objective
Configure strict compiler and clippy lints in `backend-rs/Cargo.toml` under `[workspace.lints]`, propagate them to all member crates via `[lints] workspace = true`, and enforce `#![forbid(unsafe_code)]` at the root of all production crates.

## Plan Excerpt
**Files:**
- Modify: `backend-rs/Cargo.toml`
- Modify: `backend-rs/crates/portfolio-core/Cargo.toml`
- Modify: `backend-rs/crates/portfolio-core/src/lib.rs`
- Modify: `backend-rs/crates/portfolio-db/Cargo.toml`
- Modify: `backend-rs/crates/portfolio-db/src/lib.rs`
- Modify: `backend-rs/crates/portfolio-api/Cargo.toml`
- Modify: `backend-rs/crates/portfolio-api/src/lib.rs`
- Modify: `backend-rs/crates/portfolio-api/src/main.rs`
- Modify: `backend-rs/crates/portfolio-worker/Cargo.toml`
- Modify: `backend-rs/crates/portfolio-worker/src/lib.rs`
- Modify: `backend-rs/crates/portfolio-worker/src/main.rs`
- Modify: `backend-rs/crates/portfolio-parity/Cargo.toml`
- Modify: `backend-rs/crates/portfolio-parity/src/lib.rs`
- Modify: `backend-rs/crates/portfolio-parity/src/main.rs`

## Steps
1. Add `[workspace.lints]` in `backend-rs/Cargo.toml`:
   ```toml
   [workspace.lints.rust]
   missing_docs = "warn"
   rust_2018_idioms = "warn"
   unreachable_pub = "warn"
   unexpected_cfgs = { level = "warn", check-cfg = ['cfg(tarpaulin_include)'] }

   [workspace.lints.rustdoc]
   broken_intra_doc_links = "deny"
   bare_urls = "warn"

   [workspace.lints.clippy]
   all = { level = "deny", priority = -1 }
   pedantic = { level = "warn", priority = -1 }
   unwrap_used = "deny"
   panic = "deny"
   todo = "deny"
   redundant_clone = "deny"
   undocumented_unsafe_blocks = "deny"
   doc_markdown = "warn"
   missing_errors_doc = "warn"
   module_name_repetitions = "allow"
   must_use_candidate = "allow"
   cast_possible_truncation = "allow"
   cast_precision_loss = "allow"
   cast_sign_loss = "allow"
   similar_names = "allow"
   too_many_lines = "allow"
   match_same_arms = "allow"
   struct_excessive_bools = "allow"
   needless_pass_by_value = "allow"
   ```
2. In each member crate's `Cargo.toml`, add:
   ```toml
   [lints]
   workspace = true
   ```
3. Add `#![forbid(unsafe_code)]` at root of `portfolio-core/src/lib.rs`, `portfolio-db/src/lib.rs`, `portfolio-api/src/lib.rs` & `main.rs`, `portfolio-worker/src/lib.rs` & `main.rs`.
   For `portfolio-parity` (purely synthetic test runner crate), add `#![forbid(unsafe_code)]` and `#![allow(clippy::unwrap_used, clippy::panic)]`.
4. Run `cargo check --workspace --all-targets` and `cargo clippy --workspace --all-targets` to observe the enforced lints.
5. Commit: `git add backend-rs/Cargo.toml backend-rs/crates/*/Cargo.toml backend-rs/crates/*/src/lib.rs backend-rs/crates/*/src/main.rs && git commit -m "feat(cargo): configure strict workspace clippy, rustdoc, and compiler lints"`.

## Constraints & Mandates
- Follow `AGENTS.md`: Universal Generality Mandate; Strict Zero-I/O Invariant in `portfolio-core`.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
