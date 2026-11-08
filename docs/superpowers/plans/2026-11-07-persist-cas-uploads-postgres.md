# Persist CAS Statement Uploads to PostgreSQL in Background Worker

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist parsed CAS statement financial entities (ManagedProfile, Portfolio, Asset, Folio, Transaction, and PortfolioHistory) directly to PostgreSQL in `portfolio-worker` when `DATABASE_URL` is configured, while preserving hermetic in-memory fallback for zero-I/O testing.

**Architecture:** Extend the background worker CAS ingestion pipeline (`portfolio-worker`) by introducing `process_pdf_job_with_pool` and `process_history_refresh_job_with_pool`. When a `sqlx::PgPool` is present (in Docker / production), entities are idempotently upserted into PostgreSQL matching the exact schema and constraints used by `portfolio-api`, while also populating `InMemoryDatabase` for local cache consistency. When `pool` is `None`, behavior falls back seamlessly to memory-only mode without breaking existing unit and integration tests.

**Tech Stack:** Rust, SQLx (PostgreSQL), Tokio, BullMQ/Redis, Rust Decimal, CAS parser (Python).

**Spec:** `AGENTS.md` - Agent-Native Engineering Mandates (Zero-Any, Zero-I/O in portfolio-core, Parity, Hermetic Verification Sequence).

## Global Constraints
- Preserve backward-compatibility: `process_pdf_job` and `process_history_refresh_job` must remain available with their existing signatures, delegating to the `_with_pool` variants with `None`.
- Numeric bounds and precision invariants: `Units` $\Delta \le 0.0001$, `Money` $\Delta \le ₹0.01$. Decimals must be stored without floating-point conversion errors.
- Zero-I/O constraint in `portfolio-core`: all database operations remain strictly in `portfolio-worker` and `portfolio-db`.
- Idempotency: Re-uploading the same statement or overlapping transactions must not fail or create duplicate records (`ON CONFLICT ("externalId") DO NOTHING`).
- Multi-PAN isolation: Schemas with distinct PANs must be routed to distinct `ManagedProfile` and `Portfolio` records.

## Review Focus
1. **Existing vs Newly-Created Profile ID**: When an existing `ManagedProfile` already exists in PostgreSQL for a PAN, its existing `id` must be queried and reused so foreign keys on `Portfolio` and `Folio` remain valid.
2. **Asset Deduplication & Conflict Targets**: Assets must be resolved by ISIN first, then AMFI code, then Name, avoiding SQL duplicate key conflicts.
3. **External ID Uniqueness**: Transactions with deterministic `externalId` must use `ON CONFLICT ("externalId") DO NOTHING` so that repeated CAS uploads update smoothly without constraint violations.
4. **Historical Valuation Sync**: Portfolio valuation checkpoints calculated post-upload must be written to `"PortfolioHistory"` so chart queries return immediately without recalculating from scratch.
5. **No Postgres Dependency in Unit Tests**: Hermetic unit tests without a live Postgres instance must execute cleanly with `pool: None`.

---

### Task 1: Add PostgreSQL Persistence to History Refresh Worker

**Files:**
- Modify: `backend-rs/crates/portfolio-worker/src/jobs/history_refresh.rs`
- Test: `backend-rs/crates/portfolio-worker/tests/worker_tests.rs`

**Interfaces:**
- Consumes: `sqlx::PgPool`, `HistoryRefreshJobData`, `InMemoryDatabase`
- Produces: `pub async fn process_history_refresh_job_with_pool(job_data: &HistoryRefreshJobData, db: &InMemoryDatabase, pool: Option<&sqlx::PgPool>) -> Result<Vec<HistoricalValuationEntity>, WorkerError>`

- [ ] **Step 1: Write test for `process_history_refresh_job_with_pool` with `None` pool**
- [ ] **Step 2: Run test to verify existing behavior**
- [ ] **Step 3: Implement `process_history_refresh_job_with_pool` in `history_refresh.rs`**
  - Compute historical valuation checkpoints as before.
  - If `pool` is `Some(pool)`:
    - Loop through emitted records and execute:
      ```sql
      INSERT INTO "PortfolioHistory" (id, "portfolioId", date, value, "investedAmount", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT ("portfolioId", date) DO UPDATE
      SET value = EXCLUDED.value, "investedAmount" = EXCLUDED."investedAmount", "updatedAt" = NOW()
      ```
  - Re-export and preserve `process_history_refresh_job` calling `process_history_refresh_job_with_pool(job_data, db, None)`.
