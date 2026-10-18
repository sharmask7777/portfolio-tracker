# Rust Backend Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Portfolio Tracker backend from TypeScript/Express to an idiomatic, deterministic, and high-performance Rust multi-crate architecture, porting all test suites first via strict TDD, certifying exact parity against Node.js, and keeping documentation up to date every step of the way.

**Architecture:** Hexagonal architecture in a multi-crate Cargo workspace (`backend-rs`). A pure, zero-I/O domain engine (`portfolio-core`) housing exact decimal financial math, Section 112A grandfathering, deterministic XIRR, and the 10 mock portfolios suite, flanked by SQLx persistence (`portfolio-db`), Axum REST gateway (`portfolio-api`), BullMQ-compatible Redis worker (`portfolio-worker`), and an automated differential parity testing harness (`portfolio-parity`).

**Tech Stack:** Rust 1.91+, `rust_decimal`, `chrono`, `sqlx` (PostgreSQL), `axum`, `tokio`, `tower-http`, `redis`, `thiserror`, `proptest`, `serde`, `serde_json`, `jsonwebtoken`, `bcrypt`.

---

## File Structure & Responsibilities

```
backend-rs/
├── Cargo.toml                                 # Workspace manifest configuring member crates & shared dependencies
├── crates/
│   ├── portfolio-core/                        # Pure domain financial calculation engine (Zero-I/O, sync only)
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs                         # Public domain module exports
│   │   │   ├── types.rs                       # Money, Units, Nav, Percentage, FolioNumber, Pan, Isin
│   │   │   ├── error.rs                       # Strongly typed PortfolioError / TaxError via thiserror
│   │   │   ├── holdings/                      # FIFO lot matching, folio/scheme consolidation, zero-holding isolation
│   │   │   │   ├── mod.rs
│   │   │   │   ├── lot.rs
│   │   │   │   └── registry.rs
│   │   │   ├── tax/                           # Section 112A grandfathering, LTCG/STCG, slabs, loss harvesting
│   │   │   │   ├── mod.rs
│   │   │   │   ├── grandfathering.rs
│   │   │   │   ├── rules.rs
│   │   │   │   └── harvesting.rs
│   │   │   ├── performance/                   # Deterministic XIRR (Brent's method), CAGR, Absolute Return
│   │   │   │   ├── mod.rs
│   │   │   │   ├── xirr.rs
│   │   │   │   └── metrics.rs
│   │   │   ├── xray/                          # Stock overlap (Jaccard), market-cap & sector allocation
│   │   │   │   ├── mod.rs
│   │   │   │   └── overlap.rs
│   │   │   └── parser/                        # In-memory CAS JSON/PDF transaction extractor
│   │   │       ├── mod.rs
│   │   │       └── cas.rs
│   │   └── tests/
│   │       ├── mock_portfolios.rs             # Canonical 10 Mock Portfolios suite (hermetic ground truth)
│   │       └── proptests.rs                   # Invariant property testing via proptest
│   ├── portfolio-db/                          # PostgreSQL persistence layer with SQLx
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── entities.rs                    # Direct mappings to PostgreSQL schema tables
│   │   │   ├── repositories/                  # Repository traits & sqlx implementations
│   │   │   │   ├── mod.rs
│   │   │   │   ├── portfolio_repo.rs
│   │   │   │   ├── transaction_repo.rs
│   │   │   │   └── family_repo.rs
│   │   │   └── test_mocks.rs                  # InMemoryPortfolioRepository for zero-docker tests
│   │   └── tests/
│   │       └── persistence_tests.rs           # Hermetic repository tests
│   ├── portfolio-api/                         # Axum REST API gateway
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   ├── state.rs                       # AppState (DB pool, Redis client)
│   │   │   ├── middleware/                    # JWT auth, security headers, CORS
│   │   │   ├── routes/                        # /api/portfolio, /api/tax, /api/family, /api/auth
│   │   │   └── errors.rs                      # Axum IntoResponse centralized error mapper
│   │   └── tests/
│   │       └── contract_tests.rs              # HTTP endpoint parity tests
│   ├── portfolio-worker/                      # Redis background worker
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── lib.rs
│   │   │   └── jobs/                          # BullMQ-compatible job consumers (CAS parse, NAV refresh)
│   │   └── tests/
│   │       └── worker_tests.rs
│   └── portfolio-parity/                      # Dual-runner differential parity validation suite
│       ├── Cargo.toml
│       ├── src/
│       │   └── main.rs                        # Parity comparison runner CLI
│       └── tests/
│           └── differential_test.rs           # Automated Node vs Rust diffing tests
AGENTS.md                                      # AI instructions (must document Rust workflow & mandates)
README.md                                      # Project documentation (setup, dual-stack running, testing)
.husky/pre-push                                # Git hook ensuring Rust and Node tests pass before push
```

