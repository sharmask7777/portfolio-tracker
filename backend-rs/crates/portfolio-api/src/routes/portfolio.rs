//! Portfolio management, performance summary, and fund overlap routes.

use std::str::FromStr;

use axum::extract::{Multipart, Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use chrono::Utc;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use portfolio_core::holdings::get_latest_units;
use portfolio_core::performance::metrics::{
    calculate_absolute_return, calculate_cagr, get_metrics,
};
use portfolio_core::performance::xirr::{CashFlow, calculate_xirr};
use portfolio_core::types::{Money, Nav};
use portfolio_core::xray::{FundHolding, FundOverlap, calculate_fund_overlap};
use portfolio_db::entities::{PortfolioEntity, UploadJobEntity, UploadJobStatus};
use portfolio_db::error::DbError;
use portfolio_db::repositories::{PortfolioRepository, TransactionRepository};

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePortfolioRequest {
    pub name: String,
    pub managed_profile_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OverlapQuery {
    pub isin_a: String,
    pub isin_b: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryParams {
    pub profile_id: Option<String>,
    pub tax_slab: Option<Decimal>,
    pub family_group_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryMetrics {
    pub total_invested: Decimal,
    pub total_value: Decimal,
    pub post_tax_total_value: Decimal,
    pub total_gain: Decimal,
    pub absolute_return: Decimal,
    pub xirr: Decimal,
    pub post_tax_xirr: Decimal,
    pub estimated_tax: Decimal,
    pub day_change: Decimal,
    pub day_change_percentage: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolioMetrics {
    pub invested_amount: Decimal,
    pub current_value: Decimal,
    pub total_gain: Decimal,
    pub absolute_return: Decimal,
    pub xirr: Option<Decimal>,
    pub post_tax_xirr: Option<Decimal>,
    pub post_tax_absolute_return: Option<Decimal>,
    pub current_price: Decimal,
    pub day_change: Decimal,
    pub day_change_percentage: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrichedFolio {
    pub id: Uuid,
    pub number: String,
    pub amc: Option<String>,
    pub pan: Option<String>,
    pub portfolio_id: Uuid,
    pub asset_id: Uuid,
    pub asset: Option<portfolio_db::entities::AssetEntity>,
    pub transactions: Vec<portfolio_db::entities::TransactionEntity>,
    pub metrics: FolioMetrics,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConsolidatedSummaryResponse {
    pub id: String,
    pub name: String,
    pub folios: Vec<EnrichedFolio>,
    pub closed_folios: Vec<EnrichedFolio>,
    pub tax_slab: Decimal,
    pub metrics: SummaryMetrics,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateManualAssetRequest {
    pub r#type: String,
    pub name: String,
    #[serde(deserialize_with = "deserialize_number_or_string")]
    pub units: Decimal,
    pub balance_date: Option<String>,
    pub profile_id: Option<String>,
}

fn deserialize_number_or_string<'de, D>(deserializer: D) -> Result<Decimal, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let val = serde_json::Value::deserialize(deserializer)?;
    match val {
        serde_json::Value::Number(n) => {
            Decimal::from_str(&n.to_string()).map_err(serde::de::Error::custom)
        }
        serde_json::Value::String(s) => Decimal::from_str(&s).map_err(serde::de::Error::custom),
        _ => Err(serde::de::Error::custom("expected number or string")),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolioSummary {
    pub folio_id: Uuid,
    pub folio_number: String,
    pub scheme_name: String,
    pub asset_type: String,
    pub units: Decimal,
    pub current_price: Decimal,
    pub invested_amount: Decimal,
    pub current_value: Decimal,
    pub total_gain: Decimal,
    pub absolute_return: Decimal,
    pub cagr: Option<Decimal>,
    pub xirr: Option<Decimal>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioSummaryResponse {
    pub portfolio_id: Uuid,
    pub name: String,
    pub invested_amount: Decimal,
    pub current_value: Decimal,
    pub total_gain: Decimal,
    pub absolute_return: Decimal,
    pub cagr: Option<Decimal>,
    pub xirr: Option<Decimal>,
    pub folios: Vec<FolioSummary>,
}

pub async fn list_portfolios(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<PortfolioEntity>>, ApiError> {
    let list = state.db.list_user_portfolios(auth_user.user_id).await?;
    Ok(Json(list))
}

pub async fn create_portfolio(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreatePortfolioRequest>,
) -> Result<(StatusCode, Json<PortfolioEntity>), ApiError> {
    if payload.name.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Portfolio name is required".to_string(),
        ));
    }

    let portfolio = state
        .db
        .create_portfolio(auth_user.user_id, &payload.name, payload.managed_profile_id)
        .await?;

    Ok((StatusCode::CREATED, Json(portfolio)))
}

pub async fn get_summary(
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<PortfolioSummaryResponse>, ApiError> {
    let portfolio = state
        .db
        .get_portfolio(id)
        .await?
        .ok_or(DbError::PortfolioNotFound(id))?;

    if portfolio.user_id != auth_user.user_id {
        return Err(ApiError::Forbidden);
    }

    let folios = state.db.list_folios_by_portfolio(id);
    let mut folio_summaries = Vec::with_capacity(folios.len());

    let mut total_invested = Decimal::ZERO;
    let mut total_current_value = Decimal::ZERO;
    let mut all_cash_flows = Vec::new();
    let mut earliest_date = None;

    for folio in &folios {
        let asset = state.db.get_asset(folio.asset_id);
        let scheme_name = asset
            .as_ref()
            .map(|a| a.name.clone())
            .unwrap_or_else(|| "Unknown Asset".to_string());
        let asset_type = asset
            .as_ref()
            .map(|a| a.asset_type.clone())
            .unwrap_or_else(|| "MUTUAL_FUND".to_string());

        let tx_entities = state.db.list_by_folio(folio.id).await?;
        let mut core_txs = Vec::with_capacity(tx_entities.len());
        for t in &tx_entities {
            core_txs.push(t.to_core_transaction()?);
        }

        let units = get_latest_units(&core_txs);
        let latest_nav = core_txs
            .iter()
            .rev()
            .find(|t| t.nav.is_positive())
            .map(|t| t.nav)
            .unwrap_or(Nav::ZERO);

        let metrics = get_metrics(&core_txs, latest_nav, None);

        let inv_dec = metrics.invested_amount.to_decimal();
        let val_dec = metrics.current_value.to_decimal();
        total_invested += inv_dec;
        total_current_value += val_dec;

        for tx in &core_txs {
            let flow_amount = if tx.tx_type.is_outflow() {
                -tx.amount.abs().to_decimal()
            } else if tx.tx_type.is_inflow() {
                tx.amount.abs().to_decimal()
            } else {
                tx.amount.to_decimal()
            };
            all_cash_flows.push(CashFlow::new(tx.date, flow_amount));

            earliest_date = match earliest_date {
                None => Some(tx.date),
                Some(prev) => Some(std::cmp::min(prev, tx.date)),
            };
        }

        folio_summaries.push(FolioSummary {
            folio_id: folio.id,
            folio_number: folio.number.clone(),
            scheme_name,
            asset_type,
            units: units.to_decimal(),
            current_price: latest_nav.to_decimal(),
            invested_amount: inv_dec,
            current_value: val_dec,
            total_gain: metrics.total_gain.to_decimal(),
            absolute_return: metrics.absolute_return,
            cagr: metrics.cagr,
            xirr: metrics.xirr,
        });
    }

    let today = Utc::now().date_naive();
    let total_gain = total_current_value - total_invested;
    let absolute_return =
        calculate_absolute_return(Money::new(total_invested), Money::new(total_current_value));

    let cagr = if let Some(start) = earliest_date {
        if start < today && total_invested > Decimal::ZERO {
            calculate_cagr(
                Money::new(total_invested),
                Money::new(total_current_value),
                start,
                today,
            )
            .ok()
        } else {
            None
        }
    } else {
        None
    };

    if total_current_value > Decimal::ZERO {
        all_cash_flows.push(CashFlow::new(today, total_current_value));
    }
    let xirr = calculate_xirr(&all_cash_flows).ok();

    Ok(Json(PortfolioSummaryResponse {
        portfolio_id: portfolio.id,
        name: portfolio.name,
        invested_amount: total_invested,
        current_value: total_current_value,
        total_gain,
        absolute_return,
        cagr,
        xirr,
        folios: folio_summaries,
    }))
}

pub async fn get_overlap(
    Query(params): Query<OverlapQuery>,
) -> Result<Json<FundOverlap>, ApiError> {
    let (name_a, holdings_a) = get_fund_holdings_for_isin(&params.isin_a);
    let (name_b, holdings_b) = get_fund_holdings_for_isin(&params.isin_b);

    let overlap = calculate_fund_overlap(&name_a, &holdings_a, &name_b, &holdings_b);
    Ok(Json(overlap))
}

fn get_fund_holdings_for_isin(isin: &str) -> (String, Vec<FundHolding>) {
    use std::str::FromStr;
    let dec = |s: &str| Decimal::from_str(s).unwrap();

    match isin {
        "INF179K01BE2" => (
            "HDFC Top 100 Fund".to_string(),
            vec![
                FundHolding::new("HDFC Bank Ltd.", dec("9.8")),
                FundHolding::new("ICICI Bank Ltd.", dec("8.2")),
                FundHolding::new("Reliance Industries Ltd.", dec("7.5")),
                FundHolding::new("Infosys Ltd.", dec("6.0")),
                FundHolding::new("Tata Consultancy Services Ltd.", dec("4.5")),
            ],
        ),
        "INF209K01157" => (
            "SBI Large Cap Fund".to_string(),
            vec![
                FundHolding::new("HDFC Bank Limited", dec("8.5")),
                FundHolding::new("Reliance Industries Limited", dec("9.0")),
                FundHolding::new("Infosys Limited", dec("7.0")),
                FundHolding::new("ICICI Bank Limited", dec("5.5")),
                FundHolding::new("Bharti Airtel Ltd.", dec("4.0")),
            ],
        ),
        "INF769K01DP4" => (
            "Mirae Asset Large Cap Fund".to_string(),
            vec![
                FundHolding::new("HDFC Bank Ltd.", dec("9.0")),
                FundHolding::new("ICICI Bank Ltd.", dec("7.8")),
                FundHolding::new("Reliance Industries Ltd.", dec("8.0")),
                FundHolding::new("Infosys Ltd.", dec("6.5")),
                FundHolding::new("Larsen & Toubro Ltd.", dec("4.0")),
            ],
        ),
        other => {
            let name = format!("Fund {}", other);
            let holdings = vec![
                FundHolding::new("HDFC Bank Ltd.", dec("10.0")),
                FundHolding::new("Reliance Industries Ltd.", dec("8.0")),
                FundHolding::new("Infosys Ltd.", dec("7.0")),
            ];
            (name, holdings)
        }
    }
}

use tokio::io::AsyncWriteExt;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadPdfResponse {
    pub job_id: String,
    pub message: String,
}

pub async fn upload_pdf(
    auth_user: AuthUser,
    State(state): State<AppState>,
    mut multipart: Multipart,
) -> Result<(StatusCode, Json<UploadPdfResponse>), ApiError> {
    let job_id = Uuid::new_v4();
    let uploads_dir = std::env::var("UPLOADS_DIR").unwrap_or_else(|_| "uploads".to_string());
    tokio::fs::create_dir_all(&uploads_dir)
        .await
        .map_err(|e| ApiError::Internal(e.to_string()))?;

    let file_path = std::path::Path::new(&uploads_dir).join(format!("{job_id}.pdf"));
    let file_path_str = file_path.to_string_lossy().to_string();

    let mut bytes_written = 0usize;
    let mut file_created = false;
    let mut _password: Option<String> = None;

    while let Some(mut field) = multipart
        .next_field()
        .await
        .map_err(|e| ApiError::BadRequest(e.to_string()))?
    {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "password" => {
                if let Ok(bytes) = field.bytes().await {
                    _password = Some(String::from_utf8_lossy(&bytes).to_string());
                }
            }
            "file" => {
                let mut dest = tokio::fs::File::create(&file_path)
                    .await
                    .map_err(|e| ApiError::Internal(e.to_string()))?;
                file_created = true;
                while let Some(chunk) = field
                    .chunk()
                    .await
                    .map_err(|e| ApiError::BadRequest(e.to_string()))?
                {
                    bytes_written += chunk.len();
                    dest.write_all(&chunk)
                        .await
                        .map_err(|e| ApiError::Internal(e.to_string()))?;
                }
                dest.flush()
                    .await
                    .map_err(|e| ApiError::Internal(e.to_string()))?;
            }
            _ => {}
        }
    }

    if !file_created || bytes_written == 0 {
        if file_created {
            let _ = tokio::fs::remove_file(&file_path).await;
        }
        return Err(ApiError::ValidationFailed("No file uploaded".to_string()));
    }

    let now = Utc::now();
    let job = UploadJobEntity {
        id: job_id,
        user_id: auth_user.user_id,
        file_path: file_path_str.clone(),
        status: UploadJobStatus::Pending,
        message: None,
        created_at: now,
        updated_at: now,
        started_at: None,
        completed_at: None,
    };

    if let Some(pool) = state.pool() {
        let insert_res = sqlx::query(
            r#"
            INSERT INTO "UploadJob" ("id", "userId", "filePath", "status", "message", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $6)
            "#,
        )
        .bind(job_id.to_string())
        .bind(auth_user.user_id.to_string())
        .bind(&file_path_str)
        .bind("PENDING")
        .bind(None::<String>)
        .bind(now)
        .execute(pool)
        .await;

        if let Err(e) = insert_res {
            let _ = tokio::fs::remove_file(&file_path).await;
            return Err(DbError::from(e).into());
        }
    }

    state.db.insert_upload_job(job);

    Ok((
        StatusCode::ACCEPTED,
        Json(UploadPdfResponse {
            job_id: job_id.to_string(),
            message: "PDF upload accepted and processing has started.".to_string(),
        }),
    ))
}

pub async fn get_upload_status(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(job_id): Path<Uuid>,
) -> Result<Json<UploadJobEntity>, ApiError> {
    let job = if let Some(pool) = state.pool() {
        let opt = sqlx::query_as::<_, UploadJobEntity>(
            r#"
            SELECT id::uuid, "userId"::uuid, "filePath", status, message,
                   "createdAt", "updatedAt", "startedAt", "completedAt"
            FROM "UploadJob"
            WHERE id = $1
            "#,
        )
        .bind(job_id.to_string())
        .fetch_optional(pool)
        .await
        .map_err(DbError::from)?;

        opt.or_else(|| state.db.get_upload_job(job_id))
    } else {
        state.db.get_upload_job(job_id)
    };

    let job = job.ok_or_else(|| ApiError::NotFound("Job not found".to_string()))?;

    if job.user_id != auth_user.user_id {
        return Err(ApiError::NotFound("Job not found".to_string()));
    }

    Ok(Json(job))
}

pub async fn get_portfolio_summary(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Query(params): Query<SummaryParams>,
) -> Result<Json<ConsolidatedSummaryResponse>, ApiError> {
    let slab_value = params.tax_slab.unwrap_or_else(|| Decimal::new(3, 1));
    let res_id = params
        .profile_id
        .clone()
        .or_else(|| params.family_group_id.clone())
        .unwrap_or_else(|| "consolidated".to_string());
    let res_name = if params.profile_id.is_some() {
        "Member View".to_string()
    } else if params.family_group_id.is_some() {
        "Family Portfolio".to_string()
    } else {
        "Consolidated Portfolio".to_string()
    };

    let user_portfolios = state.db.list_user_portfolios(auth_user.user_id).await?;
    let filtered_portfolios: Vec<_> = if let Some(ref prof_str) = params.profile_id {
        if let Ok(prof_uuid) = Uuid::parse_str(prof_str) {
            user_portfolios
                .into_iter()
                .filter(|p| p.managed_profile_id == Some(prof_uuid))
                .collect()
        } else {
            Vec::new()
        }
    } else {
        user_portfolios
    };

    if filtered_portfolios.is_empty() {
        return Ok(Json(ConsolidatedSummaryResponse {
            id: res_id,
            name: res_name,
            folios: Vec::new(),
            closed_folios: Vec::new(),
            tax_slab: slab_value,
            metrics: SummaryMetrics {
                total_invested: Decimal::ZERO,
                total_value: Decimal::ZERO,
                post_tax_total_value: Decimal::ZERO,
                total_gain: Decimal::ZERO,
                absolute_return: Decimal::ZERO,
                xirr: Decimal::ZERO,
                post_tax_xirr: Decimal::ZERO,
                estimated_tax: Decimal::ZERO,
                day_change: Decimal::ZERO,
                day_change_percentage: Decimal::ZERO,
            },
        }));
    }

    let mut active_folios = Vec::new();
    let mut closed_folios = Vec::new();
    let mut total_invested = Decimal::ZERO;
    let mut total_current_value = Decimal::ZERO;
    let mut all_cash_flows = Vec::new();

    for portfolio in &filtered_portfolios {
        let folios = state.db.list_folios_by_portfolio(portfolio.id);
        for folio in folios {
            let asset = state.db.get_asset(folio.asset_id);
            let tx_entities = state.db.list_by_folio(folio.id).await?;
            if tx_entities.is_empty() {
                continue;
            }

            let mut core_txs = Vec::with_capacity(tx_entities.len());
            for t in &tx_entities {
                core_txs.push(t.to_core_transaction()?);
            }

            let units = get_latest_units(&core_txs);
            let latest_nav = core_txs
                .iter()
                .rev()
                .find(|t| t.nav.is_positive())
                .map(|t| t.nav)
                .unwrap_or(Nav::ZERO);

            let metrics = get_metrics(&core_txs, latest_nav, None);
            let inv_dec = metrics.invested_amount.to_decimal();
            let val_dec = metrics.current_value.to_decimal();

            let folio_metrics = FolioMetrics {
                invested_amount: inv_dec,
                current_value: val_dec,
                total_gain: metrics.total_gain.to_decimal(),
                absolute_return: metrics.absolute_return,
                xirr: metrics.xirr,
                post_tax_xirr: metrics.xirr,
                post_tax_absolute_return: Some(metrics.absolute_return),
                current_price: latest_nav.to_decimal(),
                day_change: Decimal::ZERO,
                day_change_percentage: Decimal::ZERO,
            };

            let is_active = units.to_decimal()
                >= Decimal::from_str("0.001").unwrap_or(Decimal::ZERO)
                && val_dec >= Decimal::from_str("0.01").unwrap_or(Decimal::ZERO);

            let enriched = EnrichedFolio {
                id: folio.id,
                number: folio.number.clone(),
                amc: folio.amc.clone(),
                pan: folio.pan.clone(),
                portfolio_id: folio.portfolio_id,
                asset_id: folio.asset_id,
                asset,
                transactions: tx_entities,
                metrics: folio_metrics,
            };

            for tx in &core_txs {
                let flow_amount = if tx.tx_type.is_outflow() {
                    -tx.amount.abs().to_decimal()
                } else if tx.tx_type.is_inflow() {
                    tx.amount.abs().to_decimal()
                } else {
                    tx.amount.to_decimal()
                };
                all_cash_flows.push(CashFlow::new(tx.date, flow_amount));
            }

            if is_active {
                total_invested += inv_dec;
                total_current_value += val_dec;
                active_folios.push(enriched);
            } else {
                closed_folios.push(enriched);
            }
        }
    }

    let today = Utc::now().date_naive();
    if total_current_value > Decimal::ZERO {
        all_cash_flows.push(CashFlow::new(today, total_current_value));
    }
    let overall_xirr = calculate_xirr(&all_cash_flows)
        .ok()
        .unwrap_or(Decimal::ZERO);
    let total_gain = total_current_value - total_invested;
    let absolute_return = if total_invested > Decimal::ZERO {
        total_gain / total_invested
    } else {
        Decimal::ZERO
    };

    Ok(Json(ConsolidatedSummaryResponse {
        id: res_id,
        name: res_name,
        folios: active_folios,
        closed_folios,
        tax_slab: slab_value,
        metrics: SummaryMetrics {
            total_invested,
            total_value: total_current_value,
            post_tax_total_value: total_current_value,
            total_gain,
            absolute_return,
            xirr: overall_xirr,
            post_tax_xirr: overall_xirr,
            estimated_tax: Decimal::ZERO,
            day_change: Decimal::ZERO,
            day_change_percentage: Decimal::ZERO,
        },
    }))
}

pub async fn get_xray(
    _auth_user: AuthUser,
    Path(_id): Path<String>,
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(json!({
        "sectors": [],
        "totalValue": 0.0,
        "marketCap": {
            "large": { "percentage": 0.0, "value": 0.0 },
            "mid": { "percentage": 0.0, "value": 0.0 },
            "small": { "percentage": 0.0, "value": 0.0 }
        },
        "assetAllocation": {
            "equity": { "percentage": 0.0, "value": 0.0 },
            "debt": { "percentage": 0.0, "value": 0.0 },
            "cash": { "percentage": 0.0, "value": 0.0 },
            "gold": { "percentage": 0.0, "value": 0.0 },
            "other": { "percentage": 0.0, "value": 0.0 }
        },
        "expenseAnalysis": {
            "totalAnnualFees": 0.0,
            "weightedAvgTer": 0.0,
            "categoryBreakdown": [],
            "fundBreakdown": []
        },
        "fundCategoryAllocation": {
            "active": { "percentage": 0.0, "value": 0.0 },
            "index": { "percentage": 0.0, "value": 0.0 },
            "arbitrage": { "percentage": 0.0, "value": 0.0 },
            "other": { "percentage": 0.0, "value": 0.0 }
        }
    })))
}

pub async fn get_exposures(
    _auth_user: AuthUser,
    Path(_id): Path<String>,
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(json!([])))
}

pub async fn get_tax_summary(
    _auth_user: AuthUser,
    Path(_id): Path<String>,
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(json!({
        "realized": {
            "total": 0.0,
            "stcg": 0.0,
            "ltcg": 0.0,
            "slab": 0.0
        },
        "unrealized": {
            "total": 0.0,
            "stcg": 0.0,
            "ltcg": 0.0,
            "slab": 0.0
        },
        "details": []
    })))
}

pub async fn get_tax_impact_query(
    _auth_user: AuthUser,
    Query(_query): Query<std::collections::HashMap<String, String>>,
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(json!({
        "realized": {
            "total": 0.0,
            "stcg": 0.0,
            "ltcg": 0.0,
            "slab": 0.0
        },
        "unrealized": {
            "total": 0.0,
            "stcg": 0.0,
            "ltcg": 0.0,
            "slab": 0.0
        },
        "details": []
    })))
}

pub async fn get_history(
    _auth_user: AuthUser,
    Path(_id): Path<String>,
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(json!([])))
}

pub async fn get_stats(
    _auth_user: AuthUser,
    Path(_id): Path<String>,
    State(_state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    Ok(Json(json!({
        "ath": { "value": 0.0, "date": serde_json::Value::Null },
        "maxInvested": { "value": 0.0, "date": serde_json::Value::Null },
        "yearly": []
    })))
}

pub async fn close_folio(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(folio_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let folio_uuid = Uuid::parse_str(&folio_id)
        .map_err(|_| ApiError::NotFound("Folio not found".to_string()))?;

    let folio = state
        .db
        .get_folio(folio_uuid)
        .ok_or_else(|| ApiError::NotFound("Folio not found".to_string()))?;

    let portfolio = state
        .db
        .get_portfolio(folio.portfolio_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Folio not found".to_string()))?;

    if portfolio.user_id != auth_user.user_id {
        return Err(ApiError::NotFound("Folio not found".to_string()));
    }

    let tx_entities = state.db.list_by_folio(folio_uuid).await?;
    let mut core_txs = Vec::with_capacity(tx_entities.len());
    for t in &tx_entities {
        core_txs.push(t.to_core_transaction()?);
    }

    let units = get_latest_units(&core_txs);
    if units.to_decimal() > Decimal::from_str("0.001").unwrap_or(Decimal::ZERO) {
        let last_nav = core_txs
            .iter()
            .rev()
            .find(|t| t.nav.is_positive())
            .map(|t| t.nav.to_decimal())
            .unwrap_or(Decimal::ONE);
        let today = Utc::now().date_naive();
        let amount = -(units.to_decimal() * last_nav);
        let ext_id = format!(
            "MANUAL_CLOSE-{folio_uuid}-{}",
            Utc::now().timestamp_millis()
        );

        state
            .db
            .create_transaction(
                folio_uuid,
                today,
                "REDEMPTION",
                amount,
                -units.to_decimal(),
                last_nav,
                Decimal::ZERO,
                Some(&ext_id),
            )
            .await?;
    }

    Ok(Json(json!({ "status": "success" })))
}

pub async fn delete_folio(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(folio_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let folio_uuid = Uuid::parse_str(&folio_id)
        .map_err(|_| ApiError::NotFound("Folio not found".to_string()))?;

    let folio = state
        .db
        .get_folio(folio_uuid)
        .ok_or_else(|| ApiError::NotFound("Folio not found".to_string()))?;

    let portfolio = state
        .db
        .get_portfolio(folio.portfolio_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Folio not found".to_string()))?;

    if portfolio.user_id != auth_user.user_id {
        return Err(ApiError::NotFound("Folio not found".to_string()));
    }

    state.db.delete_folio(folio_uuid);

    if let Some(pool) = state.pool() {
        let _ = sqlx::query(r#"DELETE FROM "Transaction" WHERE "folioId" = $1"#)
            .bind(folio_uuid.to_string())
            .execute(pool)
            .await;
        let _ = sqlx::query(r#"DELETE FROM "Folio" WHERE id = $1"#)
            .bind(folio_uuid.to_string())
            .execute(pool)
            .await;
    }

    Ok(Json(json!({ "status": "success" })))
}

pub async fn purge_user_data(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    state.db.purge_user_data(auth_user.user_id);

    if let Some(pool) = state.pool() {
        let mut tx = pool.begin().await.map_err(DbError::from)?;
        let user_id_str = auth_user.user_id.to_string();
        let _ = sqlx::query(
            r#"DELETE FROM "Goal" WHERE "portfolioId" IN (SELECT id FROM "Portfolio" WHERE "userId" = $1)"#,
        )
        .bind(&user_id_str)
        .execute(&mut *tx)
        .await;
        let _ = sqlx::query(
            r#"DELETE FROM "Transaction" WHERE "folioId" IN (SELECT f.id FROM "Folio" f JOIN "Portfolio" p ON f."portfolioId" = p.id WHERE p."userId" = $1)"#,
        )
        .bind(&user_id_str)
        .execute(&mut *tx)
        .await;
        let _ = sqlx::query(
            r#"DELETE FROM "Folio" WHERE "portfolioId" IN (SELECT id FROM "Portfolio" WHERE "userId" = $1)"#,
        )
        .bind(&user_id_str)
        .execute(&mut *tx)
        .await;
        let _ = sqlx::query(r#"DELETE FROM "Portfolio" WHERE "userId" = $1"#)
            .bind(&user_id_str)
            .execute(&mut *tx)
            .await;
        let _ = sqlx::query(r#"DELETE FROM "ManagedProfile" WHERE "userId" = $1"#)
            .bind(&user_id_str)
            .execute(&mut *tx)
            .await;
        let _ = tx.commit().await;
    }

    Ok(Json(json!({
        "status": "success",
        "message": "All user data has been purged."
    })))
}

pub async fn create_manual_asset(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<CreateManualAssetRequest>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let user_id = auth_user.user_id;
    let user_portfolios = state.db.list_user_portfolios(user_id).await?;
    let target_prof_id = payload
        .profile_id
        .as_deref()
        .and_then(|p| Uuid::parse_str(p).ok());

    let portfolio = if let Some(prof_id) = target_prof_id {
        if let Some(p) = user_portfolios
            .into_iter()
            .find(|p| p.managed_profile_id == Some(prof_id))
        {
            p
        } else {
            state
                .db
                .create_portfolio(user_id, "Family Member Portfolio", Some(prof_id))
                .await?
        }
    } else if let Some(p) = user_portfolios
        .into_iter()
        .find(|p| p.managed_profile_id.is_none())
    {
        p
    } else {
        state
            .db
            .create_portfolio(user_id, "Primary Portfolio", None)
            .await?
    };

    let now_ts = Utc::now().timestamp_millis();
    let symbol = format!("{}_{}", payload.r#type, now_ts);
    let asset = state.db.create_asset(
        &payload.r#type,
        &payload.name,
        None,
        None,
        Some(&symbol),
        None,
    );

    let folio_num = format!("MANUAL_{now_ts}");
    let folio = state
        .db
        .create_folio(portfolio.id, asset.id, &folio_num, None, None)?;

    let balance_date = payload
        .balance_date
        .as_deref()
        .and_then(|d| chrono::NaiveDate::parse_from_str(d, "%Y-%m-%d").ok())
        .unwrap_or_else(|| Utc::now().date_naive());

    state
        .db
        .create_transaction(
            folio.id,
            balance_date,
            "PURCHASE",
            payload.units,
            payload.units,
            Decimal::ONE,
            payload.units,
            None,
        )
        .await?;

    Ok(Json(json!({
        "status": "success",
        "assetId": asset.id.to_string()
    })))
}

pub async fn delete_manual_asset(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(folio_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    delete_folio(auth_user, State(state), Path(folio_id)).await
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(list_portfolios).post(create_portfolio))
        .route(
            "/upload",
            post(upload_pdf).layer(axum::extract::DefaultBodyLimit::max(50 * 1024 * 1024)),
        )
        .route("/upload-status/{id}", get(get_upload_status))
        .route("/overlap", get(get_overlap))
        .route("/summary", get(get_portfolio_summary))
        .route("/manual-asset", post(create_manual_asset))
        .route("/manual-asset/{folioId}", delete(delete_manual_asset))
        .route("/folio/{folioId}", delete(delete_folio))
        .route("/folio/{folioId}/close", post(close_folio))
        .route("/purge", delete(purge_user_data))
        .route("/tax-impact", get(get_tax_impact_query))
        .route("/{id}/tax-impact", get(get_tax_summary))
        .route("/{id}/tax-summary", get(get_tax_summary))
        .route("/{id}/xray", get(get_xray))
        .route("/{id}/exposures", get(get_exposures))
        .route("/{id}/history", get(get_history))
        .route("/{id}/stats", get(get_stats))
        .route("/{id}/summary", get(get_summary))
}
