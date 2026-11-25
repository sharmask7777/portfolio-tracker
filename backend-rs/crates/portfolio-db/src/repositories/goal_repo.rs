//! Goal repository trait and SQLx PostgreSQL implementation.
//!
//! Provides data access and lifecycle management for portfolio financial goals,
//! including creation, listing, updating, and deletion.

use async_trait::async_trait;
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use uuid::Uuid;

use crate::entities::GoalEntity;
use crate::error::DbError;

/// Parameters for creating a new financial goal.
#[derive(Debug, Clone)]
pub struct CreateGoalParams<'a> {
    /// Owning portfolio UUID.
    pub portfolio_id: Uuid,
    /// Descriptive goal name.
    pub name: &'a str,
    /// Target corpus amount in INR.
    pub target_amount: Decimal,
    /// Target achievement date.
    pub target_date: NaiveDate,
    /// Planned monthly SIP contribution in INR.
    pub monthly_sip: Decimal,
    /// Priority tier (`HIGH`, `MEDIUM`, `LOW`).
    pub priority: &'a str,
    /// Percentage of portfolio value allocated to this goal (`0..=100`).
    pub allocated_percentage: Decimal,
}

/// Parameters for updating an existing financial goal.
#[derive(Debug, Clone, Default)]
pub struct UpdateGoalParams<'a> {
    /// Updated goal name, if provided.
    pub name: Option<&'a str>,
    /// Updated target corpus amount, if provided.
    pub target_amount: Option<Decimal>,
    /// Updated target date, if provided.
    pub target_date: Option<NaiveDate>,
    /// Updated monthly SIP amount, if provided.
    pub monthly_sip: Option<Decimal>,
    /// Updated priority tier, if provided.
    pub priority: Option<&'a str>,
    /// Updated allocated portfolio percentage, if provided.
    pub allocated_percentage: Option<Decimal>,
}

/// Repository interface for managing financial goals scoped to a portfolio.
#[async_trait]
pub trait GoalRepository: Send + Sync {
    /// Lists all financial goals belonging to a portfolio, ordered chronologically by creation date.
    ///
    /// # Errors
    /// Returns [`DbError`] if the query execution fails.
    async fn list_goals(&self, portfolio_id: Uuid) -> Result<Vec<GoalEntity>, DbError>;

    /// Retrieves a single financial goal by its unique identifier.
    ///
    /// # Errors
    /// Returns [`DbError`] if the query execution fails.
    async fn get_goal(&self, id: Uuid) -> Result<Option<GoalEntity>, DbError>;

