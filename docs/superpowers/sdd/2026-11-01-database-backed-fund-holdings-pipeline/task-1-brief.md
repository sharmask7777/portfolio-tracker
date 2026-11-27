# Task 1 Brief: DDL Schema, FundHoldingEntity, and FundHoldingsRepository Trait in portfolio-db

## Task Objective
Implement the database schema for `"FundHolding"` in `portfolio-db`, the Rust entity struct `FundHoldingEntity`, the `FundHoldingsRepository` trait, and the PostgreSQL implementation `SqlxFundHoldingsRepo`.

## Plan Excerpt
**Files:**
- Modify: `backend-rs/crates/portfolio-db/src/schema.rs`
- Modify: `backend-rs/crates/portfolio-db/src/entities.rs`
- Create: `backend-rs/crates/portfolio-db/src/repositories/fund_holdings_repo.rs`
- Modify: `backend-rs/crates/portfolio-db/src/repositories/mod.rs`
- Modify: `backend-rs/crates/portfolio-db/src/lib.rs`

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

## Steps
1. Write failing test for `FundHoldingEntity` Serde & Decimal conversion in `portfolio-db`.
2. Run test to verify it fails (`(cd backend-rs && cargo test --package portfolio-db test_fund_holding_entity_serde)`).
3. Implement DDL in `schema.rs`:
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
4. Define `FundHoldingEntity` in `entities.rs` with `FromRow` and Serde attributes (mapping `schemeName`, `asOfDate`, `stockName`, `stockIsin`, `createdAt`).
5. Implement `FundHoldingsRepository` trait and `SqlxFundHoldingsRepo` in `repositories/fund_holdings_repo.rs`. Export in `repositories/mod.rs` and `lib.rs`.
6. Run tests to verify they pass (`(cd backend-rs && cargo test --package portfolio-db)`).
7. Commit: `git commit -m "feat(portfolio-db): add FundHolding schema, entity, and Sqlx repository"`.

## Constraints & Mandates
- Follow `AGENTS.md` mandates: No portfolio-specific hacks; hermetic test speed; synthetic data only.
- Working directory: `/Users/shaleensharma/workplace/gemini_ws/portfolio-tracker`.
