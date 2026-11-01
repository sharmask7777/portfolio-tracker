# Database-Backed Fund Holdings Pipeline & Ingestion Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a robust, generic, database-backed mutual fund holdings repository in PostgreSQL with an in-memory mock for hermetic testing, ingestion API endpoints for monthly AMC portfolio disclosures, and dynamic look-through in the Stock Intersection and portfolio exposures pipeline with fallback heuristics.

**Architecture:** A new `"FundHolding"` table in `portfolio-db` stores normalized monthly disclosures (ISIN, asOfDate, stockName, stockIsin, sector, weight) with a composite unique constraint for date-versioned idempotent upserts. A `FundHoldingsRepository` trait is implemented for both `SqlxFundHoldingsRepo` and `InMemoryDatabase`. `portfolio-api` exposes authenticated ingestion and lookup routes (`/api/fund-holdings`), while `compute_portfolio_exposures` queries the repository in batch, dynamically prioritizing database disclosures over in-memory fallback heuristics.

**Tech Stack:** Rust (`axum`, `sqlx`, `rust_decimal`, `serde`, `chrono`, `uuid`), PostgreSQL 15, TypeScript (generated types).

**Spec:** [`docs/superpowers/specs/2026-11-01-database-backed-fund-holdings-pipeline-design.md`](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/superpowers/specs/2026-11-01-database-backed-fund-holdings-pipeline-design.md)

## Global Constraints

- **Universal Generality Mandate:** Strictly zero portfolio-specific hacks or single-instance heuristics; all fixes, parsers, and data pipelines must apply uniformly across all portfolios.
- **Strict Zero-I/O Invariant:** `portfolio-core` must remain 100% pure in-memory calculation functions with zero I/O, network, or database dependencies.
- **The Invariant Oracle Law:** Never relax numerical bounds (Units $\Delta \le 0.0001$, Money $\Delta \le ₹0.01$, Returns & XIRR $\Delta \le 10^{-6}$).
- **The Zero-Any Mandate:** No `any` types in TypeScript code; shared data contracts must use generated TypeScript bindings.
- **Mandatory Synthetic Data:** Strictly zero real PII, PANs, user names, or CAS statements in tests and fixtures.
- **Hermetic Test Speed:** Sub-millisecond test execution via `InMemoryDatabase` mock; `cargo test --workspace` must run completely Docker-free.

## Review Focus

1. **Date-Versioned Idempotent Upserts:** Re-ingesting an identical disclosure batch for the same `(isin, as_of_date, stock_name)` updates existing weights rather than duplicating rows or erroring out.
2. **Latest Disclosure Resolution:** When multiple `as_of_date` disclosures exist for the same fund ISIN, `get_latest_holdings_by_isin` and `get_latest_holdings_batch` must return only the latest available disclosure date.
3. **Seamless Heuristic Fallback:** If a fund ISIN is not present in `"FundHolding"`, `compute_portfolio_exposures` must seamlessly fall back to `resolve_holdings` without throwing errors or dropping the fund from total portfolio value.
4. **Weight Normalization & Sector Assignment:** Persisted disclosure sectors take precedence over keyword-based heuristic sector guessing; weights are properly scaled to Decimal percentages.
5. **Contract Drift Guard:** All new API models must be exported to TypeScript contracts and pass `git diff --exit-code frontend/src/types/generated`.

---

### Task 1: DDL Schema, `FundHoldingEntity`, and `FundHoldingsRepository` Trait in `portfolio-db`

**Files:**
- Modify: `backend-rs/crates/portfolio-db/src/schema.rs`
- Modify: `backend-rs/crates/portfolio-db/src/entities.rs`
- Create: `backend-rs/crates/portfolio-db/src/repositories/fund_holdings_repo.rs`
- Modify: `backend-rs/crates/portfolio-db/src/repositories/mod.rs`
- Modify: `backend-rs/crates/portfolio-db/src/lib.rs`
- Test: `backend-rs/crates/portfolio-db/tests/entities_test.rs` or inline unit tests

**Interfaces:**
- Produces:
  ```rust
  #[derive(Debug, Clone, Serialize, Deserialize)]
  pub struct FundHoldingEntity {
      pub id: Uuid,
      pub isin: String,
      pub scheme_name: String,
      pub as_of_date: NaiveDate,
      pub stock_name: String,
      pub stock_isin: Option<String>,
      pub sector: String,
      pub weight: Decimal,
      pub created_at: DateTime<Utc>,
  }

  #[async_trait]
  pub trait FundHoldingsRepository: Send + Sync {
      async fn upsert_fund_holdings(&self, holdings: &[FundHoldingEntity]) -> Result<(), DbError>;
      async fn get_latest_holdings_by_isin(&self, isin: &str) -> Result<Vec<FundHoldingEntity>, DbError>;
      async fn get_latest_holdings_batch(&self, isins: &[&str]) -> Result<HashMap<String, Vec<FundHoldingEntity>>, DbError>;
  }

  pub struct SqlxFundHoldingsRepo { pool: sqlx::PgPool }
  ```

