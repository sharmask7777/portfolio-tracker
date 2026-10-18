//! Tax simulation and tax harvesting routes.

use std::str::FromStr;

use axum::extract::{Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::Deserialize;
use uuid::Uuid;

use portfolio_core::error::PortfolioError;
use portfolio_core::tax::SellSimulation;
use portfolio_core::tax::harvesting::{
    FolioHarvestingInput, HarvestingSummary, get_harvesting_opportunities,
};
use portfolio_core::tax::rules::simulate_sell_transactions;
use portfolio_core::types::{AssetType, Money, Nav, Units};
use portfolio_db::error::DbError;
use portfolio_db::repositories::{PortfolioRepository, TransactionRepository};

use crate::errors::ApiError;
use crate::middleware::AuthUser;
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

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HarvestingQuery {
    pub as_of: Option<NaiveDate>,
    pub realized_ltcg: Option<Decimal>,
}

pub async fn simulate_sell(
    State(state): State<AppState>,
    Json(payload): Json<SimulateSellRequest>,
) -> Result<Json<SellSimulation>, ApiError> {
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
        let folio = state
            .db
            .get_folio(folio_id)
            .ok_or(DbError::FolioNotFound(folio_id))?;
        let asset = state
            .db
            .get_asset(folio.asset_id)
            .ok_or(DbError::AssetNotFound(folio.asset_id))?;

        let tx_entities = state.db.list_by_folio(folio.id).await?;
        let mut core_txs = Vec::with_capacity(tx_entities.len());
        for t in &tx_entities {
            core_txs.push(t.to_core_transaction()?);
        }

        let current_price = match payload.current_price {
            Some(p) => Nav::new(p),
            None => core_txs
                .iter()
                .rev()
                .find(|t| t.nav.is_positive())
                .map(|t| t.nav)
                .unwrap_or(Nav::ZERO),
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
            Ok(simulation) => Ok(Json(simulation)),
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
            Ok(simulation) => Ok(Json(simulation)),
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

    let portfolios = state.db.list_user_portfolios(auth_user.user_id).await?;

    let mut folio_data = Vec::new();

    for portfolio in &portfolios {
        let folios = state.db.list_folios_by_portfolio(portfolio.id);
        for folio in folios {
            let asset = match state.db.get_asset(folio.asset_id) {
                Some(a) => a,
                None => continue,
            };

            let tx_entities = state.db.list_by_folio(folio.id).await?;
            let mut core_txs = Vec::with_capacity(tx_entities.len());
            for t in &tx_entities {
                core_txs.push(t.to_core_transaction()?);
            }

            let current_nav = core_txs
                .iter()
                .rev()
                .find(|t| t.nav.is_positive())
                .map(|t| t.nav)
                .unwrap_or(Nav::ZERO);

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
}
