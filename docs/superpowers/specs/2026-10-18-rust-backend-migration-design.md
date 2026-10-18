# Rust Backend Migration Design Specification

## 1. Executive Summary

This document specifies the architecture, engineering principles, test strategy, and phased migration plan for porting the Portfolio Tracker backend from TypeScript/Node.js to idiomatic, high-performance **Rust**.

### Primary Objectives
- **Zero Regression & Guaranteed Parity:** Port all existing test suites first using a pure Test-Driven Development (TDD) workflow, backed by an automated differential parity harness comparing Node.js and Rust outputs on identical fixtures.
- **Deterministic Testability:** Decouple all financial calculation rules (tax, grandfathering, XIRR, ELSS lock-in, overlap, asset consolidation) into a zero-I/O pure domain engine (`portfolio-core`) with explicit temporal inputs and zero hidden side effects.
- **Human Readability:** Model financial concepts using rich domain types and fluent builders that read like an executable financial textbook, free of async/await or database ORM noise in calculation logic.
- **Exact Numerical Precision:** Replace JavaScript floating-point arithmetic (`number` / IEEE-754 `f64`) with exact arbitrary-precision decimal arithmetic (`rust_decimal::Decimal`), eliminating subtle penny-rounding bugs.
- **Continuous Documentation Hygiene:** Maintain `AGENTS.md`, `README.md`, and architectural specs continuously at each milestone.

---

## 2. Workspace Architecture

The Rust backend resides in `backend-rs/` alongside the existing `backend/` during the migration period to allow side-by-side execution and incremental verification.

### Directory Layout

```
portfolio-tracker/
├── backend/                         # Existing TypeScript / Node.js backend (unmodified reference)
├── backend-rs/                      # New Rust multi-crate workspace
│   ├── Cargo.toml                   # Workspace manifest
│   ├── Cargo.lock
│   ├── crates/
│   │   ├── portfolio-core/          # Pure financial domain logic (Zero I/O, sync only)
│   │   │   ├── Cargo.toml
│   │   │   ├── src/
│   │   │   │   ├── lib.rs
│   │   │   │   ├── types/           # Money, Units, Nav, Date, Isin, FolioNumber
│   │   │   │   ├── tax/             # Sec 112A grandfathering, LTCG/STCG, slabs, loss harvesting
│   │   │   │   ├── performance/     # Deterministic XIRR (Brent's method), CAGR, Absolute Return
│   │   │   │   ├── holdings/        # FIFO lot matching, consolidation, zero-holding isolation
│   │   │   │   ├── xray/            # Stock overlap (Jaccard), market-cap & sector allocation
│   │   │   │   └── parser/          # CAS PDF/JSON statement parser
│   │   │   └── tests/
│   │   │       ├── mock_portfolios.rs # Canonical 10 Mock Portfolios suite
│   │   │       └── proptests.rs     # Property-based invariants (proptest)
│   │   ├── portfolio-db/            # Persistence layer (sqlx + PostgreSQL)
│   │   │   ├── Cargo.toml
│   │   │   ├── src/
│   │   │   │   ├── lib.rs
│   │   │   │   ├── entities/        # Direct mapping to Prisma PostgreSQL tables
│   │   │   │   ├── repositories/    # Trait definitions & sqlx implementations
│   │   │   │   └── test_mocks/      # In-memory repository mocks for hermetic testing
│   │   │   └── tests/
│   │   ├── portfolio-api/           # REST API gateway (Axum + Tower)
│   │   │   ├── Cargo.toml
│   │   │   ├── src/
│   │   │   │   ├── lib.rs
│   │   │   │   ├── middleware/      # JWT auth, CORS, logging, rate limiting
│   │   │   │   ├── routes/          # /api/portfolio, /api/tax, /api/family, /api/auth
│   │   │   │   └── errors.rs        # Axum IntoResponse centralized error mapper
│   │   │   └── tests/               # Route integration & contract parity tests
│   │   ├── portfolio-worker/        # Background queue worker (Redis)
│   │   │   ├── Cargo.toml
│   │   │   ├── src/
│   │   │   │   ├── lib.rs
│   │   │   │   └── jobs/            # CAS parsing, AMFI NAV sync, history snapshot
│   │   │   └── tests/
│   │   └── portfolio-parity/        # Automated differential testing harness
│   │       ├── Cargo.toml
│   │       ├── src/
│   │       └── tests/               # Automated Node vs Rust diffing engine
├── docs/superpowers/specs/          # Architectural design docs
└── tests/fixtures/synthetic/        # Shared JSON fixtures for dual-runner parity
```

### Crate Dependency Graph

