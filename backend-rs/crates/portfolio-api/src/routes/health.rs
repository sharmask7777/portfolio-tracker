//! Health check and goal management endpoints.

use std::collections::HashMap;

use axum::extract::{Path, State};
use axum::routing::{get, put};
use axum::{Json, Router};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use portfolio_db::entities::GoalEntity;
use portfolio_db::repositories::{
    CreateGoalParams, GoalRepository, PortfolioRepository, SqlxGoalRepo, SqlxPortfolioRepo,
    UpdateGoalParams,
};
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use serde::{Deserialize, Serialize};
use serde_json::json;
use ts_rs::TS;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::services::ValuationService;
use crate::state::AppState;

/// Expected annual return rate (12% p.a.) used for server-side goal projections.
const EXPECTED_ANNUAL_RETURN_RATE: f64 = 0.12;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Insight {
    pub r#type: String,
    pub severity: String,
    pub message: String,
    pub recommendation: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: DateTime<Utc>,
}

/// Server-computed goal health status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
pub enum GoalStatus {
    #[serde(rename = "Achieved")]
    Achieved,
    #[serde(rename = "On Track")]
    OnTrack,
    #[serde(rename = "Needs Attention")]
    NeedsAttention,
    #[serde(rename = "Behind")]
    Behind,
}

/// Server-computed financial goal projection and progress metrics.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GoalMetricsDto {
    pub current_value: f64,
    pub progress_percentage: f64,
    pub projected_value: f64,
    pub shortfall: f64,
    pub surplus: f64,
    pub required_monthly_sip: f64,
    pub remaining_days: i64,
    pub remaining_months: i64,
    pub status: GoalStatus,
}

/// Persisted financial goal with server-computed projection metrics.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct GoalResponse {
    pub id: Uuid,
    pub portfolio_id: Uuid,
    pub name: String,
    pub target_amount: f64,
    pub target_date: NaiveDate,
    pub monthly_sip: f64,
    pub priority: String,
    pub allocated_percentage: f64,
    pub metrics: GoalMetricsDto,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
            let trimmed = s.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                let parsed = trimmed.parse::<f64>().map_err(serde::de::Error::custom)?;
                Ok(Some(parsed))
            }
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
    #[serde(default, deserialize_with = "deserialize_opt_f64_or_string")]
    pub monthly_sip: Option<f64>,
    pub priority: Option<String>,
    #[serde(default, deserialize_with = "deserialize_opt_f64_or_string")]
    pub allocated_percentage: Option<f64>,
    pub asset_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateGoalRequest {
    pub name: Option<String>,
    #[serde(default, deserialize_with = "deserialize_opt_f64_or_string")]
    pub target_amount: Option<f64>,
    pub target_date: Option<String>,
    #[serde(default, deserialize_with = "deserialize_opt_f64_or_string")]
    pub monthly_sip: Option<f64>,
    pub priority: Option<String>,
    #[serde(default, deserialize_with = "deserialize_opt_f64_or_string")]
    pub allocated_percentage: Option<f64>,
    pub asset_ids: Option<Vec<String>>,
}

fn round2(val: f64) -> f64 {
    (val * 100.0).round() / 100.0
}

fn decimal_from_f64(val: f64, field: &str) -> Result<Decimal, ApiError> {
    if !val.is_finite() {
        return Err(ApiError::BadRequest(format!(
            "{field} must be a finite number"
        )));
    }
    Decimal::from_f64(round2(val))
        .ok_or_else(|| ApiError::BadRequest(format!("Invalid decimal value for {field}")))
}

fn parse_target_date(
    raw: Option<&str>,
    default_if_missing: bool,
) -> Result<Option<NaiveDate>, ApiError> {
    match raw.map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => {
            if let Ok(date) = NaiveDate::parse_from_str(s, "%Y-%m-%d") {
                return Ok(Some(date));
            }
            if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
                return Ok(Some(dt.date_naive()));
            }
            Err(ApiError::BadRequest(format!(
                "Invalid targetDate '{s}'; expected YYYY-MM-DD or RFC3339 timestamp"
            )))
        }
        None if default_if_missing => Ok(Some(Utc::now().date_naive() + Duration::days(365 * 5))),
        None => Ok(None),
    }
}

