//! Fund holdings ingestion and lookup routes.

use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use portfolio_db::entities::FundHoldingEntity;
use portfolio_db::error::DbError;
use portfolio_db::repositories::{FundHoldingsRepository, SqlxFundHoldingsRepo};

use crate::errors::ApiError;
use crate::state::{AppState, DbBackend};

fn default_sector() -> String {
    "Other".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestHoldingItem {
    pub stock_name: String,
    pub stock_isin: Option<String>,
    #[serde(default = "default_sector")]
    pub sector: String,
    pub weight: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestFundHoldingsRequest {
    pub isin: String,
    pub scheme_name: String,
    pub as_of_date: NaiveDate,
    pub holdings: Vec<IngestHoldingItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestFundHoldingsResponse {
    pub isin: String,
    pub count: usize,
    pub as_of_date: NaiveDate,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FundHoldingDto {
    pub stock_name: String,
    pub stock_isin: Option<String>,
    pub sector: String,
    pub weight: f64,
}

/// Dispatches fund holdings persistence to the active database backend (in-memory or postgres).
async fn upsert_holdings(state: &AppState, holdings: &[FundHoldingEntity]) -> Result<(), DbError> {
    match &state.backend {
        DbBackend::InMemory(mem) => mem.upsert_fund_holdings(holdings).await,
        DbBackend::Postgres(pool) => {
            let repo = SqlxFundHoldingsRepo::new(pool.clone());
            repo.upsert_fund_holdings(holdings).await
        }
    }
}

/// Dispatches fund holdings retrieval to the active database backend (in-memory or postgres).
async fn get_latest_holdings(
    state: &AppState,
    isin: &str,
) -> Result<Vec<FundHoldingEntity>, DbError> {
    match &state.backend {
        DbBackend::InMemory(mem) => mem.get_latest_holdings_by_isin(isin).await,
        DbBackend::Postgres(pool) => {
            let repo = SqlxFundHoldingsRepo::new(pool.clone());
            repo.get_latest_holdings_by_isin(isin).await
        }
    }
}

/// Ingests a batch of disclosed fund holdings for a mutual fund scheme.
pub async fn ingest_fund_holdings(
    State(state): State<AppState>,
    Json(payload): Json<IngestFundHoldingsRequest>,
) -> Result<Json<IngestFundHoldingsResponse>, ApiError> {
    if payload.isin.trim().is_empty() {
        return Err(ApiError::BadRequest("ISIN cannot be empty".to_string()));
    }
    if payload.holdings.is_empty() {
        return Err(ApiError::BadRequest("Holdings cannot be empty".to_string()));
    }
    for item in &payload.holdings {
        if item.weight <= Decimal::ZERO {
            return Err(ApiError::BadRequest(
                "Holding weight must be greater than zero".to_string(),
            ));
        }
    }

    let entities: Vec<FundHoldingEntity> = payload
        .holdings
        .iter()
        .map(|item| FundHoldingEntity {
            id: Uuid::new_v4(),
            isin: payload.isin.clone(),
            scheme_name: payload.scheme_name.clone(),
            as_of_date: payload.as_of_date,
            stock_name: item.stock_name.clone(),
            stock_isin: item.stock_isin.clone(),
            sector: if item.sector.trim().is_empty() {
                "Other".to_string()
            } else {
                item.sector.clone()
            },
            weight: item.weight,
            created_at: Utc::now(),
        })
        .collect();

    let count = entities.len();
    upsert_holdings(&state, &entities).await?;

    Ok(Json(IngestFundHoldingsResponse {
        isin: payload.isin,
        count,
        as_of_date: payload.as_of_date,
        status: "success".to_string(),
    }))
}

/// Retrieves latest disclosed holdings for a mutual fund scheme by its ISIN.
pub async fn get_fund_holdings(
    State(state): State<AppState>,
    Path(isin): Path<String>,
) -> Result<Json<Vec<FundHoldingDto>>, ApiError> {
    let holdings = get_latest_holdings(&state, &isin).await?;
    let dtos = holdings
        .into_iter()
        .map(|h| FundHoldingDto {
            stock_name: h.stock_name,
            stock_isin: h.stock_isin,
            sector: h.sector,
            weight: h.weight.to_f64().unwrap_or(0.0),
        })
        .collect();

    Ok(Json(dtos))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/ingest", post(ingest_fund_holdings))
        .route("/{isin}", get(get_fund_holdings))
}