    /// Creates a new financial goal linked to a portfolio.
    ///
    /// # Errors
    /// Returns [`DbError`] if foreign key constraints are violated or database write fails.
    async fn create_goal(&self, params: CreateGoalParams<'_>) -> Result<GoalEntity, DbError>;

    /// Updates an existing financial goal scoped to its owning portfolio.
    ///
    /// Returns `Ok(None)` if no matching goal exists for `(id, portfolio_id)`.
    ///
    /// # Errors
    /// Returns [`DbError`] if database write fails.
    async fn update_goal(
        &self,
        id: Uuid,
        portfolio_id: Uuid,
        params: UpdateGoalParams<'_>,
    ) -> Result<Option<GoalEntity>, DbError>;

    /// Deletes a financial goal scoped to its owning portfolio.
    ///
    /// Returns `Ok(true)` if a goal was deleted, or `Ok(false)` if no matching goal existed.
    ///
    /// # Errors
    /// Returns [`DbError`] if database delete fails.
    async fn delete_goal(&self, id: Uuid, portfolio_id: Uuid) -> Result<bool, DbError>;
}

/// Production PostgreSQL implementation of [`GoalRepository`] using SQLx.
#[derive(Clone, Debug)]
pub struct SqlxGoalRepo {
    pool: sqlx::PgPool,
}

impl SqlxGoalRepo {
    /// Creates a new repository instance backed by the given PostgreSQL connection pool.
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl GoalRepository for SqlxGoalRepo {
    async fn list_goals(&self, portfolio_id: Uuid) -> Result<Vec<GoalEntity>, DbError> {
        let records = sqlx::query_as::<_, GoalEntity>(
            r#"
            SELECT id::uuid,
                   "portfolioId"::uuid,
                   name,
                   "targetAmount"::numeric as "targetAmount",
                   "targetDate"::date as "targetDate",
                   "monthlySip"::numeric as "monthlySip",
                   priority,
                   "allocatedPercentage"::numeric as "allocatedPercentage",
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Goal"
            WHERE "portfolioId" = $1
            ORDER BY "createdAt" ASC, id ASC
            "#,
        )
        .bind(portfolio_id.to_string())
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    async fn get_goal(&self, id: Uuid) -> Result<Option<GoalEntity>, DbError> {
        let record = sqlx::query_as::<_, GoalEntity>(
            r#"
            SELECT id::uuid,
                   "portfolioId"::uuid,
                   name,
                   "targetAmount"::numeric as "targetAmount",
                   "targetDate"::date as "targetDate",
                   "monthlySip"::numeric as "monthlySip",
                   priority,
                   "allocatedPercentage"::numeric as "allocatedPercentage",
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Goal"
            WHERE id = $1
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    async fn create_goal(&self, params: CreateGoalParams<'_>) -> Result<GoalEntity, DbError> {
        let goal_id = Uuid::new_v4();
        let now = Utc::now();
        let target_dt = params.target_date.and_hms_opt(0, 0, 0).unwrap_or_default();

        let record = sqlx::query_as::<_, GoalEntity>(
            r#"
            INSERT INTO "Goal" (
                id, "portfolioId", name, "targetAmount", "targetDate",
                "monthlySip", priority, "allocatedPercentage", "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
            RETURNING id::uuid,
                      "portfolioId"::uuid,
                      name,
                      "targetAmount"::numeric as "targetAmount",
                      "targetDate"::date as "targetDate",
                      "monthlySip"::numeric as "monthlySip",
                      priority,
                      "allocatedPercentage"::numeric as "allocatedPercentage",
                      "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                      "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            "#,
        )
        .bind(goal_id.to_string())
        .bind(params.portfolio_id.to_string())
        .bind(params.name)
        .bind(params.target_amount.to_f64().unwrap_or(0.0))
        .bind(target_dt)
        .bind(params.monthly_sip.to_f64().unwrap_or(0.0))
        .bind(params.priority)
        .bind(params.allocated_percentage.to_f64().unwrap_or(100.0))
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    async fn update_goal(
        &self,
        id: Uuid,
        portfolio_id: Uuid,
        params: UpdateGoalParams<'_>,
    ) -> Result<Option<GoalEntity>, DbError> {
        let now = Utc::now();
        let target_dt = params
            .target_date
            .map(|d| d.and_hms_opt(0, 0, 0).unwrap_or_default());

        let record = sqlx::query_as::<_, GoalEntity>(
            r#"
            UPDATE "Goal"
            SET name = COALESCE($3, name),
                "targetAmount" = COALESCE($4, "targetAmount"),
                "targetDate" = COALESCE($5, "targetDate"),
                "monthlySip" = COALESCE($6, "monthlySip"),
                priority = COALESCE($7, priority),
                "allocatedPercentage" = COALESCE($8, "allocatedPercentage"),
                "updatedAt" = $9
            WHERE id = $1 AND "portfolioId" = $2
            RETURNING id::uuid,
                      "portfolioId"::uuid,
                      name,
                      "targetAmount"::numeric as "targetAmount",
                      "targetDate"::date as "targetDate",
                      "monthlySip"::numeric as "monthlySip",
                      priority,
                      "allocatedPercentage"::numeric as "allocatedPercentage",
                      "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                      "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            "#,
        )
        .bind(id.to_string())
        .bind(portfolio_id.to_string())
        .bind(params.name)
        .bind(params.target_amount.and_then(|v| v.to_f64()))
        .bind(target_dt)
        .bind(params.monthly_sip.and_then(|v| v.to_f64()))
        .bind(params.priority)
        .bind(params.allocated_percentage.and_then(|v| v.to_f64()))
        .bind(now)
        .fetch_optional(&self.pool)
        .await?;

        Ok(record)
    }

    async fn delete_goal(&self, id: Uuid, portfolio_id: Uuid) -> Result<bool, DbError> {
        let result = sqlx::query(
            r#"
            DELETE FROM "Goal"
            WHERE id = $1 AND "portfolioId" = $2
            "#,
        )
        .bind(id.to_string())
        .bind(portfolio_id.to_string())
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }
}
