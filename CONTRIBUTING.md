# Contributing to Portfolio Tracker

Thank you for contributing to Portfolio Tracker! This guide covers local development setup, workspace architecture, static build-time guardrails, testing, coverage gates, and Docker image publishing.

> [!IMPORTANT]
> Before contributing, please familiarize yourself with the shared domain vocabulary in [CONCEPTS.md](CONCEPTS.md) and the engineering rules in [AGENTS.md](AGENTS.md).

---

## 🛠️ Tech Stack & Prerequisites

- **Rust (1.85+ / Edition 2024) & Cargo** (`backend-rs`)
- **Node.js (v20+) & pnpm (v9+)** (`frontend`, `mobile`, `packages/core-view`)
- **Python 3.10+** (`casparser` PDF parsing bridge)
- **Docker & Docker Compose** (PostgreSQL 15, Redis 7, and containerized builds)

---

## 🚀 Local Development Setup

### Quick Initialization
```bash
chmod +x setup.sh
./setup.sh
```

Or using root `pnpm` workspace commands:
```bash
# Install workspace dependencies
pnpm install

# Start PostgreSQL and Redis
docker compose up -d postgres redis

# Run Rust API and Vite frontend concurrently
pnpm dev

# Build backend (release) and frontend (verified production bundle)
pnpm build
```

### Running Services Individually
- **Backend (`backend-rs`):** `cd backend-rs && cargo run --bin portfolio-api`
- **Frontend (`frontend`):** `pnpm --filter frontend dev`
- **Mobile (`mobile`):** `pnpm --filter mobile dev` (see [mobile/README.md](mobile/README.md) for iOS Simulator, Android Emulator, and native build scripts)

Database initialization is self-healing on startup via `portfolio_db::init_schema(&pool)`—no manual migration commands are required.

---

## 🏛️ Workspace Architecture

### Rust Backend (`backend-rs`)
Organized as a 5-crate Cargo workspace following hexagonal architecture:
1. **`portfolio-core`**: Pure, synchronous, deterministic domain engine (**Zero-I/O** — no database, network, async runtime, or filesystem access; `#![forbid(unsafe_code)]`). Handles holdings aggregation, FIFO lot depletion, Section 112A/111A/50AA/55(2)(ac) tax rules, Brent's method XIRR, CAGR, and Jaccard overlap.
2. **`portfolio-db`**: SQLx PostgreSQL persistence layer (`PortfolioRepository`, `TransactionRepository`, `FamilyRepository`) plus `InMemoryDatabase` for fast Docker-free hermetic testing.
3. **`portfolio-api`**: Axum REST API gateway with camelCase JSON contract parity, JWT authentication, and CORS.
4. **`portfolio-worker`**: Asynchronous job worker supporting BullMQ-compatible Redis queues (`bull:*`) and in-memory fallback for CAS PDF parsing and NAV refreshes.
5. **`portfolio-parity`**: Differential parity harness validating numerical equivalence across synthetic scenarios within strict tolerances: Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$.

### Web Frontend (`frontend`) & Shared View Core (`packages/core-view`)
- React, TypeScript, Vite, Recharts, Lucide Icons.
- Strict zero-logic view layer: UI components paint pre-computed backend/domain state without performing tax math or persistence calls.

### Mobile App (`mobile`)
- React Native / Expo with Expo Router, `expo-sqlite` offline cache, `expo-secure-store` hardware-backed credentials, biometric unlock, and direct AMFI NAV refreshes (`api.mfapi.in`). See [mobile/README.md](mobile/README.md).

---

## 🛡️ Static Build-Time Guardrails

Portfolio Tracker enforces strict static verification across all workspaces so broken contracts, architectural leaks, dead code, and PII fail at build time:

### Cross-Repo & Privacy Guardrails
- **Anti-PII Static Scan (`scripts/check-privacy-and-pii.py`):** Blocks real PAN patterns, non-synthetic investor identifiers, or real CAS PDF/JSON files. All tests and fixtures must use synthetic data (e.g., `ABCDE1234F`, `ALPAC1001A`, "Aarav Sharma", "Neha Patel").
- **View Layer Boundary Scan (`scripts/check-view-layer-boundaries.py`):** Statically enforces zero business logic in `frontend/src/components/` and `mobile/src/components/` / `mobile/app/` (no statutory tax multiplications, Fisher deflator compounding, tax/drag subtractions, direct DB imports, or calculation engine imports).

### Rust Backend Guardrails
- **ArchUnit Boundary Oracle (`architecture_invariants_test.rs`):** Enforces Zero-I/O and `#![forbid(unsafe_code)]` in `portfolio-core`.
- **Cross-Stack Contract Parity:** TypeScript types in `frontend/src/types/generated/` and `mobile/src/types/generated/` are generated from `backend-rs`. Any API struct change must be re-exported via:
  ```bash
  (cd backend-rs && cargo test --package portfolio-api --test export_bindings)
  git diff --exit-code frontend/src/types/generated mobile/src/types/generated
  ```
