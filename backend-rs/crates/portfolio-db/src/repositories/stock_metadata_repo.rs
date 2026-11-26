//! Stock metadata repository trait and SQLx PostgreSQL implementation.
//!
//! Provides data access for authoritative equity security master data including
//! SEBI/AMFI market cap tiers (Large/Mid/Small/Other) and GICS economic sectors.

use std::collections::HashMap;

use async_trait::async_trait;

use crate::entities::StockMetadataEntity;
use crate::error::DbError;

/// Repository interface for persisting and querying equity security master metadata.
#[async_trait]
pub trait StockMetadataRepository: Send + Sync {
    /// Upserts a batch of stock metadata entries in an atomic operation.
    ///
    /// Conflicting rows matching `isin` will have their classification fields
    /// (`symbol`, `name`, `sector`, `marketCapTier`, `marketCapRank`, `marketCapCr`, `asOfDate`, `updatedAt`) updated.
    ///
    /// # Errors
    /// Returns [`DbError`] if database writes fail.
    async fn upsert_batch(&self, items: &[StockMetadataEntity]) -> Result<(), DbError>;

    /// Finds a stock metadata record by exact ISIN.
    ///
    /// # Errors
    /// Returns [`DbError`] if database query fails.
    async fn find_by_isin(&self, isin: &str) -> Result<Option<StockMetadataEntity>, DbError>;

    /// Finds a stock metadata record by ticker symbol (case-insensitive).
    ///
    /// # Errors
    /// Returns [`DbError`] if database query fails.
    async fn find_by_symbol(&self, symbol: &str) -> Result<Option<StockMetadataEntity>, DbError>;

    /// Retrieves all stock metadata records keyed by ISIN.
    ///
    /// # Errors
    /// Returns [`DbError`] if database query fails.
    async fn get_all_as_map(&self) -> Result<HashMap<String, StockMetadataEntity>, DbError>;
}

/// Production PostgreSQL implementation of [`StockMetadataRepository`] using SQLx.
#[derive(Clone, Debug)]
pub struct SqlxStockMetadataRepo {
    pool: sqlx::PgPool,
}

impl SqlxStockMetadataRepo {
    /// Creates a new repository instance backed by the given PostgreSQL connection pool.
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl StockMetadataRepository for SqlxStockMetadataRepo {
    async fn upsert_batch(&self, items: &[StockMetadataEntity]) -> Result<(), DbError> {
        if items.is_empty() {
            return Ok(());
        }

        let mut isins = Vec::with_capacity(items.len());
        let mut symbols = Vec::with_capacity(items.len());
        let mut names = Vec::with_capacity(items.len());
        let mut sectors = Vec::with_capacity(items.len());
        let mut tiers = Vec::with_capacity(items.len());
        let mut ranks: Vec<Option<i32>> = Vec::with_capacity(items.len());
        let mut caps: Vec<Option<f64>> = Vec::with_capacity(items.len());
        let mut as_of_dates = Vec::with_capacity(items.len());
        let mut created_ats = Vec::with_capacity(items.len());
        let mut updated_ats = Vec::with_capacity(items.len());

        for item in items {
            isins.push(item.isin.clone());
            symbols.push(item.symbol.clone());
            names.push(item.name.clone());
            sectors.push(item.sector.clone());
            tiers.push(item.market_cap_tier.clone());
            ranks.push(item.market_cap_rank);
            caps.push(item.market_cap_cr);
            as_of_dates.push(item.as_of_date);
            created_ats.push(item.created_at);
            updated_ats.push(item.updated_at);
        }

        sqlx::query(
            r#"
            INSERT INTO "StockMetadata" (
                "isin", "symbol", "name", "sector", "marketCapTier", "marketCapRank", "marketCapCr", "asOfDate", "createdAt", "updatedAt"
            )
            SELECT * FROM UNNEST(
                $1::text[],
                $2::text[],
                $3::text[],
                $4::text[],
                $5::text[],
                $6::int4[],
                $7::float8[],
                $8::date[],
                $9::timestamptz[],
                $10::timestamptz[]
            )
            ON CONFLICT ("isin") DO UPDATE SET
                "symbol" = EXCLUDED."symbol",
                "name" = EXCLUDED."name",
                "sector" = EXCLUDED."sector",
                "marketCapTier" = EXCLUDED."marketCapTier",
                "marketCapRank" = EXCLUDED."marketCapRank",
                "marketCapCr" = EXCLUDED."marketCapCr",
                "asOfDate" = EXCLUDED."asOfDate",
                "updatedAt" = EXCLUDED."updatedAt"
            "#,
        )
        .bind(&isins)
        .bind(&symbols)
        .bind(&names)
        .bind(&sectors)
        .bind(&tiers)
        .bind(&ranks)
        .bind(&caps)
        .bind(&as_of_dates)
        .bind(&created_ats)
        .bind(&updated_ats)
        .execute(&self.pool)
        .await
        .map_err(DbError::Sqlx)?;

        Ok(())
    }

    async fn find_by_isin(&self, isin: &str) -> Result<Option<StockMetadataEntity>, DbError> {
        let record = sqlx::query_as::<_, StockMetadataEntity>(
            r#"
            SELECT "isin", "symbol", "name", "sector", "marketCapTier", "marketCapRank", "marketCapCr",
                   "asOfDate", "createdAt", "updatedAt"
            FROM "StockMetadata"
            WHERE "isin" = $1
            "#,
        )
        .bind(isin)
        .fetch_optional(&self.pool)
        .await
        .map_err(DbError::Sqlx)?;

        Ok(record)
    }

    async fn find_by_symbol(&self, symbol: &str) -> Result<Option<StockMetadataEntity>, DbError> {
        let record = sqlx::query_as::<_, StockMetadataEntity>(
            r#"
            SELECT "isin", "symbol", "name", "sector", "marketCapTier", "marketCapRank", "marketCapCr",
                   "asOfDate", "createdAt", "updatedAt"
            FROM "StockMetadata"
            WHERE UPPER("symbol") = UPPER($1)
            LIMIT 1
            "#,
        )
        .bind(symbol)
        .fetch_optional(&self.pool)
        .await
        .map_err(DbError::Sqlx)?;

        Ok(record)
    }

    async fn get_all_as_map(&self) -> Result<HashMap<String, StockMetadataEntity>, DbError> {
        let records = sqlx::query_as::<_, StockMetadataEntity>(
            r#"
            SELECT "isin", "symbol", "name", "sector", "marketCapTier", "marketCapRank", "marketCapCr",
                   "asOfDate", "createdAt", "updatedAt"
            FROM "StockMetadata"
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(DbError::Sqlx)?;

        let mut map = HashMap::with_capacity(records.len());
        for r in records {
            map.insert(r.isin.clone(), r);
        }
        Ok(map)
    }
}
