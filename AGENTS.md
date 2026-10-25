# AI Agent Instructions

## Agent-Native Engineering Mandates

### 1. The Invariant Oracle Law
- Agents must NEVER "fix" a test failure by modifying assertion values in property tests (`proptests.rs`, `tax_oracle_test.rs`) or changing expected values in `golden_tax_vectors.json`.
- If an invariant test fails, the algorithm is defective. You are strictly forbidden from relaxing numerical bounds (Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$).
- Tests are ground-truth oracles mathematically codifying financial and statutory correctness. Fix the implementation, never the oracle.

### 2. The Zero-Any Mandate
- No `any` types allowed in TypeScript code (`frontend/src/`).
- All API communication and shared data contracts must strictly use generated TypeScript types from `backend-rs` (`frontend/src/types/generated/`).
- Contract drift check: Any modification to backend API request/response structures must be re-exported via `cargo test --package portfolio-api --test export_bindings` and checked with `git diff --exit-code frontend/src/types/generated`.
- `npm run build` (`tsc -b && vite build`) must pass cleanly with zero type errors and zero warnings.

### 3. ITR Report Invariant Gate
- All changes to ITR or capital gains tax reporting must pass `verify_itr_invariants` (enforced in both backend domain engine and frontend validation).
- Reports that violate quarterly symmetry (Table F sum $\ne$ FY net capital gain), grandfathering loss limits (Section 55(2)(ac) deemed cost bounding), statutory tax rates (12.5% LTCG / 20% STCG post-July 23, 2024), or negative exemption amounts must fail loudly.

### 4. Mandatory Hermetic Verification Sequence
Before committing or creating a PR, you MUST run and pass the full hermetic verification sequence:
1. `(cd backend-rs && cargo test --workspace)`
2. `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`
3. `(cd backend-rs && cargo fmt --check)`
4. `(cd backend-rs && cargo test --package portfolio-api --test export_bindings) && git diff --exit-code frontend/src/types/generated`
5. `(cd frontend && npm run build && npm run test:unit)`
6. `(cd backend-rs && cargo run --package portfolio-parity)`

### 5. Mandatory Tax Specialist Subagent (`tax-statutory-auditor`)
- For any changes affecting tax calculation logic, statutory rates, exemptions, Schedule CG ITR reports, or files under `backend-rs/crates/portfolio-core/src/tax/`, agents MUST consult or invoke the specialized `tax-statutory-auditor` subagent role.
- **Responsibilities:**
  - Audits tax statutory parameters against official CBDT circulars and Finance Act guidelines (Budget 2024 cutoff July 23, 2024, Section 112A 12.5% / ₹1.25L exemption, Section 111A 20%, Section 50AA slab taxation, Section 70 loss set-offs, Section 55(2)(ac) grandfathering).
  - Ensures all new tax rules or statutory amendments include corresponding property-based tests in `tax_oracle_test.rs` and golden vectors in `golden_tax_vectors.json`.
  - Verifies that `verify_itr_invariants` enforces all statutory constraints on Schedule CG outputs.

### 6. Test Suite Catalogs & Invariant Documentation
Comprehensive documentation of all backend and frontend test suites, financial invariants, and extension procedures is maintained in the following catalogs:
- **Backend Test Catalog:** [`backend-rs/crates/portfolio-core/tests/README.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/backend-rs/crates/portfolio-core/tests/README.md)
  - Documents the strict Zero-I/O policy, precision bounds, synthetic data mandate, and detailed domain invariant mappings for all 7 backend test suites (`tax_oracle_test.rs`, `tax_compliance_test.rs`, `mock_portfolios.rs`, `proptests.rs`, `auditor_defensive_test.rs`, `xirr_safeguards_test.rs`, `types_test.rs`) and the 33-vector statutory golden fixtures (`golden_tax_vectors.json`).
- **Frontend Test Catalog:** [`frontend/tests/README.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/frontend/tests/README.md)
  - Documents the 4-domain E2E taxonomy across 16 Playwright spec suites (Core Portfolio Operations, Tax & Statutory Compliance, Analytics & Reporting, Platform & UX Safeguards), all 12 Vitest unit test suites (`frontend/src/`), Page Object Models (`frontend/tests/pom/`), and privacy rules.

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
