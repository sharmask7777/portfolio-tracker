# Task 1 Brief: portfolio-core Comprehensive Rust Docs, Self-Documenting Naming & Mathematical Comments

## Task Objective
Enhance Rust doc comments (`///`), function docstrings, mathematical explanations, and domain comments across `portfolio-core`, especially for:
1. `src/holdings/lot.rs` and `src/holdings/registry.rs`: FIFO lot depletion mechanics, units rounding tolerances, tie-breaking rules, holding valuation.
2. `src/tax/grandfathering.rs`, `src/tax/rules.rs`, and `src/tax/harvesting.rs`: Section 55(2)(ac) Fair Market Value computation as of Jan 31, 2018 (deemed cost formula), Budget 2024 statutory cutoff (July 23, 2024), Section 112A 12.5% LTCG / ₹1.25L exemption, Section 111A 20% STCG, Section 50AA debt slab taxation, and ELSS 3-year statutory lock-in.
3. `src/performance/xirr.rs` and `src/performance/metrics.rs`: Newton-Raphson solver with bisection fallback, derivative clipping (`f'(r) -> epsilon`), initial bracket estimation, and CAGR/absolute return calculations.
4. `src/xray/overlap.rs` and `src/xray/allocation.rs`: Portfolio overlap formula (`min(weight_a, weight_b)`), market-cap normalization, and stock name normalization rules.

## Plan Excerpt
**Files:**
- Modify: `backend-rs/crates/portfolio-core/src/holdings/lot.rs`
- Modify: `backend-rs/crates/portfolio-core/src/holdings/registry.rs`
- Modify: `backend-rs/crates/portfolio-core/src/tax/classification.rs`
- Modify: `backend-rs/crates/portfolio-core/src/tax/grandfathering.rs`
- Modify: `backend-rs/crates/portfolio-core/src/tax/rules.rs`
- Modify: `backend-rs/crates/portfolio-core/src/tax/harvesting.rs`
- Modify: `backend-rs/crates/portfolio-core/src/performance/xirr.rs`
- Modify: `backend-rs/crates/portfolio-core/src/performance/metrics.rs`
- Modify: `backend-rs/crates/portfolio-core/src/xray/overlap.rs`
- Modify: `backend-rs/crates/portfolio-core/src/xray/allocation.rs`

## Steps
1. Add thorough `///` doc comments for structs, enums, methods, and functions.
2. Add inline comments explaining non-trivial mathematical and statutory formulas (Newton-Raphson, Section 55(2)(ac), FIFO lot splitting).
3. Ensure any ambiguous/short variable names (e.g. `d`, `m`, `u`) are made self-documenting where appropriate without breaking trait implementations (like `Add::add(self, rhs)`).
4. Verify tests and linting:
   - `(cd backend-rs && cargo test --package portfolio-core)`
   - `(cd backend-rs && cargo clippy --package portfolio-core --all-targets -- -D warnings)`
   - `(cd backend-rs && cargo fmt --check)`
5. Commit: `git add backend-rs/crates/portfolio-core && git commit -m "docs(portfolio-core): add comprehensive rust docs, mathematical comments, and self-documenting naming"`.

## Constraints & Mandates
- Follow `AGENTS.md`: Strict Zero-I/O Invariant in `portfolio-core`; The Invariant Oracle Law (never modify expected values or assertion tolerances in tests); Universal Generality Mandate.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
