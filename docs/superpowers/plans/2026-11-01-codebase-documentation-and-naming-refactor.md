# Codebase Documentation, Rust Docs, JSDoc, and Self-Documenting Naming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide comprehensive, human-readable documentation across the entire codebase (`portfolio-core`, `portfolio-db`, `portfolio-api`, `portfolio-worker`, and `frontend`), enrich complex mathematical and statutory algorithms with explanatory inline comments, and refactor ambiguous/cryptic variable and method names into self-documenting identifiers while strictly preserving 100% numerical parity and zero contract drift.

**Architecture:** Pure documentation and readability refactoring: Rust doc comments (`///`) on all structs, enums, traits, and functions; TypeScript JSDoc (`/** ... */`) across frontend utilities and components; mathematical/statutory inline comments explaining domain-heavy logic (FIFO lot depletion, Section 55(2)(ac) grandfathering, Section 112A/111A/50AA tax rates, XIRR Newton-Raphson bounds, SQL CTE lookups, and Schedule CG Table F quarterly symmetry); and renaming cryptic abbreviations to clean self-documenting identifiers.

**Tech Stack:** Rust (`cargo doc`, `cargo clippy`, `cargo fmt`), TypeScript / React (`tsc -b`, `vitest`).

## Global Constraints

- **Universal Generality Mandate:** Strictly zero portfolio-specific hacks or single-instance heuristics; all fixes and documentation must apply uniformly across all portfolios.
- **Self-Documenting Code Mandate (AGENTS.md Sec 8):** Clear, descriptive names; full doc comments; explanatory comments on all complex algorithms.
- **Strict Zero-I/O Invariant:** `portfolio-core` must remain 100% pure in-memory calculation functions with zero I/O, network, or database dependencies.
- **The Invariant Oracle Law:** Never relax numerical bounds (Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$).
- **The Zero-Any Mandate:** No `any` types in TypeScript code.
- **Mandatory Synthetic Data:** Strictly zero real PII, PANs, user names, or CAS statements.

## Review Focus

1. **Behavioral Invariance:** Refactoring variable/method names and adding doc comments must not alter runtime evaluation, numerical results, or API response shapes.
2. **Mathematical Accuracy of Explanations:** Explanatory comments for XIRR, FIFO lot tracking, Section 55(2)(ac) grandfathering, and Schedule CG Table F quarterly symmetry must accurately codify the mathematical formula and statutory CBDT rules.
3. **Rust Doc Quality:** All public items must compile cleanly with `cargo doc` without broken intra-doc links or missing parameter/return descriptions.
4. **Zero-Any Compliance:** All `any` types in `frontend/src/utils/consolidation.ts` must be replaced with strong TypeScript types (`FolioView`, `Record<string, unknown>`).
5. **Contract Drift Guard:** All API exports must remain identical in `frontend/src/types/generated`.

---

### Task 1: `portfolio-core` Comprehensive Rust Docs, Self-Documenting Naming & Mathematical Comments

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

- [ ] **Step 1: Audit and enhance Rust docs and comments in `holdings/`**
  - In `lot.rs`: Document FIFO lot depletion mechanics, units rounding tolerances, and tie-breaking rules.
  - In `registry.rs`: Document `FolioRegistry`, holding valuation, and net cashflow aggregation.
- [ ] **Step 2: Audit and enhance Rust docs and statutory comments in `tax/`**
  - In `grandfathering.rs`: Add detailed statutory comments explaining Section 55(2)(ac) Fair Market Value formula as of Jan 31, 2018 (`cost = max(actual_cost, min(fmv, sale_price))`), preventing artificial losses while shielding pre-2018 gains.
  - In `rules.rs`: Add comments explaining Budget 2024 cutoff (July 23, 2024), transition from 10% to 12.5% LTCG, 15% to 20% STCG, Section 50AA debt slab taxation, and ELSS 3-year statutory lock-in.
  - In `harvesting.rs`: Document tax-loss harvesting algorithm, short-term vs long-term gain netting, and exclusion of locked ELSS units.
