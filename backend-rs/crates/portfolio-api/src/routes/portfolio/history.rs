//! Portfolio historical valuation timeline and all-time-high / yearly statistics route handlers.

use std::collections::BTreeMap;

use axum::Json;
use axum::extract::{Path, State};
use chrono::{Datelike, NaiveDate};
use portfolio_db::{InMemoryDatabase, PortfolioHistoryRepository};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::Serialize;
use ts_rs::TS;
use uuid::Uuid;

use super::resolve_target_portfolios;
use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::state::AppState;

/// A single historical valuation checkpoint in the portfolio timeline.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct HistoryPointDto {
    /// Valuation date (`YYYY-MM-DD`).
    pub date: NaiveDate,
    /// Market value on `date`.
    #[ts(type = "number")]
    pub value: f64,
    /// Net invested amount on `date`.
    #[ts(type = "number")]
    pub invested_amount: f64,
    /// Unrealized gain (`value - invested_amount`) on `date`.
    #[ts(type = "number")]
    pub unrealized_gain: f64,
    /// Percentage gain relative to `invested_amount`.
    #[ts(type = "number")]
    pub gain_percentage: f64,
    /// Whether this checkpoint is a new all-time high.
    pub is_ath: bool,
    /// Running all-time high value up to `date`.
    #[ts(type = "number")]
    pub ath_value: f64,
    /// Percentage drawdown from `ath_value`.
    #[ts(type = "number")]
    pub drawdown_percentage: f64,
}

/// A milestone peak (all-time high or maximum invested) with its true occurrence date.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct StatMilestoneDto {
    /// Peak value.
    #[ts(type = "number")]
    pub value: f64,
    /// Date on which the peak occurred, or `null` if no history exists.
    pub date: Option<NaiveDate>,
}

/// Annual portfolio summary milestone for a calendar year.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct YearlyStatDto {
    /// Calendar year (e.g., `2024`).
    pub year: i32,
    /// Maximum portfolio value observed during the year.
    #[ts(type = "number")]
    pub max_value: f64,
    /// Date on which `max_value` occurred.
    pub max_value_date: Option<NaiveDate>,
    /// Maximum invested amount observed during the year.
    #[ts(type = "number")]
    pub max_invested: f64,
    /// Date on which `max_invested` occurred.
    pub max_invested_date: Option<NaiveDate>,
    /// Closing portfolio value at year-end (or latest date in the year).
    #[ts(type = "number")]
    pub end_value: f64,
    /// Closing invested amount at year-end (or latest date in the year).
    #[ts(type = "number")]
    pub end_invested: f64,
}

/// Response payload for `GET /api/portfolio/:id/stats`.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct PortfolioStatsResponse {
    /// All-time high portfolio value and its date.
    pub ath: StatMilestoneDto,
    /// Maximum net invested capital and its date.
    pub max_invested: StatMilestoneDto,
    /// Per-year milestone breakdown.
    pub yearly: Vec<YearlyStatDto>,
}

type PortfolioHistoryMap = BTreeMap<NaiveDate, (Decimal, Decimal)>;

/// Computes LOCF-aligned in-memory history across multiple portfolios.
pub(crate) async fn fetch_in_memory_history(
    db: &InMemoryDatabase,
    portfolio_ids: &[Uuid],
) -> Vec<crate::services::HistoryPoint> {
    let mut per_portfolio: Vec<(Uuid, PortfolioHistoryMap)> = Vec::new();
    let mut all_dates = std::collections::BTreeSet::new();

    for &pid in portfolio_ids {
        let records =
            PortfolioHistoryRepository::get_aggregated_history(db, &[pid.to_string()], None, None)
                .await
                .unwrap_or_default();
        let mut map = BTreeMap::new();
        for rec in records {
            all_dates.insert(rec.date);
            map.insert(rec.date, (rec.value, rec.cost));
        }
        per_portfolio.push((pid, map));
    }

    let mut last_known: BTreeMap<Uuid, (Decimal, Decimal)> = BTreeMap::new();
    let mut history_points = Vec::new();

    for dt in all_dates {
        let mut total_val = Decimal::ZERO;
        let mut total_inv = Decimal::ZERO;
        for (pid, map) in &per_portfolio {
            if let Some(&(val, inv)) = map.get(&dt) {
                last_known.insert(*pid, (val, inv));
            }
            if let Some(&(val, inv)) = last_known.get(pid) {
                total_val += val;
                total_inv += inv;
            }
        }
        history_points.push(crate::services::HistoryPoint {
            date: dt,
            value: total_val,
            invested_amount: total_inv,
            unrealized_gain: total_val - total_inv,
            gain_percentage: Decimal::ZERO,
            is_ath: false,
            ath_value: Decimal::ZERO,
            drawdown_percentage: Decimal::ZERO,
        });
    }

    history_points
}