---

## Phased Tasks

### Task 1: Workspace Initialization & Documentation Setup

**Files:**
- Create: `backend-rs/Cargo.toml`
- Create: `backend-rs/crates/portfolio-core/Cargo.toml`
- Create: `backend-rs/crates/portfolio-core/src/lib.rs`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `.husky/pre-push`

- [ ] **Step 1: Create Cargo workspace manifest**

```toml
# backend-rs/Cargo.toml
[workspace]
resolver = "2"
members = [
    "crates/portfolio-core",
    "crates/portfolio-db",
    "crates/portfolio-api",
    "crates/portfolio-worker",
    "crates/portfolio-parity",
]

[workspace.package]
version = "0.1.0"
edition = "2024"
authors = ["Portfolio Tracker Contributors"]
license = "ISC"

[workspace.dependencies]
rust_decimal = { version = "1.36", features = ["serde-with-str", "maths"] }
chrono = { version = "0.4", features = ["serde"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "2.0"
tokio = { version = "1.43", features = ["full"] }
sqlx = { version = "0.8", features = ["runtime-tokio-rustls", "postgres", "chrono", "rust_decimal", "uuid"] }
axum = { version = "0.8", features = ["macros"] }
tower-http = { version = "0.6", features = ["cors", "trace", "set-header"] }
redis = { version = "0.28", features = ["tokio-comp"] }
jsonwebtoken = "9.3"
bcrypt = "0.17"
uuid = { version = "1.13", features = ["v4", "serde"] }
proptest = "1.6"
```

- [ ] **Step 2: Create initial `portfolio-core` manifest and placeholder**

```toml
# backend-rs/crates/portfolio-core/Cargo.toml
[package]
name = "portfolio-core"
version.workspace = true
edition.workspace = true

[dependencies]
rust_decimal.workspace = true
chrono.workspace = true
serde.workspace = true
serde_json.workspace = true
thiserror.workspace = true

[dev-dependencies]
proptest.workspace = true
```

```rust
// backend-rs/crates/portfolio-core/src/lib.rs
//! Zero-I/O deterministic financial calculations for Portfolio Tracker.
pub mod types;
pub mod error;
pub mod holdings;
pub mod tax;
pub mod performance;
pub mod xray;
pub mod parser;
```

- [ ] **Step 3: Update `AGENTS.md` and `README.md` with Rust mandates**

In `AGENTS.md`, document the Rust testing commands (`cargo test --workspace`), the requirement that all financial tests in `portfolio-core` remain strictly zero-I/O, and that `backend-rs` tests must pass before pushing.
In `README.md`, add instructions for compiling and testing `backend-rs`.

- [ ] **Step 4: Update `.husky/pre-push` to execute `cargo test`**

Add `(cd backend-rs && cargo test --workspace)` to `.husky/pre-push` so no regression can ever be pushed.

- [ ] **Step 5: Verify workspace compilation & commit**

Run: `cd backend-rs && cargo check`
Expected: PASS
Run: `git add backend-rs AGENTS.md README.md .husky/pre-push && git commit -m "chore: initialize backend-rs cargo workspace and documentation"`

---

