//! Health check, smart insights, and goal management endpoints.

use axum::extract::{Path, State};
use axum::routing::{get, put};
use axum::{Json, Router};
use chrono::{DateTime, NaiveDate, Utc};
use portfolio_db::{GoalRepository, PgGoalRepository};
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::routes::portfolio::resolve_target_portfolios;
use crate::state::AppState;

/// Portfolio insight item returned by `GET /api/portfolio/:portfolioId/insights`.
#[derive(Debug, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Insight {
    /// Insight category (`"CONCENTRATION"`, `"OVERLAP"`, `"INFO"`, etc.).
    pub r#type: String,
    /// Severity level (`"HIGH"`, `"MEDIUM"`, `"LOW"`).
    pub severity: String,
    /// Human-readable insight summary.
    pub message: String,
    /// Actionable recommendation.
    pub recommendation: String,
}

/// Health check response payload.
#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct HealthResponse {
    /// Service status (`"ok"`).
    pub status: String,
    /// Current UTC timestamp.
    pub timestamp: DateTime<Utc>,
}

/// Goal DTO returned by goal CRUD endpoints.
#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct GoalDto {
    /// Goal UUID.
    pub id: String,
    /// Owning portfolio UUID.
    pub portfolio_id: String,
    /// Goal name.
    pub name: String,
    /// Target amount in INR.
    #[ts(type = "number")]
    pub target_amount: f64,
    /// Target date.
    pub target_date: DateTime<Utc>,
}

/// Response returned after deleting a goal.
#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct DeleteGoalResponse {
    /// Whether the goal was deleted.
    pub success: bool,
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
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(portfolio_id): Path<String>,
) -> Result<Json<Vec<Insight>>, ApiError> {
    let exposures = crate::routes::portfolio::compute_portfolio_exposures(
        &state,
        auth_user.user_id,
        &portfolio_id,
        false,
    )
    .await
    .unwrap_or_default();

    let mut insights = Vec::new();

    // 1. Sector Concentration Check
    let mut sector_map: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for exp in &exposures {
        *sector_map.entry(exp.sector.clone()).or_insert(0.0) += exp.percentage;
    }

    let mut sectors: Vec<(String, f64)> = sector_map.into_iter().collect();
    sectors.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

    for (sector_name, pct) in sectors {
        if pct > 0.3 {
            let severity = if pct > 0.45 { "HIGH" } else { "MEDIUM" };
            insights.push(Insight {
                r#type: "CONCENTRATION".to_string(),
                severity: severity.to_string(),
                message: format!(
                    "High concentration in {} sector ({:.1}%).",
                    sector_name,
                    pct * 100.0
                ),
                recommendation:
                    "Consider diversifying into other sectors to reduce structural risk."
                        .to_string(),
            });
        }
    }

    // 2. Stock Overlap Check
    for stock in exposures.iter().take(5) {
        if stock.percentage > 0.1 {
            let severity = if stock.percentage > 0.15 {
                "HIGH"
            } else {
                "MEDIUM"
            };
            insights.push(Insight {
                r#type: "OVERLAP".to_string(),
                severity: severity.to_string(),
                message: format!(
                    "Significant exposure to {} ({:.1}%).",
                    stock.name,
                    stock.percentage * 100.0
                ),
                recommendation: format!(
                    "This stock is held across {} funds. Review if you are over-exposed.",
                    stock.contributions.len()
                ),
            });
        }
    }

    // 3. Fallback Info Insight if no risks detected
    if insights.is_empty() {
        insights.push(Insight {
            r#type: "INFO".to_string(),
            severity: "LOW".to_string(),
            message: "Your portfolio looks well-diversified.".to_string(),
            recommendation: "Continue monitoring regular rebalancing opportunities.".to_string(),
        });
    }

    Ok(Json(insights))
}

