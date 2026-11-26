//! Health check, smart insights, and goal management endpoints.

use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};

use axum::extract::{Path, State};
use axum::routing::{get, put};
use axum::{Json, Router};
use chrono::{DateTime, NaiveDate, Utc};
use portfolio_db::entities::GoalEntity;
use portfolio_db::{GoalRepository, PgGoalRepository};
use rust_decimal::Decimal;
use rust_decimal::prelude::{FromPrimitive, ToPrimitive};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::routes::portfolio::{fetch_portfolio, resolve_target_portfolios};
use crate::services::ValuationService;
use crate::state::AppState;

/// Expected annual return rate (12% p.a.) used for server-side goal projections.
const EXPECTED_ANNUAL_RETURN_RATE: f64 = 0.12;

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

/// Server-computed goal health status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export)]
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
#[ts(export)]
pub struct GoalMetricsDto {
    #[ts(type = "number")]
    pub current_value: f64,
    #[ts(type = "number")]
    pub progress_percentage: f64,
    #[ts(type = "number")]
    pub projected_value: f64,
    #[ts(type = "number")]
    pub shortfall: f64,
    #[ts(type = "number")]
    pub surplus: f64,
    #[ts(type = "number")]
    pub required_monthly_sip: f64,
    pub remaining_days: i64,
    pub remaining_months: i64,
    pub status: GoalStatus,
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
    /// Monthly SIP contribution in INR.
    #[ts(type = "number")]
    pub monthly_sip: f64,
    /// Priority tier (`"HIGH"`, `"MEDIUM"`, `"LOW"`).
    pub priority: String,
    /// Percentage of portfolio allocated to this goal.
    #[ts(type = "number")]
    pub allocated_percentage: f64,
    /// Server-computed projection and progress metrics.
    pub metrics: GoalMetricsDto,
    /// Creation timestamp.
    pub created_at: DateTime<Utc>,
    /// Last update timestamp.
    pub updated_at: DateTime<Utc>,
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

#[derive(Debug, Clone)]
struct GoalExtras {
    monthly_sip: f64,
    priority: String,
    allocated_percentage: f64,
}

impl Default for GoalExtras {
    fn default() -> Self {
        Self {
            monthly_sip: 0.0,
            priority: "MEDIUM".to_string(),
            allocated_percentage: 100.0,
        }
    }
}

static GOAL_EXTRAS: OnceLock<RwLock<HashMap<String, GoalExtras>>> = OnceLock::new();

fn goal_extras_map() -> &'static RwLock<HashMap<String, GoalExtras>> {
    GOAL_EXTRAS.get_or_init(|| RwLock::new(HashMap::new()))
}

fn round2(val: f64) -> f64 {
    (val * 100.0).round() / 100.0
}

fn normalize_priority(raw: Option<&str>) -> Result<Option<String>, ApiError> {
    match raw {
        None => Ok(None),
        Some(s) => {
            let upper = s.trim().to_uppercase();
            match upper.as_str() {
                "HIGH" | "MEDIUM" | "LOW" => Ok(Some(upper)),
                _ => Err(ApiError::BadRequest(
                    "priority must be one of HIGH, MEDIUM, LOW".to_string(),
                )),
            }
        }
    }
}