### Task 2: Financial Primitives & Exact Precision Types (`portfolio-core`)

**Files:**
- Create: `backend-rs/crates/portfolio-core/src/types.rs`
- Create: `backend-rs/crates/portfolio-core/src/error.rs`
- Create: `backend-rs/crates/portfolio-core/tests/types_test.rs`

- [ ] **Step 1: Write the failing tests for financial primitives (RED)**

```rust
// backend-rs/crates/portfolio-core/tests/types_test.rs
use portfolio_core::types::{Money, Units, Nav, Percentage};
use std::str::FromStr;

#[test]
fn test_exact_money_precision_prevents_penny_loss() {
    let a = Money::from_str("0.10").unwrap();
    let b = Money::from_str("0.20").unwrap();
    let sum = a + b;
    assert_eq!(sum.to_string(), "0.30"); // Prevents 0.30000000000000004
}

#[test]
fn test_units_four_decimal_places() {
    let u = Units::from_str("123.45678").unwrap().round_to_precision();
    assert_eq!(u.to_string(), "123.4568");
}

#[test]
fn test_nav_four_decimal_places() {
    let n = Nav::from_str("45.1234").unwrap();
    let u = Units::from_str("100.0000").unwrap();
    let value = n.multiply_by_units(u);
    assert_eq!(value.to_string(), "4512.34");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --package portfolio-core --test types_test`
Expected: FAIL (types not defined)

- [ ] **Step 3: Implement exact precision financial types (GREEN)**

```rust
// backend-rs/crates/portfolio-core/src/types.rs
use rust_decimal::Decimal;
use rust_decimal::RoundingStrategy;
use serde::{Deserialize, Serialize};
use std::ops::{Add, Sub, Mul, Div};
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Default)]
pub struct Money(pub Decimal);

impl Money {
    pub const ZERO: Self = Self(Decimal::ZERO);
    pub fn new(val: Decimal) -> Self { Self(val.round_dp_with_strategy(2, RoundingStrategy::MidpointNearestEven)) }
    pub fn max(self, other: Self) -> Self { Self(self.0.max(other.0)) }
    pub fn min(self, other: Self) -> Self { Self(self.0.min(other.0)) }
}

impl FromStr for Money {
    type Err = rust_decimal::Error;
    fn from_str(s: &str) -> Result<Self, Self::Err> { Ok(Self::new(Decimal::from_str(s)?)) }
}

impl std::fmt::Display for Money {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{:.2}", self.0) }
}

impl Add for Money { type Output = Self; fn add(self, rhs: Self) -> Self { Self::new(self.0 + rhs.0) } }
impl Sub for Money { type Output = Self; fn sub(self, rhs: Self) -> Self { Self::new(self.0 - rhs.0) } }

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Default)]
pub struct Units(pub Decimal);

impl Units {
    pub const ZERO: Self = Self(Decimal::ZERO);
    pub fn new(val: Decimal) -> Self { Self(val) }
    pub fn round_to_precision(self) -> Self { Self(self.0.round_dp_with_strategy(4, RoundingStrategy::MidpointNearestEven)) }
}

impl FromStr for Units {
    type Err = rust_decimal::Error;
    fn from_str(s: &str) -> Result<Self, Self::Err> { Ok(Self(Decimal::from_str(s)?)) }
}

impl std::fmt::Display for Units {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { write!(f, "{:.4}", self.0) }
}

impl Add for Units { type Output = Self; fn add(self, rhs: Self) -> Self { Self(self.0 + rhs.0) } }
impl Sub for Units { type Output = Self; fn sub(self, rhs: Self) -> Self { Self(self.0 - rhs.0) } }

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Default)]
pub struct Nav(pub Decimal);

impl Nav {
    pub fn new(val: Decimal) -> Self { Self(val.round_dp_with_strategy(4, RoundingStrategy::MidpointNearestEven)) }
    pub fn multiply_by_units(self, units: Units) -> Money {
        Money::new(self.0 * units.0)
    }
}

impl FromStr for Nav {
    type Err = rust_decimal::Error;
    fn from_str(s: &str) -> Result<Self, Self::Err> { Ok(Self::new(Decimal::from_str(s)?)) }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize, Default)]
pub struct Percentage(pub Decimal);
```