fn normalize_priority(raw: Option<&str>) -> Result<Option<String>, ApiError> {
    match raw.map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => match s.to_uppercase().as_str() {
            "HIGH" => Ok(Some("HIGH".to_string())),
            "MEDIUM" => Ok(Some("MEDIUM".to_string())),
            "LOW" => Ok(Some("LOW".to_string())),
            other => Err(ApiError::BadRequest(format!(
                "Invalid priority '{other}'; expected HIGH, MEDIUM, or LOW"
            ))),
        },
        None => Ok(None),
    }
}

/// Computes server-side goal projection metrics using live portfolio valuation and `allocated_percentage`.
pub fn compute_goal_metrics(
    goal: &GoalEntity,
    portfolio_value: f64,
    today: NaiveDate,
) -> GoalMetricsDto {
    let target_amount = goal.target_amount.to_f64().unwrap_or(0.0).max(0.0);
    let monthly_sip = goal.monthly_sip.to_f64().unwrap_or(0.0).max(0.0);
    let allocated_pct = goal
        .allocated_percentage
        .to_f64()
        .unwrap_or(100.0)
        .clamp(0.0, 100.0);

    let current_value = round2(portfolio_value.max(0.0) * (allocated_pct / 100.0));
    let progress_percentage = if target_amount > 0.0 {
        round2(((current_value / target_amount) * 100.0).clamp(0.0, 100.0))
    } else {
        100.0
    };

    let remaining_days = (goal.target_date - today).num_days().max(0);
    let remaining_months = if remaining_days <= 0 {
        0
    } else {
        ((remaining_days as f64) / 30.4375).ceil() as i64
    };

    let monthly_rate = EXPECTED_ANNUAL_RETURN_RATE / 12.0;
    let n = remaining_months as f64;

    let (projected_value, required_monthly_sip) = if n <= 0.0 {
        let req = (target_amount - current_value).max(0.0);
        (current_value, round2(req))
    } else {
        let growth_factor = (1.0 + monthly_rate).powf(n);
        let fv_corpus = current_value * growth_factor;
        let annuity_factor = (growth_factor - 1.0) / monthly_rate;
        let fv_sip = monthly_sip * annuity_factor;
        let projected = fv_corpus + fv_sip;

        let req_sip = if current_value >= target_amount || target_amount <= 0.0 {
            0.0
        } else {
            let gap = (target_amount - fv_corpus).max(0.0);
            if annuity_factor > 0.0 {
                gap / annuity_factor
            } else {
                gap
            }
        };
        (round2(projected), round2(req_sip))
    };

    let shortfall = round2((target_amount - projected_value).max(0.0));
    let surplus = round2((projected_value - target_amount).max(0.0));

    let status = if target_amount <= 0.0 || current_value >= target_amount {
        GoalStatus::Achieved
    } else if projected_value >= target_amount {
        GoalStatus::OnTrack
    } else if projected_value >= target_amount * 0.80 {
        GoalStatus::NeedsAttention
    } else {
        GoalStatus::Behind
    };

    GoalMetricsDto {
        current_value,
        progress_percentage,
        projected_value,
        shortfall,
        surplus,
        required_monthly_sip,
        remaining_days,
        remaining_months,
        status,
    }
}

