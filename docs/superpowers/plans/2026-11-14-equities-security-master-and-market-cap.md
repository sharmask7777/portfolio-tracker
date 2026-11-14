# Equities Security Master & Market Cap Classification Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace brittle, hardcoded company substring matching in `get_stock_market_cap` and `get_stock_sector` with a scalable, hybrid Security Master architecture featuring a bundled authoritative SEBI Top 1,000 equity catalog, a self-healing PostgreSQL `"StockMetadata"` database table, dynamic API/worker ingestion, and clean fallback to `"other"` / `"unclassified"`.

**Architecture:** 
1. **Core Domain Catalog (`portfolio-core`):** Pure in-memory `SecurityMaster` containing SEBI/AMFI Top 1,000 listed Indian equities with ISIN, Symbol, Name, Sector, and Tier (`LARGE`, `MID`, `SMALL`). Resolves classifications in $O(1)$ time by ISIN, symbol, or normalized company name.
2. **Database Persistence (`portfolio-db`):** `"StockMetadata"` table with self-healing DDL in `schema.rs` and `StockMetadataRepository` trait implemented for both `SqlxStockMetadataRepo` and `InMemoryDatabase`. Seeded automatically on startup from the bundled reference dataset.
3. **Dynamic Ingestion (`portfolio-api`):** Authenticated batch ingestion endpoint `POST /api/stock-metadata` allowing live updates of AMFI semi-annual reclassifications without redeploying code.
4. **X-Ray & Exposures Integration (`portfolio-api`):** Replaces legacy hardcoded `if-else` branches in `routes/portfolio.rs` with `StockMetadata` repository lookups, defaulting unmapped securities cleanly to `other` / `unclassified`.
5. **Frontend Contract Parity (`frontend`):** Extends `XRayData.marketCap` with optional `other: { percentage, value }` and renders `Other / Unclassified` in `XRayDashboard.tsx` when present.

**Tech Stack:** Rust (`axum`, `sqlx`, `rust_decimal`, `serde`, `chrono`, `uuid`), PostgreSQL 15, TypeScript (React, Recharts, Vite).

---

## Global Constraints

- **Universal Generality Mandate:** Strictly zero hardcoded company substring `if-else` branches in application route handlers. All classifications must resolve through the Security Master catalog or database entities.
- **Strict Zero-I/O Invariant:** `portfolio-core` must remain 100% pure in-memory calculation functions with zero I/O, network, or async runtime dependencies.
- **The Invariant Oracle Law:** Never relax numerical bounds (Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$).
- **The Zero-Any & Contract Parity Mandate:** No `any` types in TypeScript code; shared data contracts must use generated TypeScript types or strictly typed interfaces.
- **Mandatory Synthetic Data:** Strictly zero real PII or user portfolios in tests.
- **Hermetic Test Speed:** Sub-millisecond test execution via `InMemoryDatabase` mock; `cargo test --workspace` must pass completely Docker-free.

---

## Review Focus

1. **Exact Resolution Priority:** Lookup must prioritize ISIN first $\to$ Symbol second $\to$ Normalized Company Name third $\to$ Fallback to `"Other"` / `"other"`.
2. **Unclassified Equity Handling:** Equities not present in the master (e.g. overseas stocks like Microsoft/Alphabet, unlisted pre-IPO, micro-caps outside top 1,000) must cleanly map to `other` without defaulting falsely to `large` or dropping from total value.
3. **Market Cap Sum Symmetry:** The sum of `large`, `mid`, `small`, and `other` market cap values and percentages must strictly equal total portfolio equity value (100.0% $\pm 0.01\%$).
4. **Self-Healing Seeding & Idempotency:** Database schema initialization must populate `"StockMetadata"` if empty, and batch upserts must use `ON CONFLICT (isin) DO UPDATE`.
5. **Contract Drift Guard:** All updated API response models must maintain contract parity with frontend components.

---

### Task 1: Core Domain Security Master Catalog in `portfolio-core`