- [ ] **Step 1: Write the failing unit tests for `FundHoldingEntity` and schema definitions**

Add test in `backend-rs/crates/portfolio-db/src/entities.rs` (or a dedicated test module) verifying JSON serialization/deserialization and Decimal conversion of `FundHoldingEntity`.
```rust
#[test]
fn test_fund_holding_entity_serde() {
    let entity = FundHoldingEntity {
        id: Uuid::new_v4(),
        isin: "INF209K01157".to_string(),
        scheme_name: "SBI Large Cap Fund".to_string(),
        as_of_date: NaiveDate::from_ymd_opt(2026, 10, 31).unwrap(),
        stock_name: "HDFC Bank Ltd.".to_string(),
        stock_isin: Some("INE040A01034".to_string()),
        sector: "Financial Services".to_string(),
        weight: Decimal::from_str("8.50").unwrap(),
        created_at: Utc::now(),
    };
    let json = serde_json::to_string(&entity).unwrap();
    let decoded: FundHoldingEntity = serde_json::from_str(&json).unwrap();
    assert_eq!(decoded.isin, entity.isin);
    assert_eq!(decoded.weight, entity.weight);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `(cd backend-rs && cargo test --package portfolio-db test_fund_holding_entity_serde)`
Expected: FAIL with "cannot find type `FundHoldingEntity` in this scope"

- [ ] **Step 3: Implement DDL in `schema.rs`, `FundHoldingEntity` in `entities.rs`, and repository in `repositories/fund_holdings_repo.rs`**

1. In `schema.rs`, add:
```sql
CREATE TABLE IF NOT EXISTS "FundHolding" (
    "id" TEXT PRIMARY KEY,
    "isin" TEXT NOT NULL,
    "schemeName" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "stockName" TEXT NOT NULL,
    "stockIsin" TEXT,
    "sector" TEXT NOT NULL DEFAULT 'Other',
    "weight" NUMERIC(6, 3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FundHolding_isin_asOfDate_stockName_key" UNIQUE ("isin", "asOfDate", "stockName")
);
CREATE INDEX IF NOT EXISTS "FundHolding_isin_idx" ON "FundHolding"("isin");
CREATE INDEX IF NOT EXISTS "FundHolding_asOfDate_idx" ON "FundHolding"("asOfDate");
```
2. In `entities.rs`, define `FundHoldingEntity` with `sqlx::FromRow` and Serde attributes.
3. In `fund_holdings_repo.rs`, define `FundHoldingsRepository` trait and `SqlxFundHoldingsRepo` implementing:
   - `upsert_fund_holdings`: Batch `INSERT INTO "FundHolding" ... ON CONFLICT ("isin", "asOfDate", "stockName") DO UPDATE SET "weight" = EXCLUDED."weight", "sector" = EXCLUDED."sector"`
   - `get_latest_holdings_by_isin`: Queries holdings for the max `asOfDate` of the given ISIN.
   - `get_latest_holdings_batch`: Queries holdings for the max `asOfDate` partitioned by ISIN.
4. Export in `repositories/mod.rs` and `lib.rs`.

- [ ] **Step 4: Run test to verify it passes**

Run: `(cd backend-rs && cargo test --package portfolio-db)`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-rs/crates/portfolio-db
git commit -m "feat(portfolio-db): add FundHolding schema, entity, and Sqlx repository"
```

---

### Task 2: Implement `FundHoldingsRepository` on `InMemoryDatabase` for Hermetic Testing

**Files:**
- Modify: `backend-rs/crates/portfolio-db/src/test_mocks.rs`
- Test: `backend-rs/crates/portfolio-db/src/test_mocks.rs` (add unit tests)

**Interfaces:**
- Consumes: `FundHoldingEntity`, `FundHoldingsRepository` from Task 1.
- Produces: Full in-memory mock supporting sub-millisecond, Zero-I/O tests for fund holding ingestion and lookups.

- [ ] **Step 1: Write failing unit tests for `InMemoryDatabase` fund holdings operations**

Add tests in `test_mocks.rs`:
- `test_in_memory_fund_holdings_upsert_and_latest_lookup`: Ingest 2 dates for the same ISIN, assert only the latest date's holdings are returned.
- `test_in_memory_fund_holdings_idempotent_update`: Ingest revised weight for existing (isin, date, stock), assert weight is updated without duplicate entries.
- `test_in_memory_fund_holdings_batch_lookup`: Ingest for 2 ISINs, query batch for 3 ISINs (one non-existent), assert correct mapping and missing ISIN omitted or empty.

- [ ] **Step 2: Run test to verify it fails**

Run: `(cd backend-rs && cargo test --package portfolio-db test_in_memory_fund_holdings)`
Expected: FAIL with "no method named `upsert_fund_holdings` on `InMemoryDatabase`"

- [ ] **Step 3: Implement `FundHoldingsRepository` for `InMemoryDatabase` in `test_mocks.rs`**

1. Add `fund_holdings: HashMap<(String, NaiveDate, String), FundHoldingEntity>` to `InMemoryDatabaseState`.
2. Implement `FundHoldingsRepository` for `InMemoryDatabase`:
   - `upsert_fund_holdings`: Write lock state, insert/overwrite keyed by `(isin, as_of_date, stock_name)`.
   - `get_latest_holdings_by_isin`: Read lock, filter by ISIN, find max `as_of_date`, return all holdings for that date sorted by weight descending.
   - `get_latest_holdings_batch`: Group by ISIN, find max date per ISIN, return map.
3. Reset `fund_holdings` in `clear()`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `(cd backend-rs && cargo test --package portfolio-db)`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend-rs/crates/portfolio-db/src/test_mocks.rs
git commit -m "feat(portfolio-db): implement FundHoldingsRepository for InMemoryDatabase"
```

---

### Task 3: API Ingestion and Lookup Endpoints in `portfolio-api`

**Files:**
- Create: `backend-rs/crates/portfolio-api/src/routes/fund_holdings.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/mod.rs`
- Modify: `backend-rs/crates/portfolio-api/src/state.rs`
- Test: `backend-rs/crates/portfolio-api/tests/contract_tests.rs`

**Interfaces:**
- Consumes: `FundHoldingEntity`, `FundHoldingsRepository` from `portfolio-db`.
- Produces:
  - `POST /api/fund-holdings/ingest`: Accepts `IngestFundHoldingsRequest`, validates total weight and mandatory fields, returns `IngestFundHoldingsResponse`.
  - `GET /api/fund-holdings/:isin`: Returns `Vec<FundHoldingDto>` for the latest disclosure date.

- [ ] **Step 1: Write failing contract tests for fund holdings API endpoints**

In `backend-rs/crates/portfolio-api/tests/contract_tests.rs`, add tests:
- `test_ingest_fund_holdings_success`: Ingest valid SBI Large Cap Fund disclosure batch, assert 200 OK and response with count.
- `test_ingest_fund_holdings_validation_failure`: Ingest with empty ISIN or empty holdings, assert 400 Bad Request.
- `test_get_fund_holdings_by_isin`: Ingest and then query `GET /api/fund-holdings/INF209K01157`, assert returned holdings match with correct Decimal weights and stock names.
- `test_get_fund_holdings_not_found`: Query unknown ISIN, assert 404 or empty array (200 with `[]`).

- [ ] **Step 2: Run test to verify it fails**

Run: `(cd backend-rs && cargo test --package portfolio-api --test contract_tests test_ingest_fund_holdings)`
Expected: FAIL with route not found (404) or missing types.

- [ ] **Step 3: Implement `fund_holdings.rs` and wire into `AppState`**

1. Create `backend-rs/crates/portfolio-api/src/routes/fund_holdings.rs`:
   - DTOs: `IngestHoldingItem`, `IngestFundHoldingsRequest`, `IngestFundHoldingsResponse`, `FundHoldingDto`.
   - Route handlers:
     - `pub async fn ingest_fund_holdings(State(state): State<AppState>, Json(req): Json<IngestFundHoldingsRequest>) -> Result<Json<IngestFundHoldingsResponse>, ApiError>`
     - `pub async fn get_fund_holdings(State(state): State<AppState>, Path(isin): Path<String>) -> Result<Json<Vec<FundHoldingDto>>, ApiError>`
   - Validation: Ensure `isin` is non-empty, `holdings` is non-empty, and weights are positive.
2. In `state.rs`, mount routes:
   - `.route("/api/fund-holdings/ingest", post(fund_holdings::ingest_fund_holdings))`
   - `.route("/api/fund-holdings/:isin", get(fund_holdings::get_fund_holdings))`
3. Handle repository routing for both `DbBackend::InMemory` and `DbBackend::Postgres`.

- [ ] **Step 4: Run contract tests to verify they pass**

Run: `(cd backend-rs && cargo test --package portfolio-api --test contract_tests test_ingest_fund_holdings)`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-rs/crates/portfolio-api
git commit -m "feat(portfolio-api): add fund holdings ingestion and lookup API routes"
```

---

### Task 4: Dynamic Look-Through Integration in `compute_portfolio_exposures`

**Files:**
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Test: `backend-rs/crates/portfolio-api/tests/contract_tests.rs`

**Interfaces:**
- Consumes: `FundHoldingsRepository` via `state.backend`, `resolve_holdings` as fallback.
- Produces: Dynamic exposure resolution that automatically utilizes persisted database disclosures if available, falling back seamlessly to `resolve_holdings` heuristics if missing.

- [ ] **Step 1: Write failing contract test for dynamic database look-through with fallback**

In `contract_tests.rs`:
Add test `test_dynamic_exposure_uses_db_holdings_when_available`:
1. Create a user portfolio containing a folio with ISIN `"INF209K01157"` and value 100,000.
2. Before ingestion: `GET /api/portfolio/{id}/exposures` returns exposure based on `resolve_holdings` heuristic.
3. Ingest custom disclosure for `"INF209K01157"` with unique stock "Custom Synth Tech Ltd." (weight 15.0%) and sector "Technology".
4. After ingestion: `GET /api/portfolio/{id}/exposures` returns "Custom Synth Tech Ltd." at 15.0% and allocated value 15,000.
5. In the same portfolio, a fund without DB disclosure (e.g. UTI Nifty 50) still resolves via fallback heuristics without error.

- [ ] **Step 2: Run test to verify it fails**

Run: `(cd backend-rs && cargo test --package portfolio-api --test contract_tests test_dynamic_exposure_uses_db_holdings_when_available)`
Expected: FAIL because `compute_portfolio_exposures` only calls `resolve_holdings` and ignores the DB.

- [ ] **Step 3: Update `compute_portfolio_exposures` in `portfolio.rs`**

1. In `compute_portfolio_exposures`:
   - Collect unique active equity folios' ISINs.
   - Batch query latest holdings:
     - If `DbBackend::InMemory(ref mem)`, call `mem.get_latest_holdings_batch(&isin_refs).await`.
     - If `DbBackend::Postgres(ref pool)`, call `SqlxFundHoldingsRepo::new(pool.clone()).get_latest_holdings_batch(&isin_refs).await`.
   - When iterating over `active_equity_folios`:
     - If `db_holdings_map.get(isin)` has entries, map them into `FundHolding` structs, using the persisted `stock_name`, `weight`, and `sector`.
     - If not found or empty, call `resolve_holdings(isin, &asset.name)`.
2. Normalize stock names and aggregate values into `StockExposure` contributions as before.

- [ ] **Step 4: Run contract tests to verify they pass**

Run: `(cd backend-rs && cargo test --package portfolio-api --test contract_tests test_dynamic_exposure_uses_db_holdings_when_available)`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-rs/crates/portfolio-api
git commit -m "feat(portfolio-api): dynamically prioritize database fund disclosures in portfolio exposures"
```

---

### Task 5: Export Type Bindings, Parity Verification, & Full Hermetic Gate Execution

**Files:**
- Modify: `frontend/src/types/generated/` (via export bindings)
- Test: Full Hermetic Verification Sequence (Steps 1-7 from `AGENTS.md`)

- [ ] **Step 1: Export TypeScript bindings and verify no contract drift**

Run:
```bash
(cd backend-rs && cargo test --package portfolio-api --test export_bindings)
git status frontend/src/types/generated
```
Expected: Any newly introduced public structs have generated `.ts` definitions in `frontend/src/types/generated/`.

- [ ] **Step 2: Run backend tests, clippy, and formatting checks**

Run:
```bash
(cd backend-rs && cargo test --workspace)
(cd backend-rs && cargo clippy --workspace --all-targets -- -D warnings)
(cd backend-rs && cargo fmt --check)
```
Expected: Zero compilation errors, zero clippy warnings, clean formatting.

- [ ] **Step 3: Run parity validation harness and frontend unit tests**

Run:
```bash
(cd backend-rs && cargo run --package portfolio-parity)
(cd frontend && npm run build && npm run test:unit)
```
Expected: All parity vectors within precision bounds; TypeScript build and unit tests pass cleanly.

- [ ] **Step 4: Check coverage gates**

Run:
```bash
npm run test:coverage
```
Expected: Backend line coverage $\ge 80\%$, frontend coverage gates pass.

- [ ] **Step 5: Commit any generated bindings or test adjustments**

```bash
git add frontend/src/types/generated
git commit -m "chore: update generated typescript bindings and verify hermetic test suite"
```