fn to_goal_response(goal: GoalEntity, portfolio_value: f64, today: NaiveDate) -> GoalResponse {
    let metrics = compute_goal_metrics(&goal, portfolio_value, today);
    GoalResponse {
        id: goal.id,
        portfolio_id: goal.portfolio_id,
        name: goal.name,
        target_amount: round2(goal.target_amount.to_f64().unwrap_or(0.0)),
        target_date: goal.target_date,
        monthly_sip: round2(goal.monthly_sip.to_f64().unwrap_or(0.0)),
        priority: goal.priority,
        allocated_percentage: round2(goal.allocated_percentage.to_f64().unwrap_or(100.0)),
        metrics,
        created_at: goal.created_at,
        updated_at: goal.updated_at,
    }
}

async fn resolve_owned_portfolio_ids(
    state: &AppState,
    user_id: Uuid,
    portfolio_id: &str,
) -> Result<(bool, Vec<Uuid>), ApiError> {
    if let Ok(port_uuid) = Uuid::parse_str(portfolio_id) {
        let portfolio = crate::routes::portfolio::fetch_portfolio(state, port_uuid)
            .await?
            .ok_or_else(|| ApiError::NotFound("Portfolio not found".to_string()))?;
        if portfolio.user_id != user_id {
            return Err(ApiError::Forbidden);
        }
        Ok((true, vec![port_uuid]))
    } else {
        let portfolios =
            crate::routes::portfolio::resolve_target_portfolios(state, user_id, portfolio_id)
                .await?;
        Ok((false, portfolios.into_iter().map(|p| p.id).collect()))
    }
}

async fn portfolio_live_value(state: &AppState, portfolio_id: Uuid) -> Result<f64, ApiError> {
    let snapshot = ValuationService::compute_live_valuation(state, &[portfolio_id]).await?;
    Ok(snapshot.total_value.to_f64().unwrap_or(0.0))
}

async fn db_list_goals(state: &AppState, portfolio_id: Uuid) -> Result<Vec<GoalEntity>, ApiError> {
    if let Some(pool) = state.pool() {
        Ok(SqlxGoalRepo::new(pool.clone())
            .list_goals(portfolio_id)
            .await?)
    } else {
        Ok(state.db.list_goals(portfolio_id).await?)
    }
}

async fn db_get_goal(state: &AppState, goal_id: Uuid) -> Result<Option<GoalEntity>, ApiError> {
    if let Some(pool) = state.pool() {
        Ok(SqlxGoalRepo::new(pool.clone()).get_goal(goal_id).await?)
    } else {
        Ok(state.db.get_goal(goal_id).await?)
    }
}

async fn db_create_goal(
    state: &AppState,
    params: CreateGoalParams<'_>,
) -> Result<GoalEntity, ApiError> {
    if let Some(pool) = state.pool() {
        Ok(SqlxGoalRepo::new(pool.clone()).create_goal(params).await?)
    } else {
        Ok(state.db.create_goal(params).await?)
    }
}

async fn db_update_goal(
    state: &AppState,
    goal_id: Uuid,
    portfolio_id: Uuid,
    params: UpdateGoalParams<'_>,
) -> Result<Option<GoalEntity>, ApiError> {
    if let Some(pool) = state.pool() {
        Ok(SqlxGoalRepo::new(pool.clone())
            .update_goal(goal_id, portfolio_id, params)
            .await?)
    } else {
        Ok(state.db.update_goal(goal_id, portfolio_id, params).await?)
    }
}

