//! Portfolio repository trait and SQLx PostgreSQL implementation.
//!
//! Provides data access and lifecycle management for user investment portfolios,
//! including creation, retrieval, listing, and atomic cascading deletion.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::entities::{
    AssetEntity, FolioEntity, PortfolioBundle, PortfolioEntity, TransactionEntity,
};
use crate::error::DbError;

/// Repository interface for managing portfolio containers and their lifecycles.
#[async_trait]
pub trait PortfolioRepository: Send + Sync {
    /// Creates a new portfolio for a user, optionally linked to a specific managed family profile.
    ///
    /// # Arguments
    /// * `user_id` - UUID of the owner user account.
    /// * `name` - Descriptive label for the portfolio (e.g. "Primary Growth", "Retirement").
    /// * `managed_profile_id` - Optional UUID of the associated family profile.
    ///
    /// # Errors
    /// Returns [`DbError`] if foreign key constraints are violated or database write fails.
    async fn create_portfolio(
        &self,
        user_id: Uuid,
        name: &str,
        managed_profile_id: Option<Uuid>,
    ) -> Result<PortfolioEntity, DbError>;

    /// Gets a single portfolio by its unique identifier.
    ///
    /// Returns `Ok(None)` if no portfolio exists with the specified ID.
    ///
    /// # Errors
    /// Returns [`DbError`] if the query execution fails.
    async fn get_portfolio(&self, id: Uuid) -> Result<Option<PortfolioEntity>, DbError>;

    /// Lists all portfolios owned by a specific user, ordered chronologically by creation date.
    ///
    /// # Arguments
    /// * `user_id` - UUID of the owner user account.
    ///
    /// # Errors
    /// Returns [`DbError`] if query execution fails.
    async fn list_user_portfolios(&self, user_id: Uuid) -> Result<Vec<PortfolioEntity>, DbError>;

    /// Deletes a portfolio by ID, performing an atomic cascade across all child folios
    /// and transactions within a database transaction.
    ///
    /// # Arguments
    /// * `id` - UUID of the portfolio to permanently delete.
    ///
    /// # Errors
    /// Returns [`DbError`] if transaction execution or commit fails.
    async fn delete_portfolio(&self, id: Uuid) -> Result<(), DbError>;

    /// Fetches a complete portfolio bundle (portfolio, folios, assets, transactions)
    /// using batched `ANY($1)` queries to eliminate N+1 round-trips.
    async fn fetch_portfolio_bundle(&self, id: Uuid) -> Result<Option<PortfolioBundle>, DbError>;

    /// Atomically creates a manual asset, its folio, and its initial purchase transaction
    /// within a single database transaction.
    #[allow(clippy::too_many_arguments)]
    async fn create_manual_asset(
        &self,
        portfolio_id: Uuid,
        asset_type: &str,
        name: &str,
        amount: Decimal,
        units: Decimal,
        nav: Decimal,
        date: DateTime<Utc>,
    ) -> Result<(AssetEntity, FolioEntity, TransactionEntity), DbError>;
}

/// Production PostgreSQL implementation of [`PortfolioRepository`] using SQLx.
#[derive(Clone, Debug)]
pub struct SqlxPortfolioRepo {
    pool: sqlx::PgPool,
}

