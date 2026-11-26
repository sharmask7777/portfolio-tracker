//! Fund holdings repository trait and SQLx PostgreSQL implementation.
//!
//! Provides data access for monthly mutual fund stock-level portfolio disclosures (look-through equity holding data).

use std::collections::HashMap;

use async_trait::async_trait;

use crate::entities::FundHoldingEntity;
use crate::error::DbError;

/// Repository interface for persisting and querying mutual fund equity holding disclosures.
#[async_trait]
pub trait FundHoldingsRepository: Send + Sync {
    /// Upserts a batch of disclosed fund stock holdings in an atomic transaction.
    ///
    /// Conflicting rows matching `(isin, asOfDate, stockName)` will have their
    /// metadata (`schemeName`, `stockIsin`, `sector`, `weight`) updated.
    ///
    /// # Errors
    /// Returns [`DbError`] if the database transaction fails or queries error.
    async fn upsert_fund_holdings(&self, holdings: &[FundHoldingEntity]) -> Result<(), DbError>;

    /// Gets the latest disclosed holdings for a mutual fund scheme by its ISIN.
    ///
    /// Finds the maximum `asOfDate` available for the given ISIN, and returns all stock
    /// positions for that date, ordered by portfolio weight descending.
    ///
    /// # Errors
    /// Returns [`DbError`] if the query execution fails.
    async fn get_latest_holdings_by_isin(
        &self,
        isin: &str,
    ) -> Result<Vec<FundHoldingEntity>, DbError>;

    /// Gets the latest disclosed holdings in batch for multiple mutual fund ISINs.
    ///
    /// Uses an optimized Common Table Expression (CTE) to retrieve the latest `asOfDate`
    /// for each requested scheme in a single round-trip. Returns a map keyed by ISIN.
    ///
    /// # Errors
    /// Returns [`DbError`] if the batch query execution fails.
    async fn get_latest_holdings_batch(
        &self,
        isins: &[&str],
    ) -> Result<HashMap<String, Vec<FundHoldingEntity>>, DbError>;
}

/// Production PostgreSQL implementation of [`FundHoldingsRepository`] using SQLx.
#[derive(Clone, Debug)]
pub struct SqlxFundHoldingsRepo {
    pool: sqlx::PgPool,
}

impl SqlxFundHoldingsRepo {
    /// Creates a new repository instance backed by the given PostgreSQL connection pool.
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl FundHoldingsRepository for SqlxFundHoldingsRepo {
    async fn upsert_fund_holdings(&self, holdings: &[FundHoldingEntity]) -> Result<(), DbError> {
        if holdings.is_empty() {
            return Ok(());
        }

        let mut ids = Vec::with_capacity(holdings.len());
        let mut isins = Vec::with_capacity(holdings.len());
        let mut scheme_names = Vec::with_capacity(holdings.len());
        let mut as_of_dates = Vec::with_capacity(holdings.len());
        let mut stock_names = Vec::with_capacity(holdings.len());
        let mut stock_isins: Vec<Option<String>> = Vec::with_capacity(holdings.len());
        let mut sectors = Vec::with_capacity(holdings.len());
        let mut weights = Vec::with_capacity(holdings.len());
        let mut created_ats = Vec::with_capacity(holdings.len());

        for holding in holdings {
            ids.push(holding.id.to_string());
            isins.push(holding.isin.clone());
            scheme_names.push(holding.scheme_name.clone());
            as_of_dates.push(holding.as_of_date);
            stock_names.push(holding.stock_name.clone());
            stock_isins.push(holding.stock_isin.clone());
            sectors.push(holding.sector.clone());
            weights.push(holding.weight);
            created_ats.push(holding.created_at);
        }

        // Single-statement UNNEST bulk upsert matching "FundHolding_isin_asOfDate_stockName_key".
        sqlx::query(
            r#"
            INSERT INTO "FundHolding" (
                id, isin, "schemeName", "asOfDate", "stockName", "stockIsin", sector, weight, "createdAt"
            )
            SELECT * FROM UNNEST(
                $1::text[],
                $2::text[],
                $3::text[],
                $4::date[],
                $5::text[],
                $6::text[],
                $7::text[],
                $8::numeric[],
                $9::timestamptz[]
            )
            ON CONFLICT ("isin", "asOfDate", "stockName") DO UPDATE SET
                "schemeName" = EXCLUDED."schemeName",
                "stockIsin" = EXCLUDED."stockIsin",
                "sector" = EXCLUDED."sector",
                "weight" = EXCLUDED."weight"
            "#,
        )
        .bind(&ids)
        .bind(&isins)
        .bind(&scheme_names)
        .bind(&as_of_dates)
        .bind(&stock_names)
        .bind(&stock_isins)
        .bind(&sectors)
        .bind(&weights)
        .bind(&created_ats)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_latest_holdings_by_isin(
        &self,
        isin: &str,
    ) -> Result<Vec<FundHoldingEntity>, DbError> {
        // Find the maximum disclosure date for this ISIN via scalar subquery,
        // and fetch all company positions sorted from largest allocation to smallest.
        let records = sqlx::query_as::<_, FundHoldingEntity>(
            r#"
            SELECT id::uuid, isin, "schemeName", "asOfDate", "stockName", "stockIsin", sector, weight,
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt"
            FROM "FundHolding"
            WHERE isin = $1 AND "asOfDate" = (
                SELECT MAX("asOfDate") FROM "FundHolding" WHERE isin = $1
            )
            ORDER BY weight DESC, "stockName" ASC
            "#,
        )
        .bind(isin)
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    async fn get_latest_holdings_batch(
        &self,
        isins: &[&str],
    ) -> Result<HashMap<String, Vec<FundHoldingEntity>>, DbError> {
        let mut result_map: HashMap<String, Vec<FundHoldingEntity>> = HashMap::new();
        if isins.is_empty() {
            return Ok(result_map);
        }

        // Initialize empty entry for each requested ISIN so missing schemes return empty vectors
        for &isin_str in isins {
            result_map.entry(isin_str.to_string()).or_default();
        }

        let isin_strings: Vec<String> =
            isins.iter().map(std::string::ToString::to_string).collect();

        // Optimized CTE (Common Table Expression):
        // 1. `latest_dates`: Groups by scheme ISIN across the ANY($1) array to find each
        //    individual fund's most recent disclosure date (MAX(asOfDate)).
        // 2. Joins `FundHolding` against `latest_dates` matching on both (isin, asOfDate)
        //    to pull all underlying stock holdings in a single round-trip without N+1 query overhead.
        let records = sqlx::query_as::<_, FundHoldingEntity>(
            r#"
            WITH latest_dates AS (
                SELECT isin, MAX("asOfDate") as max_date
                FROM "FundHolding"
                WHERE isin = ANY($1)
                GROUP BY isin
            )
            SELECT holding.id::uuid, holding.isin, holding."schemeName", holding."asOfDate",
                   holding."stockName", holding."stockIsin", holding.sector, holding.weight,
                   holding."createdAt" AT TIME ZONE 'UTC' as "createdAt"
            FROM "FundHolding" holding
            JOIN latest_dates ON holding.isin = latest_dates.isin AND holding."asOfDate" = latest_dates.max_date
            ORDER BY holding.isin ASC, holding.weight DESC, holding."stockName" ASC
            "#,
        )
        .bind(&isin_strings[..])
        .fetch_all(&self.pool)
        .await?;

        for record in records {
            result_map
                .entry(record.isin.clone())
                .or_default()
                .push(record);
        }

        Ok(result_map)
    }
}
