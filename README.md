# Portfolio Tracker (MVP)

A deep-analytics portfolio tracking platform for Indian investors. Supports CAMS/Karvy CAS statements, real-time performance tracking, deep X-Ray analytics, and advanced tax optimization.

## 🚀 Quick Start (For Users)

You can run Portfolio Tracker on any machine using Docker. You don't need to download the source code—just follow these three simple steps to start the application using our pre-built images.

### 1. Create a Project Folder
Create a new folder on your computer and navigate into it:
```bash
mkdir portfolio-tracker
cd portfolio-tracker
```

### 2. Create Configuration Files

**Step A:** Create a file named `.env` in this folder to hold your settings. Change the password and IP fields as needed.
```env
# .env
PORTFOLIO_DB_USER=portfolio_admin
PORTFOLIO_DB_PASSWORD=your_secure_password_here
PORTFOLIO_DB_NAME=portfolio_tracker
TZ_GLOBAL=UTC
VOLUME_PREFIX_GLOBAL=.
VITE_API_PORT=3031
# If accessing from another device on your network, replace localhost with your server's IP address (e.g., 192.168.1.100)
IP_GLOBAL=localhost

# Authentication (IMPORTANT: CHANGE THIS!)
# Generate a strong secret with `openssl rand -hex 32`
JWT_SECRET=your_secure_jwt_secret_here
# Token expiration time (e.g., 7d, 24h, 1h)
JWT_EXPIRES_IN=7d

```

**Step B:** Create a file named `docker-compose.yml` and paste the following configuration:
```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:15-alpine
    container_name: portfolio_tracker_db
    restart: always
    environment:
      POSTGRES_USER: ${PORTFOLIO_DB_USER}
      POSTGRES_PASSWORD: ${PORTFOLIO_DB_PASSWORD}
      POSTGRES_DB: ${PORTFOLIO_DB_NAME}
      TZ: ${TZ_GLOBAL}
    volumes:
      - "${VOLUME_PREFIX_GLOBAL}/appdata/portfolio/db:/var/lib/postgresql/data"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${PORTFOLIO_DB_USER} -d ${PORTFOLIO_DB_NAME}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: portfolio_tracker_redis
    restart: always
    environment:
      TZ: ${TZ_GLOBAL}
    volumes:
      - "${VOLUME_PREFIX_GLOBAL}/appdata/portfolio/redis:/data"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: ${DOCKER_REGISTRY_USER:-portfolio}/portfolio-backend:latest
    container_name: portfolio_tracker_backend
    restart: always
    ports:
      - "${VITE_API_PORT:-3001}:3001"
    environment:
      DATABASE_URL: "postgresql://${PORTFOLIO_DB_USER}:${PORTFOLIO_DB_PASSWORD}@postgres:5432/${PORTFOLIO_DB_NAME}?schema=public"
      REDIS_HOST: redis
      REDIS_PORT: 6379
      PORT: 3001
      PYTHON_PATH: python3
      UPLOADS_DIR: /app/uploads
      TZ: ${TZ_GLOBAL}
      JWT_SECRET: ${JWT_SECRET}
    volumes:
      - shared_uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  worker:
    image: ${DOCKER_REGISTRY_USER:-portfolio}/portfolio-backend:latest
    container_name: portfolio_tracker_worker
    restart: always
    command: ["portfolio-worker"]
    environment:
      DATABASE_URL: "postgresql://${PORTFOLIO_DB_USER}:${PORTFOLIO_DB_PASSWORD}@postgres:5432/${PORTFOLIO_DB_NAME}?schema=public"
      REDIS_HOST: redis
      REDIS_PORT: 6379
      PYTHON_PATH: python3
      UPLOADS_DIR: /app/uploads
      TZ: ${TZ_GLOBAL}
    volumes:
      - shared_uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      backend:
        condition: service_started

  frontend:
    image: shaleenks/portfolio-frontend:latest
    container_name: portfolio_tracker_frontend
    restart: always
    ports:
      - "8082:80"
    environment:
      VITE_API_URL: "http://${IP_GLOBAL}:${VITE_API_PORT}"
      TZ: ${TZ_GLOBAL}
    depends_on:
      - backend

volumes:
  shared_uploads:
```

> [!TIP]
> **Recommended Volume Setup for Uploads:**
> We strongly recommend using the Docker named volume `shared_uploads:/app/uploads` as shown above. Both the backend (which receives file uploads) and the worker (which parses and deletes the temporary files) share this volume. Docker automatically ensures the proper permissions for the non-root `node` container user.
>
> If you choose to bind-mount a host path instead (e.g. `- "${VOLUME_PREFIX_GLOBAL}/.../uploads:/app/uploads"`), ensure the directory on the host is owned or writable by UID:GID `1000:1000` (e.g. `sudo chown -R 1000:1000 <path_to_uploads>`), otherwise file uploads will fail with `EACCES: permission denied`.


### 3. Start the Application
Run this command to download the images and start the tracker:
```bash
docker-compose up -d
```

