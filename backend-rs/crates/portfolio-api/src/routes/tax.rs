//! Tax simulation and tax harvesting routes.

use std::str::FromStr;

use axum::extract::{Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use portfolio_core::error::PortfolioError;
use portfolio_core::tax::harvesting::{
    FolioHarvestingInput, HarvestingSummary, get_harvesting_opportunities,
};
use portfolio_core::tax::rules::simulate_sell_transactions;
use portfolio_core::tax::{RealizedGain, SellSimulation, TaxType};
use portfolio_core::types::{AssetType, Money, Nav, Units};
use portfolio_db::error::DbError;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::routes::portfolio::{
    fetch_asset_for_folio, fetch_folio, fetch_folios_for_portfolio, fetch_latest_nav,
    fetch_portfolio, fetch_transactions_for_folio, fetch_user_portfolios,
    resolve_target_portfolios,
};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulateSellRequest {
    pub folio_id: Option<Uuid>,
    pub asset_name: Option<String>,
    pub asset_type: Option<String>,
    pub units: Decimal,
    pub current_price: Option<Decimal>,
    pub tax_slab: Option<Decimal>,
    pub sell_date: Option<NaiveDate>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxBreakdownItem {
    #[serde(with = "rust_decimal::serde::float")]
    pub amount: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub tax: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub cess: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxBreakdown {
    pub stcg: TaxBreakdownItem,
    pub ltcg: TaxBreakdownItem,
    pub slab: TaxBreakdownItem,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_tax: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationResponse {
    pub asset_name: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub units_to_sell: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub estimated_value: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_gain: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub taxable_gain: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub estimated_tax: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub exit_load: Decimal,
    pub tax_breakdown: TaxBreakdown,
    pub matched_lots: Vec<RealizedGain>,
}

fn to_simulation_response(sim: SellSimulation) -> SimulationResponse {
    let mut stcg_amt = Decimal::ZERO;
    let mut stcg_tax = Decimal::ZERO;
    let mut stcg_cess = Decimal::ZERO;
    let mut ltcg_amt = Decimal::ZERO;
    let mut ltcg_tax = Decimal::ZERO;
    let mut ltcg_cess = Decimal::ZERO;
    let mut slab_amt = Decimal::ZERO;
    let mut slab_tax = Decimal::ZERO;
    let mut slab_cess = Decimal::ZERO;
    let mut total_tax = Decimal::ZERO;

    for lot in &sim.matched_lots {
        match lot.tax_type {
            TaxType::Stcg => {
                stcg_amt += lot.gain.to_decimal();
                stcg_tax += lot.estimated_tax.to_decimal();
                stcg_cess += lot.cess.to_decimal();
            }
            TaxType::Ltcg => {
                ltcg_amt += lot.gain.to_decimal();
                ltcg_tax += lot.estimated_tax.to_decimal();
                ltcg_cess += lot.cess.to_decimal();
            }
            TaxType::Slab => {
                slab_amt += lot.gain.to_decimal();
                slab_tax += lot.estimated_tax.to_decimal();
                slab_cess += lot.cess.to_decimal();
            }
        }
        total_tax += lot.estimated_tax.to_decimal();
    }

    SimulationResponse {
        asset_name: sim.asset_name,
        units_to_sell: sim.units_to_sell.to_decimal(),
        estimated_value: sim.estimated_value.to_decimal(),
        total_gain: sim.total_gain.to_decimal(),
        taxable_gain: sim.taxable_gain.to_decimal(),
        estimated_tax: sim.estimated_tax.to_decimal(),
        exit_load: sim.exit_load.to_decimal(),
        tax_breakdown: TaxBreakdown {
            stcg: TaxBreakdownItem {
                amount: stcg_amt,
                tax: stcg_tax,
                cess: stcg_cess,
            },
            ltcg: TaxBreakdownItem {
                amount: ltcg_amt,
                tax: ltcg_tax,
                cess: ltcg_cess,
            },
            slab: TaxBreakdownItem {
                amount: slab_amt,
                tax: slab_tax,
                cess: slab_cess,
            },
            total_tax,
        },
        matched_lots: sim.matched_lots,
    }
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HarvestingQuery {
    pub scope_id: Option<String>,
    pub as_of: Option<NaiveDate>,
    pub realized_ltcg: Option<Decimal>,
}

pub async fn simulate_sell(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<SimulateSellRequest>,
) -> Result<Json<SimulationResponse>, ApiError> {
    if payload.units <= Decimal::ZERO {
        return Err(ApiError::BadRequest(
            "Valid positive units are required for simulation".to_string(),
        ));
    }

    let sell_date = payload.sell_date.unwrap_or_else(|| Utc::now().date_naive());
    let tax_slab = payload
        .tax_slab
        .unwrap_or_else(|| Decimal::from_str("0.30").unwrap());

    if let Some(folio_id) = payload.folio_id {
        let folio = fetch_folio(&state, folio_id)
            .await?
            .ok_or(DbError::FolioNotFound(folio_id))?;
        let portfolio = fetch_portfolio(&state, folio.portfolio_id)
            .await?
            .ok_or(DbError::PortfolioNotFound(folio.portfolio_id))?;

        if portfolio.user_id != auth_user.user_id {
            return Err(ApiError::Forbidden);
        }

        let asset = fetch_asset_for_folio(&state, folio.asset_id)
            .await?
            .ok_or(DbError::AssetNotFound(folio.asset_id))?;

        let tx_entities = fetch_transactions_for_folio(&state, folio.id).await?;
        let mut core_txs = Vec::with_capacity(tx_entities.len());
        for t in &tx_entities {
            core_txs.push(t.to_core_transaction()?);
        }

        let fallback_nav = core_txs
            .iter()
            .rev()
            .find(|t| t.nav.is_positive())
            .map(|t| t.nav)
            .unwrap_or(Nav::ZERO);

        let current_price = match payload.current_price {
            Some(p) => Nav::new(p),
            None => fetch_latest_nav(&state, Some(&asset), fallback_nav).await,
        };

        let asset_type = asset
            .asset_type
            .parse::<AssetType>()
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;

        match simulate_sell_transactions(
            &asset.name,
            asset_type,
            &core_txs,
            Units::new(payload.units),
            sell_date,
            current_price,
            tax_slab,
            None,
        ) {
            Ok(simulation) => Ok(Json(to_simulation_response(simulation))),
            Err(PortfolioError::UnitsLocked { available, locked }) => {
                Err(ApiError::UnitsLocked { available, locked })
            }
            Err(e) => Err(ApiError::from(e)),
        }
    } else {
        let asset_name = payload.asset_name.ok_or_else(|| {
            ApiError::BadRequest("Folio ID or asset name is required".to_string())
        })?;
        let asset_type_str = payload
            .asset_type
            .unwrap_or_else(|| "MUTUAL_FUND".to_string());
        let asset_type = asset_type_str
            .parse::<AssetType>()
            .map_err(|e| ApiError::BadRequest(e.to_string()))?;
        let current_price = Nav::new(payload.current_price.unwrap_or(Decimal::ZERO));

        match simulate_sell_transactions(
            &asset_name,
            asset_type,
            &[],
            Units::new(payload.units),
            sell_date,
            current_price,
            tax_slab,
            None,
        ) {
            Ok(simulation) => Ok(Json(to_simulation_response(simulation))),
            Err(PortfolioError::UnitsLocked { available, locked }) => {
                Err(ApiError::UnitsLocked { available, locked })
            }
            Err(e) => Err(ApiError::from(e)),
        }
    }
}

pub async fn get_harvesting(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<HarvestingQuery>,
) -> Result<Json<HarvestingSummary>, ApiError> {
    let as_of = query.as_of.unwrap_or_else(|| Utc::now().date_naive());
    let realized_ltcg = Money::new(query.realized_ltcg.unwrap_or(Decimal::ZERO));

    let portfolios = if let Some(ref scope_id) = query.scope_id {
        resolve_target_portfolios(&state, auth_user.user_id, scope_id).await?
    } else {
        fetch_user_portfolios(&state, auth_user.user_id).await?
    };

    let mut folio_data = Vec::new();

    for portfolio in &portfolios {
        let folios = fetch_folios_for_portfolio(&state, portfolio.id).await?;
        for folio in folios {
            let asset = match fetch_asset_for_folio(&state, folio.asset_id).await? {
                Some(a) => a,
                None => continue,
            };

            let tx_entities = fetch_transactions_for_folio(&state, folio.id).await?;
            let mut core_txs = Vec::with_capacity(tx_entities.len());
            for t in &tx_entities {
                core_txs.push(t.to_core_transaction()?);
            }

            let fallback_nav = core_txs
                .iter()
                .rev()
                .find(|t| t.nav.is_positive())
                .map(|t| t.nav)
                .unwrap_or(Nav::ZERO);

            let current_nav = fetch_latest_nav(&state, Some(&asset), fallback_nav).await;

            let asset_type = asset
                .asset_type
                .parse::<AssetType>()
                .unwrap_or(AssetType::MutualFund);

            folio_data.push((
                folio.id.to_string(),
                asset.name,
                asset_type,
                core_txs,
                current_nav,
            ));
        }
    }

    let inputs: Vec<FolioHarvestingInput> = folio_data
        .iter()
        .map(|(fid, name, atype, txs, nav)| {
            FolioHarvestingInput::new(name, *atype, txs, *nav).with_folio_id(fid)
        })
        .collect();

    let summary = get_harvesting_opportunities(&inputs, as_of, realized_ltcg, None);
    Ok(Json(summary))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/simulate-sell", post(simulate_sell))
        .route("/harvesting", get(get_harvesting))
        .route("/harvesting-opportunities", get(get_harvesting))
}
