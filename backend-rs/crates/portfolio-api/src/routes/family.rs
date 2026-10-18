//! Family profile management and cascading deletion routes.

use std::str::FromStr;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::routing::get;
use axum::{Json, Router};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use portfolio_db::entities::ManagedProfileEntity;
use portfolio_db::repositories::FamilyRepository;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProfileRequest {
    pub name: String,
    pub pan: String,
    pub tax_slab: Option<Decimal>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteProfileResponse {
    pub status: String,
    pub id: Uuid,
}

pub async fn list_profiles(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<ManagedProfileEntity>>, ApiError> {
    let profiles = state.db.list_profiles(auth_user.user_id).await?;
    Ok(Json(profiles))
}

pub async fn create_profile(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateProfileRequest>,
) -> Result<(StatusCode, Json<ManagedProfileEntity>), ApiError> {
    if payload.name.trim().is_empty() || payload.pan.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Name and PAN are required".to_string(),
        ));
    }

    let tax_slab = payload
        .tax_slab
        .unwrap_or_else(|| Decimal::from_str("0.30").unwrap());

    let profile = state
        .db
        .create_managed_profile(
            auth_user.user_id,
            payload.name.trim(),
            payload.pan.trim(),
            tax_slab,
        )
        .await?;

    Ok((StatusCode::CREATED, Json(profile)))
}

pub async fn delete_profile(
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<DeleteProfileResponse>, ApiError> {
    state
        .db
        .delete_managed_profile(auth_user.user_id, id)
        .await?;

    Ok(Json(DeleteProfileResponse {
        status: "success".to_string(),
        id,
    }))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/profiles", get(list_profiles).post(create_profile))
        .route("/profiles/{id}", axum::routing::delete(delete_profile))
        .route("/profile/{id}", axum::routing::delete(delete_profile))
}