- **6-Stage Backend Gate (`backend-rs/scripts/verify.sh`):** `cargo fmt --check`, `cargo check --workspace --all-targets`, `cargo clippy --workspace --all-targets -- -D warnings`, `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps`, `cargo test --workspace`, and `cargo deny check`.

### TypeScript Frontend & Mobile Guardrails
- **Zero-Any & Compiler Rigor (`tsconfig.app.json`):** `strict: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- **Layer Boundaries (`eslint-plugin-boundaries`) & Naming (`eslint-plugin-check-file`):** Utilities cannot import UI components; sibling UI domains cannot import each other's private internals; `PascalCase.tsx` for components and `kebab-case.ts` for utilities.
- **Validated Env Vars (`frontend/src/env.ts`):** Centralized `@t3-oss/env-core` + `zod` validation; direct `import.meta.env` access is prohibited.
- **Dead-Code Auditing (`knip --production`):** Zero unused files, exports, or dependencies (generated Rust bindings preserved).
- **Mobile Maintainability Sensors (`mobile/eslint.config.js`):** File $\le 300$ lines, function $\le 50$ lines, params $\le 3$ (no `eslint-disable max-params`), cyclomatic complexity $\le 10$, zero `any`.

---

## Testing, Coverage & Verification Sequence

### Test Catalogs
- **Backend Test Catalog:** [backend-rs/crates/portfolio-core/tests/README.md](backend-rs/crates/portfolio-core/tests/README.md) (7 suites + 33-vector `golden_tax_vectors.json`)
- **Frontend Test Catalog:** [frontend/tests/README.md](frontend/tests/README.md) (16 Playwright E2E specs + 12 Vitest suites + Page Object Models)

### Full Hermetic Verification Sequence
Run and pass these checks before committing or opening a PR:

```bash
# 0. Privacy & View Layer Boundaries
python3 scripts/check-privacy-and-pii.py
python3 scripts/check-view-layer-boundaries.py --self-test
python3 scripts/check-view-layer-boundaries.py

# 1-6. Rust Backend Verification (or run: cd backend-rs && ./scripts/verify.sh)
(cd backend-rs && cargo fmt --check)
(cd backend-rs && cargo check --workspace --all-targets)
(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)
(cd backend-rs && RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps)
(cd backend-rs && cargo test --workspace)
(cd backend-rs && cargo deny check)

# 7. TypeScript Contract Parity
(cd backend-rs && cargo test --package portfolio-api --test export_bindings) && git diff --exit-code frontend/src/types/generated mobile/src/types/generated

# 8. Differential Parity Harness
(cd backend-rs && cargo run --package portfolio-parity)

# 9. Frontend Build & Unit Tests
pnpm --filter frontend build && pnpm --filter frontend test:unit

# 10. Mobile Build Verify & Simulation E2E
pnpm --filter mobile build:verify && pnpm --filter mobile test:e2e

# 11. Blocking Coverage Gates
pnpm test:coverage
```

**Blocking Coverage Thresholds:**
- **Backend (`cargo llvm-cov`):** `portfolio-core` $\ge 93\%$ lines; workspace $\ge 78\%$ lines.
- **Frontend (`vitest`):** Lines $\ge 89\%$, Statements $\ge 87\%$, Funcs $\ge 86\%$, Branches $\ge 72\%$.
- **Mobile (`vitest`):** Lines $\ge 89\%$, Statements $\ge 87\%$, Funcs $\ge 86\%$, Branches $\ge 75\%$.
- **Incremental Diff Coverage (`scripts/check-diff-coverage.py`):** $\ge 85\%$.

### E2E & UAT Suites
- **Web E2E (Local):** `pnpm --filter frontend test:e2e`
- **Web E2E (Docker):** `pnpm --filter frontend test:e2e:docker`
- **Native Mobile Emulators:** `bash mobile/scripts/emulate-android.sh`, `bash mobile/scripts/emulate-ios.sh`, `bash mobile/scripts/run-native-e2e.sh`
- **Full Product UAT Suite:** `pnpm run test:uat` (or `bash scripts/run-uat-suite.sh`) — required before non-trivial PRs.

---

## 🐳 Building & Publishing Docker Images

Ensure `DOCKER_REGISTRY_USER` is set in `.env` (e.g., `shaleenks`).

```bash
# Single-platform build & push
docker compose build
docker compose push

# Multi-architecture build & push (linux/amd64 + linux/arm64)
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ${DOCKER_REGISTRY_USER:-shaleenks}/portfolio-backend:latest ./backend-rs --push
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ${DOCKER_REGISTRY_USER:-shaleenks}/portfolio-frontend:latest -f frontend/Dockerfile . --push
```

---

## 🔀 Git & Commit Rules

- Never use `git push --no-verify`. Husky pre-push hooks and CI workflows enforce mock portfolio, privacy, and build gates.
- Updating tax rules: modify `backend-rs/crates/portfolio-core/src/tax/` and update `tax_oracle_test.rs` + `golden_tax_vectors.json`.