```rust
// backend-rs/crates/portfolio-core/src/error.rs
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum PortfolioError {
    #[error("Insufficient units available: requested {requested}, available {available}")]
    InsufficientUnits { requested: String, available: String },
    #[error("Units locked under statutory rule: locked {locked}, available {available}")]
    UnitsLocked { locked: String, available: String },
    #[error("XIRR computation failed to converge")]
    XirrConvergenceFailure,
    #[error("Invalid transaction: {0}")]
    InvalidTransaction(String),
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --package portfolio-core --test types_test`
Expected: PASS

- [ ] **Step 5: Commit**

Run: `git add backend-rs/crates/portfolio-core/src/types.rs backend-rs/crates/portfolio-core/src/error.rs backend-rs/crates/portfolio-core/tests/types_test.rs && git commit -m "feat(portfolio-core): add exact precision financial types and domain errors"`

---

### Task 3: The Canonical 10 Mock Portfolios Test Specification (RED)

**Files:**
- Create: `backend-rs/crates/portfolio-core/tests/mock_portfolios.rs`

- [ ] **Step 1: Port all 10 mock portfolio specifications from TypeScript to Rust (RED)**

Transcribe all 10 mock portfolios from `backend/src/test/mock-portfolios.spec.ts` into strongly-typed, human-readable BDD test cases:
1. `test_portfolio_1_scheme_consolidation`: Aggregates folios `AURORA-FOLIO-1` and `AURORA-FOLIO-2` for scheme `INF209K01165` without duplicate valuation.
2. `test_portfolio_2_fully_redeemed_zero_holdings`: Fully redeemed position (`ZEPHYR-EXITED-001`) reports 0 active units and 0 current value.
3. `test_portfolio_3_partial_redemption_retained`: FIFO partial redemption consumes oldest lots, accurately retaining residual units and proportional invested cost.
4. `test_portfolio_4_direct_equity_and_mf_intersection`: Intersects direct Reliance shares and HDFC Top 100 Reliance holdings cleanly.
5. `test_portfolio_5_pure_debt_and_liquid_funds`: Computes non-equity debt metrics cleanly without throwing or producing `NaN`.
6. `test_portfolio_6_alternative_assets_gold`: Calculates accurate returns for SGB/Physical Gold assets.
7. `test_portfolio_7_multi_member_cascading_deletion`: Verifies transactional deletion integrity across family members.
8. `test_portfolio_8_grandfathering_section_112a`: Calculates LTCG using $\max(\text{Cost}, \min(\text{FMV on 31-Jan-2018}, \text{Sale}))$.
9. `test_portfolio_9_elss_3yr_lockin`: Allows selling unlocked units (>3 years) while strictly blocking locked units ($\le 3$ years).
10. `test_portfolio_10_folio_lifecycle_manual_close`: Validates closing and redemption lifecycle.

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --package portfolio-core --test mock_portfolios`
Expected: FAIL (holding and tax modules not yet implemented)

- [ ] **Step 3: Commit the test specification**

Run: `git add backend-rs/crates/portfolio-core/tests/mock_portfolios.rs && git commit -m "test(portfolio-core): port 10 mock portfolios test specification from typescript"`

---

### Task 4: FIFO Lot Engine & Scheme Consolidation (GREEN for Portfolios 1, 2, 3, 10)

**Files:**
- Create: `backend-rs/crates/portfolio-core/src/holdings/lot.rs`
- Create: `backend-rs/crates/portfolio-core/src/holdings/registry.rs`
- Create: `backend-rs/crates/portfolio-core/src/holdings/mod.rs`
- Modify: `backend-rs/crates/portfolio-core/src/lib.rs`

- [ ] **Step 1: Implement FIFO Lot data structure**

```rust
// backend-rs/crates/portfolio-core/src/holdings/lot.rs
use crate::types::{Money, Units, Nav};
use chrono::NaiveDate;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaxLot {
    pub purchase_date: NaiveDate,
    pub original_units: Units,
    pub remaining_units: Units,
    pub purchase_nav: Nav,
    pub purchase_amount: Money,
}
```

- [ ] **Step 2: Implement Holdings Registry and FIFO consumption**

Implement transaction processing (`buy`, `sip`, `sell`) in `backend-rs/crates/portfolio-core/src/holdings/registry.rs`:
- When a `sell` occurs, deplete `remaining_units` from the earliest open `TaxLot` in chronological order.
- Calculate realized gain and remaining cost basis proportionally.
- Consolidate multiple folios under identical scheme codes (ISIN / AMFI).
- Isolate fully redeemed positions (`remaining_units == 0`) with zero current valuation.

- [ ] **Step 3: Run mock portfolio tests for Portfolios 1, 2, 3, 10**

Run: `cargo test --package portfolio-core --test mock_portfolios portfolio_1 portfolio_2 portfolio_3 portfolio_10`
Expected: PASS

- [ ] **Step 4: Commit**

Run: `git add backend-rs/crates/portfolio-core/src/holdings/ && git commit -m "feat(portfolio-core): implement fifo lot matching and scheme consolidation engine"`

---

### Task 5: Section 112A LTCG Grandfathering & Tax Engine (GREEN for Portfolios 8 & 9)

**Files:**
- Create: `backend-rs/crates/portfolio-core/src/tax/grandfathering.rs`
- Create: `backend-rs/crates/portfolio-core/src/tax/rules.rs`
- Create: `backend-rs/crates/portfolio-core/src/tax/harvesting.rs`
- Create: `backend-rs/crates/portfolio-core/src/tax/mod.rs`

- [ ] **Step 1: Implement Section 112A statutory formula**

```rust
// backend-rs/crates/portfolio-core/src/tax/grandfathering.rs
use crate::types::Money;
use chrono::NaiveDate;