/// Fetches LOCF-aligned history points for `p_uuids` and reconciles the terminal point with live valuation.
async fn fetch_reconciled_history_points(
    state: &AppState,
    p_uuids: &[Uuid],
) -> Result<Vec<crate::services::HistoryPoint>, ApiError> {
    if p_uuids.is_empty() {
        return Ok(Vec::new());
    }

    let mut points: Vec<crate::services::HistoryPoint> = if let Some(pool) = state.pool() {
        let p_ids: Vec<String> = p_uuids
            .iter()
            .map(std::string::ToString::to_string)
            .collect();
        sqlx::query_as::<_, crate::services::HistoryPoint>(
            r#"
            WITH target_history AS (
                SELECT "portfolioId", date::date as dt, value, "investedAmount"
                FROM "PortfolioHistory"
                WHERE "portfolioId" = ANY($1)
            ),
            dates AS (
                SELECT DISTINCT dt FROM target_history
            ),
            portfolio_list AS (
                SELECT UNNEST($1::text[]) as pid
            ),
            grid AS (
                SELECT d.dt, p.pid
                FROM dates d
                CROSS JOIN portfolio_list p
            ),
            filled AS (
                SELECT g.dt, g.pid,
                       th.value, th."investedAmount",
                       COUNT(th.value) OVER (PARTITION BY g.pid ORDER BY g.dt) as val_grp,
                       COUNT(th."investedAmount") OVER (PARTITION BY g.pid ORDER BY g.dt) as inv_grp
                FROM grid g
                LEFT JOIN target_history th ON th."portfolioId" = g.pid AND th.dt = g.dt
            ),
            locf AS (
                SELECT dt, pid,
                       FIRST_VALUE(value) OVER (PARTITION BY pid, val_grp ORDER BY dt) as filled_val,
                       FIRST_VALUE("investedAmount") OVER (PARTITION BY pid, inv_grp ORDER BY dt) as filled_inv
                FROM filled
            )
            SELECT dt as date,
                   SUM(COALESCE(filled_val, 0))::numeric as value,
                   SUM(COALESCE(filled_inv, 0))::numeric as "investedAmount"
            FROM locf
            GROUP BY dt
            ORDER BY dt ASC
            "#,
        )
        .bind(&p_ids)
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    } else {
        fetch_in_memory_history(state.db().as_ref(), p_uuids).await
    };

    let live = crate::services::ValuationService::compute_live_valuation(state, p_uuids).await?;
    let today = live.as_of_date;

    if points.is_empty() {
        if !live.total_invested.is_zero() || !live.total_value.is_zero() {
            points.push(crate::services::HistoryPoint {
                date: today,
                value: live.total_value,
                invested_amount: live.total_invested,
                unrealized_gain: live.total_value - live.total_invested,
                gain_percentage: Decimal::ZERO,
                is_ath: false,
                ath_value: Decimal::ZERO,
                drawdown_percentage: Decimal::ZERO,
            });
        }
    } else if let Some(last) = points.last_mut() {
        if last.date == today {
            last.value = live.total_value;
            last.invested_amount = live.total_invested;
        } else if last.date < today {
            points.push(crate::services::HistoryPoint {
                date: today,
                value: live.total_value,
                invested_amount: live.total_invested,
                unrealized_gain: live.total_value - live.total_invested,
                gain_percentage: Decimal::ZERO,
                is_ath: false,
                ath_value: Decimal::ZERO,
                drawdown_percentage: Decimal::ZERO,
            });
        }
    }

    Ok(points)
}