async fn db_delete_goal(
    state: &AppState,
    goal_id: Uuid,
    portfolio_id: Uuid,
) -> Result<bool, ApiError> {
    if let Some(pool) = state.pool() {
        Ok(SqlxGoalRepo::new(pool.clone())
            .delete_goal(goal_id, portfolio_id)
            .await?)
    } else {
        Ok(state.db.delete_goal(goal_id, portfolio_id).await?)
    }
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
    sectors.sort_by(|a, b| b.1.total_cmp(&a.1).then_with(|| a.0.cmp(&b.0)));

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

pub async fn get_goals(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(portfolio_id): Path<String>,
) -> Result<Json<Vec<GoalResponse>>, ApiError> {
    let (_, portfolio_ids) =
        resolve_owned_portfolio_ids(&state, auth_user.user_id, &portfolio_id).await?;
    if portfolio_ids.is_empty() {
        return Ok(Json(Vec::new()));
    }

    let today = Utc::now().date_naive();
    let mut valuation_cache: HashMap<Uuid, f64> = HashMap::new();
    let mut responses = Vec::new();

    for p_id in portfolio_ids {
        let goals = db_list_goals(&state, p_id).await?;
        if goals.is_empty() {
            continue;
        }
        let port_val = if let Some(v) = valuation_cache.get(&p_id) {
            *v
        } else {
            let v = portfolio_live_value(&state, p_id).await?;
            valuation_cache.insert(p_id, v);
            v
        };
        for goal in goals {
            responses.push(to_goal_response(goal, port_val, today));
        }
    }

    Ok(Json(responses))
}

pub async fn create_goal(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(portfolio_id): Path<String>,
    Json(payload): Json<CreateGoalRequest>,
) -> Result<Json<GoalResponse>, ApiError> {
    let (is_explicit_uuid, portfolio_ids) =
        resolve_owned_portfolio_ids(&state, auth_user.user_id, &portfolio_id).await?;
    let target_portfolio_id = if let Some(&id) = portfolio_ids.first() {
        id
    } else if !is_explicit_uuid {
        if let Some(pool) = state.pool() {
            SqlxPortfolioRepo::new(pool.clone())
                .create_portfolio(auth_user.user_id, "Primary Portfolio", None)
                .await?
                .id
        } else {
            state
                .db
                .create_portfolio(auth_user.user_id, "Primary Portfolio", None)
                .await?
                .id
        }
    } else {
        return Err(ApiError::NotFound("Portfolio not found".to_string()));
    };

    let trimmed_name = payload.name.trim();
    if trimmed_name.is_empty() {
        return Err(ApiError::BadRequest("Goal name is required".to_string()));
    }
    if !payload.target_amount.is_finite() || payload.target_amount <= 0.0 {
        return Err(ApiError::BadRequest(
            "targetAmount must be greater than 0".to_string(),
        ));
    }

    let monthly_sip_f64 = payload.monthly_sip.unwrap_or(0.0);
    if !monthly_sip_f64.is_finite() || monthly_sip_f64 < 0.0 {
        return Err(ApiError::BadRequest(
            "monthlySip must be non-negative".to_string(),
        ));
    }

    let allocated_pct_f64 = payload.allocated_percentage.unwrap_or(100.0);
    if !allocated_pct_f64.is_finite() || !(0.0..=100.0).contains(&allocated_pct_f64) {
        return Err(ApiError::BadRequest(
            "allocatedPercentage must be between 0 and 100".to_string(),
        ));
    }

    let target_date = parse_target_date(payload.target_date.as_deref(), true)?
        .unwrap_or_else(|| Utc::now().date_naive() + Duration::days(365 * 5));
    let priority =
        normalize_priority(payload.priority.as_deref())?.unwrap_or_else(|| "MEDIUM".to_string());

    let goal = db_create_goal(
        &state,
        CreateGoalParams {
            portfolio_id: target_portfolio_id,
            name: trimmed_name,
            target_amount: decimal_from_f64(payload.target_amount, "targetAmount")?,
            target_date,
            monthly_sip: decimal_from_f64(monthly_sip_f64, "monthlySip")?,
            priority: &priority,
            allocated_percentage: decimal_from_f64(allocated_pct_f64, "allocatedPercentage")?,
        },
    )
    .await?;

    let port_val = portfolio_live_value(&state, target_portfolio_id).await?;
    let today = Utc::now().date_naive();
    Ok(Json(to_goal_response(goal, port_val, today)))
}

pub async fn update_goal(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path((portfolio_id, goal_id)): Path<(String, String)>,
    Json(payload): Json<UpdateGoalRequest>,
) -> Result<Json<GoalResponse>, ApiError> {
    let goal_uuid = Uuid::parse_str(&goal_id)
        .map_err(|_| ApiError::BadRequest("Invalid goalId UUID".to_string()))?;
    let (is_explicit_uuid, portfolio_ids) =
        resolve_owned_portfolio_ids(&state, auth_user.user_id, &portfolio_id).await?;

    let target_portfolio_id = if is_explicit_uuid {
        portfolio_ids[0]
    } else {
        let existing = db_get_goal(&state, goal_uuid)
            .await?
            .ok_or_else(|| ApiError::NotFound("Goal not found".to_string()))?;
        if !portfolio_ids.contains(&existing.portfolio_id) {
            return Err(ApiError::Forbidden);
        }
        existing.portfolio_id
    };

    let name_opt = match payload.name.as_deref() {
        Some(n) => {
            let trimmed = n.trim();
            if trimmed.is_empty() {
                return Err(ApiError::BadRequest(
                    "Goal name cannot be empty".to_string(),
                ));
            }
            Some(trimmed)
        }
        None => None,
    };

    let target_amount_opt = match payload.target_amount {
        Some(v) => {
            if !v.is_finite() || v <= 0.0 {
                return Err(ApiError::BadRequest(
                    "targetAmount must be greater than 0".to_string(),
                ));
            }
            Some(decimal_from_f64(v, "targetAmount")?)
        }
        None => None,
    };

    let monthly_sip_opt = match payload.monthly_sip {
        Some(v) => {
            if !v.is_finite() || v < 0.0 {
                return Err(ApiError::BadRequest(
                    "monthlySip must be non-negative".to_string(),
                ));
            }
            Some(decimal_from_f64(v, "monthlySip")?)
        }
        None => None,
    };

    let allocated_pct_opt = match payload.allocated_percentage {
        Some(v) => {
            if !v.is_finite() || !(0.0..=100.0).contains(&v) {
                return Err(ApiError::BadRequest(
                    "allocatedPercentage must be between 0 and 100".to_string(),
                ));
            }
            Some(decimal_from_f64(v, "allocatedPercentage")?)
        }
        None => None,
    };

    let target_date_opt = parse_target_date(payload.target_date.as_deref(), false)?;
    let priority_opt = normalize_priority(payload.priority.as_deref())?;

    let updated = db_update_goal(
        &state,
        goal_uuid,
        target_portfolio_id,
        UpdateGoalParams {
            name: name_opt,
            target_amount: target_amount_opt,
            target_date: target_date_opt,
            monthly_sip: monthly_sip_opt,
            priority: priority_opt.as_deref(),
            allocated_percentage: allocated_pct_opt,
        },
    )
    .await?
    .ok_or_else(|| ApiError::NotFound("Goal not found".to_string()))?;

    let port_val = portfolio_live_value(&state, target_portfolio_id).await?;
    let today = Utc::now().date_naive();
    Ok(Json(to_goal_response(updated, port_val, today)))
}

pub async fn delete_goal(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path((portfolio_id, goal_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let goal_uuid = Uuid::parse_str(&goal_id)
        .map_err(|_| ApiError::BadRequest("Invalid goalId UUID".to_string()))?;
    let (is_explicit_uuid, portfolio_ids) =
        resolve_owned_portfolio_ids(&state, auth_user.user_id, &portfolio_id).await?;

    let target_portfolio_id = if is_explicit_uuid {
        portfolio_ids[0]
    } else {
        let existing = db_get_goal(&state, goal_uuid)
            .await?
            .ok_or_else(|| ApiError::NotFound("Goal not found".to_string()))?;
        if !portfolio_ids.contains(&existing.portfolio_id) {
            return Err(ApiError::Forbidden);
        }
        existing.portfolio_id
    };

    let deleted = db_delete_goal(&state, goal_uuid, target_portfolio_id).await?;
    if !deleted {
        return Err(ApiError::NotFound("Goal not found".to_string()));
    }

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