- [ ] **Step 3: Audit and enhance Rust docs and mathematical comments in `performance/` and `xray/`**
  - In `xirr.rs`: Document Newton-Raphson iteration with bisection fallback, derivative clipping (`f'(r) -> epsilon`), initial bracket estimation, and boundary constraints.
  - In `metrics.rs`: Document CAGR, absolute return, and annualization formulas.
  - In `overlap.rs` and `allocation.rs`: Document portfolio overlap formula (`min(weight_a, weight_b)`), market-cap normalization, and stock name normalization rules.
- [ ] **Step 4: Verify tests and formatting**
  - Run: `(cd backend-rs && cargo test --package portfolio-core)`
  - Run: `(cd backend-rs && cargo clippy --package portfolio-core --all-targets -- -D warnings)`
  - Run: `(cd backend-rs && cargo fmt --check)`
  - Expected: PASS
- [ ] **Step 5: Commit**
  - `git commit -m "docs(portfolio-core): add comprehensive rust docs, mathematical comments, and self-documenting naming"`

---

### Task 2: `portfolio-db` Comprehensive Rust Docs, Query Explanations & Repository Clarity

**Files:**
- Modify: `backend-rs/crates/portfolio-db/src/repositories/fund_holdings_repo.rs`
- Modify: `backend-rs/crates/portfolio-db/src/repositories/portfolio_repo.rs`
- Modify: `backend-rs/crates/portfolio-db/src/repositories/transaction_repo.rs`
- Modify: `backend-rs/crates/portfolio-db/src/repositories/family_repo.rs`
- Modify: `backend-rs/crates/portfolio-db/src/test_mocks.rs`
- Modify: `backend-rs/crates/portfolio-db/src/schema.rs`
- Modify: `backend-rs/crates/portfolio-db/src/entities.rs`

- [ ] **Step 1: Document database schemas, constraints, and entities**
  - In `schema.rs`: Document all table definitions, unique composite constraints (e.g. `("isin", "asOfDate", "stockName")`), foreign key cascading rules, and index strategies.
  - In `entities.rs`: Document all entity structs and fields.
- [ ] **Step 2: Document repository traits and SQLx query implementations**
  - In `fund_holdings_repo.rs`: Document CTE batch retrieval query (`latest_dates`), date-versioning semantics, and transactional upsert with `ON CONFLICT DO UPDATE`.
  - In `portfolio_repo.rs`, `transaction_repo.rs`, and `family_repo.rs`: Document CRUD operations, transaction isolation, and user-scoping constraints.
- [ ] **Step 3: Document in-memory mock implementation in `test_mocks.rs`**
  - Document thread-safe concurrent state (`RwLock<InMemoryDatabaseState>`), date-partitioned filtering, and deterministic tie-breaking.
- [ ] **Step 4: Verify tests and formatting**
  - Run: `(cd backend-rs && cargo test --package portfolio-db)`
  - Run: `(cd backend-rs && cargo clippy --package portfolio-db --all-targets -- -D warnings)`
  - Run: `(cd backend-rs && cargo fmt --check)`
  - Expected: PASS
- [ ] **Step 5: Commit**
  - `git commit -m "docs(portfolio-db): add comprehensive rust docs and query explanations"`

---

### Task 3: `portfolio-api` & `portfolio-worker` Comprehensive Rust Docs & Variable Naming Refactoring

