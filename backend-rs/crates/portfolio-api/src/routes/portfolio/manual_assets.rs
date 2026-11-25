//! Manual asset creation and deletion route handlers.

use axum::Json;
use axum::extract::{Path, State};
use chrono::Utc;
use portfolio_db::PortfolioRepository;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use super::folios::{StatusResponse, delete_folio};
use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::state::AppState;

/// Request payload for creating a manual asset holding (Gold, Real Estate, Unlisted, etc.).
#[derive(Debug, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CreateManualAssetRequest {
    /// Asset name (e.g., "Sovereign Gold Bond 2024").
    pub name: String,
    /// Asset type (e.g., "GOLD", "REAL_ESTATE", "UNLISTED", "SGB").
    pub r#type: String,
    /// Number of units or invested amount.
    #[ts(type = "number")]
    pub units: Decimal,
    /// Optional valuation date in `YYYY-MM-DD` format.
    pub balance_date: Option<String>,
    /// Optional managed profile UUID.
    pub profile_id: Option<String>,
}

/// Response payload returned after creating a manual asset holding.
#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CreateManualAssetResponse {
    /// Operation status (`"success"`).
    pub status: String,
    /// Newly created asset UUID string.
    pub asset_id: String,
}

/// Route handler for `POST /api/portfolio/manual-asset` creating manual holding (Gold, Real Estate, Unlisted).
pub async fn create_manual_asset(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateManualAssetRequest>,
) -> Result<Json<CreateManualAssetResponse>, ApiError> {
    let user_id = auth_user.user_id;
    let _target_prof_id = payload
        .profile_id
        .as_deref()
        .and_then(|p| Uuid::parse_str(p).ok());

    let balance_date = payload
        .balance_date
        .as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .unwrap_or_else(|| Utc::now().date_naive())
        .and_hms_opt(0, 0, 0)
        .unwrap_or_default()
        .and_utc();

    let (asset, _folio, _tx) = state
        .db
        .create_manual_asset(
            user_id,
            &payload.name,
            &payload.r#type,
            payload.units,
            payload.units,
            Decimal::ONE,
            balance_date,
        )
        .await?;

    Ok(Json(CreateManualAssetResponse {
        status: "success".to_string(),
        asset_id: asset.id.to_string(),
    }))
}

/// Route handler for `DELETE /api/portfolio/manual-asset/:folioId` deleting a manual holding.
pub async fn delete_manual_asset(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(folio_id): Path<String>,
) -> Result<Json<StatusResponse>, ApiError> {
    delete_folio(auth_user, State(state), Path(folio_id)).await
}
