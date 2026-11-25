use async_trait::async_trait;
use chrono::NaiveDate;
use rust_decimal::Decimal;
use sqlx::PgPool;

use crate::entities::HistoricalValuationEntity;
use crate::error::DbError;

/// Peak valuation point for a portfolio or aggregated set of portfolios.
#[derive(Debug, Clone, PartialEq)]
pub struct PeakValuation {
    /// Peak valuation amount in INR.
    pub value: Decimal,
    /// Date on which the peak valuation occurred.
    pub date: NaiveDate,
}

/// Repository trait for querying and aggregating `PortfolioHistory` valuations.
#[async_trait]
pub trait PortfolioHistoryRepository: Send + Sync {
    /// Fetches the aggregated valuation timeline across `portfolio_ids` using a single
    /// Last Observation Carried Forward (LOCF) query.
    async fn get_aggregated_history(
        &self,
        portfolio_ids: &[String],
        from_date: Option<NaiveDate>,
        to_date: Option<NaiveDate>,
    ) -> Result<Vec<HistoricalValuationEntity>, DbError>;

    /// Returns the peak valuation and its exact date across `portfolio_ids`.
    async fn get_peak_valuation(
        &self,
        portfolio_ids: &[String],
    ) -> Result<Option<PeakValuation>, DbError>;
}

/// PostgreSQL implementation of [`PortfolioHistoryRepository`].
#[derive(Clone, Debug)]
pub struct PgPortfolioHistoryRepository {
    pool: PgPool,
}

impl PgPortfolioHistoryRepository {
    /// Creates a new [`PgPortfolioHistoryRepository`] backed by the given connection pool.
    #[must_use]
    pub const fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl PortfolioHistoryRepository for PgPortfolioHistoryRepository {
    async fn get_aggregated_history(
        &self,
        portfolio_ids: &[String],
        from_date: Option<NaiveDate>,
        to_date: Option<NaiveDate>,
    ) -> Result<Vec<HistoricalValuationEntity>, DbError> {
        if portfolio_ids.is_empty() {
            return Ok(Vec::new());
        }

        // Single LOCF query: for each distinct date across the requested portfolios,
        // carry forward the latest observation per portfolio <= that date and sum them.
        let rows = sqlx::query_as::<_, HistoricalValuationEntity>(
            r#"
            WITH distinct_dates AS (
                SELECT DISTINCT date
                FROM "PortfolioHistory"
                WHERE "portfolioId" = ANY($1)
                  AND ($2::date IS NULL OR date::date >= $2)
                  AND ($3::date IS NULL OR date::date <= $3)
            ),
            target_portfolios AS (
                SELECT unnest($1::text[]) AS "portfolioId"
            )
            SELECT
                (array_agg(locf.id ORDER BY locf."portfolioId"))[1] AS id,
                $4::text AS "portfolioId",
                d.date::date AS date,
                COALESCE(SUM(locf.value), 0) AS value,
                COALESCE(SUM(locf."investedAmount"), 0) AS cost,
                MAX(locf."createdAt") AS "createdAt"
            FROM distinct_dates d
            CROSS JOIN target_portfolios p
            LEFT JOIN LATERAL (
                SELECT id, "portfolioId", value, "investedAmount", "createdAt"
                FROM "PortfolioHistory" ph
                WHERE ph."portfolioId" = p."portfolioId"
                  AND ph.date <= d.date
                ORDER BY ph.date DESC
                LIMIT 1
            ) locf ON TRUE
            GROUP BY d.date
            ORDER BY d.date ASC
            "#,
        )
        .bind(portfolio_ids)
        .bind(from_date)
        .bind(to_date)
        .bind(portfolio_ids.first().map_or("", String::as_str))
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn get_peak_valuation(
        &self,
        portfolio_ids: &[String],
    ) -> Result<Option<PeakValuation>, DbError> {
        let history = self
            .get_aggregated_history(portfolio_ids, None, None)
            .await?;
        let peak = history
            .into_iter()
            .max_by(|a, b| a.value.cmp(&b.value).then_with(|| a.date.cmp(&b.date)))
            .map(|h| PeakValuation {
                value: h.value,
                date: h.date,
            });
        Ok(peak)
    }
}
