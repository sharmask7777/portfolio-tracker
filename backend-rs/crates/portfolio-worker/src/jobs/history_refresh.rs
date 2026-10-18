//! Background worker job for recalculating portfolio historical valuation timeline.

use std::collections::HashMap;

use chrono::Utc;
use portfolio_core::holdings::lot::TaxLot;
use portfolio_core::types::{Money, Nav, Units};
use portfolio_db::InMemoryDatabase;
use portfolio_db::entities::HistoricalValuationEntity;
use portfolio_db::repositories::{PortfolioRepository, TransactionRepository};
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::error::WorkerError;
use crate::jobs::HistoryRefreshJobData;

/// Tracking state for an individual folio during history valuation timeline reconstruction.
#[derive(Debug, Clone, Default)]
pub struct FolioTrackingState {
    pub active_units: Units,
    pub latest_nav: Nav,
    pub fifo_lots: Vec<TaxLot>,
    pub invested_cost: Money,
}

impl FolioTrackingState {
    /// Computes current market value for this folio.
    ///
    /// If active units are zero, value is zero.
    /// If latest NAV is known and positive, value = active_units * latest_nav.
    /// Otherwise, falls back to invested cost basis.
    pub fn current_value(&self) -> Money {
        if self.active_units.is_zero() {
            Money::ZERO
        } else if self.latest_nav.is_positive() {
            self.active_units * self.latest_nav
        } else {
            self.invested_cost
        }
    }
}

/// Core handler for recalculating historical valuation timeline for a portfolio.
///
/// Lifecycle:
/// 1. Verifies portfolio exists in the database.
/// 2. Fetches all transactions for the portfolio in chronological order.
/// 3. Tracks lots, active units, latest NAV, and FIFO cost per folio/asset independently.
/// 4. Computes total portfolio value and invested cost on each timeline checkpoint:
///    - Portfolio value = \sum_{folios} (folio.active_units * folio.latest_nav)
///    - Portfolio cost = \sum_{folios} folio.invested_cost
/// 5. Persists the historical valuation timeline in the database.
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

    let mut folio_states: HashMap<Uuid, FolioTrackingState> = HashMap::new();
    let mut records = Vec::new();

    let total_txs = transactions.len();
    for (i, tx) in transactions.iter().enumerate() {
        let folio_state = folio_states.entry(tx.folio_id).or_default();

        let normalized = tx.tx_type.trim().to_uppercase();
        let is_inflow = normalized.contains("BUY")
            || normalized.contains("PURCHASE")
            || normalized.contains("SIP")
            || normalized.contains("SWITCH_IN")
            || normalized.contains("REINVEST");
        let is_outflow = normalized.contains("SELL")
            || normalized.contains("REDEMPTION")
            || normalized.contains("SWITCH_OUT");

        let tx_units = Units::new(tx.units.abs());
        let tx_amount = Money::new(tx.amount.abs());
        let tx_nav = if tx.nav > Decimal::ZERO {
            Nav::new(tx.nav.abs())
        } else if !tx_units.is_zero() && !tx_amount.is_zero() {
            tx_amount / tx_units
        } else {
            Nav::ZERO
        };

        if tx_nav.is_positive() {
            folio_state.latest_nav = tx_nav;
        }

        if is_inflow {
            if tx_units.is_positive() {
                let lot = TaxLot::new(tx.date, tx_units, tx_nav, tx_amount);
                folio_state.fifo_lots.push(lot);
                folio_state.active_units += tx_units;
                folio_state.invested_cost += tx_amount;
            }
        } else if is_outflow {
            let mut units_to_sell = tx_units;
            for lot in &mut folio_state.fifo_lots {
                if units_to_sell.is_zero() {
                    break;
                }
                if lot.is_depleted() {
                    continue;
                }
                let (consumed, cost_basis) = lot.deplete(units_to_sell);
                units_to_sell -= consumed;

                if folio_state.invested_cost > cost_basis {
                    folio_state.invested_cost -= cost_basis;
                } else {
                    folio_state.invested_cost = Money::ZERO;
                }

                if folio_state.active_units > consumed {
                    folio_state.active_units -= consumed;
                } else {
                    folio_state.active_units = Units::ZERO;
                }
            }
            folio_state.fifo_lots.retain(|lot| !lot.is_depleted());
            if folio_state.active_units.is_zero() {
                folio_state.invested_cost = Money::ZERO;
                folio_state.fifo_lots.clear();
            }
        }

        // Only emit a valuation checkpoint at the end of each date boundary
        let is_last_tx_of_date = i + 1 == total_txs || transactions[i + 1].date != tx.date;
        if is_last_tx_of_date {
            let total_value: Decimal = folio_states
                .values()
                .map(|f| f.current_value().to_decimal())
                .sum();
            let total_cost: Decimal = folio_states
                .values()
                .map(|f| f.invested_cost.to_decimal())
                .sum();

            let record = db.store_historical_valuation(
                job_data.portfolio_id,
                tx.date,
                total_value,
                total_cost,
            );
            records.push(record);
        }
    }

    // Ensure a valuation checkpoint for today exists if transactions are prior to today
    let today = Utc::now().date_naive();
    if let Some(last_tx) = transactions.last()
        && last_tx.date < today
    {
        let today_value: Decimal = folio_states
            .values()
            .map(|f| f.current_value().to_decimal())
            .sum();
        let today_cost: Decimal = folio_states
            .values()
            .map(|f| f.invested_cost.to_decimal())
            .sum();
        let record =
            db.store_historical_valuation(job_data.portfolio_id, today, today_value, today_cost);
        records.push(record);
    }

    Ok(records)
}
