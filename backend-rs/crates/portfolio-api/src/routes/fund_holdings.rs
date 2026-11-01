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

/// Represents an individual stock holding entry in a fund holdings ingestion payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestHoldingItem {
    /// Name of the disclosed portfolio company (e.g. "HDFC Bank Ltd.").
    pub stock_name: String,
    /// Optional International Securities Identification Number (ISIN) for the stock.
    pub stock_isin: Option<String>,
    /// Economic sector classification (defaults to `"Other"` if omitted or empty).
    #[serde(default = "default_sector")]
    pub sector: String,
    /// Percentage weight of the holding within the mutual fund scheme (must be > 0).
    pub weight: Decimal,
}

/// Request payload for ingesting monthly disclosed stock holdings for a mutual fund scheme.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestFundHoldingsRequest {
    /// Scheme ISIN (e.g. "INF879O01018").
    pub isin: String,
    /// Official scheme name (e.g. "Parag Parikh Flexi Cap Fund").
    pub scheme_name: String,
    /// Month-end reporting date as of which holdings are disclosed.
    pub as_of_date: NaiveDate,
    /// List of individual company stock holdings and their portfolio weights.
    pub holdings: Vec<IngestHoldingItem>,
}

/// Response returned after successfully ingesting disclosed fund holdings.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestFundHoldingsResponse {
    /// Scheme ISIN that was updated.
    pub isin: String,
    /// Total number of stock holding entities ingested.
    pub count: usize,
    /// Reporting date for the ingested holdings.
    pub as_of_date: NaiveDate,
    /// Processing status string (e.g. `"success"`).
    pub status: String,
}

/// Data Transfer Object representing a disclosed stock holding for client-facing API responses.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FundHoldingDto {
    /// Name of the underlying company.
    pub stock_name: String,
    /// Stock ISIN identifier if available.
    pub stock_isin: Option<String>,
    /// Sector classification for the company.
    pub sector: String,
    /// Percentage weight in the mutual fund portfolio.
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

/// Route handler for `POST /api/fund-holdings/ingest` ingesting monthly disclosed fund holdings.
///
/// Validates that:
/// - ISIN is non-empty.
/// - Holdings list is non-empty.
/// - All constituent stock weights are strictly greater than zero.
///
/// Upserts records into PostgreSQL `FundHolding` or in-memory mock store.
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

/// Route handler for `GET /api/fund-holdings/:isin` retrieving latest disclosed holdings for a mutual fund scheme.
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

/// Constructs and returns the Axum router for fund holdings ingestion and lookup.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/ingest", post(ingest_fund_holdings))
        .route("/{isin}", get(get_fund_holdings))
}