pub const JAN_31_2018: NaiveDate = NaiveDate::from_ymd_opt(2018, 1, 31).unwrap();

pub fn compute_deemed_cost_112a(
    purchase_date: NaiveDate,
    actual_cost: Money,
    sale_price: Money,
    fmv_jan_31_2018: Option<Money>,
) -> Money {
    match fmv_jan_31_2018 {
        Some(fmv) if purchase_date <= JAN_31_2018 => {
            actual_cost.max(fmv.min(sale_price))
        }
        _ => actual_cost,
    }
}
```

- [ ] **Step 2: Implement ELSS 3-Year Lock-in Validator & Harvesting Rules**

Implement lock-in verification in `backend-rs/crates/portfolio-core/src/tax/rules.rs`:
- For each lot in an ELSS scheme, if `as_of < purchase_date + 3 years`, classify units as `locked`.
- Attempting to sell more than `available_units` returns `Err(PortfolioError::UnitsLocked)`.
- Implement tax gain harvesting up to ₹1,25,000 annual exemption limit in `harvesting.rs`.

- [ ] **Step 3: Run mock portfolio tests for Portfolios 8 & 9**

Run: `cargo test --package portfolio-core --test mock_portfolios portfolio_8 portfolio_9`
Expected: PASS

- [ ] **Step 4: Commit**

Run: `git add backend-rs/crates/portfolio-core/src/tax/ && git commit -m "feat(portfolio-core): implement section 112a grandfathering and elss lock-in tax engine"`

---

### Task 6: Deterministic XIRR & Performance Metrics (GREEN for Portfolios 4, 5, 6)

**Files:**
- Create: `backend-rs/crates/portfolio-core/src/performance/xirr.rs`
- Create: `backend-rs/crates/portfolio-core/src/performance/metrics.rs`
- Create: `backend-rs/crates/portfolio-core/src/performance/mod.rs`

- [ ] **Step 1: Implement deterministic root-finding XIRR using Brent's method**

```rust
// backend-rs/crates/portfolio-core/src/performance/xirr.rs
use chrono::NaiveDate;
use rust_decimal::Decimal;

