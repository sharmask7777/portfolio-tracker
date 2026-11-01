//! Fund holdings repository trait and SQLx implementation.

use std::collections::HashMap;

use async_trait::async_trait;

use crate::entities::FundHoldingEntity;
use crate::error::DbError;

#[async_trait]
pub trait FundHoldingsRepository: Send + Sync {
    /// Upserts a batch of fund holdings (disclosed portfolio holdings) into the database.
    ///
    /// Conflicting rows matching `(isin, asOfDate, stockName)` will have their
    /// metadata (schemeName, stockIsin, sector, weight) updated.
    async fn upsert_fund_holdings(&self, holdings: &[FundHoldingEntity]) -> Result<(), DbError>;

    /// Gets the latest disclosed holdings for a mutual fund scheme by its ISIN.
    ///
    /// Selects all holdings for the latest `asOfDate` available for that ISIN,
    /// ordered by weight descending.
    async fn get_latest_holdings_by_isin(
        &self,
        isin: &str,
    ) -> Result<Vec<FundHoldingEntity>, DbError>;

    /// Gets the latest disclosed holdings in batch for multiple mutual fund ISINs.
    ///
    /// Returns a map keyed by ISIN containing the holdings for that fund's latest
    /// `asOfDate`.
    async fn get_latest_holdings_batch(
        &self,
        isins: &[&str],
    ) -> Result<HashMap<String, Vec<FundHoldingEntity>>, DbError>;
}

/// Production PostgreSQL repository for FundHoldings using SQLx.
#[derive(Clone, Debug)]
pub struct SqlxFundHoldingsRepo {
    pool: sqlx::PgPool,
}

impl SqlxFundHoldingsRepo {
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

        let mut tx = self.pool.begin().await?;

        for holding in holdings {
            sqlx::query(
                r#"
                INSERT INTO "FundHolding" (
                    id, isin, "schemeName", "asOfDate", "stockName", "stockIsin", sector, weight, "createdAt"
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT ("isin", "asOfDate", "stockName") DO UPDATE SET
                    "schemeName" = EXCLUDED."schemeName",
                    "stockIsin" = EXCLUDED."stockIsin",
                    "sector" = EXCLUDED."sector",
                    "weight" = EXCLUDED."weight"
                "#,
            )
            .bind(holding.id.to_string())
            .bind(&holding.isin)
            .bind(&holding.scheme_name)
            .bind(holding.as_of_date)
            .bind(&holding.stock_name)
            .bind(holding.stock_isin.as_deref())
            .bind(&holding.sector)
            .bind(holding.weight)
            .bind(holding.created_at)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    async fn get_latest_holdings_by_isin(
        &self,
        isin: &str,
    ) -> Result<Vec<FundHoldingEntity>, DbError> {
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
        let mut result: HashMap<String, Vec<FundHoldingEntity>> = HashMap::new();
        if isins.is_empty() {
            return Ok(result);
        }

        for &isin in isins {
            result.entry(isin.to_string()).or_default();
        }

        let isin_strings: Vec<String> = isins.iter().map(|s| s.to_string()).collect();

        let records = sqlx::query_as::<_, FundHoldingEntity>(
            r#"
            WITH latest_dates AS (
                SELECT isin, MAX("asOfDate") as max_date
                FROM "FundHolding"
                WHERE isin = ANY($1)
                GROUP BY isin
            )
            SELECT h.id::uuid, h.isin, h."schemeName", h."asOfDate", h."stockName", h."stockIsin", h.sector, h.weight,
                   h."createdAt" AT TIME ZONE 'UTC' as "createdAt"
            FROM "FundHolding" h
            JOIN latest_dates ld ON h.isin = ld.isin AND h."asOfDate" = ld.max_date
            ORDER BY h.isin ASC, h.weight DESC, h."stockName" ASC
            "#,
        )
        .bind(&isin_strings[..])
        .fetch_all(&self.pool)
        .await?;

        for record in records {
            result.entry(record.isin.clone()).or_default().push(record);
        }

        Ok(result)
    }
}