fn compute_goal_metrics(
    target_amount: f64,
    monthly_sip: f64,
    allocated_pct: f64,
    target_date: NaiveDate,
    portfolio_value: f64,
    today: NaiveDate,
) -> GoalMetricsDto {
    let target_amount = target_amount.max(0.0);
    let monthly_sip = monthly_sip.max(0.0);
    let allocated_pct = allocated_pct.clamp(0.0, 100.0);

    let current_value = round2(portfolio_value.max(0.0) * (allocated_pct / 100.0));
    let progress_percentage = if target_amount > 0.0 {
        round2(((current_value / target_amount) * 100.0).clamp(0.0, 100.0))
    } else {
        100.0
    };

    let remaining_days = (target_date - today).num_days().max(0);
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

fn to_goal_dto(g: GoalEntity, portfolio_value: f64, today: NaiveDate) -> GoalDto {
    let extras = goal_extras_map()
        .read()
        .ok()
        .and_then(|m| m.get(&g.id).cloned())
        .unwrap_or_default();
    let target_amount = round2(g.target_amount.to_f64().unwrap_or(0.0));
    let metrics = compute_goal_metrics(
        target_amount,
        extras.monthly_sip,
        extras.allocated_percentage,
        g.target_date.date_naive(),
        portfolio_value,
        today,
    );
    GoalDto {
        id: g.id,
        portfolio_id: g.portfolio_id,
        name: g.name,
        target_amount,
        target_date: g.target_date,
        monthly_sip: round2(extras.monthly_sip),
        priority: extras.priority,
        allocated_percentage: round2(extras.allocated_percentage),
        metrics,
        created_at: g.created_at,
        updated_at: g.updated_at,
    }
}

async fn resolve_owned_portfolio_ids(
    state: &AppState,
    user_id: Uuid,
    portfolio_id: &str,
) -> Result<Vec<Uuid>, ApiError> {
    if let Ok(port_uuid) = Uuid::parse_str(portfolio_id) {
        let portfolio = fetch_portfolio(state, port_uuid)
            .await?
            .ok_or_else(|| ApiError::NotFound("Portfolio not found".to_string()))?;
        if portfolio.user_id != user_id {
            return Err(ApiError::Forbidden);
        }
        Ok(vec![port_uuid])
    } else {
        let portfolios = resolve_target_portfolios(state, user_id, portfolio_id).await?;
        Ok(portfolios.into_iter().map(|p| p.id).collect())
    }
}

async fn portfolio_live_value(state: &AppState, portfolio_id: Uuid) -> Result<f64, ApiError> {
    let snapshot = ValuationService::compute_live_valuation(state, &[portfolio_id]).await?;
    Ok(snapshot.total_value.to_f64().unwrap_or(0.0))
}

/// Lists all financial goals for the specified portfolio.
pub async fn get_goals(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(portfolio_id): Path<String>,
) -> Result<Json<Vec<GoalDto>>, ApiError> {
    let owned_ids = resolve_owned_portfolio_ids(&state, auth_user.user_id, &portfolio_id).await?;
    let today = Utc::now().date_naive();
    let mut goals = Vec::new();
    for port_uuid in owned_ids {
        let pid = port_uuid.to_string();
        let port_val = portfolio_live_value(&state, port_uuid).await?;
        let rows = if let Some(pool) = state.pool() {
            PgGoalRepository::new(pool.clone()).list_goals(&pid).await?
        } else {
            state.db.list_goals(&pid).await?
        };
        for g in rows {
            goals.push(to_goal_dto(g, port_val, today));
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
    let owned_ids = resolve_owned_portfolio_ids(&state, auth_user.user_id, &portfolio_id).await?;
    let target_port_uuid = *owned_ids
        .first()
        .ok_or_else(|| ApiError::NotFound("Portfolio not found".to_string()))?;
    let pid = target_port_uuid.to_string();
    let target_amount = Decimal::from_f64(payload.target_amount).unwrap_or(Decimal::ZERO);
    let target_date = parse_target_date(payload.target_date.as_deref());

    let monthly_sip = payload.monthly_sip.unwrap_or(0.0).max(0.0);
    let priority =
        normalize_priority(payload.priority.as_deref())?.unwrap_or_else(|| "MEDIUM".to_string());
    let allocated_percentage = payload
        .allocated_percentage
        .unwrap_or(100.0)
        .clamp(0.0, 100.0);

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

    if let Ok(mut map) = goal_extras_map().write() {
        map.insert(
            g.id.clone(),
            GoalExtras {
                monthly_sip,
                priority,
                allocated_percentage,
            },
        );
    }

    let port_val = portfolio_live_value(&state, target_port_uuid).await?;
    let today = Utc::now().date_naive();
    Ok(Json(to_goal_dto(g, port_val, today)))
}

/// Verifies that `goal_id` belongs to one of the resolved `portfolio_ids`.
async fn verify_goal_ownership(
    state: &AppState,
    portfolio_ids: &[String],
    goal_id: &str,
) -> Result<(), ApiError> {
    for pid in portfolio_ids {
        let rows = if let Some(pool) = state.pool() {
            PgGoalRepository::new(pool.clone()).list_goals(pid).await?
        } else {
            state.db.list_goals(pid).await?
        };
        if rows.iter().any(|g| g.id == goal_id) {
            return Ok(());
        }
    }
    Err(ApiError::NotFound(format!("Goal {goal_id} not found")))
}

/// Updates an existing financial goal.
pub async fn update_goal(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path((portfolio_id, goal_id)): Path<(String, String)>,
    Json(payload): Json<UpdateGoalRequest>,
) -> Result<Json<GoalDto>, ApiError> {
    let owned_ids = resolve_owned_portfolio_ids(&state, auth_user.user_id, &portfolio_id).await?;
    let portfolio_ids: Vec<String> = owned_ids.iter().map(|p| p.to_string()).collect();
    verify_goal_ownership(&state, &portfolio_ids, &goal_id).await?;
    let name = payload.name.unwrap_or_else(|| "Goal".to_string());
    let target_amount =
        Decimal::from_f64(payload.target_amount.unwrap_or(100_000.0)).unwrap_or(Decimal::ZERO);
    let target_date = parse_target_date(payload.target_date.as_deref());
    let priority_opt = normalize_priority(payload.priority.as_deref())?;

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

    if let Ok(mut map) = goal_extras_map().write() {
        let entry = map.entry(g.id.clone()).or_default();
        if let Some(sip) = payload.monthly_sip {
            entry.monthly_sip = sip.max(0.0);
        }
        if let Some(p) = priority_opt {
            entry.priority = p;
        }
        if let Some(pct) = payload.allocated_percentage {
            entry.allocated_percentage = pct.clamp(0.0, 100.0);
        }
    }

    let port_uuid = Uuid::parse_str(&g.portfolio_id)
        .map_err(|_| ApiError::Internal("Invalid portfolio_id on goal".to_string()))?;
    let port_val = portfolio_live_value(&state, port_uuid).await?;
    let today = Utc::now().date_naive();
    Ok(Json(to_goal_dto(g, port_val, today)))
}

/// Deletes a financial goal by ID.
pub async fn delete_goal(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path((portfolio_id, goal_id)): Path<(String, String)>,
) -> Result<Json<DeleteGoalResponse>, ApiError> {
    let owned_ids = resolve_owned_portfolio_ids(&state, auth_user.user_id, &portfolio_id).await?;
    let portfolio_ids: Vec<String> = owned_ids.iter().map(|p| p.to_string()).collect();
    verify_goal_ownership(&state, &portfolio_ids, &goal_id).await?;
    let deleted = if let Some(pool) = state.pool() {
        PgGoalRepository::new(pool.clone())
            .delete_goal(&goal_id)
            .await?
    } else {
        state.db.delete_goal(&goal_id).await?
    };

    if deleted && let Ok(mut map) = goal_extras_map().write() {
        map.remove(&goal_id);
    }

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
