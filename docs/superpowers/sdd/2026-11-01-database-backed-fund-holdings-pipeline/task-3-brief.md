# Task 3 Brief: API Ingestion and Lookup Endpoints in portfolio-api

## Task Objective
Create `POST /api/fund-holdings/ingest` and `GET /api/fund-holdings/:isin` in `portfolio-api`, wire them into Axum router in `state.rs`, and write comprehensive hermetic contract tests in `contract_tests.rs`.

## Plan Excerpt
**Files:**
- Create: `backend-rs/crates/portfolio-api/src/routes/fund_holdings.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/mod.rs`
- Modify: `backend-rs/crates/portfolio-api/src/state.rs`
- Test: `backend-rs/crates/portfolio-api/tests/contract_tests.rs`

**Interfaces:**
- Consumes: `FundHoldingEntity`, `FundHoldingsRepository` trait from `portfolio-db` (via `state.backend`).
- Produces:
  ```rust
  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct IngestHoldingItem {
      pub stock_name: String,
      pub stock_isin: Option<String>,
      #[serde(default = "default_sector")]
      pub sector: String,
      pub weight: Decimal,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct IngestFundHoldingsRequest {
      pub isin: String,
      pub scheme_name: String,
      pub as_of_date: NaiveDate,
      pub holdings: Vec<IngestHoldingItem>,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct IngestFundHoldingsResponse {
      pub isin: String,
      pub count: usize,
      pub as_of_date: NaiveDate,
      pub status: String,
  }

  #[derive(Debug, Clone, Serialize, Deserialize)]
  #[serde(rename_all = "camelCase")]
  pub struct FundHoldingDto {
      pub stock_name: String,
      pub stock_isin: Option<String>,
      pub sector: String,
      pub weight: f64,
  }
  ```
  - Routes:
    - `POST /api/fund-holdings/ingest`
    - `GET /api/fund-holdings/:isin`

## Steps
1. Write failing contract tests in `backend-rs/crates/portfolio-api/tests/contract_tests.rs`:
   - `test_ingest_fund_holdings_success`: Ingest valid batch, assert 200 OK and response with count.
   - `test_ingest_fund_holdings_validation_failure`: Ingest with empty ISIN or empty holdings, assert 400 Bad Request.
   - `test_get_fund_holdings_by_isin`: Ingest and then query `GET /api/fund-holdings/INF209K01157`, assert returned holdings match with correct weights and stock names.
   - `test_get_fund_holdings_empty_when_not_found`: Query unknown ISIN, assert empty array `[]` with 200 OK.
2. Run tests to verify failure: `(cd backend-rs && cargo test --package portfolio-api --test contract_tests test_ingest_fund_holdings)`.
3. Implement `backend-rs/crates/portfolio-api/src/routes/fund_holdings.rs`:
   - Validation: `isin` must be non-empty, `holdings` must not be empty, each holding weight must be $> 0$.
   - Helper to resolve `FundHoldingsRepository`:
     - If `DbBackend::InMemory(ref mem)`, call `mem.upsert_fund_holdings(...)` or `mem.get_latest_holdings_by_isin(...)`.
     - If `DbBackend::Postgres(ref pool)`, call `SqlxFundHoldingsRepo::new(pool.clone())`.
   - Handlers:
     - `ingest_fund_holdings(State(state): State<AppState>, Json(payload): Json<IngestFundHoldingsRequest>) -> Result<Json<IngestFundHoldingsResponse>, ApiError>`
     - `get_fund_holdings(State(state): State<AppState>, Path(isin): Path<String>) -> Result<Json<Vec<FundHoldingDto>>, ApiError>`
4. Register in `backend-rs/crates/portfolio-api/src/routes/mod.rs` and mount in `state.rs`:
   - `.route("/api/fund-holdings/ingest", post(fund_holdings::ingest_fund_holdings))`
   - `.route("/api/fund-holdings/:isin", get(fund_holdings::get_fund_holdings))`
5. Run tests: `(cd backend-rs && cargo test --package portfolio-api --test contract_tests)`.
6. Run clippy & fmt: `(cd backend-rs && cargo clippy --package portfolio-api --all-targets -- -D warnings)` and `(cd backend-rs && cargo fmt --check)`.
7. Commit: `git add backend-rs/crates/portfolio-api && git commit -m "feat(portfolio-api): add fund holdings ingestion and lookup API routes"`.

## Constraints & Mandates
- Follow `AGENTS.md`: Universal Generality Mandate (no portfolio-specific hacks); hermetic test speed (zero-I/O in memory tests); synthetic data only.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
