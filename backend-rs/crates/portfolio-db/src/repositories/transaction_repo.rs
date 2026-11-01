//! Transaction repository trait and SQLx PostgreSQL implementation.
//!
//! Provides data access and persistence for financial ledger transactions under folios and portfolios.

use async_trait::async_trait;
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::entities::TransactionEntity;
use crate::error::DbError;

/// Repository interface for ledger transaction ingestion, querying, and chronological ordering.
#[async_trait]
pub trait TransactionRepository: Send + Sync {
    /// Inserts a new financial transaction into a specific folio.
    ///
    /// Preserves exact numerical precision by storing `amount`, `units`, `nav`, and `balance`
    /// as high-precision decimals.
    ///
    /// # Arguments
    /// * `folio_id` - UUID of the target folio account.
    /// * `date` - Transaction execution or allotment date.
    /// * `tx_type` - Transaction action classification (e.g. "PURCHASE", "REDEMPTION", "DIVIDEND_PAYOUT").
    /// * `amount` - Total currency value in INR.
    /// * `units` - Number of units transacted.
    /// * `nav` - Net Asset Value (price per unit) applied to the trade.
    /// * `balance` - Cumulative unit balance resulting after the transaction.
    /// * `external_id` - Optional external statement deduplication identifier.
    ///
    /// # Errors
    /// Returns [`DbError`] if foreign keys are invalid or database write fails.
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

    /// Lists all transactions for a specific folio ordered strictly chronologically.
    ///
    /// The sorting order (`date ASC, createdAt ASC, id ASC`) guarantees deterministic
    /// FIFO lot processing required for statutory tax calculations.
    ///
    /// # Errors
    /// Returns [`DbError`] if query execution fails.
    async fn list_by_folio(&self, folio_id: Uuid) -> Result<Vec<TransactionEntity>, DbError>;

    /// Lists all transactions across all folios in an entire portfolio ordered chronologically.
    ///
    /// # Errors
    /// Returns [`DbError`] if query execution fails.
    async fn list_by_portfolio(
        &self,
        portfolio_id: Uuid,
    ) -> Result<Vec<TransactionEntity>, DbError>;
}

/// Production PostgreSQL implementation of [`TransactionRepository`] using SQLx.
#[derive(Clone, Debug)]
pub struct SqlxTransactionRepo {
    pool: sqlx::PgPool,
}

impl SqlxTransactionRepo {
    /// Creates a new repository instance backed by the given PostgreSQL connection pool.
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
        let transaction_id = Uuid::new_v4();
        let now = Utc::now();
        let date_timestamp = date
            .and_hms_opt(0, 0, 0)
            .ok_or_else(|| DbError::Internal("Invalid date conversion".to_string()))?;

        // Inserts new ledger transaction and casts columns to domain-compatible types
        // (timestamp to date, float8 to numeric) for exact decimal fidelity.
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
        .bind(transaction_id.to_string())
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
        // Enforces strict FIFO chronological ordering: primary sort by trade execution date,
        // secondary sort by insertion timestamp, and tertiary tie-breaker by transaction UUID.
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
        // Joins Transaction to Folio on folioId to aggregate all trades belonging to a portfolio,
        // maintaining identical chronological FIFO ordering across folios.
        let records = sqlx::query_as::<_, TransactionEntity>(
            r#"
            SELECT transaction.id::uuid, transaction."folioId"::uuid, transaction.date::date as date, transaction.type,
                   transaction.amount::numeric as amount, transaction.units::numeric as units,
                   transaction.nav::numeric as nav, transaction.balance::numeric as balance,
                   transaction."externalId",
                   transaction."createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   transaction."updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Transaction" transaction
            JOIN "Folio" folio ON transaction."folioId" = folio.id
            WHERE folio."portfolioId" = $1
            ORDER BY transaction.date ASC, transaction."createdAt" ASC, transaction.id ASC
            "#,
        )
        .bind(portfolio_id.to_string())
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }
}
