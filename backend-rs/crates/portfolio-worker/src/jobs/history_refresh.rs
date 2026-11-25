//! Background worker job for recalculating portfolio historical valuation timeline.

use std::collections::{BTreeMap, HashMap};

use chrono::{Days, NaiveDate, Utc};
use portfolio_core::holdings::lot::TaxLot;
use portfolio_core::types::{Money, Nav, Units};
use portfolio_db::InMemoryDatabase;
use portfolio_db::entities::HistoricalValuationEntity;
use portfolio_db::repositories::{PortfolioRepository, TransactionRepository};
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::error::WorkerError;
use crate::jobs::HistoryRefreshJobData;
use crate::jobs::timeline_policy::is_checkpoint_date;

/// Tracking state for an individual folio during history valuation timeline reconstruction.
#[derive(Debug, Clone, Default)]
pub struct FolioTrackingState {
    pub active_units: Units,
    pub latest_nav: Nav,
    pub latest_nav_date: Option<NaiveDate>,
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
/// 3. Preloads historical daily scheme NAV time series.
/// 4. Generates granular checkpoints:
///    - For dates older than 3 months: every Friday, all transaction dates, first and last day of every month.
///    - For dates within the last 3 months: every single day.
///    - Marks active units to published market NAV on each checkpoint date.
/// 5. Persists the historical valuation timeline in the database.
pub async fn process_history_refresh_job(
    job_data: &HistoryRefreshJobData,
    db: &InMemoryDatabase,
) -> Result<Vec<HistoricalValuationEntity>, WorkerError> {
    process_history_refresh_job_with_pool(job_data, db, None).await
}

/// Helper handler for recalculating historical valuation timeline with optional PostgreSQL pool.
///
/// When `pool` is provided, fetches transactions and historical NAVs directly from PostgreSQL
/// and upserts the resulting valuation records into PostgreSQL `PortfolioHistory` table.
pub async fn process_history_refresh_job_with_pool(
    job_data: &HistoryRefreshJobData,
    db: &InMemoryDatabase,
    pool: Option<&sqlx::PgPool>,
) -> Result<Vec<HistoricalValuationEntity>, WorkerError> {
    // 1. Verify portfolio exists
    if let Some(pool) = pool {
        if !portfolio_db::repositories::check_portfolio_exists(pool, job_data.portfolio_id)
            .await
            .map_err(WorkerError::Db)?
        {
            return Err(WorkerError::PortfolioNotFound(job_data.portfolio_id));
        }
    } else {
        let _portfolio = db
            .get_portfolio(job_data.portfolio_id)
            .await?
            .ok_or(WorkerError::PortfolioNotFound(job_data.portfolio_id))?;
    }

    // 2. Fetch all transactions for this portfolio (already sorted chronologically)
    let transactions: Vec<portfolio_db::entities::TransactionEntity> = if let Some(pool) = pool {
        portfolio_db::repositories::fetch_portfolio_transactions(pool, job_data.portfolio_id)
            .await
            .map_err(WorkerError::Db)?
    } else {
        db.list_by_portfolio(job_data.portfolio_id).await?
    };

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

    // 3. Preload historical NAVs and folio -> amfiCode mappings
    let folio_amfi_map: HashMap<Uuid, String> = if let Some(pool) = pool {
        portfolio_db::repositories::fetch_folio_amfi_codes_for_portfolio(
            pool,
            job_data.portfolio_id,
        )
        .await
        .map_err(WorkerError::Db)?
    } else {
        let mut map = HashMap::new();
        let folios = db.list_folios_by_portfolio(job_data.portfolio_id);
        for folio in folios {
            if let Some(asset) = db.get_asset(folio.asset_id)
                && let Some(amfi) = asset.amfi_code
            {
                map.insert(folio.id, amfi);
            }
        }
        map
    };

    let scheme_nav_history: HashMap<String, BTreeMap<NaiveDate, Decimal>> = if let Some(pool) = pool
    {
        portfolio_db::repositories::fetch_historical_navs_for_portfolio(pool, job_data.portfolio_id)
            .await
            .map_err(WorkerError::Db)?
    } else {
        let mut map: HashMap<String, BTreeMap<NaiveDate, Decimal>> = HashMap::new();
        for amfi_code in folio_amfi_map.values() {
            let navs = db.list_navs(amfi_code);
            for n in navs {
                if n.nav > Decimal::ZERO {
                    map.entry(amfi_code.clone())
                        .or_default()
                        .insert(n.date, n.nav);
                }
            }
        }
        map
    };

    // Group transactions by date for chronological replay
    let mut txs_by_date: BTreeMap<NaiveDate, Vec<&portfolio_db::entities::TransactionEntity>> =
        BTreeMap::new();
    for tx in &transactions {
        txs_by_date.entry(tx.date).or_default().push(tx);
    }

    let start_date = transactions[0].date;
    let today = Utc::now().date_naive();
    let end_date = std::cmp::max(transactions.last().map_or(today, |t| t.date), today);

    let mut folio_states: HashMap<Uuid, FolioTrackingState> = HashMap::new();
    let mut records = Vec::new();

    let mut current_date = start_date;
    while current_date <= end_date {
        let txs_today = txs_by_date.get(&current_date);
        let has_transaction = txs_today.is_some();

        // 4a. Apply transactions on this date to update units, lots, and invested cost
        if let Some(txs) = txs_today {
            for tx in txs {
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
                    folio_state.latest_nav_date = Some(tx.date);
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
            }
        }

        // 4b. Check if current_date is a designated checkpoint date
        let should_record =
            is_checkpoint_date(current_date, today, has_transaction) || current_date == end_date;

        if should_record {
            // Update latest_nav for active folios from preloaded HistoricalNAV up to current_date
            for (folio_id, state) in &mut folio_states {
                if state.active_units.is_positive()
                    && let Some(amfi_code) = folio_amfi_map.get(folio_id)
                    && let Some(nav_map) = scheme_nav_history.get(amfi_code)
                    && let Some((&nav_date, &market_nav)) =
                        nav_map.range(..=current_date).next_back()
                    && market_nav > Decimal::ZERO
                    && state.latest_nav_date.is_none_or(|d| nav_date >= d)
                {
                    state.latest_nav = Nav::new(market_nav);
                    state.latest_nav_date = Some(nav_date);
                }
            }

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
                current_date,
                total_value,
                total_cost,
            );
            records.push(record);
        }

        match current_date.checked_add_days(Days::new(1)) {
            Some(next_date) => current_date = next_date,
            None => break,
        }
    }

    // 5. Persist the generated timeline records in PostgreSQL if pool is active
    if let Some(pool) = pool {
        for record in &records {
            portfolio_db::repositories::upsert_portfolio_history(
                pool,
                record.id,
                record.portfolio_id,
                record.date,
                record.value,
                record.cost,
            )
            .await
            .map_err(WorkerError::Db)?;
        }
    }

    Ok(records)
}
