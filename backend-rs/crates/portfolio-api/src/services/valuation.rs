//! Modular portfolio valuation service ensuring mathematical and structural parity
//! across live summary metrics, historical valuation timelines, and peak milestones.

use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use ts_rs::TS;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::state::AppState;

/// Authoritative snapshot of portfolio valuation as of the current market date.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct PortfolioValuationSnapshot {
    /// Date of the live valuation snapshot (always today's date).
    pub as_of_date: NaiveDate,
    /// Consolidated unliquidated invested cost basis across active positions.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub total_invested: Decimal,
    /// Consolidated current mark-to-market valuation across active positions.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub total_value: Decimal,
}

/// Historical valuation timeline checkpoint returned by `/api/portfolio/:id/history`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct HistoryPoint {
    /// Valuation snapshot date ("YYYY-MM-DD").
    pub date: NaiveDate,
    /// Total portfolio market valuation.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub value: Decimal,
    /// Total invested capital.
    #[sqlx(rename = "investedAmount")]
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub invested_amount: Decimal,
}

/// Centralized valuation service for calculating mark-to-market portfolio totals.
pub struct ValuationService;

impl ValuationService {
    /// Computes consolidated live valuation across the supplied portfolio IDs.
    ///
    /// Evaluates all active folios ($units \ge 0.001$), resolves latest closing NAVs
    /// from AMFI / `HistoricalNAV` (with transaction fallback), and computes total
    /// invested capital and current market value using canonical domain rules.
    pub async fn compute_live_valuation(
        state: &AppState,
        portfolio_ids: &[Uuid],
    ) -> Result<PortfolioValuationSnapshot, ApiError> {
        let today = Utc::now().date_naive();
        let mut total_invested = Decimal::ZERO;
        let mut total_value = Decimal::ZERO;

        let active_threshold = Decimal::from_str("0.001").unwrap_or(Decimal::ZERO);

        for &p_id in portfolio_ids {
            let folios = crate::routes::portfolio::fetch_folios_for_portfolio(state, p_id).await?;
            for folio in folios {
                let asset =
                    crate::routes::portfolio::fetch_asset_for_folio(state, folio.asset_id).await?;
                let tx_entities =
                    crate::routes::portfolio::fetch_transactions_for_folio(state, folio.id).await?;
                if tx_entities.is_empty() {
                    continue;
                }

                let mut core_txs = Vec::with_capacity(tx_entities.len());
                for tx in &tx_entities {
                    core_txs.push(tx.to_core_transaction()?);
                }

                let units = portfolio_core::holdings::get_latest_units(&core_txs);
                let units_decimal = units.to_decimal();
                if units_decimal < active_threshold {
                    continue;
                }

                let fallback = core_txs
                    .iter()
                    .rev()
                    .find(|t| t.nav.is_positive())
                    .map(|t| (t.date, t.nav));
                let latest_nav =
                    crate::routes::portfolio::fetch_latest_nav(state, asset.as_ref(), fallback)
                        .await;

                let perf_opts = portfolio_core::performance::metrics::PerformanceOptions::new()
                    .with_as_of_date(today);
                let metrics = portfolio_core::performance::metrics::get_metrics(
                    &core_txs,
                    latest_nav,
                    Some(perf_opts),
                );

                total_invested += metrics.invested_amount.to_decimal();
                total_value += metrics.current_value.to_decimal();
            }
        }

        Ok(PortfolioValuationSnapshot {
            as_of_date: today,
            total_invested,
            total_value,
        })
    }
}