**Files:**
- Create: `backend-rs/crates/portfolio-core/src/xray/security_master.rs`
- Modify: `backend-rs/crates/portfolio-core/src/xray/mod.rs`
- Modify: `backend-rs/crates/portfolio-core/src/lib.rs`
- Create: `backend-rs/crates/portfolio-core/tests/security_master_test.rs`

**Details:**
1. Define `MarketCapTier` enum (`Large`, `Mid`, `Small`, `Other`) with serde serialization/deserialization.
2. Define `SecurityMetadata` struct with `isin`, `symbol`, `name`, `sector`, `tier`, `rank`.
3. Provide the curated static SEBI/AMFI Top equity lookup table covering major Nifty 50, Nifty Next 50, Nifty Midcap 150, and Smallcap 250 constituents.
4. Implement `resolve_security_classification(isin: Option<&str>, symbol: Option<&str>, name: &str) -> (Option<&'static str>, MarketCapTier)`.

**Steps:**
- [x] Write failing test in `backend-rs/crates/portfolio-core/tests/security_master_test.rs` asserting resolution of Large Cap (e.g. HDFC Bank, TCS), Mid Cap (e.g. Federal Bank, Cummins, Indian Hotels), Small Cap (e.g. Sonata Software, CEAT), and unmapped stocks (e.g. "Alphabet Inc.", "Unknown Corp") returning `Other`.
- [x] Run `cargo test --package portfolio-core --test security_master_test` and confirm failure.
- [x] Implement `MarketCapTier`, `SecurityMetadata`, and static lookup map in `portfolio-core/src/xray/security_master.rs`.
- [x] Re-run `cargo test --package portfolio-core --test security_master_test` and confirm pass.

---

### Task 2: PostgreSQL Schema & Repository for `StockMetadata` in `portfolio-db`

**Files:**
- Modify: `backend-rs/crates/portfolio-db/src/schema.rs`
- Modify: `backend-rs/crates/portfolio-db/src/entities.rs`
- Create: `backend-rs/crates/portfolio-db/src/repositories/stock_metadata_repo.rs`
- Modify: `backend-rs/crates/portfolio-db/src/repositories/mod.rs`
- Modify: `backend-rs/crates/portfolio-db/src/test_mocks.rs`
- Modify: `backend-rs/crates/portfolio-db/tests/schema_test.rs`
- Create: `backend-rs/crates/portfolio-db/tests/stock_metadata_test.rs`

**Details:**
1. In `schema.rs`:
   ```sql
   CREATE TABLE IF NOT EXISTS "StockMetadata" (
       "isin" TEXT PRIMARY KEY,
       "symbol" TEXT NOT NULL,
       "name" TEXT NOT NULL,
       "sector" TEXT NOT NULL DEFAULT 'Other',
       "marketCapTier" TEXT NOT NULL,
       "marketCapRank" INT,
       "marketCapCr" DOUBLE PRECISION,
       "asOfDate" DATE NOT NULL,
       "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
       "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
   );
   CREATE INDEX IF NOT EXISTS "StockMetadata_symbol_idx" ON "StockMetadata"("symbol");
   CREATE INDEX IF NOT EXISTS "StockMetadata_name_idx" ON "StockMetadata"("name");
   ```
2. In `entities.rs`: Define `StockMetadataEntity`.
3. In `repositories/stock_metadata_repo.rs`: Define `StockMetadataRepository` trait:
   - `upsert_batch(&self, items: &[StockMetadataEntity]) -> Result<(), DbError>`
   - `find_by_isin(&self, isin: &str) -> Result<Option<StockMetadataEntity>, DbError>`
   - `get_all_as_map(&self) -> Result<HashMap<String, StockMetadataEntity>, DbError>`
4. Implement for `SqlxStockMetadataRepo` and `InMemoryDatabase`.