```
           ┌──────────────────────┐
           │    portfolio-core    │ ◄── Pure domain, zero I/O
           └──────────▲───────────┘
                      │
         ┌────────────┼────────────┐
         │                         │
┌────────┴────────┐       ┌────────┴────────┐
│  portfolio-db   │       │portfolio-parity │ ◄── Compares Node vs Rust
└────────▲────────┘       └─────────────────┘
         │
   ┌─────┴───────────────┐
   │                     │
┌──┴──────────────┐ ┌────┴─────────────┐
│  portfolio-api  │ │ portfolio-worker │
└─────────────────┘ └──────────────────┘
```

---

## 3. Deterministic Domain Engine (`portfolio-core`)

### 3.1 Guiding Principles
1. **Zero External I/O:** `portfolio-core` has zero awareness of files, sockets, databases, network connections, or async runtimes. All dependencies are pure, deterministic compute libraries.
2. **Exact Financial Precision:** All financial calculations use `rust_decimal::Decimal` (28-29 digits of precision). Never use IEEE-754 `f32` or `f64` for money, units, or NAV.
3. **Explicit Temporal Reference:** No calls to `Utc::now()` or OS time. Every function accepting a time dependency (such as tax year evaluation, ELSS 3-year lock-in check, or performance as-of date) requires an explicit `as_of: NaiveDate`.
4. **Strong Domain Types:** Wrap primitives into distinct types to prevent accidental unit-currency mismatches:
   - `Money` = `Decimal` (rounded to 2 decimal places for INR)
   - `Units` = `Decimal` (rounded to 4 decimal places for mutual funds)
   - `Nav` = `Decimal` (rounded to 4 decimal places)
   - `Pan` = Validated 10-character alphanumeric struct
   - `FolioNumber` = Cleaned, alphanumeric identifier

### 3.2 Key Modules

#### `tax`
- **Section 112A LTCG Grandfathering (Jan 31, 2018 FMV):**
  $$\text{Deemed Cost} = \max(\text{Actual Cost}, \min(\text{FMV on 31-Jan-2018}, \text{Sale Price}))$$
- **Holding Period Classifications:**
  - Equity & Equity Mutual Funds: $\ge 12$ months $\rightarrow$ LTCG (12.5% above ₹1.25 Lakh exemption limit, post Budget 2024; 10% above ₹1 Lakh historical).
  - Pre-April 2023 Debt: $\ge 36$ months $\rightarrow$ LTCG with indexation benefits.
  - Post-April 2023 Debt: Taxed at marginal income tax slab rates regardless of holding period.
- **Harvesting Engine:** Computes unrealized capital gains and losses, identifying optimal unit sales to exhaust the annual exemption limit without triggering taxable liabilities.

#### `performance`
- **Deterministic XIRR Calculation:** Root-finding algorithm using Brent's method with guaranteed interval bracketing and Newton-Raphson fallback. Bounded iteration count prevents infinite loops, and ill-formed cash flow sequences return a explicit `Result<Percentage, PerformanceError>` instead of `NaN`.
- **CAGR & Absolute Return:** Standardized formulas parameterized by exact date differences.
- **Daily Performance Change:** Delta computation against previous business day NAV.

#### `holdings`
- **FIFO Lot Engine:** Ingests transaction log (PURCHASE, SIP, REDEMPTION, SWITCH_IN, SWITCH_OUT) and maintains an ordered sequence of open purchase tax lots. Partial redemptions consume units from the earliest active lot, precisely splitting cost basis.
- **Scheme Consolidation:** Multi-folio aggregation under identical AMFI/ISIN codes without duplicate unit or value counting.
- **Zero-Holding Isolation:** Fully exited schemes retain closed transaction history but present zero current units, zero current value, and non-distorting contribution to portfolio weightings.

#### `xray`
- **Overlap Analysis:** Direct equity overlap and weighted portfolio intersection using Jaccard index:
  $$\text{Overlap}(A, B) = \sum_{c \in A \cap B} \min(\text{Weight}_A(c), \text{Weight}_B(c))$$
- **Asset Allocation:** Equity, Debt, Cash, and Alternative Asset (Gold/SGB/Real Estate) breakdowns.

---

## 4. Test Strategy: "All Tests Port First" & Pure TDD

### 4.1 Strict TDD Protocol
No production code is authored without a preceding failing test:
1. **Red Phase:** Write a Rust test file matching a Node.js test specification. Define required domain structs and signatures. The test fails compilation or fails assertion.
2. **Green Phase:** Author the minimal domain logic required to pass the test.
3. **Parity Phase:** Execute the test input through both Node.js and Rust via `portfolio-parity`. Verify that the numerical and structural outputs match within defined tolerances.
4. **Refactor Phase:** Apply Rust idioms, enhance readability, and add property-based invariant checks (`proptest`).

