//! Transaction repository trait and SQLx implementation.

use async_trait::async_trait;
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::entities::TransactionEntity;
use crate::error::DbError;

#[async_trait]
pub trait TransactionRepository: Send + Sync {
    /// Inserts a new financial transaction into a folio.
    #[allow(clippy::too_many_arguments)]
    async fn create_transaction(
        &self,
        folio_id: Uuid,
        date: NaiveDate,
        tx_type: &str,
        amount: Decimal,
        units: Decimal,
        nav: Decimal,
        balance: Decimal,
        external_id: Option<&str>,
    ) -> Result<TransactionEntity, DbError>;

    /// Lists all transactions for a specific folio ordered chronologically.
    async fn list_by_folio(&self, folio_id: Uuid) -> Result<Vec<TransactionEntity>, DbError>;

    /// Lists all transactions for all folios in a portfolio ordered chronologically.
    async fn list_by_portfolio(
        &self,
        portfolio_id: Uuid,
    ) -> Result<Vec<TransactionEntity>, DbError>;
}

/// Production PostgreSQL repository for Transactions using SQLx.
#[derive(Clone, Debug)]
pub struct SqlxTransactionRepo {
    pool: sqlx::PgPool,
}

impl SqlxTransactionRepo {
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl TransactionRepository for SqlxTransactionRepo {
    async fn create_transaction(
        &self,
        folio_id: Uuid,
        date: NaiveDate,
        tx_type: &str,
        amount: Decimal,
        units: Decimal,
        nav: Decimal,
        balance: Decimal,
        external_id: Option<&str>,
    ) -> Result<TransactionEntity, DbError> {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let date_timestamp = date
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| DbError::Internal("Invalid date conversion".to_string()))?;

        let record = sqlx::query_as::<_, TransactionEntity>(
            r#"
            INSERT INTO "Transaction" (
                id, "folioId", date, type, amount, units, nav, balance, "externalId", "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5::text::float8, $6::text::float8, $7::text::float8, $8::text::float8, $9, $10, $10)
            RETURNING id::uuid, "folioId"::uuid, date::date as date, type,
                      amount::numeric as amount, units::numeric as units,
                      nav::numeric as nav, balance::numeric as balance,
                      "externalId",
                      "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                      "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            "#,
        )
        .bind(id.to_string())
        .bind(folio_id.to_string())
        .bind(date_timestamp)
        .bind(tx_type)
        .bind(amount.to_string())
        .bind(units.to_string())
        .bind(nav.to_string())
        .bind(balance.to_string())
        .bind(external_id)
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    async fn list_by_folio(&self, folio_id: Uuid) -> Result<Vec<TransactionEntity>, DbError> {
        let records = sqlx::query_as::<_, TransactionEntity>(
            r#"
            SELECT id::uuid, "folioId"::uuid, date::date as date, type,
                   amount::numeric as amount, units::numeric as units,
                   nav::numeric as nav, balance::numeric as balance,
                   "externalId",
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Transaction"
            WHERE "folioId" = $1
            ORDER BY date ASC, "createdAt" ASC, id ASC
            "#,
        )
        .bind(folio_id.to_string())
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    async fn list_by_portfolio(
        &self,
        portfolio_id: Uuid,
    ) -> Result<Vec<TransactionEntity>, DbError> {
        let records = sqlx::query_as::<_, TransactionEntity>(
            r#"
            SELECT t.id::uuid, t."folioId"::uuid, t.date::date as date, t.type,
                   t.amount::numeric as amount, t.units::numeric as units,
                   t.nav::numeric as nav, t.balance::numeric as balance,
                   t."externalId",
                   t."createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   t."updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Transaction" t
            JOIN "Folio" f ON t."folioId" = f.id
            WHERE f."portfolioId" = $1
            ORDER BY t.date ASC, t."createdAt" ASC, t.id ASC
            "#,
        )
        .bind(portfolio_id.to_string())
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }
}