That's it! You can now access your application:
- **Frontend UI:** `http://localhost:8082` (or your server's IP:8082)
- **Backend API:** `http://localhost:3031` (or your server's IP:3031)

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite, Recharts, Lucide Icons, Nginx (Production), pnpm workspace.
- **Backend (Rust):** High-performance backend workspace (`backend-rs`) using Tokio, Axum, SQLx, Rust Decimal, and a zero-I/O deterministic engine (`portfolio-core`).
- **Caching:** Redis.
- **Infrastructure:** Docker, Multi-stage Builds, Persistent Volumes.
- **Parsing:** Python 3 + `casparser` library.

---

## 💻 Developer Instructions

### Prerequisites
- Docker & Docker Compose
- Node.js (v20+) & pnpm (v9+)
- Python 3.10+
- Rust (1.85+ / edition 2024) & Cargo

### 1. Local Build & Run
The project includes a unified setup script to initialize everything locally.

```bash
chmod +x setup.sh
./setup.sh
```

Or using root workspace pnpm commands:
```bash
# Install dependencies across workspace
pnpm install

# Run backend and frontend concurrently in development mode
pnpm dev

# Build both backend (release) and frontend (verified production bundle)
pnpm build

# Run full test suite (backend workspace + frontend unit tests)
pnpm test
```

### 2. Manual Development Setup
If you prefer running services individually:

#### Infrastructure
```bash
docker compose up -d postgres redis
```

#### Backend (Rust - `backend-rs`)
The high-performance Rust backend is organized as a Cargo workspace in `backend-rs/` following hexagonal architecture:
- **`portfolio-core`**: Pure domain financial calculation engine (Zero-I/O, synchronous, deterministic). Handles holdings aggregation, FIFO lot depletion, Section 112A grandfathering, LTCG/STCG capital gains, slab taxation, Brent's method XIRR, CAGR, absolute returns, and Jaccard portfolio overlap.
- **`portfolio-db`**: PostgreSQL persistence layer using SQLx, with repository traits and an `InMemoryDatabase` for fast zero-Docker hermetic testing.
- **`portfolio-api`**: High-throughput Axum REST API gateway with camelCase contract parity matching frontend contracts, JWT authentication middleware, and CORS.
- **`portfolio-worker`**: Asynchronous background job worker supporting BullMQ-compatible Redis queueing (`bull:pdfUploadQueue:*`) and in-memory fallback, processing CAS statement parsing and NAV refreshes.
- **`portfolio-parity`**: Differential parity validation harness certifying exact numerical equivalence between TypeScript and Rust calculation engines down to strict tolerances ($\Delta \le ₹0.01$, $\Delta \le 0.0001$ units, $\Delta \le 10^{-6}$ for XIRR).

**Rust Development & Verification Commands:**
```bash
cd backend-rs

# Type-check all workspace crates
cargo check --workspace

# Run all hermetic unit, mock portfolio, and property-based tests
cargo test --workspace

# Run differential parity harness against benchmark scenarios (100% parity certified)
cargo run --package portfolio-parity

# Run clippy linter with zero warnings
cargo clippy --workspace --all-targets -- -D warnings

# Verify code formatting
cargo fmt --check

# Execute full hermetic verification sequence
./scripts/verify.sh
```

**Running Rust Services with Docker Compose:**
```bash
# Launch full stack (Rust backend, Rust worker, Frontend, DB, Redis)
docker compose up -d
```

#### Frontend
```bash
# From workspace root
pnpm install
pnpm --filter frontend dev

# Or directly from frontend directory:
cd frontend
pnpm install
pnpm dev
```

### 3. Building & Pushing Images

The project supports both single-platform and multi-architecture builds. Multi-arch is recommended if you develop on Apple Silicon (M1/M2/M3) but deploy on an Intel-based NAS or VPS.

#### Prerequisites
Ensure `DOCKER_REGISTRY_USER` is set in your `.env` file (e.g., `DOCKER_REGISTRY_USER=shaleenks`).

#### Single-Platform Build (Current Machine)
```bash
# Build & Push
docker compose build
docker compose push
```

#### Multi-Architecture Build (Recommended for Deployment)
To support both `arm64` (Mac) and `amd64` (NAS/Intel), use Docker Buildx:

```bash
# 1. Create a builder if you haven't already
docker buildx create --use

# 2. Build & Push both architectures simultaneously
# Rust Backend & Worker
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ${DOCKER_REGISTRY_USER:-portfolio}/portfolio-backend:latest ./backend-rs --push

# Frontend
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ${DOCKER_REGISTRY_USER:-portfolio}/portfolio-frontend:latest ./frontend --push
```

#### Verification
Check your Docker Hub repository. It should show "OS/ARCH" as `linux/amd64` and `linux/arm64` for the latest tags.

---

## 🛡️ Static Build-Time Guardrails Paradigm

Portfolio Tracker enforces a comprehensive, agent-native static verification paradigm across both the backend and frontend stacks. Broken imports, type inaccuracies, architectural violations, dead code, and unvalidated environment variables fail loudly at build time before reaching runtime or production.

### Rust Backend Guardrails (`backend-rs`)
1. **Zero-I/O Domain Engine (`portfolio-core`)**: Domain calculation engine remains strictly zero-I/O (no network, async runtime, database, or disk operations). Financial logic is purely functional, deterministic, and verified by property tests (`proptests.rs`, `tax_oracle_test.rs`).
2. **Hermetic Verification Gate (`./scripts/verify.sh`)**: All commits and pull requests must pass the 6-stage script:
   - `cargo fmt --check` (Zero formatting variance)
   - `cargo check --workspace --all-targets` (Clean compilation)
   - `cargo clippy --workspace --all-targets -- -D warnings` (Zero linter warnings)
   - `RUSTDOCFLAGS="-D warnings" cargo doc --workspace --no-deps` (Zero undocumented APIs)
   - `cargo test --workspace` (100% test pass rate across unit, mock portfolio, and property tests)
   - `cargo deny check` (Automated audit of crate licenses, security advisories, and banned dependencies)
3. **Cross-Stack Type Contract Parity**: API request/response structures are code-generated to TypeScript via `cargo test --package portfolio-api --test export_bindings` and enforced with `git diff --exit-code frontend/src/types/generated`.
4. **Differential Parity Engine (`portfolio-parity`)**: Continuously asserts mathematical parity against precision bounds: Units $\Delta \le 0.0001$, Financial Amounts $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$.
5. **Coverage Gates**: Backend line coverage $\ge 80\%$ via `cargo llvm-cov`.

### Frontend React Guardrails (`frontend/`)
1. **Strict TypeScript Compiler Configuration (`tsconfig.app.json`)**:
   - `strict: true` and `noImplicitAny: true` enforcing zero untyped code (Zero-Any Mandate).
   - `noUncheckedIndexedAccess: true`: Array and record index lookups evaluate to `T | undefined`, mandating safe narrowing, null-coalescing (`??`), or optional chaining (`?.`).
   - `exactOptionalPropertyTypes: true`: Distinguishes undefined property values from omitted optional properties.
   - `isolatedModules: true` and `noEmit: true`: Fast, type-safe compilation matching Vite bundling behavior.
2. **Architectural Boundary Enforcement (`eslint-plugin-boundaries`)**:
   - Strict layer hierarchy: UI components can consume utilities and types; utilities cannot import UI components.
   - Subdomain isolation: UI feature domains (`Analytics`, `Tax`, `Dashboard`, `Family`, `Auth`, `Insights`) cannot import private internals of sibling domains.
   - Circular dependency rejection: Enforces acyclic dependency trees across the frontend codebase.
3. **Standardized Naming Conventions (`eslint-plugin-check-file`)**:
   - React component files under `src/components/` must strictly use `PascalCase.tsx`.
   - Utility modules under `src/utils/` must strictly use `kebab-case.ts`.
4. **Schema-Validated Environment Variables (`@t3-oss/env-core` + `zod`)**:
   - Centralized in `frontend/src/env.ts` with strict Zod schema validation for all client-side variables (`VITE_API_URL`, `MODE`, `PROD`, `DEV`).
   - Direct, unvalidated access to `import.meta.env` is prohibited; missing or invalid variables trigger immediate build-time failure.
5. **Dead-Code & Dependency Auditing (`knip`)**:
   - Automatically detects unused files, unused exports, and unreferenced dependencies via `knip --production`.
   - Generated Rust contract bindings (`src/types/generated/**`) are explicitly configured for preservation.
6. **Frontend Verification Gate (`build:verify`)**:
   - `pnpm --filter frontend build` runs `pnpm build:verify && vite build`.
   - `pnpm build:verify` executes `pnpm lint && pnpm typecheck && pnpm knip` as a single blocking gate.
7. **Coverage Gates**: Vitest coverage thresholds enforced via `pnpm test:coverage` (Lines $\ge 88\%$, Statements $\ge 86\%$, Functions $\ge 85\%$, Branches $\ge 65\%$).

---

## 🧪 Testing & Quality

- **Rust Workspace Unit & PBT:** `(cd backend-rs && cargo test --workspace)`
- **Rust Differential Parity Harness:** `(cd backend-rs && cargo run --package portfolio-parity)`
- **Frontend Verification Gate:** `pnpm --filter frontend build:verify`
- **Frontend Unit Tests & Coverage:** `pnpm --filter frontend test:unit`
- **Full Workspace Test Suite:** `pnpm test`
- **Full Coverage Suite:** `pnpm test:coverage`
- **E2E Testing (Local Server):** `pnpm --filter frontend test:e2e`
- **E2E Testing (Docker Deployment):** You can verify a full Docker deployment (Frontend + Rust Backend + Database) using Playwright. Make sure your docker containers are running, then execute:
  ```bash
  pnpm --filter frontend test:e2e:docker
  ```
- **Quality Mandates:** Zero-tolerance for `NaN` displays in the UI.

## 📖 Maintenance

- **Database Migrations:** The Rust backend features self-healing database initialization (`portfolio_db::init_schema`) executing automatically on startup—no manual `prisma migrate deploy` is needed.
- **Updating Tax Rules:** Modify logic in `TaxService.ts` or `backend-rs/crates/portfolio-core/src/tax/` (Budget 2024 ready).


---
Created with ❤️ by Gemini CLI.