### 4.2 Canonical 10 Mock Portfolios Suite
The primary test suite ported to `portfolio-core/tests/mock_portfolios.rs` maps directly to `backend/src/test/mock-portfolios.spec.ts`:

| # | Portfolio Name | Core Invariant Under Test |
|---|----------------|---------------------------|
| 1 | **Aurora Growth** | Multi-folio scheme consolidation across folios/PANs without duplicate valuation. |
| 2 | **Zephyr Exited** | Zero holdings isolation; exited positions show 0 units and 0 current value. |
| 3 | **Titan Bluechip** | Partial redemptions; exact FIFO lot depletion and retained cost basis. |
| 4 | **Olympus Hybrid** | Direct equity and mutual fund underlying stock overlap and allocation. |
| 5 | **Sovereign Safety** | Pure debt/liquid funds; graceful empty equity states without NaN or errors. |
| 6 | **Nova Multi-Asset** | Alternative assets (SGB, Gold, Real Estate) pricing and performance metrics. |
| 7 | **Solaria Family** | Multi-member family profiles, cascading transactional deletion integrity. |
| 8 | **Vintage Heritage** | Section 112A LTCG grandfathering using Jan 31, 2018 FMV formula. |
| 9 | **Tax Optimizer** | ELSS 3-year statutory lock-in; selling unlocked units permitted, locked units blocked. |
| 10 | **Folio Lifecycle** | Manual folio closure, complete redemption, and historical audit retention. |

### 4.3 Property-Based Testing (`proptest`)
All property-based tests in `backend/src/services/*.pbt.spec.ts` are ported to `portfolio-core/tests/proptests.rs`:
- **Conservation of Units:** $\sum \text{Bought} - \sum \text{Sold} \equiv \text{Active Units} + \text{Fractional Remainder}$.
- **Cost Basis Bounds:** For any transaction history, remaining cost basis $\le \sum \text{Purchased Amount}$.
- **Section 112A Deemed Cost Range:** $\text{Actual Cost} \le \text{Deemed Cost} \le \max(\text{Actual Cost}, \text{FMV})$.
- **XIRR Bounds:** For any positive cash flows ending in positive valuation, $-100\% \le \text{XIRR} < +\infty$.

### 4.4 Differential Parity Harness (`portfolio-parity`)
A dedicated crate executing shared JSON fixtures (`tests/fixtures/synthetic/*.json`) through both implementations:
- **Tolerances:**
  - Monetary values (Tax, Capital Gains, Cost Basis): $\le ₹0.01$ (exact paisa match).
  - Mutual fund units: $\le 0.0001$ units.
  - XIRR / Returns: $\le 10^{-6}$ (0.0001%).
  - JSON API Schemas: Exact key and casing parity (`camelCase`).

---

## 5. Persistence, API, and Worker Architecture

### 5.1 Persistence (`portfolio-db`)
- **Technology:** `sqlx` (asynchronous, pure Rust driver with connection pooling via `PgPool`).
- **PostgreSQL Schema:** Direct compatibility with the existing Prisma database schema (`User`, `ManagedProfile`, `FamilyGroup`, `Portfolio`, `Asset`, `Folio`, `Transaction`, etc.).
- **Repository Pattern:** Pure traits with two implementations:
  1. `PgRepository`: Production implementation using SQLx.
  2. `InMemoryRepository`: Fast, thread-safe in-memory store for hermetic integration testing.
- **Transactions:** Complex workflows (e.g. CAS statement import) execute inside `sqlx::Transaction<Postgres>` to ensure atomic commits across all related tables.

### 5.2 REST API Gateway (`portfolio-api`)
- **Framework:** `axum` with `tokio` runtime and `tower-http` middleware.
- **Middleware:**
  - `AuthMiddleware`: JWT verification using `jsonwebtoken`, injecting `AuthUser` into handler arguments.
  - `SecurityHeaders`: Setting standard security headers (CSP, HSTS, X-Content-Type-Options) mirroring `helmet`.
  - `CorsLayer`: Matching existing frontend CORS permissions.
- **Route Parity:** Identical endpoints, HTTP verbs, and status codes:
  - `/api/auth/*`
  - `/api/portfolio/*`
  - `/api/tax/*`
  - `/api/family/*`
  - `/api/health`
- **Serialization:** Structs decorated with `#[serde(rename_all = "camelCase")]` to ensure zero breaking changes for the React frontend.

