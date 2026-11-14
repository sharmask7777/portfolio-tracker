//! Stock metadata management and ingestion routes.

use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{NaiveDate, Utc};
use serde::{Deserialize, Serialize};

use portfolio_db::entities::StockMetadataEntity;
use portfolio_db::repositories::{SqlxStockMetadataRepo, StockMetadataRepository};

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::state::AppState;

fn default_sector() -> String {
    "Other".to_string()
}

/// Individual stock item in ingestion payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestStockMetadataItem {
    pub isin: String,
    pub symbol: String,
    pub name: String,
    #[serde(default = "default_sector")]
    pub sector: String,
    pub market_cap_tier: String,
    pub market_cap_rank: Option<i32>,
    pub market_cap_cr: Option<f64>,
    pub as_of_date: Option<NaiveDate>,
}

/// Request payload for batch ingesting stock classification metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestStockMetadataRequest {
    pub stocks: Vec<IngestStockMetadataItem>,
}

/// Response returned after successfully ingesting stock metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IngestStockMetadataResponse {
    pub count: usize,
    pub status: String,
}

/// Assembles the stock metadata REST API routes.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", post(ingest_stock_metadata).get(get_all_stock_metadata))
        .route("/{isin}", get(get_stock_metadata_by_isin))
}

/// Ingests a batch of stock classification metadata records.
pub async fn ingest_stock_metadata(
    _auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<IngestStockMetadataRequest>,
) -> Result<Json<IngestStockMetadataResponse>, ApiError> {
    if payload.stocks.is_empty() {
        return Ok(Json(IngestStockMetadataResponse {
            count: 0,
            status: "ok".to_string(),
        }));
    }

    let now = Utc::now();
    let default_as_of = now.date_naive();

    let entities: Vec<StockMetadataEntity> = payload
        .stocks
        .into_iter()
        .map(|item| StockMetadataEntity {
            isin: item.isin,
            symbol: item.symbol,
            name: item.name,
            sector: if item.sector.trim().is_empty() {
                "Other".to_string()
            } else {
                item.sector
            },
            market_cap_tier: item.market_cap_tier.to_lowercase(),
            market_cap_rank: item.market_cap_rank,
            market_cap_cr: item.market_cap_cr,
            as_of_date: item.as_of_date.unwrap_or(default_as_of),
            created_at: now,
            updated_at: now,
        })
        .collect();

    let count = entities.len();

    if let Some(pool) = state.pool() {
        let repo = SqlxStockMetadataRepo::new(pool.clone());
        repo.upsert_batch(&entities).await?;
    } else {
        state.db().upsert_batch(&entities).await?;
    }

    Ok(Json(IngestStockMetadataResponse {
        count,
        status: "ok".to_string(),
    }))
}

/// Retrieves stock metadata by ISIN.
pub async fn get_stock_metadata_by_isin(
    _auth_user: AuthUser,
    Path(isin): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<StockMetadataEntity>, ApiError> {
    let result = if let Some(pool) = state.pool() {
        let repo = SqlxStockMetadataRepo::new(pool.clone());
        repo.find_by_isin(&isin).await?
    } else {
        state.db().find_by_isin(&isin).await?
    };

    match result {
        Some(entity) => Ok(Json(entity)),
        None => Err(ApiError::NotFound(format!(
            "Stock with ISIN '{isin}' not found"
        ))),
    }
}

/// Retrieves all stock metadata mapped by ISIN.
pub async fn get_all_stock_metadata(
    _auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<std::collections::HashMap<String, StockMetadataEntity>>, ApiError> {
    let map = if let Some(pool) = state.pool() {
        let repo = SqlxStockMetadataRepo::new(pool.clone());
        repo.get_all_as_map().await?
    } else {
        state.db().get_all_as_map().await?
    };

    Ok(Json(map))
}
