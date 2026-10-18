//! Background worker job for recalculating portfolio historical valuation timeline.

use chrono::Utc;
use portfolio_db::InMemoryDatabase;
use portfolio_db::entities::HistoricalValuationEntity;
use portfolio_db::repositories::{PortfolioRepository, TransactionRepository};
use rust_decimal::Decimal;

use crate::error::WorkerError;
use crate::jobs::HistoryRefreshJobData;

/// Core handler for recalculating historical valuation timeline for a portfolio.
///
/// Lifecycle:
/// 1. Verifies portfolio exists in the database.
/// 2. Fetches all transactions for the portfolio in chronological order.
/// 3. Computes cumulative units, invested cost, and portfolio value on each timeline checkpoint.
/// 4. Persists the historical valuation timeline in the database.
pub async fn process_history_refresh_job(
    job_data: &HistoryRefreshJobData,
    db: &InMemoryDatabase,
) -> Result<Vec<HistoricalValuationEntity>, WorkerError> {
    // 1. Verify portfolio exists
    let _portfolio = db
        .get_portfolio(job_data.portfolio_id)
        .await?
        .ok_or(WorkerError::PortfolioNotFound(job_data.portfolio_id))?;

    // 2. Fetch all transactions for this portfolio (already sorted chronologically by DB)
    let transactions = db.list_by_portfolio(job_data.portfolio_id).await?;

    if transactions.is_empty() {
        let today = Utc::now().date_naive();
        let record = db.store_historical_valuation(
            job_data.portfolio_id,
            today,
            Decimal::ZERO,
            Decimal::ZERO,
        );
        return Ok(vec![record]);
    }

    let mut cumulative_units = Decimal::ZERO;
    let mut cumulative_cost = Decimal::ZERO;
    let mut last_nav = Decimal::ZERO;
    let mut records = Vec::new();

    for tx in &transactions {
        let normalized = tx.tx_type.trim().to_uppercase();
        let is_inflow = normalized.contains("BUY")
            || normalized.contains("PURCHASE")
            || normalized.contains("SIP")
            || normalized.contains("SWITCH_IN");
        let is_outflow = normalized.contains("SELL")
            || normalized.contains("REDEMPTION")
            || normalized.contains("SWITCH_OUT");

        if is_inflow {
            cumulative_units += tx.units;
            cumulative_cost += tx.amount;
        } else if is_outflow {
            cumulative_units = (cumulative_units - tx.units).max(Decimal::ZERO);
            if cumulative_units.is_zero() {
                cumulative_cost = Decimal::ZERO;
            } else {
                cumulative_cost = (cumulative_cost - tx.amount).max(Decimal::ZERO);
            }
        }

        if tx.nav > Decimal::ZERO {
            last_nav = tx.nav;
        }

        let market_value = if last_nav > Decimal::ZERO {
            cumulative_units * last_nav
        } else {
            cumulative_cost
        };

        let record = db.store_historical_valuation(
            job_data.portfolio_id,
            tx.date,
            market_value,
            cumulative_cost,
        );
        records.push(record);
    }

    // Ensure a valuation checkpoint for today exists if transactions are prior to today
    let today = Utc::now().date_naive();
    if let Some(last_tx) = transactions.last()
        && last_tx.date < today
    {
        let today_value = if last_nav > Decimal::ZERO {
            cumulative_units * last_nav
        } else {
            cumulative_cost
        };
        let record = db.store_historical_valuation(
            job_data.portfolio_id,
            today,
            today_value,
            cumulative_cost,
        );
        records.push(record);
    }

    Ok(records)
}