### 5.3 Background Worker (`portfolio-worker`)
- **Queue Engine:** Redis client subscribing to existing BullMQ queue keys (`bull:uploadQueue:*`, `bull:navQueue:*`).
- **Jobs:**
  - `CasParseJob`: Asynchronous parsing and ingestion of uploaded CAS files.
  - `NavRefreshJob`: AMFI India API synchronizer for updated NAV values.
  - `HistoryRefreshJob`: Daily portfolio snapshot generation.

### 5.4 Error Handling & Diagnostics
- Domain and database errors use `thiserror`:
  ```rust
  #[derive(Debug, thiserror::Error)]
  pub enum PortfolioError {
      #[error("Insufficient unlocked units for asset {asset_id}: requested {requested}, available {available}")]
      InsufficientUnlockedUnits { asset_id: String, requested: Units, available: Units },
      
      #[error("XIRR computation failed to converge within bounds")]
      XirrConvergenceFailure,
      
      #[error("Entity not found: {entity} ({id})")]
      NotFound { entity: &'static str, id: String },
  }
  ```
- Axum maps domain errors to structured JSON errors:
  ```json
  {
    "error": "Insufficient unlocked units for asset INF174K01LS2: requested 600.000, available 500.000",
    "code": "INSUFFICIENT_UNLOCKED_UNITS"
  }
  ```

---

## 6. Continuous Documentation & Agent Hygiene

To satisfy the mandate *"make sure all AGENTS.md and README.md and other files are up to date every step of the way"*:
1. **`AGENTS.md`:** Update to incorporate Rust-specific build/test instructions (`cargo test`, `cargo clippy`, hermetic parity commands) while preserving all existing privacy, synthetic data, and mock portfolio mandates.
2. **`README.md`:** Maintain documentation of the dual-stack development workflow, setup commands for both Node.js and Rust environments, and migration progress.
3. **Architecture Docs (`docs/architecture/`):** Update `system_overview.md` to reflect the Rust services as they are introduced.
4. **Pre-push Hooks (`.husky/pre-push`):** Update git hooks to run `cargo test --workspace` alongside existing TypeScript checks to ensure zero regressions are pushed to remote.

---

## 7. Phased Implementation Milestones

```
Phase 1: Workspace & Core Domain Engine (portfolio-core + portfolio-parity)
├── Milestone 1.1: Initialize backend-rs workspace and Rust toolchain
├── Milestone 1.2: Port 10 Mock Portfolios test specifications (RED)
├── Milestone 1.3: Implement Money, Units, Nav, and Date domain primitives
├── Milestone 1.4: Implement FIFO Lot Engine & Holdings Consolidation (GREEN)
├── Milestone 1.5: Implement Section 112A Grandfathering & Tax Engine (GREEN)
├── Milestone 1.6: Implement Deterministic XIRR & Performance Engine (GREEN)
├── Milestone 1.7: Implement X-Ray & Overlap Analysis (GREEN)
├── Milestone 1.8: Implement CAS PDF/JSON Parser (GREEN)
├── Milestone 1.9: Port Property-Based Tests (proptest)
└── Milestone 1.10: Parity Suite validation (Node vs Rust diff certified)

Phase 2: Database Persistence Layer (portfolio-db)
├── Milestone 2.1: Define entity models matching PostgreSQL schema
├── Milestone 2.2: Port database unit/integration test specifications (RED)
├── Milestone 2.3: Implement InMemoryRepository mocks for zero-IO testing
├── Milestone 2.4: Implement SQLx repositories and migrations verification (GREEN)
└── Milestone 2.5: Parity validation against Node.js Prisma queries

Phase 3: HTTP REST API Gateway (portfolio-api)
├── Milestone 3.1: Port route contract tests matching Express endpoints (RED)
├── Milestone 3.2: Implement Axum router, JWT auth middleware, and error handlers
├── Milestone 3.3: Implement Portfolio, Tax, Family, and Auth endpoints (GREEN)
└── Milestone 3.4: Dual-runner HTTP contract parity verification

Phase 4: Background Workers & Scheduling (portfolio-worker)
├── Milestone 4.1: Port worker queue tests (RED)
├── Milestone 4.2: Implement Redis worker matching BullMQ schemas (GREEN)
└── Milestone 4.3: End-to-end async upload & processing verification

Phase 5: CI/CD, Documentation, and Cutover
├── Milestone 5.1: Multi-stage Dockerfile for backend-rs
├── Milestone 5.2: Update GitHub Actions CI workflows for Rust checks
├── Milestone 5.3: Update AGENTS.md, README.md, and docs to reflect final Rust backend
└── Milestone 5.4: Frontend cutover and Playwright E2E verification
```
