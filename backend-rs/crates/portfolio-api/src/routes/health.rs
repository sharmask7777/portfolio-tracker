//! Health check and goal management endpoints.

use axum::extract::Path;
use axum::routing::{get, put};
use axum::{Json, Router};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::state::AppState;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: DateTime<Utc>,
}

fn deserialize_f64_or_string<'de, D>(deserializer: D) -> Result<f64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum NumOrStr {
        Num(f64),
        Str(String),
    }

    match NumOrStr::deserialize(deserializer)? {
        NumOrStr::Num(n) => Ok(n),
        NumOrStr::Str(s) => s.trim().parse::<f64>().map_err(serde::de::Error::custom),
    }
}

fn deserialize_opt_f64_or_string<'de, D>(deserializer: D) -> Result<Option<f64>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum NumOrStr {
        Num(f64),
        Str(String),
    }

    match Option::<NumOrStr>::deserialize(deserializer)? {
        Some(NumOrStr::Num(n)) => Ok(Some(n)),
        Some(NumOrStr::Str(s)) => {
            let parsed = s.trim().parse::<f64>().map_err(serde::de::Error::custom)?;
            Ok(Some(parsed))
        }
        None => Ok(None),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGoalRequest {
    pub name: String,
    #[serde(deserialize_with = "deserialize_f64_or_string")]
    pub target_amount: f64,
    pub target_date: Option<String>,
    pub asset_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGoalRequest {
    pub name: Option<String>,
    #[serde(default, deserialize_with = "deserialize_opt_f64_or_string")]
    pub target_amount: Option<f64>,
    pub target_date: Option<String>,
    pub asset_ids: Option<Vec<String>>,
}

pub async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        timestamp: Utc::now(),
    })
}

pub async fn get_insights(
    _auth_user: AuthUser,
    Path(_portfolio_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(json!([])))
}

pub async fn get_goals(
    _auth_user: AuthUser,
    Path(_portfolio_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(json!([])))
}

pub async fn create_goal(
    _auth_user: AuthUser,
    Path(_portfolio_id): Path<String>,
    Json(payload): Json<CreateGoalRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let id = Uuid::new_v4().to_string();
    Ok(Json(json!({
        "id": id,
        "name": payload.name,
        "targetAmount": payload.target_amount,
    })))
}

pub async fn update_goal(
    _auth_user: AuthUser,
    Path((_portfolio_id, goal_id)): Path<(String, String)>,
    Json(payload): Json<UpdateGoalRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(json!({
        "id": goal_id,
        "name": payload.name.unwrap_or_else(|| "Goal".to_string()),
        "targetAmount": payload.target_amount.unwrap_or(100000.0),
    })))
}

pub async fn delete_goal(
    _auth_user: AuthUser,
    Path((_portfolio_id, _goal_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(json!({ "success": true })))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(health_check))
        .route("/{portfolioId}/insights", get(get_insights))
        .route("/{portfolioId}/goals", get(get_goals).post(create_goal))
        .route(
            "/{portfolioId}/goals/{goalId}",
            put(update_goal).delete(delete_goal),
        )
}