impl SqlxPortfolioRepo {
    /// Creates a new repository instance backed by the given PostgreSQL connection pool.
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PortfolioRepository for SqlxPortfolioRepo {
    async fn create_portfolio(
        &self,
        user_id: Uuid,
        name: &str,
        managed_profile_id: Option<Uuid>,
    ) -> Result<PortfolioEntity, DbError> {
        let portfolio_id = Uuid::new_v4();
        let now = Utc::now();

        // Inserts the portfolio and returns the persisted record with normalized UTC timestamps.
        let record = sqlx::query_as::<_, PortfolioEntity>(
            r#"
            INSERT INTO "Portfolio" (id, "userId", name, "managedProfileId", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $5)
            RETURNING id::uuid, "userId"::uuid, "managedProfileId"::uuid, name,
                      "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                      "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            "#,
        )
        .bind(portfolio_id.to_string())
        .bind(user_id.to_string())
        .bind(name)
        .bind(managed_profile_id.map(|profile_id| profile_id.to_string()))
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    async fn get_portfolio(&self, id: Uuid) -> Result<Option<PortfolioEntity>, DbError> {
        let record = sqlx::query_as::<_, PortfolioEntity>(
            r#"
            SELECT id::uuid, "userId"::uuid, "managedProfileId"::uuid, name,
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Portfolio"
            WHERE id = $1
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    async fn list_user_portfolios(&self, user_id: Uuid) -> Result<Vec<PortfolioEntity>, DbError> {
        // Returns all user portfolios sorted oldest to newest for stable dashboard presentation.
        let records = sqlx::query_as::<_, PortfolioEntity>(
            r#"
            SELECT id::uuid, "userId"::uuid, "managedProfileId"::uuid, name,
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Portfolio"
            WHERE "userId" = $1
            ORDER BY "createdAt" ASC
            "#,
        )
        .bind(user_id.to_string())
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    async fn delete_portfolio(&self, id: Uuid) -> Result<(), DbError> {
        // An explicit database transaction guarantees that deletion of all downstream financial
        // records is completely atomic. If any step fails, the entire deletion rolls back.
        let mut transaction = self.pool.begin().await?;

        // 1. Delete all transactions belonging to any folio located within this portfolio.
        //    Uses a subquery matching on the portfolio foreign key.
        sqlx::query(
            r#"
            DELETE FROM "Transaction"
            WHERE "folioId" IN (
                SELECT id FROM "Folio"
                WHERE "portfolioId" = $1
            )
            "#,
        )
        .bind(id.to_string())
        .execute(&mut *transaction)
        .await?;

        // 2. Delete all folios linked to this portfolio.
        sqlx::query(
            r#"
            DELETE FROM "Folio"
            WHERE "portfolioId" = $1
            "#,
        )
        .bind(id.to_string())
        .execute(&mut *transaction)
        .await?;

        // 3. Delete the parent portfolio record itself.
        sqlx::query(
            r#"
            DELETE FROM "Portfolio"
            WHERE id = $1
            "#,
        )
        .bind(id.to_string())
        .execute(&mut *transaction)
        .await?;

        // Commit all deletions atomically.
        transaction.commit().await?;

        Ok(())
    }

    async fn fetch_portfolio_bundle(&self, id: Uuid) -> Result<Option<PortfolioBundle>, DbError> {
        let Some(portfolio) = self.get_portfolio(id).await? else {
            return Ok(None);
        };

        let folios = sqlx::query_as::<_, FolioEntity>(
            r#"
            SELECT id, number, amc, pan, "portfolioId", "assetId", "createdAt", "updatedAt"
            FROM "Folio"
            WHERE "portfolioId" = $1
            ORDER BY "createdAt" ASC
            "#,
        )
        .bind(id.to_string())
        .fetch_all(&self.pool)
        .await?;

        if folios.is_empty() {
            return Ok(Some(PortfolioBundle {
                portfolio,
                folios,
                assets: Vec::new(),
                transactions: Vec::new(),
            }));
        }

        let asset_ids: Vec<String> = folios.iter().map(|f| f.asset_id.to_string()).collect();
        let folio_ids: Vec<String> = folios.iter().map(|f| f.id.to_string()).collect();

        let assets = sqlx::query_as::<_, AssetEntity>(
            r#"
            SELECT id, type::text AS type, name, isin, "amfiCode", symbol, "exitLoadMetadata", "createdAt", "updatedAt"
            FROM "Asset"
            WHERE id = ANY($1)
            "#,
        )
        .bind(&asset_ids)
        .fetch_all(&self.pool)
        .await?;

        let transactions = sqlx::query_as::<_, TransactionEntity>(
            r#"
            SELECT id, date, type, amount, units, nav, balance, "folioId", "externalId", "createdAt", "updatedAt"
            FROM "Transaction"
            WHERE "folioId" = ANY($1)
            ORDER BY date ASC, "createdAt" ASC
            "#,
        )
        .bind(&folio_ids)
        .fetch_all(&self.pool)
        .await?;

        Ok(Some(PortfolioBundle {
            portfolio,
            folios,
            assets,
            transactions,
        }))
    }

    async fn create_manual_asset(
        &self,
        portfolio_id: Uuid,
        asset_type: &str,
        name: &str,
        amount: Decimal,
        units: Decimal,
        nav: Decimal,
        date: DateTime<Utc>,
    ) -> Result<(AssetEntity, FolioEntity, TransactionEntity), DbError> {
        let mut tx = self.pool.begin().await?;
        let now = Utc::now();
        let asset_id = Uuid::new_v4().to_string();
        let folio_id = Uuid::new_v4().to_string();
        let tx_id = Uuid::new_v4().to_string();
        let folio_number = format!("MANUAL-{}", &asset_id[..8]);

        let asset = sqlx::query_as::<_, AssetEntity>(
            r#"
            INSERT INTO "Asset" (id, type, name, "createdAt", "updatedAt")
            VALUES ($1, $2::"AssetType", $3, $4, $5)
            RETURNING id, type::text AS type, name, isin, "amfiCode", symbol, "exitLoadMetadata", "createdAt", "updatedAt"
            "#,
        )
        .bind(&asset_id)
        .bind(asset_type)
        .bind(name)
        .bind(now)
        .bind(now)
        .fetch_one(&mut *tx)
        .await?;

        let folio = sqlx::query_as::<_, FolioEntity>(
            r#"
            INSERT INTO "Folio" (id, number, "portfolioId", "assetId", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, number, amc, pan, "portfolioId", "assetId", "createdAt", "updatedAt"
            "#,
        )
        .bind(&folio_id)
        .bind(&folio_number)
        .bind(portfolio_id.to_string())
        .bind(&asset_id)
        .bind(now)
        .bind(now)
        .fetch_one(&mut *tx)
        .await?;

        let transaction = sqlx::query_as::<_, TransactionEntity>(
            r#"
            INSERT INTO "Transaction" (id, date, type, amount, units, nav, balance, "folioId", "createdAt", "updatedAt")
            VALUES ($1, $2, 'PURCHASE', $3, $4, $5, $4, $6, $7, $8)
            RETURNING id, date, type, amount, units, nav, balance, "folioId", "externalId", "createdAt", "updatedAt"
            "#,
        )
        .bind(&tx_id)
        .bind(date)
        .bind(amount)
        .bind(units)
        .bind(nav)
        .bind(&folio_id)
        .bind(now)
        .bind(now)
        .fetch_one(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok((asset, folio, transaction))
    }
}
