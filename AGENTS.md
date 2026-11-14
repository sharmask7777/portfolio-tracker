# AI Agent Instructions

## Agent-Native Engineering Mandates

### 1. The Invariant Oracle Law
- Agents must NEVER "fix" a test failure by modifying assertion values in property tests (`proptests.rs`, `tax_oracle_test.rs`) or changing expected values in `golden_tax_vectors.json`.
- If an invariant test fails, the algorithm is defective. You are strictly forbidden from relaxing numerical bounds (Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$).
- Tests are ground-truth oracles mathematically codifying financial and statutory correctness. Fix the implementation, never the oracle.

### 2. The Zero-Any & Static Build-Time Guardrails Mandate
- **The Zero-Any Rule**: No `any` types allowed in TypeScript code (`frontend/src/`).
- **Contract Parity & Drift Check**: All API communication and shared data contracts must strictly use generated TypeScript types from `backend-rs` (`frontend/src/types/generated/`). Any modification to backend API request/response structures must be re-exported via `cargo test --package portfolio-api --test export_bindings` and checked with `git diff --exit-code frontend/src/types/generated`.
- **TypeScript Compiler Strictness**: `tsconfig.app.json` enforces maximum compiler rigor (`strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `isolatedModules: true`, `noEmit: true`). Array and record index lookups evaluate to `T | undefined`, mandating safe narrowing or optional chaining.
- **Architectural Boundaries**: Layer isolation is strictly validated via `eslint-plugin-boundaries`. Utility modules cannot import UI components; UI domains (`Analytics`, `Tax`, `Dashboard`, `Family`, `Auth`, `Insights`) cannot import private internals of sibling domains; circular dependencies are disallowed.
- **File Naming Conventions**: Standardized casing is enforced via `eslint-plugin-check-file` (PascalCase for React components under `src/components/`, kebab-case for utilities under `src/utils/`).
- **Schema-Validated Environment Variables**: All environment variable access is centralized in `frontend/src/env.ts` validated via `@t3-oss/env-core` and `zod`. Direct unvalidated access to `import.meta.env` is prohibited; invalid or missing variables fail loudly at build time.
- **Dead-Code & Dependency Auditing**: `knip` runs via `knip --production` during builds. Zero unused files, exports, or dependencies permitted. Code-generated Rust bindings (`src/types/generated/**`) are explicitly preserved.
- **Static Privacy & Anti-PII Guardrail**: `scripts/check-privacy-and-pii.py` scans all tracked repository files before commit/push, statically barring real-world PAN patterns, non-synthetic identifiers, or CAS PDF/JSON files.
- **Rust ArchUnit Boundary Oracle**: `backend-rs/crates/portfolio-core/tests/architecture_invariants_test.rs` programmatically asserts Zero-I/O compliance (no networking, async runtime, database, or cache dependencies) and `#![forbid(unsafe_code)]` in domain roots.
- **Build Verification Gate**: `pnpm --filter frontend build` (`pnpm build:verify && vite build`) and `pnpm --filter frontend build:verify` (`pnpm lint && pnpm typecheck && pnpm knip`) must pass cleanly with zero type errors, zero lint warnings, and zero dead code.

### 3. ITR Report Invariant Gate
- All changes to ITR or capital gains tax reporting must pass `verify_itr_invariants` (enforced in both backend domain engine and frontend validation).
- Reports that violate quarterly symmetry (Table F sum $\ne$ FY net capital gain), grandfathering loss limits (Section 55(2)(ac) deemed cost bounding), statutory tax rates (12.5% LTCG / 20% STCG post-July 23, 2024), or negative exemption amounts must fail loudly.

### 4. Mandatory Hermetic Verification Sequence
Before committing or creating a PR, you MUST run and pass the full hermetic verification sequence (or run `(cd backend-rs && ./scripts/verify.sh)` for backend stages):
1. `(cd backend-rs && cargo fmt --check)`
2. `(cd backend-rs && cargo check --workspace --all-targets)`
3. `(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)`
4. `(cd backend-rs && RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps)`
5. `(cd backend-rs && cargo test --workspace)`
6. `(cd backend-rs && cargo deny check)`
7. `(cd backend-rs && cargo test --package portfolio-api --test export_bindings) && git diff --exit-code frontend/src/types/generated`
8. `(cd backend-rs && cargo run --package portfolio-parity)`
9. `pnpm --filter frontend build && pnpm --filter frontend test:unit`
10. `pnpm test:coverage` (Blocking coverage gates: Backend $\ge$ 80% line coverage via `cargo llvm-cov`; Frontend: Lines $\ge$ 88%, Statements $\ge$ 86%, Funcs $\ge$ 85%, Branches $\ge$ 65% via `vitest`)

### 5. Mandatory Tax Specialist Subagent (`tax-statutory-auditor`)
- For any changes affecting tax calculation logic, statutory rates, exemptions, Schedule CG ITR reports, or files under `backend-rs/crates/portfolio-core/src/tax/`, agents MUST consult or invoke the specialized `tax-statutory-auditor` subagent role.
- **Responsibilities:**
  - Audits tax statutory parameters against official CBDT circulars and Finance Act guidelines (Budget 2024 cutoff July 23, 2024, Section 112A 12.5% / ₹1.25L exemption, Section 111A 20%, Section 50AA slab taxation, Section 70 loss set-offs, Section 55(2)(ac) grandfathering).
  - Ensures all new tax rules or statutory amendments include corresponding property-based tests in `tax_oracle_test.rs` and golden vectors in `golden_tax_vectors.json`.
  - Verifies that `verify_itr_invariants` enforces all statutory constraints on Schedule CG outputs.

### 6. Mandatory Multi-Specialist Review Crew for New Features
For all non-trivial feature development or analytical enhancements, agents MUST execute review via a specialized agent crew before merging:
1. **CX & Frontend Specialist (`cx-frontend-auditor`)**:
   - Audits interaction ergonomics, keyboard accessibility (WCAG 2.1 AA roving tabindex, ARIA roles, live regions), responsive layouts ($375\text{px}$ to $1440\text{px}$), visual clutter avoidance (e.g. 4-tier tile dimension thresholds, clipping paths), and layout memoization.
2. **Quantitative Finance & Visual Invariant Specialist (`finance-visual-auditor`)**:
   - Audits mathematical reconciliation, Value Conservation Law ($\Delta \le ₹0.01$), sum-of-parts completeness, tail holding reconciliation for undisclosed portfolios, denominator clarity (distinguishing `% of Portfolio`, `% of Asset Class`, `% of Parent`), and statutory/hedging segregation (such as cash-futures arbitrage funds).
3. **Architecture & Code Quality Auditor (`code-quality-auditor`)**:
   - Enforces the Zero-Any rule, exact optional property safety (`exactOptionalPropertyTypes: true`), layer boundary isolation (`eslint-plugin-boundaries`), knip production zero-dead-code compliance, and self-documenting code.

### 7. Test Suite Catalogs & Invariant Documentation
Comprehensive documentation of all backend and frontend test suites, financial invariants, and extension procedures is maintained in the following catalogs:
- **Backend Test Catalog:** [`backend-rs/crates/portfolio-core/tests/README.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/backend-rs/crates/portfolio-core/tests/README.md)
  - Documents the strict Zero-I/O policy, precision bounds, synthetic data mandate, and detailed domain invariant mappings for all 7 backend test suites (`tax_oracle_test.rs`, `tax_compliance_test.rs`, `mock_portfolios.rs`, `proptests.rs`, `auditor_defensive_test.rs`, `xirr_safeguards_test.rs`, `types_test.rs`) and the 33-vector statutory golden fixtures (`golden_tax_vectors.json`).
- **Frontend Test Catalog:** [`frontend/tests/README.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/frontend/tests/README.md)
  - Documents the 4-domain E2E taxonomy across 16 Playwright spec suites (Core Portfolio Operations, Tax & Statutory Compliance, Analytics & Reporting, Platform & UX Safeguards), all 12 Vitest unit test suites (`frontend/src/`), Page Object Models (`frontend/tests/pom/`), and privacy rules.
- **Documented Solutions:** [`docs/solutions/`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/solutions/) — documented solutions to past problems (bugs, database issues, tax compliance, performance patterns), organized by category with YAML frontmatter (`module`, `tags`, `problem_type`). Relevant when implementing or debugging in documented areas.
- **Shared Domain Vocabulary:** [`CONCEPTS.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/CONCEPTS.md) — shared domain vocabulary (entities, named processes, status concepts) — relevant when orienting to the codebase or discussing domain concepts.

### 7. Universal Generality Mandate (No Portfolio-Specific Hacks)
- **Zero Portfolio-Specific Hacks**: Agents must NEVER introduce fixes, heuristics, conditional branches, or hardcoded overrides tailored to a single specific portfolio, account, user, or single statement instance.
- **Generic Across All Portfolios**: All fixes, parsers, calculations, classification algorithms, and data representations MUST be inherently generic and apply uniformly across all portfolios.
- **Permissible Broad Overrides**: Non-standard representations, parser quirks, or data anomalies that are generic across all portfolios encountering that provider/format (e.g., CAMS vs. KFintech statement quirks, AMC disclosure formats, statutory scheme naming anomalies) are acceptable overrides, provided they are structured generically rather than keyed to specific users or portfolios.
- **Mandatory Validation Gate**: All review and validation agents (`review`, `research` auditors, task reviewers) MUST critically evaluate any proposed change for portfolio-specific logic and block any non-generic workarounds.

### 8. Self-Documenting Code & Comprehensive Documentation Mandate
- **Self-Documenting Names**: All function names, method names, variables, and type names must be clear, descriptive, and self-documenting. Cryptic abbreviations or ambiguous single-letter variables that obscure financial, mathematical, or domain meaning must be avoided or refactored.
- **Comprehensive Rust Docs (`///`) & TypeScript JSDoc (`/** */`)**: All structs, enums, traits, methods, and functions across the codebase must have helpful doc comments explaining their purpose, arguments, invariants, and return values to provide instant context for human reviewers.
- **Explanatory Comments on Complex Logic**: Any non-trivial, domain-dense, or mathematically complex logic (such as FIFO lot allocation, Section 55(2)(ac) grandfathering adjustments, Section 112A/111A/50AA tax computations, XIRR root-finding fallbacks, portfolio look-through normalization, and SQL CTE batch queries) MUST include clear explanatory comments detailing the statutory intent, mathematical formulation, or algorithm rationale.

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
- **Hook & CI Enforcement**: Mock portfolio tests MUST run as part of hermetic unit tests (`pnpm test` or `pnpm --filter frontend test:unit`), the pre-push hook (`.husky/pre-push`), and GitHub Actions workflows (`.github/workflows/e2e.yml`).

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
For any changes to the backend or calculation logic, run and pass `backend-rs/scripts/verify.sh` or:
- `cargo fmt --check`
- `cargo check --workspace --all-targets`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps`
- `cargo test --workspace`
- `cargo deny check`
- `cargo run --package portfolio-parity`

### Docker Compose 100% Rust Architecture
The production and local `docker-compose.yml` runs 100% on the Rust backend (`backend-rs`) as the native `backend` and `worker` services. Database initialization is completely self-healing on container boot via `portfolio_db::init_schema(&pool)` executing DDL idempotent migrations.

## Git and Commits

NEVER use `git push --no-verify`. Always run tests locally or allow husky hooks to run properly to prevent spurious changes from being pushed. If tests fail, fix them before pushing.
