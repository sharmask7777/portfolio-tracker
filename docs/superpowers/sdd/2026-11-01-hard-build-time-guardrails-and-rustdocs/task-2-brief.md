# Task 2 Brief: Production Code Clean-up (unwrap_used & panic Remediation)

## Task Objective
Remediate all `clippy::unwrap_used` and `clippy::panic` violations so that production code (`src/`) is 100% panic-free, while allowing `unwrap()` in test modules (`#[cfg(test)]`) and integration test files (`tests/`).

## Plan Excerpt
**Files to Remediate (Production Code):**
- Modify: `backend-rs/crates/portfolio-core/src/performance/xirr.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/tax.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/family.rs`

**Files to Add Test Allowances (`#[cfg(test)]` & `tests/`):**
- In `backend-rs/crates/portfolio-core/src/`:
  - Add `#[allow(clippy::unwrap_used, clippy::panic)]` to `mod tests` in `holdings/registry.rs`, `performance/metrics.rs`, `performance/xirr.rs`, `xray/allocation.rs`, `xray/overlap.rs`, `holdings/lot.rs`, etc.
- In `backend-rs/crates/portfolio-core/tests/`:
  - Add `#![allow(clippy::unwrap_used, clippy::panic)]` at top of `auditor_defensive_test.rs`, `mock_portfolios.rs`, `proptests.rs`, `tax_compliance_test.rs`, `tax_oracle_test.rs`, `types_test.rs`, `xirr_safeguards_test.rs`.
- In `backend-rs/crates/portfolio-db/tests/`:
  - Add `#![allow(clippy::unwrap_used, clippy::panic)]` at top of `persistence_tests.rs`, `market_data_test.rs`, `schema_test.rs`.
- In `backend-rs/crates/portfolio-db/src/test_mocks.rs`:
  - Add `#[allow(clippy::unwrap_used, clippy::panic)]` for test mock helpers where appropriate.
- In `backend-rs/crates/portfolio-api/tests/`:
  - Add `#![allow(clippy::unwrap_used, clippy::panic)]` at top of `contract_tests.rs`, `export_bindings.rs`, `nav_resolution_test.rs`, `nav_sync_test.rs`.
- In `backend-rs/crates/portfolio-worker/tests/`:
  - Add `#![allow(clippy::unwrap_used, clippy::panic)]` at top of `worker_tests.rs`.

## Steps
1. Refactor production code unwraps:
   - `portfolio-core/src/performance/xirr.rs:281`: `let last_date = sorted_flows.last().ok_or_else(|| PortfolioError::CalculationFailed("No cash flows provided".into()))?.date;`
   - `portfolio-api/src/routes/portfolio.rs`:
     - Line 943: `let dec = |s: &str| Decimal::from_str(s).unwrap_or(Decimal::ZERO);`
     - Lines 1448-1449: `Decimal::new(1, 3)` (for 0.001) and `Decimal::new(1, 2)` (for 0.01)
     - Line 2100: `Decimal::new(1, 2)`
     - Line 241: `Uuid::parse_str("...").unwrap_or_default()`
     - Line 2728: `today.and_hms_opt(0, 0, 0).unwrap_or_default()`
   - `portfolio-api/src/routes/family.rs`:
     - Line 57: `Uuid::parse_str("...").unwrap_or_default()`
     - Line 107: `Decimal::new(30, 2)` (for 0.30)
   - `portfolio-api/src/routes/tax.rs`:
     - Line 259: `Decimal::new(30, 2)` (for 0.30)
2. Add `#![allow(clippy::unwrap_used, clippy::panic)]` to all integration test files in `crates/*/tests/` and test modules in `src/`.
3. Verify clippy passes: `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`.
4. Verify all tests pass: `(cd backend-rs && cargo test --workspace)`.
5. Commit: `git add backend-rs/crates && git commit -m "fix(backend): remediate unwrap and panic lints in production code with safe fallbacks"`.

## Constraints & Mandates
- Follow `AGENTS.md`: The Invariant Oracle Law (never alter test assertion values or numerical bounds); Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