**Files:**
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/fund_holdings.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/tax.rs`
- Modify: `backend-rs/crates/portfolio-api/src/services/nav_sync.rs`
- Modify: `backend-rs/crates/portfolio-worker/src/jobs/cas_parser.rs`
- Modify: `backend-rs/crates/portfolio-worker/src/jobs/nav_refresh.rs`

- [ ] **Step 1: Refactor cryptic variable names in `routes/portfolio.rs`**
  - In `compute_portfolio_exposures`: Rename cryptic variables (`val_dec` -> `current_holding_value`, `norm_key` -> `normalized_stock_key`, `h` -> `disclosed_holding`, `ctx` -> `core_transaction`, `t` -> `transaction_entity`, `folio_val` -> `folio_market_value`, `stock_val` -> `allocated_stock_value`).
  - Add doc comments for `compute_portfolio_exposures`, `resolve_holdings`, `get_stock_sector`, and `get_overlap`.
- [ ] **Step 2: Document API route handlers in `routes/fund_holdings.rs` and `routes/tax.rs`**
  - Document request/response contracts, HTTP status codes, validation rules, and advance tax quarter mapping.
- [ ] **Step 3: Document NAV synchronization and background worker jobs**
  - In `services/nav_sync.rs`: Document rate-limiting acquisition, fallback to historical NAVs, and lazy background synchronization.
  - In `portfolio-worker`: Document CAS parsing worker pipeline and BullMQ queue message lifecycle.
- [ ] **Step 4: Verify tests and formatting**
  - Run: `(cd backend-rs && cargo test --package portfolio-api && cd ../portfolio-worker && cargo test)`
  - Run: `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`
  - Run: `(cd backend-rs && cargo fmt --check)`
  - Expected: PASS
- [ ] **Step 5: Commit**
  - `git commit -m "refactor(portfolio-api): improve variable naming clarity and add comprehensive rust docs"`

---

### Task 4: Frontend TypeScript Documentation, JSDoc & Type Cleansing (`frontend/src`)

**Files:**
- Modify: `frontend/src/utils/consolidation.ts`
- Modify: `frontend/src/utils/itrReportGenerator.ts`
- Modify: `frontend/src/components/Analytics/IntersectionView.tsx`

- [ ] **Step 1: Eliminate `any` and add JSDoc in `frontend/src/utils/consolidation.ts`**
  - Replace `folios: any[]` with strongly-typed interfaces (`FolioView` or strict typed shape).
  - Add JSDoc documenting scheme grouping logic, unique PAN aggregation, day change percentage derivation, and value-weighted XIRR calculation.
  - Rename short variables (`f` -> `folio`, `val` -> `folioValue`).
- [ ] **Step 2: Add comprehensive JSDoc and statutory comments in `frontend/src/utils/itrReportGenerator.ts`**
  - Add JSDoc for `AdvanceTaxAccrualMatrix`, `TableFQuarterData`, and Schedule CG generation.
  - Add inline comments explaining Section 55(2)(ac) grandfathering computations, quarterly symmetry rules (Table F sum must equal net capital gain), and statutory tax rates.
- [ ] **Step 3: Add JSDoc and comments in `frontend/src/components/Analytics/IntersectionView.tsx`**
  - Document look-through stock exposure calculation, multi-fund overlap badge logic, sector filtering, and the `excludeArbitrage` toggle effect on portfolio value denominators.
- [ ] **Step 4: Verify frontend build and unit tests**
  - Run: `(cd frontend && npm run build && npm run test:unit)`
  - Expected: Clean build with 0 TypeScript errors and 113/113 passing tests.
- [ ] **Step 5: Commit**
  - `git commit -m "docs(frontend): add comprehensive JSDoc, eliminate any types in consolidation, and enhance code clarity"`

---

### Task 5: Full Hermetic Gate Execution & Verification

**Files:**
- Verify: Full verification sequence (Steps 1-7 in `AGENTS.md`).

- [ ] **Step 1: Export TypeScript bindings and check zero contract drift**
  - `(cd backend-rs && cargo test --package portfolio-api --test export_bindings) && git diff --exit-code frontend/src/types/generated`
- [ ] **Step 2: Full backend workspace test suite, clippy, and fmt**
  - `(cd backend-rs && cargo test --workspace)`
  - `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`
  - `(cd backend-rs && cargo fmt --check)`
- [ ] **Step 3: Parity validation and frontend tests**
  - `(cd backend-rs && cargo run --package portfolio-parity)`
  - `(cd frontend && npm run build && npm run test:unit)`
- [ ] **Step 4: Test coverage check**
  - `npm run test:coverage`
- [ ] **Step 5: Final review and confirmation**
