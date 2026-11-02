# Design Document: Hard Build-Time Guardrails & Rustdoc Static Verification for Rust Backend

**Date:** 2026-11-01  
**Issue:** [#21 Hard build time guardrails for the rust backend](https://github.com/sharmask7777/portfolio-tracker/issues/21)  
**Status:** In Review  
**Target File:** `docs/superpowers/specs/2026-11-01-hard-build-time-guardrails-and-rustdocs-design.md`

---

## 1. Intent & Context

To support agentic AI-native development and long-term codebase health across `backend-rs`, we must establish hard build-time guardrails that prevent regressions, eliminate panic-prone patterns in production code, enforce licensing and security vulnerability checks on dependencies, and guarantee high-quality documentation through static compiler linting.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Strict Workspace Lints (`backend-rs/Cargo.toml`)**:
  - Configure `[workspace.lints.rust]` and `[workspace.lints.clippy]`, inherited by all 5 workspace crates (`portfolio-core`, `portfolio-db`, `portfolio-api`, `portfolio-worker`, `portfolio-parity`) via `[lints] workspace = true`.
  - Enforce `clippy::all = "deny"`, `clippy::unwrap_used = "deny"`, `clippy::panic = "deny"`, `clippy::todo = "deny"`, `clippy::redundant_clone = "deny"`.
  - Enforce `#![forbid(unsafe_code)]` across all root files (`src/lib.rs` / `src/main.rs`).
  - Configure `clippy::pedantic = "warn"` with granular allowances for benign pedantic patterns (`module_name_repetitions`, `must_use_candidate`, `cast_possible_truncation`, `similar_names`, etc.).
  - Allow `unwrap()` / `panic()` specifically in test code (`#[cfg(test)]`, `tests/`) while strictly forbidding them in production library paths (`src/`).
- **Static Rustdoc Guardrails**:
  - Add `missing_docs = "warn"`, `rustdoc::broken_intra_doc_links = "deny"` in workspace lints.
  - Enforce static doc verification via `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps`.
  - Add clippy doc lints (`clippy::doc_markdown = "warn"`, `clippy::missing_errors_doc = "warn"`).
- **Dependency Security & License Auditing (`deny.toml`)**:
  - Create `backend-rs/deny.toml` configuring `cargo-deny`:
    - Advisories: Deny known security vulnerabilities and yanked crates; warn on unmaintained crates.
    - Licenses: Enforce permitted open-source licenses (MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, Unicode-DFS-2016, OpenSSL, Zlib).
    - Bans: Warn or deny duplicate crate versions where feasible; skip platform-specific duplicates.
- **Unified Verification Pipeline (`scripts/verify.sh` & `package.json`)**:
  - Add `scripts/verify.sh` (executable) running:
    1. `cargo fmt --check`
    2. `cargo check --workspace --all-targets`
    3. `cargo clippy --workspace --all-targets -- -D warnings`
    4. `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps`
    5. `cargo test --workspace`
    6. `cargo deny check`
    7. `cargo machete` (or warning fallback if binary absent)
    8. `cargo run --package portfolio-parity`
  - Update `AGENTS.md` verification sequence and pre-push hooks to integrate these guardrails.
- **Production Code Compliance**:
  - Clean up any production code `unwrap()` / `panic()` calls in `src/` to ensure zero compilation or clippy errors under strict lints.

### Non-Goals
- Forbidding `unwrap()` in unit and contract tests under `tests/` or `#[cfg(test)]`.
- Restricting or breaking existing Zero-I/O or parity bounds.

### Anti-Goals
- Introducing breaking changes to financial calculation logic or precision tolerances ($\Delta \le 0.0001$ units, $\Delta \le ₹0.01$ amounts, $\Delta \le 10^{-6}$ returns).
- Failing builds on minor pedantic stylistic quirks that do not affect correctness.

---

## 3. Architecture & Specification

### A. Workspace Lints in `backend-rs/Cargo.toml`

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

# Hard denial of panic-prone code
unwrap_used = "deny"
panic = "deny"
todo = "deny"
redundant_clone = "deny"
undocumented_unsafe_blocks = "deny"

# Documentation lints
doc_markdown = "warn"
missing_errors_doc = "warn"

# Granular allowances for benign pedantic noise in financial systems
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

Each crate (`portfolio-core`, `portfolio-db`, `portfolio-api`, `portfolio-worker`, `portfolio-parity`) adds:
```toml
[lints]
workspace = true
```

In root files (`src/lib.rs` / `src/main.rs`):
```rust
#![forbid(unsafe_code)]
```

For test files/modules, allow unwrap:
```rust
#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::panic)]
mod tests { ... }
```

### B. Dependency Governance (`backend-rs/deny.toml`)

- **Advisories**:
  - `vulnerability = "deny"`
  - `yanked = "deny"`
  - `unmaintained = "warn"`
- **Licenses**:
  - `allow = ["MIT", "Apache-2.0", "ISC", "BSD-3-Clause", "BSD-2-Clause", "Unicode-DFS-2016", "OpenSSL", "Zlib"]`
  - `confidence-threshold = 0.8`
- **Bans**:
  - `multiple-versions = "warn"`
  - `wildcards = "allow"`
- **Sources**:
  - `allow-registry = ["https://github.com/rust-lang/crates.io-index"]`

### C. Verification Script (`backend-rs/scripts/verify.sh`)

Script that runs sequentially with clear, colored output:
1. `cargo fmt --check`
2. `cargo check --workspace --all-targets`
3. `cargo clippy --workspace --all-targets -- -D warnings`
4. `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps`
5. `cargo test --workspace`
6. `cargo deny check` (checks if installed; runs or gives guidance)
7. `cargo machete` (checks if installed; runs or gives guidance)
8. `cargo run --package portfolio-parity`

---

## 4. Work Breakdown for Plan Mode

1. **Task 1: Workspace Lints Configuration & `#![forbid(unsafe_code)]`**
   - Update `backend-rs/Cargo.toml` with `[workspace.lints]` and crate-level `[lints] workspace = true`.
   - Add `#![forbid(unsafe_code)]` in all root crate `src/lib.rs` and `src/main.rs`.
2. **Task 2: Production Code Clean-up (`unwrap_used` & `panic` Remediation)**
   - Scan production code (`src/`) across all 5 crates for unhandled `.unwrap()` / `panic!()` calls.
   - Refactor to proper `?` operator, `unwrap_or`, `ok_or_else`, or explicit error mapping with `PortfolioError` / `ApiError` / `DbError`.
   - Ensure `#[cfg(test)]` modules and integration test files (`tests/`) have `#[allow(clippy::unwrap_used, clippy::panic)]`.
3. **Task 3: Rustdoc Static Guardrails & Missing Docs Resolution**
   - Run `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps`.
   - Fix any broken doc links or missing docs in public items.
4. **Task 4: `cargo-deny` (`deny.toml`) & Dependency Auditing**
   - Create `backend-rs/deny.toml` with permitted licenses, security advisories, and source restrictions.
   - Run `cargo deny check` and verify it passes.
5. **Task 5: Verification Script, `AGENTS.md` Update, & Hermetic Sequence Certification**
   - Create `backend-rs/scripts/verify.sh`.
   - Update `AGENTS.md` Mandatory Hermetic Verification Sequence to include `cargo doc` and `cargo deny`.
   - Run the full verification suite and verify all gates pass.
