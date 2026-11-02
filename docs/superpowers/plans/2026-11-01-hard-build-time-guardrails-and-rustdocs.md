# Hard Build-Time Guardrails & Rustdoc Static Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish hard build-time guardrails for the Rust backend workspace (`backend-rs`) by enforcing strict workspace-level compiler and clippy lints (`unwrap_used = "deny"`, `panic = "deny"`, `forbid(unsafe_code)`), static rustdoc checks (`missing_docs = "warn"`, intra-doc link validation, `RUSTDOCFLAGS="-D warnings"`), automated dependency license and vulnerability auditing (`cargo-deny` with `deny.toml`), and a unified verification pipeline script (`backend-rs/scripts/verify.sh`).

**Architecture:** Workspace-level configuration in `backend-rs/Cargo.toml` (`[workspace.lints.rust]`, `[workspace.lints.clippy]`, `[workspace.lints.rustdoc]`) inherited across all 5 workspace crates (`portfolio-core`, `portfolio-db`, `portfolio-api`, `portfolio-worker`, `portfolio-parity`) via `[lints] workspace = true`. Production library code (`src/`) is refactored to eliminate unhandled `.unwrap()` / `panic!()` calls, while unit tests (`tests/`, `#[cfg(test)]`) are explicitly permitted to use `.unwrap()`. Dependency governance is codified in `backend-rs/deny.toml`, and the full verification pipeline is centralized in `backend-rs/scripts/verify.sh` and wired into `AGENTS.md`.

**Tech Stack:** Rust (`cargo clippy`, `cargo fmt`, `cargo doc`, `cargo-deny`, `cargo-machete`), Bash.