- [ ] **Step 4: Run `cargo test --package portfolio-worker` to verify PASS**
- [ ] **Step 5: Commit changes**

---

### Task 2: Implement PostgreSQL Ingestion Pipeline for CAS Statements

**Files:**
- Modify: `backend-rs/crates/portfolio-worker/src/jobs/cas_parser.rs`
- Modify: `backend-rs/crates/portfolio-worker/src/jobs/mod.rs`
- Test: `backend-rs/crates/portfolio-worker/tests/worker_tests.rs`

**Interfaces:**
- Consumes: `ProcessPdfUploadJobData`, `InMemoryDatabase`, `Option<&sqlx::PgPool>`
- Produces: `pub async fn process_pdf_job_with_pool(job_data: &ProcessPdfUploadJobData, db: &InMemoryDatabase, pool: Option<&sqlx::PgPool>) -> Result<(), WorkerError>`

- [ ] **Step 1: Add helper SQL functions in `cas_parser.rs` for Postgres entity upserts:**
  - `upsert_postgres_profile(pool, user_id, pan, tax_slab) -> Result<Uuid, WorkerError>`
  - `upsert_postgres_portfolio(pool, user_id, profile_id, name) -> Result<Uuid, WorkerError>`
  - `upsert_postgres_asset(pool, name, isin, amfi_code) -> Result<Uuid, WorkerError>`
  - `upsert_postgres_folio(pool, portfolio_id, asset_id, number, amc, pan) -> Result<Uuid, WorkerError>`
  - `insert_postgres_transaction(pool, folio_id, date, tx_type, amount, units, nav, balance, external_id) -> Result<(), WorkerError>`
- [ ] **Step 2: Update `process_cas_file_internal` to take `pool: Option<&sqlx::PgPool>`**
  - When `pool` is `Some`:
    - Ingest each profile, portfolio, asset, folio, and transaction into PostgreSQL using the helpers.
    - Also ingest into `InMemoryDatabase` for local cache.
  - When `pool` is `None`:
    - Retain purely in-memory ingestion.
  - Call `process_history_refresh_job_with_pool` for each touched portfolio with `pool`.
- [ ] **Step 3: Update `process_pdf_job_with_pool` and ensure `process_pdf_job` delegates to it**
- [ ] **Step 4: Add unit tests in `worker_tests.rs` validating `process_pdf_job_with_pool`**
- [ ] **Step 5: Run tests to verify PASS**
- [ ] **Step 6: Commit changes**

---

### Task 3: Wire PostgreSQL Pool into Worker Main Entrypoint

**Files:**
- Modify: `backend-rs/crates/portfolio-worker/src/main.rs`

**Interfaces:**
- Consumes: `process_pdf_job_with_pool`, `pg_pool`
- Produces: Live worker processing PDF jobs with direct Postgres persistence

- [ ] **Step 1: Update `main.rs` to call `process_pdf_job_with_pool(&job, &db, pg_pool.as_ref())`**
- [ ] **Step 2: Ensure logging clearly reports PostgreSQL persistence status upon successful job completion**
- [ ] **Step 3: Run hermetic verification: `cargo check --workspace --all-targets` and `cargo test --package portfolio-worker`**
- [ ] **Step 4: Commit changes**

---

### Task 4: Full Hermetic Verification Sequence & Docker Build Proof

**Files:**
- Verify workspace builds cleanly without warnings or errors.

- [ ] **Step 1: Run `cargo fmt --check` in `backend-rs`**
- [ ] **Step 2: Run `cargo clippy --workspace --all-targets -- -D warnings`**
- [ ] **Step 3: Run `cargo test --workspace`**
- [ ] **Step 4: Verify test export bindings and contracts: `cargo test --package portfolio-api --test export_bindings && git diff --exit-code frontend/src/types/generated`**
- [ ] **Step 5: Provide the user with the docker image build/deploy commands for their remote host**