/// Route handler for `GET /api/portfolio/:id/history` retrieving historical valuation timeline.
pub async fn get_history(
    auth_user: AuthUser,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<Vec<HistoryPointDto>>, ApiError> {
    let portfolios = resolve_target_portfolios(&state, auth_user.user_id, &id).await?;
    let p_uuids: Vec<Uuid> = portfolios.iter().map(|p| p.id).collect();
    let points = fetch_reconciled_history_points(&state, &p_uuids).await?;

    let mut running_ath = 0.0_f64;
    let dtos = points
        .into_iter()
        .map(|p| {
            let value = p.value.to_f64().unwrap_or(0.0);
            let invested_amount = p.invested_amount.to_f64().unwrap_or(0.0);
            let unrealized_gain = value - invested_amount;
            let gain_percentage = if invested_amount > 0.0 {
                (unrealized_gain / invested_amount) * 100.0
            } else {
                0.0
            };
            let is_ath = if value > running_ath {
                running_ath = value;
                true
            } else {
                false
            };
            let drawdown_percentage = if running_ath > 0.0 {
                ((running_ath - value) / running_ath) * 100.0
            } else {
                0.0
            };
            HistoryPointDto {
                date: p.date,
                value,
                invested_amount,
                unrealized_gain,
                gain_percentage,
                is_ath,
                ath_value: running_ath,
                drawdown_percentage,
            }
        })
        .collect();

    Ok(Json(dtos))
}

/// Route handler for `GET /api/portfolio/:id/stats` returning all-time high (ATH) and annual milestones.
pub async fn get_stats(
    auth_user: AuthUser,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<PortfolioStatsResponse>, ApiError> {
    let portfolios = resolve_target_portfolios(&state, auth_user.user_id, &id).await?;
    let p_uuids: Vec<Uuid> = portfolios.iter().map(|p| p.id).collect();
    let points = fetch_reconciled_history_points(&state, &p_uuids).await?;

    if points.is_empty() {
        return Ok(Json(PortfolioStatsResponse {
            ath: StatMilestoneDto {
                value: 0.0,
                date: None,
            },
            max_invested: StatMilestoneDto {
                value: 0.0,
                date: None,
            },
            yearly: Vec::new(),
        }));
    }

    let ath_point = points.iter().max_by_key(|p| p.value);
    let max_inv_point = points.iter().max_by_key(|p| p.invested_amount);

    let mut by_year: BTreeMap<i32, Vec<&crate::services::HistoryPoint>> = BTreeMap::new();
    for p in &points {
        by_year.entry(p.date.year()).or_default().push(p);
    }

    let yearly = by_year
        .into_iter()
        .map(|(year, year_points)| {
            let max_val_pt = year_points.iter().copied().max_by_key(|p| p.value);
            let max_inv_pt = year_points
                .iter()
                .copied()
                .max_by_key(|p| p.invested_amount);
            let end_pt = year_points.last().copied();
            YearlyStatDto {
                year,
                max_value: max_val_pt.and_then(|p| p.value.to_f64()).unwrap_or(0.0),
                max_value_date: max_val_pt.map(|p| p.date),
                max_invested: max_inv_pt
                    .and_then(|p| p.invested_amount.to_f64())
                    .unwrap_or(0.0),
                max_invested_date: max_inv_pt.map(|p| p.date),
                end_value: end_pt.and_then(|p| p.value.to_f64()).unwrap_or(0.0),
                end_invested: end_pt
                    .and_then(|p| p.invested_amount.to_f64())
                    .unwrap_or(0.0),
            }
        })
        .collect();

    Ok(Json(PortfolioStatsResponse {
        ath: StatMilestoneDto {
            value: ath_point.and_then(|p| p.value.to_f64()).unwrap_or(0.0),
            date: ath_point.map(|p| p.date),
        },
        max_invested: StatMilestoneDto {
            value: max_inv_point
                .and_then(|p| p.invested_amount.to_f64())
                .unwrap_or(0.0),
            date: max_inv_point.map(|p| p.date),
        },
        yearly,
    }))
}