pub struct CashFlow {
    pub date: NaiveDate,
    pub amount: Decimal, // negative for outflow (investment), positive for inflow (redemption/current value)
}

pub fn calculate_xirr(cash_flows: &[CashFlow]) -> Result<Decimal, crate::error::PortfolioError> {
    // Deterministic Brent's method with interval bracketing and convergence tolerance 1e-7
}
```

- [ ] **Step 2: Implement CAGR and Absolute Return**

Implement holding-period return formulas in `backend-rs/crates/portfolio-core/src/performance/metrics.rs`.

- [ ] **Step 3: Run mock portfolio tests for Portfolios 4, 5, 6 and all 10 portfolios**

Run: `cargo test --package portfolio-core --test mock_portfolios`
Expected: ALL 10 TESTS PASS

- [ ] **Step 4: Commit**

Run: `git add backend-rs/crates/portfolio-core/src/performance/ && git commit -m "feat(portfolio-core): implement deterministic xirr and performance metrics"`

---

### Task 7: Property-Based Testing (`portfolio-core/tests/proptests.rs`)

**Files:**
- Create: `backend-rs/crates/portfolio-core/tests/proptests.rs`

- [ ] **Step 1: Write property tests for financial invariants**

Port `backend/src/services/*.pbt.spec.ts` using `proptest`:
1. **Conservation of Units:** Random sequences of buy and sell transactions never violate $\sum \text{bought} - \sum \text{sold} \equiv \text{remaining}$.
2. **Grandfathering Cost Bounds:** Deemed cost $\in [\text{Actual Cost}, \max(\text{Actual Cost}, \text{FMV})]$.
3. **XIRR Monotonicity:** Higher terminal valuation with identical cash flows strictly increases XIRR.

- [ ] **Step 2: Run property-based tests**

Run: `cargo test --package portfolio-core --test proptests`
Expected: PASS (1000+ generated test cases passing)

- [ ] **Step 3: Commit**

Run: `git add backend-rs/crates/portfolio-core/tests/proptests.rs && git commit -m "test(portfolio-core): add property-based invariant test suite"`

---

### Task 8: Automated Differential Parity Harness (`portfolio-parity`)

**Files:**
- Create: `backend-rs/crates/portfolio-parity/Cargo.toml`
- Create: `backend-rs/crates/portfolio-parity/src/main.rs`
- Create: `backend-rs/crates/portfolio-parity/tests/differential_test.rs`
- Create: `tests/fixtures/synthetic/portfolio_scenarios.json`

- [ ] **Step 1: Create shared synthetic JSON fixtures**

Extract synthetic portfolio transactions, buy dates, and valuation dates into `tests/fixtures/synthetic/portfolio_scenarios.json`.

- [ ] **Step 2: Implement dual-runner parity verification test**

Run scenarios through Node.js test runner and Rust `portfolio-core`, diffing:
- Tax capital gains (tolerance $\le ₹0.01$).
- Active units (tolerance $\le 0.0001$).
- XIRR (tolerance $\le 10^{-6}$).

- [ ] **Step 3: Execute parity test suite**

Run: `cargo test --package portfolio-parity`
Expected: PASS (Zero regressions certified)

- [ ] **Step 4: Commit**

Run: `git add backend-rs/crates/portfolio-parity/ tests/fixtures/ && git commit -m "feat(portfolio-parity): add differential dual-runner parity validation harness"`

---

### Task 9: Database Persistence Layer (`portfolio-db`)

**Files:**
- Create: `backend-rs/crates/portfolio-db/Cargo.toml`
- Create: `backend-rs/crates/portfolio-db/src/lib.rs`
- Create: `backend-rs/crates/portfolio-db/src/entities.rs`
- Create: `backend-rs/crates/portfolio-db/src/repositories/portfolio_repo.rs`
- Create: `backend-rs/crates/portfolio-db/src/test_mocks.rs`
- Create: `backend-rs/crates/portfolio-db/tests/persistence_tests.rs`

- [ ] **Step 1: Write failing repository test (RED)**

Write tests in `persistence_tests.rs` verifying portfolio retrieval, transaction listing, and cascading deletion using `InMemoryPortfolioRepository`.

- [ ] **Step 2: Implement entities and repository traits (GREEN)**

Map PostgreSQL tables from Prisma schema directly into Rust structs. Implement `PortfolioRepository` with `sqlx` and in-memory mock.

- [ ] **Step 3: Run repository tests**

Run: `cargo test --package portfolio-db`
Expected: PASS

- [ ] **Step 4: Commit**

Run: `git add backend-rs/crates/portfolio-db/ && git commit -m "feat(portfolio-db): implement entities and repository layer with sqlx"`

---

### Task 10: HTTP REST API Gateway (`portfolio-api`)

**Files:**
- Create: `backend-rs/crates/portfolio-api/Cargo.toml`
- Create: `backend-rs/crates/portfolio-api/src/lib.rs`
- Create: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Create: `backend-rs/crates/portfolio-api/src/routes/tax.rs`
- Create: `backend-rs/crates/portfolio-api/src/middleware/auth.rs`
- Create: `backend-rs/crates/portfolio-api/tests/contract_tests.rs`

- [ ] **Step 1: Write failing HTTP contract parity tests (RED)**

Test endpoints `/api/portfolio/:id/summary` and `/api/tax/gains` using Axum's `tower::ServiceExt::oneshot`.

- [ ] **Step 2: Implement Axum handlers and JWT auth middleware (GREEN)**

Implement routes with `serde(rename_all = "camelCase")` matching Express JSON responses exactly.

- [ ] **Step 3: Run HTTP contract tests**

Run: `cargo test --package portfolio-api`
Expected: PASS

- [ ] **Step 4: Commit**

Run: `git add backend-rs/crates/portfolio-api/ && git commit -m "feat(portfolio-api): implement axum rest gateway with contract parity"`

---

### Task 11: Background Queue Workers (`portfolio-worker`)

**Files:**
- Create: `backend-rs/crates/portfolio-worker/Cargo.toml`
- Create: `backend-rs/crates/portfolio-worker/src/lib.rs`
- Create: `backend-rs/crates/portfolio-worker/src/jobs/cas_parser.rs`
- Create: `backend-rs/crates/portfolio-worker/src/jobs/nav_refresh.rs`
- Create: `backend-rs/crates/portfolio-worker/tests/worker_tests.rs`

- [ ] **Step 1: Write worker tests (RED)**
- [ ] **Step 2: Implement Redis queue consumer matching BullMQ format (GREEN)**
- [ ] **Step 3: Run worker tests**

Run: `cargo test --package portfolio-worker`
Expected: PASS

- [ ] **Step 4: Commit**

Run: `git add backend-rs/crates/portfolio-worker/ && git commit -m "feat(portfolio-worker): implement redis background worker for cas parsing and nav refresh"`

---

### Task 12: CI/CD, Documentation, and Cutover Verification

**Files:**
- Create: `backend-rs/Dockerfile`
- Modify: `.github/workflows/e2e.yml`
- Modify: `docker-compose.yml`
- Modify: `AGENTS.md`
- Modify: `README.md`

- [ ] **Step 1: Create multi-stage Rust Dockerfile**
- [ ] **Step 2: Update GitHub Actions CI workflow to run Rust tests**
- [ ] **Step 3: Verify full Playwright E2E and hermetic test suite against Rust backend**
- [ ] **Step 4: Final update to `AGENTS.md` and `README.md`**
- [ ] **Step 5: Commit and verify clean workspace**

Run: `cargo test --workspace` and `npm test`
Expected: ALL GREEN
Run: `git commit -m "chore: finalize rust backend migration, ci workflows, and documentation"`