/// Lists all financial goals for the specified portfolio.
pub async fn get_goals(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(portfolio_id): Path<String>,
) -> Result<Json<Vec<GoalDto>>, ApiError> {
    let portfolios = resolve_target_portfolios(&state, auth_user.user_id, &portfolio_id).await?;
    let mut goals = Vec::new();
    for p in portfolios {
        let pid = p.id.to_string();
        let rows = if let Some(pool) = state.pool() {
            PgGoalRepository::new(pool.clone()).list_goals(&pid).await?
        } else {
            state.db.list_goals(&pid).await?
        };
        for g in rows {
            goals.push(GoalDto {
                id: g.id.clone(),
                portfolio_id: g.portfolio_id.clone(),
                name: g.name,
                target_amount: g.target_amount.to_f64().unwrap_or(0.0),
                target_date: g.target_date,
            });
        }
    }
    Ok(Json(goals))
}

fn parse_target_date(raw: Option<&str>) -> DateTime<Utc> {
    raw.and_then(|s| {
        DateTime::parse_from_rfc3339(s)
            .map(|dt| dt.with_timezone(&Utc))
            .ok()
            .or_else(|| {
                NaiveDate::parse_from_str(s, "%Y-%m-%d")
                    .ok()
                    .and_then(|d| d.and_hms_opt(0, 0, 0))
                    .map(|ndt| ndt.and_utc())
            })
    })
    .unwrap_or_else(|| Utc::now() + chrono::Duration::days(365))
}

/// Creates a new financial goal for the specified portfolio.
pub async fn create_goal(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(portfolio_id): Path<String>,
    Json(payload): Json<CreateGoalRequest>,
) -> Result<Json<GoalDto>, ApiError> {
    let portfolios = resolve_target_portfolios(&state, auth_user.user_id, &portfolio_id).await?;
    let target_portfolio = portfolios
        .first()
        .ok_or_else(|| ApiError::NotFound("Portfolio not found".to_string()))?;
    let pid = target_portfolio.id.to_string();
    let target_amount = Decimal::from_f64(payload.target_amount).unwrap_or(Decimal::ZERO);
    let target_date = parse_target_date(payload.target_date.as_deref());

    let g = if let Some(pool) = state.pool() {
        PgGoalRepository::new(pool.clone())
            .create_goal(&pid, &payload.name, target_amount, target_date)
            .await?
    } else {
        state
            .db
            .create_goal(&pid, &payload.name, target_amount, target_date)
            .await?
    };

    Ok(Json(GoalDto {
        id: g.id.clone(),
        portfolio_id: g.portfolio_id.clone(),
        name: g.name,
        target_amount: g.target_amount.to_f64().unwrap_or(0.0),
        target_date: g.target_date,
    }))
}

/// Updates an existing financial goal.
pub async fn update_goal(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path((portfolio_id, goal_id)): Path<(String, String)>,
    Json(payload): Json<UpdateGoalRequest>,
) -> Result<Json<GoalDto>, ApiError> {
    let _portfolios = resolve_target_portfolios(&state, auth_user.user_id, &portfolio_id).await?;
    let name = payload.name.unwrap_or_else(|| "Goal".to_string());
    let target_amount =
        Decimal::from_f64(payload.target_amount.unwrap_or(100_000.0)).unwrap_or(Decimal::ZERO);
    let target_date = parse_target_date(payload.target_date.as_deref());

    let g = if let Some(pool) = state.pool() {
        PgGoalRepository::new(pool.clone())
            .update_goal(&goal_id, &name, target_amount, target_date)
            .await?
    } else {
        state
            .db
            .update_goal(&goal_id, &name, target_amount, target_date)
            .await?
    };

    Ok(Json(GoalDto {
        id: g.id.clone(),
        portfolio_id: g.portfolio_id.clone(),
        name: g.name,
        target_amount: g.target_amount.to_f64().unwrap_or(0.0),
        target_date: g.target_date,
    }))
}

/// Deletes a financial goal by ID.
pub async fn delete_goal(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path((portfolio_id, goal_id)): Path<(String, String)>,
) -> Result<Json<DeleteGoalResponse>, ApiError> {
    let _portfolios = resolve_target_portfolios(&state, auth_user.user_id, &portfolio_id).await?;
    let deleted = if let Some(pool) = state.pool() {
        PgGoalRepository::new(pool.clone())
            .delete_goal(&goal_id)
            .await?
    } else {
        state.db.delete_goal(&goal_id).await?
    };

    Ok(Json(DeleteGoalResponse { success: deleted }))
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
