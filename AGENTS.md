# AI Agent Instructions

## Mandatory Testing Requirement

For any new functionalities or bug fixes, you MUST mandatorily update and run both hermetic tests (backend/frontend unit tests) and Playwright E2E tests to cover the new code paths. These test updates must be committed as part of the primary change itself.

## Mandatory Data Anonymization & Privacy Protection

- **Zero Real Data Commitment**: You are strictly prohibited from hardcoding, committing, staging, or logging real personal identifying information (PII) or real portfolio data.
- **Forbidden Identifiers**: Absolutely NO real PANs (Permanent Account Numbers), investor names, email addresses, phone numbers, folio numbers, bank/demat details, or actual statement files (CAS PDFs, `parsed_cas.json`, `*.cas.json`).
- **Synthetic Test Data Only**: All tests, fixtures, mocks, and examples MUST use synthetic, fictitious data (e.g. synthetic PANs such as `ABCDE1234F`, `ALPAC1001A`, fictitious user names like "Aarav Sharma", "Neha Patel", etc.).
- **Ignore Verification**: Real CAS statements or parsed JSON files must remain permanently git-ignored and never committed to the repository.

## Mandatory Mock Portfolio Test Suite

- **Comprehensive Mock Suite**: All financial logic, portfolio calculations, consolidation behaviors, and UI views MUST be validated against the 10+ synthetic mock portfolios suite (`backend-rs/crates/portfolio-core/tests/mock_portfolios.rs`, `frontend/src/utils/mock-portfolios.test.ts`, and `frontend/tests/mock-portfolios.spec.ts`).
- **Coverage of Financial Scenarios**: Any new feature or bug fix must ensure the mock portfolio suite covers:
  1. **Scheme Consolidation**: Grouping multiple folios/PANs for the same scheme without duplicate valuation.
  2. **Zero-Holding / Full Redemption Isolation**: Fully redeemed positions must never show active holdings/valuation and must be cleanly isolated in closed positions.
  3. **Partial Redemptions**: FIFO accounting of remaining units, invested cost, and realized gains.
  4. **Stock Intersection & X-Ray**: Accurate underlying company allocation and multi-fund overlap without NaN or phantom exposure.
  5. **Asset-Class Specific States**: Correct behavior for pure debt/liquid (empty equity states) and mixed multi-asset allocations.
  6. **Alternative Assets**: Unlisted assets, SGBs, Physical Gold, and Real Estate integration.
  7. **Multi-Member Profiles**: Family profile switching, aggregation, and cascading deletion integrity.
  8. **Tax Rules & Grandfathering**: Section 112A LTCG grandfathering (Jan 31, 2018 FMV formula) and loss set-off rules.
  9. **Lock-In Restrictions**: ELSS 3-year lock-in and statutory withdrawal constraints.
  10. **Folio Lifecycle**: Manual closing and deletion of folios and managed profiles.
- **Continuous Evolution**: All future use cases, edge cases, and bug fixes MUST be baked into these mock portfolios so regressions are caught permanently.
- **Hook & CI Enforcement**: Mock portfolio tests MUST run as part of hermetic unit tests (`npm test`), the pre-push hook (`.husky/pre-push`), and GitHub Actions workflows (`.github/workflows/e2e.yml`).

## Backend Testing

The project backend is 100% Rust (`backend-rs`). All backend calculation and API endpoints are tested via the Rust cargo workspace.

### Rust Backend Workspace Architecture

The Rust backend (`backend-rs`) follows hexagonal architecture across 5 specialized member crates:
1. **`portfolio-core`**: The pure domain calculation engine.
   - **Strict Zero-I/O Invariant**: MUST remain strictly zero-I/O (no databases, no network, no async runtime, no filesystem). All calculations (holdings, FIFO, capital gains tax, performance/XIRR, and X-Ray) must be pure, deterministic functions operating solely in-memory.
   - Contains the hermetic 10 mock portfolios suite (`tests/mock_portfolios.rs`), defensive test suite (`tests/auditor_defensive_test.rs`), and property-based invariant tests (`tests/proptests.rs`).
2. **`portfolio-db`**: Database persistence layer with SQLx.
   - Provides strongly-typed PostgreSQL entity mappings and repository interfaces (`PortfolioRepository`, `TransactionRepository`, `FamilyRepository`).
   - Includes `InMemoryDatabase` for sub-millisecond, Docker-free hermetic testing.
3. **`portfolio-api`**: High-performance HTTP REST API gateway.
   - Built with Axum and Tokio, providing camelCase JSON response parity matching frontend contracts.
   - Includes JWT authentication middleware, CORS configuration, and centralized error mapping.
4. **`portfolio-worker`**: Asynchronous background job worker.
   - Connects to BullMQ-compatible Redis queues (`bull:<queue_name>:*`) with fallback in-memory queuing.
   - Handles CAS PDF / JSON upload processing, multi-PAN transaction ingestion, and historical valuation refreshes.
5. **`portfolio-parity`**: Differential parity validation harness.
   - Validates numerical parity across synthetic scenarios.
   - Enforces precision bounds: Units $\Delta \le 0.0001$, Financial Amounts $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$.

### Rust Testing & Quality Mandates
For any changes to the backend or calculation logic, run and pass:
- `cargo check --workspace`
- `cargo test --workspace`
- `cargo run --package portfolio-parity`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo fmt --check`

### Docker Compose 100% Rust Architecture
The production and local `docker-compose.yml` runs 100% on the Rust backend (`backend-rs`) as the native `backend` and `worker` services. Database initialization is completely self-healing on container boot via `portfolio_db::init_schema(&pool)` executing DDL idempotent migrations.

## Git and Commits

NEVER use `git push --no-verify`. Always run tests locally or allow husky hooks to run properly to prevent spurious changes from being pushed. If tests fail, fix them before pushing.
