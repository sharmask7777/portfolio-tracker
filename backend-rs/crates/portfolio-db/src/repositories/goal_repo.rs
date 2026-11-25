use async_trait::async_trait;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

use crate::entities::GoalEntity;
use crate::error::DbError;

/// Repository trait for financial goal CRUD operations.
#[async_trait]
pub trait GoalRepository: Send + Sync {
    /// Creates a new financial goal for a portfolio.
    async fn create_goal(
        &self,
        portfolio_id: &str,
        name: &str,
        target_amount: Decimal,
        target_date: DateTime<Utc>,
    ) -> Result<GoalEntity, DbError>;

    /// Lists all goals belonging to a portfolio, ordered by `targetDate` ascending.
    async fn list_goals(&self, portfolio_id: &str) -> Result<Vec<GoalEntity>, DbError>;

    /// Updates an existing goal's name, target amount, or target date.
    async fn update_goal(
        &self,
        goal_id: &str,
        name: &str,
        target_amount: Decimal,
        target_date: DateTime<Utc>,
    ) -> Result<GoalEntity, DbError>;

    /// Deletes a goal by its ID. Returns `true` if a record was deleted.
    async fn delete_goal(&self, goal_id: &str) -> Result<bool, DbError>;
}

/// PostgreSQL implementation of [`GoalRepository`].
#[derive(Clone, Debug)]
pub struct PgGoalRepository {
    pool: PgPool,
}

impl PgGoalRepository {
    /// Creates a new [`PgGoalRepository`] backed by the given connection pool.
    #[must_use]
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl GoalRepository for PgGoalRepository {
    async fn create_goal(
        &self,
        portfolio_id: &str,
        name: &str,
        target_amount: Decimal,
        target_date: DateTime<Utc>,
    ) -> Result<GoalEntity, DbError> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();
        let goal = sqlx::query_as::<_, GoalEntity>(
            r#"
            INSERT INTO "Goal" (id, name, "targetAmount", "targetDate", "portfolioId", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, name, "targetAmount", "targetDate", "portfolioId", "createdAt", "updatedAt"
            "#,
        )
        .bind(&id)
        .bind(name)
        .bind(target_amount)
        .bind(target_date)
        .bind(portfolio_id)
        .bind(now)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(goal)
    }

    async fn list_goals(&self, portfolio_id: &str) -> Result<Vec<GoalEntity>, DbError> {
        let goals = sqlx::query_as::<_, GoalEntity>(
            r#"
            SELECT id, name, "targetAmount", "targetDate", "portfolioId", "createdAt", "updatedAt"
            FROM "Goal"
            WHERE "portfolioId" = $1
            ORDER BY "targetDate" ASC, "createdAt" ASC
            "#,
        )
        .bind(portfolio_id)
        .fetch_all(&self.pool)
        .await?;

        Ok(goals)
    }

    async fn update_goal(
        &self,
        goal_id: &str,
        name: &str,
        target_amount: Decimal,
        target_date: DateTime<Utc>,
    ) -> Result<GoalEntity, DbError> {
        let now = Utc::now();
        let goal = sqlx::query_as::<_, GoalEntity>(
            r#"
            UPDATE "Goal"
            SET name = $2, "targetAmount" = $3, "targetDate" = $4, "updatedAt" = $5
            WHERE id = $1
            RETURNING id, name, "targetAmount", "targetDate", "portfolioId", "createdAt", "updatedAt"
            "#,
        )
        .bind(goal_id)
        .bind(name)
        .bind(target_amount)
        .bind(target_date)
        .bind(now)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| DbError::NotFound(format!("Goal {goal_id} not found")))?;

        Ok(goal)
    }

    async fn delete_goal(&self, goal_id: &str) -> Result<bool, DbError> {
        let result = sqlx::query(r#"DELETE FROM "Goal" WHERE id = $1"#)
            .bind(goal_id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }
}
