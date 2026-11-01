# Design Document: Database-Backed Fund Holdings Pipeline & Ingestion Engine

**Date:** 2026-11-01  
**Status:** In Review  
**Target File:** `docs/superpowers/specs/2026-11-01-database-backed-fund-holdings-pipeline-design.md`

---

## 1. Intent & The Why

Mutual fund investors hold portfolios containing arbitrary mutual fund schemes whose underlying holdings and weights change monthly. While in-memory heuristics work well for canonical benchmark index funds, real-world portfolio tracking requires:
1. **Authentic Holdings Persistence:** A database repository storing monthly AMC portfolio disclosures (stock name, stock ISIN, sector, and exact percentage weight).
2. **Dynamic Exposure Resolution:** When calculating portfolio stock look-through and X-Ray, schemes with persisted disclosures should use authentic database holdings, while falling back to category heuristics if no disclosure exists yet.
3. **Disclosure Ingestion Interface:** An API and worker ingestion interface to ingest standardized monthly portfolio disclosures (JSON/CSV) into PostgreSQL with idempotent upserts.
4. **Hermetic Test Support:** Full in-memory database mock support in `InMemoryDatabase` for sub-millisecond, Zero-I/O hermetic testing.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Database Entity & Schema:**
  - Create table `"FundHolding"` in `portfolio-db` matching Prisma structure.
  - Add `FundHoldingEntity` with fields: `id`, `isin`, `scheme_name`, `as_of_date`, `stock_name`, `stock_isin`, `sector`, `weight`, `created_at`.
  - Add repository methods: `upsert_fund_holdings`, `get_latest_holdings_by_isin`, `get_latest_holdings_batch`.
  - Implement both PostgreSQL (`sqlx`) and `InMemoryDatabase` mock for hermetic testing.
- **Dynamic Ingestion API:**
  - Endpoint `POST /api/fund-holdings/ingest` in `portfolio-api` accepting authenticated disclosure batches.
  - Endpoint `GET /api/fund-holdings/:isin` returning the latest disclosure for an ISIN.
- **Exposure Pipeline Integration:**
  - In `portfolio-api::compute_portfolio_exposures`:
    - Collect active equity folios' ISINs.
    - Query database for persisted disclosures.
    - If found, use database holdings and actual sectors.
    - If not found (or ISIN missing), seamlessly fallback to `resolve_holdings` heuristic.
- **Hermetic Testing & Invariant Preservation:**
  - Strict zero-I/O in `portfolio-core`.
  - All existing 10 mock portfolios and differential parity checks must continue to pass with exact precision bounds ($\Delta \le 0.0001$ units, $\Delta \le ₹0.01$ amounts, $\Delta \le 10^{-6}$ returns).
  - Strict Zero-Any Mandate in TypeScript.

### Non-Goals
- Directly connecting to third-party scraping targets during test runs (mandated zero external I/O during test execution).
- Modifying tax oracle or Schedule CG tax calculation algorithms.

### Anti-Goals
- Breaking existing synthetic test suites or requiring external databases for `cargo test`.
- Overwriting existing portfolio holdings without date versioning (`as_of_date` composite constraint).

---

## 3. Architecture & Data Contracts

### A. Database Layer (`portfolio-db`)

#### Schema Definition (`schema.rs`)
```sql
CREATE TABLE IF NOT EXISTS "FundHolding" (
    "id" TEXT PRIMARY KEY,
    "isin" TEXT NOT NULL,
    "schemeName" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "stockName" TEXT NOT NULL,
    "stockIsin" TEXT,
    "sector" TEXT NOT NULL DEFAULT 'Other',
    "weight" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FundHolding_isin_asOfDate_stockName_key" UNIQUE ("isin", "asOfDate", "stockName")
);
CREATE INDEX IF NOT EXISTS "FundHolding_isin_idx" ON "FundHolding"("isin");
CREATE INDEX IF NOT EXISTS "FundHolding_asOfDate_idx" ON "FundHolding"("asOfDate");
```

#### Entity Definition (`entities.rs`)
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
```

#### Repository Methods (`repositories/portfolio_repo.rs` & `test_mocks.rs`)
```rust
#[async_trait]
pub trait FundHoldingsRepository: Send + Sync {
    async fn upsert_fund_holdings(&self, holdings: &[FundHoldingEntity]) -> Result<(), DbError>;
    async fn get_latest_holdings_by_isin(&self, isin: &str) -> Result<Vec<FundHoldingEntity>, DbError>;
    async fn get_latest_holdings_batch(&self, isins: &[&str]) -> Result<HashMap<String, Vec<FundHoldingEntity>>, DbError>;
}
```

---

### B. API Route Layer (`portfolio-api`)

1. **Ingest Endpoint:**
   `POST /api/fund-holdings/ingest`
   - Request Body:
     ```json
     {
       "isin": "INF209K01157",
       "schemeName": "SBI Large Cap Fund",
       "asOfDate": "2026-10-31",
       "holdings": [
         {
           "stockName": "HDFC Bank Ltd.",
           "stockIsin": "INE040A01034",
           "sector": "Financial Services",
           "weight": 8.5
         }
       ]
     }
     ```
   - Validates total weights and formats.
   - Atomically upserts into `"FundHolding"`.

2. **Lookup Endpoint:**
   `GET /api/fund-holdings/:isin`
   - Returns latest disclosure records for the specified fund ISIN.

3. **Dynamic Look-Through in `compute_portfolio_exposures`:**
   - Queries `get_latest_holdings_batch` for all unique active equity ISINs.
   - If the ISIN has holdings in DB, maps to `FundHolding` with persisted weights and sectors.
   - If DB returns empty for that ISIN, falls back to `resolve_holdings(isin, scheme_name)`.

---

## 4. What's Left to the Builder

- Exact batch query optimizations in `portfolio_repo.rs` (PostgreSQL window function `ROW_NUMBER() OVER (PARTITION BY "isin", "stockName" ORDER BY "asOfDate" DESC)` or subquery for latest date).
- DTO deserialization validation helpers in `portfolio-api`.
