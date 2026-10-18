//! Portfolio repository trait and SQLx implementation.

use async_trait::async_trait;
use chrono::Utc;
use uuid::Uuid;

use crate::entities::PortfolioEntity;
use crate::error::DbError;

#[async_trait]
pub trait PortfolioRepository: Send + Sync {
    /// Creates a new portfolio for a user, optionally linked to a managed profile.
    async fn create_portfolio(
        &self,
        user_id: Uuid,
        name: &str,
        managed_profile_id: Option<Uuid>,
    ) -> Result<PortfolioEntity, DbError>;

    /// Gets a portfolio by its ID.
    async fn get_portfolio(&self, id: Uuid) -> Result<Option<PortfolioEntity>, DbError>;

    /// Lists all portfolios owned by a user.
    async fn list_user_portfolios(&self, user_id: Uuid) -> Result<Vec<PortfolioEntity>, DbError>;

    /// Deletes a portfolio by ID.
    async fn delete_portfolio(&self, id: Uuid) -> Result<(), DbError>;
}

/// Production PostgreSQL repository for Portfolios using SQLx.
#[derive(Clone, Debug)]
pub struct SqlxPortfolioRepo {
    pool: sqlx::PgPool,
}

impl SqlxPortfolioRepo {
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
        let id = Uuid::new_v4();
        let now = Utc::now();
        let record = sqlx::query_as::<_, PortfolioEntity>(
            r#"
            INSERT INTO "Portfolio" (id, "userId", name, "managedProfileId", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $5)
            RETURNING id::uuid, "userId"::uuid, "managedProfileId"::uuid, name, "createdAt", "updatedAt"
            "#,
        )
        .bind(id.to_string())
        .bind(user_id.to_string())
        .bind(name)
        .bind(managed_profile_id.map(|u| u.to_string()))
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    async fn get_portfolio(&self, id: Uuid) -> Result<Option<PortfolioEntity>, DbError> {
        let record = sqlx::query_as::<_, PortfolioEntity>(
            r#"
            SELECT id::uuid, "userId"::uuid, "managedProfileId"::uuid, name, "createdAt", "updatedAt"
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
        let records = sqlx::query_as::<_, PortfolioEntity>(
            r#"
            SELECT id::uuid, "userId"::uuid, "managedProfileId"::uuid, name, "createdAt", "updatedAt"
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
        sqlx::query(
            r#"
            DELETE FROM "Portfolio"
            WHERE id = $1
            "#,
        )
        .bind(id.to_string())
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
