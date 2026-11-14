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

        let mut tx = self.pool.begin().await.map_err(DbError::Sqlx)?;

        for item in items {
            sqlx::query(
                r#"
                INSERT INTO "StockMetadata" (
                    "isin", "symbol", "name", "sector", "marketCapTier", "marketCapRank", "marketCapCr", "asOfDate", "createdAt", "updatedAt"
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
            .bind(&item.isin)
            .bind(&item.symbol)
            .bind(&item.name)
            .bind(&item.sector)
            .bind(&item.market_cap_tier)
            .bind(item.market_cap_rank)
            .bind(item.market_cap_cr)
            .bind(item.as_of_date)
            .bind(item.created_at)
            .bind(item.updated_at)
            .execute(&mut *tx)
            .await
            .map_err(DbError::Sqlx)?;
        }

        tx.commit().await.map_err(DbError::Sqlx)?;
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