**Steps:**
- [x] Write failing test in `backend-rs/crates/portfolio-db/tests/stock_metadata_test.rs` testing batch upsert, lookup by ISIN, and in-memory mock repository behavior.
- [x] Run `cargo test --package portfolio-db --test stock_metadata_test` and confirm failure.
- [x] Implement DDL in `schema.rs`, entity in `entities.rs`, repository in `repositories/stock_metadata_repo.rs`, and mock in `test_mocks.rs`.
- [x] Re-run `cargo test --package portfolio-db --test stock_metadata_test` and `cargo test --package portfolio-db --test schema_test` and confirm pass.

---

### Task 3: Replace Hardcoded Logic in `portfolio-api` (`get_stock_market_cap` and `get_stock_sector`)

**Files:**
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Create: `backend-rs/crates/portfolio-api/src/routes/stock_metadata.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/mod.rs`
- Modify: `backend-rs/crates/portfolio-api/src/lib.rs`
- Modify: `backend-rs/crates/portfolio-api/tests/contract_tests.rs`

**Details:**
1. Completely remove the hardcoded substring chains in `get_stock_sector` and `get_stock_market_cap`.
2. Replace with delegation to `portfolio_core::xray::resolve_security_classification`.
3. In `get_xray`:
   - Query `StockMetadataRepository` or in-memory security master map.
   - Aggregate market caps into `large`, `mid`, `small`, and `other`.
   - Ensure `exArbitrage` also reflects accurate market cap and sector aggregation without hardcoded lists.
4. Expose `POST /api/stock-metadata` for authorized ingestion of fresh AMFI classification datasets.

**Steps:**
- [x] Write failing test in `backend-rs/crates/portfolio-api/tests/contract_tests.rs` asserting:
  - `get_stock_market_cap` resolves known companies accurately without substrings.
  - Unmapped equities evaluate to `"other"`.
  - `/api/portfolio/:id/xray` returns properly populated market cap and sector distributions.
- [x] Run `cargo test --package portfolio-api --test contract_tests test_get_stock_market_cap` and confirm failure.
- [x] Implement refactored functions and `get_xray` lookups in `portfolio.rs`.
- [x] Re-run tests and confirm pass.

---

### Task 4: Frontend Contract & Dashboard Alignment

**Files:**
- Modify: `frontend/src/components/Analytics/types.ts`
- Modify: `frontend/src/components/Analytics/XRayDashboard.tsx`
- Modify: `frontend/src/components/Analytics/XRayView.test.tsx`
- Modify: `frontend/src/components/Analytics/XRayDashboard.test.tsx`

**Details:**
1. In `types.ts`, add `other?: { percentage: number; value: number }` to `marketCap` (and `exArbitrage.marketCap`).
2. In `XRayDashboard.tsx`, include `{ name: 'Other / Unclassified', value: (data.marketCap?.other?.percentage || 0) * 100 }` in the BarChart dataset if `data.marketCap?.other && data.marketCap.other.value > 0`.
3. Verify zero TypeScript errors and full test pass.

**Steps:**
- [x] Update frontend types and `XRayDashboard.tsx`.
- [x] Run `pnpm --filter frontend test:unit` and verify all analytics unit tests pass.
- [x] Run `pnpm --filter frontend build` to verify build, lint, and knip gates pass cleanly.

---

### Task 5: End-to-End Verification, Parity, and Pre-Push Gate

**Files:**
- Test scripts: `backend-rs/scripts/verify.sh`
- Docker E2E tests: `frontend/tests/`

**Details:**
1. Run `(cd backend-rs && ./scripts/verify.sh)` to certify:
   - `cargo fmt --check`
   - `cargo check --workspace --all-targets`
   - `cargo clippy --workspace --all-targets -- -D warnings`
   - `cargo doc --workspace --no-deps`
   - `cargo test --workspace`
   - `cargo deny check`
   - `portfolio-parity` (all 10 synthetic scenarios pass with 100% precision)
2. Run `pnpm --filter frontend test:unit` and `pnpm --filter frontend build`.
3. Commit all changes with semantic commit messages and push to remote.
