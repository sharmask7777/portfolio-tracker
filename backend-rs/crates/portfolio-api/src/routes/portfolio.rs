//! Portfolio management, performance summary, and fund overlap routes.

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use portfolio_core::holdings::get_latest_units;
use portfolio_core::performance::metrics::{
    calculate_absolute_return, calculate_cagr, get_metrics,
};
use portfolio_core::performance::xirr::{CashFlow, calculate_xirr};
use portfolio_core::types::{Money, Nav};
use portfolio_core::xray::{FundHolding, FundOverlap, calculate_fund_overlap};
use portfolio_db::entities::PortfolioEntity;
use portfolio_db::error::DbError;
use portfolio_db::repositories::{PortfolioRepository, TransactionRepository};

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePortfolioRequest {
    pub name: String,
    pub managed_profile_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlapQuery {
    pub isin_a: String,
    pub isin_b: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolioSummary {
    pub folio_id: Uuid,
    pub folio_number: String,
    pub scheme_name: String,
    pub asset_type: String,
    pub units: Decimal,
    pub current_price: Decimal,
    pub invested_amount: Decimal,
    pub current_value: Decimal,
    pub total_gain: Decimal,
    pub absolute_return: Decimal,
    pub cagr: Option<Decimal>,
    pub xirr: Option<Decimal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioSummaryResponse {
    pub portfolio_id: Uuid,
    pub name: String,
    pub invested_amount: Decimal,
    pub current_value: Decimal,
    pub total_gain: Decimal,
    pub absolute_return: Decimal,
    pub cagr: Option<Decimal>,
    pub xirr: Option<Decimal>,
    pub folios: Vec<FolioSummary>,
}

pub async fn list_portfolios(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<PortfolioEntity>>, ApiError> {
    let list = state.db.list_user_portfolios(auth_user.user_id).await?;
    Ok(Json(list))
}

pub async fn create_portfolio(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreatePortfolioRequest>,
) -> Result<(StatusCode, Json<PortfolioEntity>), ApiError> {
    if payload.name.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Portfolio name is required".to_string(),
        ));
    }

    let portfolio = state
        .db
        .create_portfolio(auth_user.user_id, &payload.name, payload.managed_profile_id)
        .await?;

    Ok((StatusCode::CREATED, Json(portfolio)))
}

pub async fn get_summary(
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<PortfolioSummaryResponse>, ApiError> {
    let portfolio = state
        .db
        .get_portfolio(id)
        .await?
        .ok_or(DbError::PortfolioNotFound(id))?;

    let folios = state.db.list_folios_by_portfolio(id);
    let mut folio_summaries = Vec::with_capacity(folios.len());

    let mut total_invested = Decimal::ZERO;
    let mut total_current_value = Decimal::ZERO;
    let mut all_cash_flows = Vec::new();
    let mut earliest_date = None;

    for folio in &folios {
        let asset = state.db.get_asset(folio.asset_id);
        let scheme_name = asset
            .as_ref()
            .map(|a| a.name.clone())
            .unwrap_or_else(|| "Unknown Asset".to_string());
        let asset_type = asset
            .as_ref()
            .map(|a| a.asset_type.clone())
            .unwrap_or_else(|| "MUTUAL_FUND".to_string());

        let tx_entities = state.db.list_by_folio(folio.id).await?;
        let mut core_txs = Vec::with_capacity(tx_entities.len());
        for t in &tx_entities {
            core_txs.push(t.to_core_transaction()?);
        }

        let units = get_latest_units(&core_txs);
        let latest_nav = core_txs
            .iter()
            .rev()
            .find(|t| t.nav.is_positive())
            .map(|t| t.nav)
            .unwrap_or(Nav::ZERO);

        let metrics = get_metrics(&core_txs, latest_nav, None);

        let inv_dec = metrics.invested_amount.to_decimal();
        let val_dec = metrics.current_value.to_decimal();
        total_invested += inv_dec;
        total_current_value += val_dec;

        for tx in &core_txs {
            let flow_amount = if tx.tx_type.is_outflow() {
                -tx.amount.abs().to_decimal()
            } else if tx.tx_type.is_inflow() {
                tx.amount.abs().to_decimal()
            } else {
                tx.amount.to_decimal()
            };
            all_cash_flows.push(CashFlow::new(tx.date, flow_amount));

            earliest_date = match earliest_date {
                None => Some(tx.date),
                Some(prev) => Some(std::cmp::min(prev, tx.date)),
            };
        }

        folio_summaries.push(FolioSummary {
            folio_id: folio.id,
            folio_number: folio.number.clone(),
            scheme_name,
            asset_type,
            units: units.to_decimal(),
            current_price: latest_nav.to_decimal(),
            invested_amount: inv_dec,
            current_value: val_dec,
            total_gain: metrics.total_gain.to_decimal(),
            absolute_return: metrics.absolute_return,
            cagr: metrics.cagr,
            xirr: metrics.xirr,
        });
    }

    let today = Utc::now().date_naive();
    let total_gain = total_current_value - total_invested;
    let absolute_return =
        calculate_absolute_return(Money::new(total_invested), Money::new(total_current_value));

    let cagr = if let Some(start) = earliest_date {
        if start < today && total_invested > Decimal::ZERO {
            calculate_cagr(
                Money::new(total_invested),
                Money::new(total_current_value),
                start,
                today,
            )
            .ok()
        } else {
            None
        }
    } else {
        None
    };

    if total_current_value > Decimal::ZERO {
        all_cash_flows.push(CashFlow::new(today, total_current_value));
    }
    let xirr = calculate_xirr(&all_cash_flows).ok();

    Ok(Json(PortfolioSummaryResponse {
        portfolio_id: portfolio.id,
        name: portfolio.name,
        invested_amount: total_invested,
        current_value: total_current_value,
        total_gain,
        absolute_return,
        cagr,
        xirr,
        folios: folio_summaries,
    }))
}

pub async fn get_overlap(
    Query(params): Query<OverlapQuery>,
) -> Result<Json<FundOverlap>, ApiError> {
    let (name_a, holdings_a) = get_fund_holdings_for_isin(&params.isin_a);
    let (name_b, holdings_b) = get_fund_holdings_for_isin(&params.isin_b);

    let overlap = calculate_fund_overlap(&name_a, &holdings_a, &name_b, &holdings_b);
    Ok(Json(overlap))
}

fn get_fund_holdings_for_isin(isin: &str) -> (String, Vec<FundHolding>) {
    use std::str::FromStr;
    let dec = |s: &str| Decimal::from_str(s).unwrap();

    match isin {
        "INF179K01BE2" => (
            "HDFC Top 100 Fund".to_string(),
            vec![
                FundHolding::new("HDFC Bank Ltd.", dec("9.8")),
                FundHolding::new("ICICI Bank Ltd.", dec("8.2")),
                FundHolding::new("Reliance Industries Ltd.", dec("7.5")),
                FundHolding::new("Infosys Ltd.", dec("6.0")),
                FundHolding::new("Tata Consultancy Services Ltd.", dec("4.5")),
            ],
        ),
        "INF209K01157" => (
            "SBI Large Cap Fund".to_string(),
            vec![
                FundHolding::new("HDFC Bank Limited", dec("8.5")),
                FundHolding::new("Reliance Industries Limited", dec("9.0")),
                FundHolding::new("Infosys Limited", dec("7.0")),
                FundHolding::new("ICICI Bank Limited", dec("5.5")),
                FundHolding::new("Bharti Airtel Ltd.", dec("4.0")),
            ],
        ),
        "INF769K01DP4" => (
            "Mirae Asset Large Cap Fund".to_string(),
            vec![
                FundHolding::new("HDFC Bank Ltd.", dec("9.0")),
                FundHolding::new("ICICI Bank Ltd.", dec("7.8")),
                FundHolding::new("Reliance Industries Ltd.", dec("8.0")),
                FundHolding::new("Infosys Ltd.", dec("6.5")),
                FundHolding::new("Larsen & Toubro Ltd.", dec("4.0")),
            ],
        ),
        other => {
            let name = format!("Fund {}", other);
            let holdings = vec![
                FundHolding::new("HDFC Bank Ltd.", dec("10.0")),
                FundHolding::new("Reliance Industries Ltd.", dec("8.0")),
                FundHolding::new("Infosys Ltd.", dec("7.0")),
            ];
            (name, holdings)
        }
    }
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_portfolios).post(create_portfolio))
        .route("/overlap", get(get_overlap))
        .route("/{id}/summary", get(get_summary))
}