**Spec:** [`docs/superpowers/specs/2026-11-01-hard-build-time-guardrails-and-rustdocs-design.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/superpowers/specs/2026-11-01-hard-build-time-guardrails-and-rustdocs-design.md)

## Global Constraints

- **Universal Generality Mandate:** Strictly zero portfolio-specific hacks or single-instance heuristics; all fixes and lints must apply uniformly across all portfolios.
- **Strict Zero-I/O Invariant:** `portfolio-core` must remain 100% pure in-memory calculation functions with zero I/O, network, or database dependencies.
- **The Invariant Oracle Law:** Never relax numerical bounds (Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$).
- **The Zero-Any Mandate:** No `any` types in TypeScript code.
- **Mandatory Synthetic Data:** Strictly zero real PII, PANs, user names, or CAS statements.
- **Test Exemption for Unwraps:** Strictly forbid `unwrap()` in production library code (`src/`), while permitting it in test modules/files (`#[cfg(test)]`, `tests/`).

## Review Focus

1. **Production Code Panic Immunity:** No unhandled `.unwrap()` or `panic!()` calls in `src/` of production crates (`portfolio-core`, `portfolio-db`, `portfolio-api`, `portfolio-worker`).
2. **Test Assertions Preserved:** Ensure tests under `#[cfg(test)]` and integration test files continue to use `.unwrap()` seamlessly without breaking assertions or oracle tests.
3. **Static Rustdoc Compilation:** `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps` must compile cleanly with 0 warnings and 0 broken intra-doc links.
4. **License & Vulnerability Compliance:** `cargo deny check` must pass cleanly against `backend-rs/deny.toml` without flagging permissible open-source dependencies.
5. **Full Hermetic Verification Sequence:** Zero regressions across the workspace, 100% test passage, 10/10 differential parity scenarios, and backend line coverage $\ge 80\%$.

---

### Task 1: Strict Workspace Lints Configuration & `#![forbid(unsafe_code)]`

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

- [ ] **Step 1: Configure `[workspace.lints]` in `backend-rs/Cargo.toml`**
  - Add `[workspace.lints.rust]`, `[workspace.lints.rustdoc]`, and `[workspace.lints.clippy]`.
  - Set `clippy::all = { level = "deny", priority = -1 }`.
  - Set `clippy::pedantic = { level = "warn", priority = -1 }`.
  - Set `clippy::unwrap_used = "deny"`, `panic = "deny"`, `todo = "deny"`, `redundant_clone = "deny"`, `undocumented_unsafe_blocks = "deny"`.
  - Set `missing_docs = "warn"`, `broken_intra_doc_links = "deny"`.
  - Configure allowances for benign pedantic rules (`module_name_repetitions`, `cast_possible_truncation`, `similar_names`, etc.).
- [ ] **Step 2: Enable `[lints] workspace = true` and `#![forbid(unsafe_code)]` across member crates**
  - In each member crate's `Cargo.toml`, add `[lints] workspace = true`.
  - In each crate root `lib.rs` / `main.rs`, add `#![forbid(unsafe_code)]`.
  - For `portfolio-parity` (which is purely a test harness crate), allow `clippy::unwrap_used` and `clippy::panic` at crate level (`#![allow(clippy::unwrap_used, clippy::panic)]`).
- [ ] **Step 3: Run `cargo check` to inspect flagged lints**
  - Run: `(cd backend-rs && cargo check --workspace --all-targets)`
  - Run: `(cd backend-rs && cargo clippy --workspace --all-targets)`
  - Expected: Flags unwrap calls in production `src/` to be fixed in Task 2.
- [ ] **Step 4: Commit**
  - `git add backend-rs/Cargo.toml backend-rs/crates/*/Cargo.toml backend-rs/crates/*/src/lib.rs backend-rs/crates/*/src/main.rs`
  - `git commit -m "feat(cargo): configure strict workspace clippy, rustdoc, and compiler lints"`

---

### Task 2: Production Code Clean-up (`unwrap_used` & `panic` Remediation)

**Files:**
- Modify: `backend-rs/crates/portfolio-core/src/performance/xirr.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/tax.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/family.rs`
- Modify: `backend-rs/crates/portfolio-worker/src/jobs/cas_parser.rs`
- Modify: `backend-rs/crates/portfolio-worker/src/jobs/nav_refresh.rs`

- [ ] **Step 1: Refactor production `unwrap()` calls in `portfolio-core`**
  - In `xirr.rs`: Replace `sorted_flows.last().unwrap()` with `if let Some(last) = sorted_flows.last()` or `.ok_or(PortfolioError::CalculationFailed(...))`.
  - In `#[cfg(test)]` modules across `portfolio-core`: Ensure `#![allow(clippy::unwrap_used, clippy::panic)]` or module-level `#[allow(clippy::unwrap_used, clippy::panic)]` is present so tests can idiomatically assert.
- [ ] **Step 2: Refactor production `unwrap()` calls in `portfolio-api`**
  - In `routes/portfolio.rs`:
    - Replace `Decimal::from_str(s).unwrap()` in `resolve_holdings` with `Decimal::from_str(s).unwrap_or(Decimal::ZERO)`.
    - Replace `Decimal::from_str("0.001").unwrap()` with `Decimal::new(1, 3)` (exact 0.001) or safe unwrap_or.
    - Replace `Decimal::from_str("0.01").unwrap()` with `Decimal::new(1, 2)` (exact 0.01).
    - Replace `today.and_hms_opt(0, 0, 0).unwrap()` with `.unwrap_or_default()`.
    - In demo/synthetic user ID check: replace `Uuid::parse_str("...").unwrap()` with `const` or `unwrap_or_default()`.
  - In `routes/tax.rs`: Replace `.unwrap_or_else(|| Decimal::from_str("0.30").unwrap())` with `Decimal::new(30, 2)`.
  - In `routes/family.rs`: Replace `.unwrap_or_else(|| Decimal::from_str("0.30").unwrap())` with `Decimal::new(30, 2)` and parse_str with `unwrap_or_default()`.
- [ ] **Step 3: Refactor production `unwrap()` calls in `portfolio-worker`**
  - In `jobs/cas_parser.rs` and `nav_refresh.rs`: Safely handle any unwrap calls in parsing and background jobs using `?` or `ok_or_else`.
- [ ] **Step 4: Verify clippy passes cleanly**
  - Run: `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`
  - Expected: Clean (0 warnings, 0 unwrap errors).
- [ ] **Step 5: Run tests to verify zero regressions**
  - Run: `(cd backend-rs && cargo test --workspace)`
  - Expected: 100% tests pass.
- [ ] **Step 6: Commit**
  - `git add backend-rs/crates`
  - `git commit -m "fix(backend): remediate unwrap and panic lints in production code with safe fallbacks"`

---

### Task 3: Static Rustdoc Guardrails & Intra-Doc Link Verification

**Files:**
- Modify: `backend-rs/Cargo.toml` (if doc flags adjustment needed)
- Modify: `backend-rs/crates/*/src/` (any items flagged by `missing_docs` or broken doc links)

- [ ] **Step 1: Run static rustdoc verification command**
  - Run: `(cd backend-rs && RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps)`
  - Expected: Checks for broken intra-doc links, syntax errors, or missing documentation on public items.
- [ ] **Step 2: Fix any flagged doc comments or missing docs**
  - Address any warnings reported by `cargo doc` or `clippy::doc_markdown`.
- [ ] **Step 3: Verify clean rustdoc build**
  - Run: `(cd backend-rs && RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps)`
  - Expected: PASS with 0 warnings.
- [ ] **Step 4: Commit**
  - `git add backend-rs/crates`
  - `git commit -m "docs(rustdoc): verify and enforce static rustdoc guardrails with zero doc warnings"`

---

### Task 4: Dependency Auditing with `cargo-deny` (`deny.toml`)

**Files:**
- Create: `backend-rs/deny.toml`

- [ ] **Step 1: Create `backend-rs/deny.toml` configuration**
  - Configure `[advisories]`: `vulnerability = "deny"`, `yanked = "deny"`, `unmaintained = "warn"`.
  - Configure `[licenses]`: Allowed licenses: MIT, Apache-2.0, ISC, BSD-2-Clause, BSD-3-Clause, Unicode-DFS-2016, OpenSSL, Zlib. Set `confidence-threshold = 0.8`.
  - Configure `[bans]`: `multiple-versions = "warn"`, `wildcards = "allow"`.
  - Configure `[sources]`: Allowed registry crates.io.
- [ ] **Step 2: Run `cargo deny check`**
  - Run: `(cd backend-rs && cargo deny check)`
  - Expected: Validates licenses, bans, advisories, and sources across the workspace lockfile.
- [ ] **Step 3: Refine `deny.toml` if any legitimate license or advisory exceptions are needed**
  - Ensure all dependencies in `Cargo.lock` pass without error.
- [ ] **Step 4: Commit**
  - `git add backend-rs/deny.toml`
  - `git commit -m "feat(security): add cargo-deny configuration for dependency license and advisory auditing"`

---

### Task 5: Verification Pipeline Script, `AGENTS.md` Update & Hermetic Certification

**Files:**
- Create: `backend-rs/scripts/verify.sh`
- Modify: `AGENTS.md`
- Modify: `.husky/pre-push`

- [ ] **Step 1: Create `backend-rs/scripts/verify.sh`**
  - Implement executable bash script executing the sequential verification pipeline:
    1. `cargo fmt --check`
    2. `cargo check --workspace --all-targets`
    3. `cargo clippy --workspace --all-targets -- -D warnings`
    4. `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps`
    5. `cargo test --workspace`
    6. `cargo deny check` (with auto-detection)
    7. `cargo machete` (with auto-detection)
    8. `cargo run --package portfolio-parity`
  - Make executable: `chmod +x backend-rs/scripts/verify.sh`.
- [ ] **Step 2: Update `AGENTS.md` Mandatory Hermetic Verification Sequence**
  - Add `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps` and `cargo deny check` to Mandatory Hermetic Verification Sequence (Section 4).
- [ ] **Step 3: Execute `scripts/verify.sh` and full hermetic sequence**
  - Run: `backend-rs/scripts/verify.sh`
  - Run: `(cd frontend && npm run build && npm run test:unit)`
  - Run: `npm run test:coverage`
- [ ] **Step 4: Commit**
  - `git add backend-rs/scripts/verify.sh AGENTS.md .husky/pre-push`
  - `git commit -m "chore(ci): establish unified verify.sh pipeline script and update verification sequence in AGENTS.md"`
