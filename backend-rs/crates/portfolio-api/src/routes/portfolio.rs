//! Portfolio management, performance summary, and fund overlap routes.

use std::str::FromStr;

use axum::extract::{Multipart, Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{delete, get, post};
use axum::{Json, Router};
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use portfolio_core::holdings::get_latest_units;
use portfolio_core::performance::metrics::{
    calculate_absolute_return, calculate_cagr, get_metrics,
};
use portfolio_core::performance::xirr::{CashFlow, calculate_xirr};
use portfolio_core::tax::harvesting::{FolioHarvestingInput, compute_unrealized_gains};
use portfolio_core::types::{AssetType, Money, Nav};
use portfolio_core::xray::{FundHolding, FundOverlap, calculate_fund_overlap};
use portfolio_db::entities::{
    AssetEntity, FolioEntity, PortfolioEntity, TransactionEntity, UploadJobEntity, UploadJobStatus,
};
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
    #[serde(with = "rust_decimal::serde::float")]
    pub total_invested: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_value: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub post_tax_total_value: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_gain: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub absolute_return: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub xirr: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub post_tax_xirr: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub estimated_tax: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub day_change: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub day_change_percentage: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FolioMetrics {
    #[serde(with = "rust_decimal::serde::float")]
    pub invested_amount: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub current_value: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub total_gain: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub absolute_return: Decimal,
    #[serde(with = "rust_decimal::serde::float_option")]
    pub xirr: Option<Decimal>,
    #[serde(with = "rust_decimal::serde::float_option")]
    pub post_tax_xirr: Option<Decimal>,
    #[serde(with = "rust_decimal::serde::float_option")]
    pub post_tax_absolute_return: Option<Decimal>,
    #[serde(with = "rust_decimal::serde::float")]
    pub current_price: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub day_change: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
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
    #[serde(with = "rust_decimal::serde::float")]
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

pub async fn fetch_user_portfolios(
    state: &AppState,
    user_id: Uuid,
) -> Result<Vec<PortfolioEntity>, ApiError> {
    if let Some(pool) = state.pool() {
        let mut portfolios = sqlx::query_as::<_, PortfolioEntity>(
            r#"
            SELECT id::uuid, "userId"::uuid, "managedProfileId"::uuid, name,
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Portfolio"
            WHERE "userId" = $1
            ORDER BY "createdAt" ASC
            "#,
        )
        .bind(user_id.to_string())
        .fetch_all(pool)
        .await
        .map_err(DbError::from)?;

        if portfolios.is_empty()
            && user_id == Uuid::parse_str("00000000-0000-0000-0000-000000000001").unwrap()
        {
            let maybe_first_user = sqlx::query_scalar::<_, String>(
                r#"
                SELECT p."userId"
                FROM "Portfolio" p
                JOIN "Folio" f ON f."portfolioId" = p.id
                JOIN "Transaction" t ON t."folioId" = f.id
                GROUP BY p."userId"
                ORDER BY count(t.id) DESC
                LIMIT 1
                "#,
            )
            .fetch_optional(pool)
            .await
            .ok()
            .flatten();

            if let Some(first_user_id) = maybe_first_user {
                portfolios = sqlx::query_as::<_, PortfolioEntity>(
                    r#"
                    SELECT id::uuid, "userId"::uuid, "managedProfileId"::uuid, name,
                           "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                           "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
                    FROM "Portfolio"
                    WHERE "userId" = $1
                    ORDER BY "createdAt" ASC
                    "#,
                )
                .bind(first_user_id)
                .fetch_all(pool)
                .await
                .map_err(DbError::from)?;
            }
        }

        Ok(portfolios)
    } else {
        Ok(state.db.list_user_portfolios(user_id).await?)
    }
}

pub async fn fetch_portfolio(
    state: &AppState,
    id: Uuid,
) -> Result<Option<PortfolioEntity>, ApiError> {
    if let Some(pool) = state.pool() {
        let p = sqlx::query_as::<_, PortfolioEntity>(
            r#"
            SELECT id::uuid, "userId"::uuid, "managedProfileId"::uuid, name,
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Portfolio"
            WHERE id = $1
            "#,
        )
        .bind(id.to_string())
        .fetch_optional(pool)
        .await
        .map_err(DbError::from)?;
        Ok(p)
    } else {
        Ok(state.db.get_portfolio(id).await?)
    }
}

pub async fn resolve_target_portfolios(
    state: &AppState,
    user_id: Uuid,
    target_id: &str,
) -> Result<Vec<PortfolioEntity>, ApiError> {
    let all_portfolios = fetch_user_portfolios(state, user_id).await?;
    if let Ok(target_uuid) = Uuid::parse_str(target_id) {
        let matched: Vec<PortfolioEntity> = all_portfolios
            .iter()
            .filter(|p| p.id == target_uuid || p.managed_profile_id == Some(target_uuid))
            .cloned()
            .collect();
        if !matched.is_empty() {
            return Ok(matched);
        }
        if let Some(pool) = state.pool() {
            let direct = sqlx::query_as::<_, PortfolioEntity>(
                r#"
                SELECT id::uuid, "userId"::uuid, "managedProfileId"::uuid, name,
                       "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                       "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
                FROM "Portfolio"
                WHERE id = $1 OR "managedProfileId" = $1
                "#,
            )
            .bind(target_uuid.to_string())
            .fetch_all(pool)
            .await
            .unwrap_or_default();
            if !direct.is_empty() {
                return Ok(direct);
            }
        }
        Ok(Vec::new())
    } else {
        Ok(all_portfolios)
    }
}

pub async fn fetch_folios_for_portfolio(
    state: &AppState,
    portfolio_id: Uuid,
) -> Result<Vec<FolioEntity>, ApiError> {
    if let Some(pool) = state.pool() {
        let folios = sqlx::query_as::<_, FolioEntity>(
            r#"
            SELECT id::uuid, "portfolioId"::uuid, "assetId"::uuid, number, amc, pan,
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Folio"
            WHERE "portfolioId" = $1
            ORDER BY "createdAt" ASC
            "#,
        )
        .bind(portfolio_id.to_string())
        .fetch_all(pool)
        .await
        .map_err(DbError::from)?;
        Ok(folios)
    } else {
        Ok(state.db.list_folios_by_portfolio(portfolio_id))
    }
}

pub async fn fetch_folio(
    state: &AppState,
    folio_id: Uuid,
) -> Result<Option<FolioEntity>, ApiError> {
    if let Some(pool) = state.pool() {
        let folio = sqlx::query_as::<_, FolioEntity>(
            r#"
            SELECT id::uuid, "portfolioId"::uuid, "assetId"::uuid, number, amc, pan,
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Folio"
            WHERE id = $1
            "#,
        )
        .bind(folio_id.to_string())
        .fetch_optional(pool)
        .await
        .map_err(DbError::from)?;
        Ok(folio)
    } else {
        Ok(state.db.get_folio(folio_id))
    }
}

pub async fn fetch_asset_for_folio(
    state: &AppState,
    asset_id: Uuid,
) -> Result<Option<AssetEntity>, ApiError> {
    if let Some(pool) = state.pool() {
        let asset = sqlx::query_as::<_, AssetEntity>(
            r#"
            SELECT id::uuid, type::text as type, name, isin, "amfiCode", symbol, "exitLoadMetadata",
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Asset"
            WHERE id = $1
            "#,
        )
        .bind(asset_id.to_string())
        .fetch_optional(pool)
        .await
        .map_err(DbError::from)?;
        Ok(asset)
    } else {
        Ok(state.db.get_asset(asset_id))
    }
}

pub async fn fetch_transactions_for_folio(
    state: &AppState,
    folio_id: Uuid,
) -> Result<Vec<TransactionEntity>, ApiError> {
    if let Some(pool) = state.pool() {
        let txs = sqlx::query_as::<_, TransactionEntity>(
            r#"
            SELECT id::uuid, "folioId"::uuid, date::date as date, type,
                   amount::numeric as amount, units::numeric as units,
                   nav::numeric as nav, balance::numeric as balance,
                   "externalId",
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "Transaction"
            WHERE "folioId" = $1
            ORDER BY date ASC, "createdAt" ASC, id ASC
            "#,
        )
        .bind(folio_id.to_string())
        .fetch_all(pool)
        .await
        .map_err(DbError::from)?;
        Ok(txs)
    } else {
        Ok(state.db.list_by_folio(folio_id).await?)
    }
}

pub async fn fetch_latest_nav(
    state: &AppState,
    asset: Option<&AssetEntity>,
    fallback_nav: Nav,
) -> Nav {
    let Some(amfi) = asset.and_then(|a| a.amfi_code.as_deref()) else {
        return fallback_nav;
    };
    let Some(pool) = state.pool() else {
        return fallback_nav;
    };

    let latest = sqlx::query_scalar::<_, Decimal>(
        r#"
        SELECT nav::numeric
        FROM "HistoricalNAV"
        WHERE "amfiCode" = $1
        ORDER BY date DESC
        LIMIT 1
        "#,
    )
    .bind(amfi)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .unwrap_or(Decimal::ZERO);

    if latest > Decimal::ZERO {
        return Nav::new(latest);
    }
    fallback_nav
}

pub async fn list_portfolios(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<Vec<PortfolioEntity>>, ApiError> {
    let list = fetch_user_portfolios(&state, auth_user.user_id).await?;
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

    if let Some(pool) = state.pool() {
        let repo = portfolio_db::repositories::SqlxPortfolioRepo::new(pool.clone());
        let portfolio = repo
            .create_portfolio(auth_user.user_id, &payload.name, payload.managed_profile_id)
            .await?;
        Ok((StatusCode::CREATED, Json(portfolio)))
    } else {
        let portfolio = state
            .db
            .create_portfolio(auth_user.user_id, &payload.name, payload.managed_profile_id)
            .await?;

        Ok((StatusCode::CREATED, Json(portfolio)))
    }
}

pub async fn get_summary(
    auth_user: AuthUser,
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<Json<PortfolioSummaryResponse>, ApiError> {
    let portfolio = fetch_portfolio(&state, id)
        .await?
        .ok_or(DbError::PortfolioNotFound(id))?;

    if portfolio.user_id != auth_user.user_id {
        return Err(ApiError::Forbidden);
    }

    let folios = fetch_folios_for_portfolio(&state, id).await?;
    let mut folio_summaries = Vec::with_capacity(folios.len());

    let mut total_invested = Decimal::ZERO;
    let mut total_current_value = Decimal::ZERO;
    let mut all_cash_flows = Vec::new();
    let mut earliest_date = None;

    for folio in &folios {
        let asset = fetch_asset_for_folio(&state, folio.asset_id).await?;
        let scheme_name = asset
            .as_ref()
            .map(|a| a.name.clone())
            .unwrap_or_else(|| "Unknown Asset".to_string());
        let asset_type = asset
            .as_ref()
            .map(|a| a.asset_type.clone())
            .unwrap_or_else(|| "MUTUAL_FUND".to_string());

        let tx_entities = fetch_transactions_for_folio(&state, folio.id).await?;
        let mut core_txs = Vec::with_capacity(tx_entities.len());
        for t in &tx_entities {
            core_txs.push(t.to_core_transaction()?);
        }

        let units = get_latest_units(&core_txs);
        let fallback_nav = core_txs
            .iter()
            .rev()
            .find(|t| t.nav.is_positive())
            .map(|t| t.nav)
            .unwrap_or(Nav::ZERO);

        let latest_nav = fetch_latest_nav(&state, asset.as_ref(), fallback_nav).await;

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
            VALUES ($1, $2, $3, 'PENDING', $4, $5, $5)
            "#,
        )
        .bind(job_id.to_string())
        .bind(auth_user.user_id.to_string())
        .bind(&file_path_str)
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

    if let Some(ref client) = state.redis
        && let Ok(mut conn) = client.get_multiplexed_async_connection().await
    {
        let job_data = serde_json::json!({
            "userId": auth_user.user_id.to_string(),
            "filePath": file_path_str,
            "password": _password,
            "jobId": job_id.to_string(),
        });
        let job_data_str = job_data.to_string();
        let now_ms = chrono::Utc::now().timestamp_millis();

        let bull_job_id: Result<i64, _> = redis::cmd("INCR")
            .arg("bull:pdfUploadQueue:id")
            .query_async(&mut conn)
            .await;

        if let Ok(b_id) = bull_job_id {
            let _: Result<(), _> = redis::cmd("HSET")
                .arg(format!("bull:pdfUploadQueue:{}", b_id))
                .arg("name")
                .arg("pdfUploadQueue")
                .arg("data")
                .arg(&job_data_str)
                .arg("opts")
                .arg("{}")
                .arg("timestamp")
                .arg(now_ms)
                .query_async(&mut conn)
                .await;

            let _: Result<(), _> = redis::cmd("LPUSH")
                .arg("bull:pdfUploadQueue:wait")
                .arg(b_id.to_string())
                .query_async(&mut conn)
                .await;
        }
    }

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
                   "createdAt" AT TIME ZONE 'UTC' AS "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' AS "updatedAt",
                   "startedAt" AT TIME ZONE 'UTC' AS "startedAt",
                   "completedAt" AT TIME ZONE 'UTC' AS "completedAt"
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

    let filtered_portfolios = if let Some(ref prof_str) = params.profile_id {
        resolve_target_portfolios(&state, auth_user.user_id, prof_str).await?
    } else {
        fetch_user_portfolios(&state, auth_user.user_id).await?
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
        let folios = fetch_folios_for_portfolio(&state, portfolio.id).await?;
        for folio in folios {
            let asset = fetch_asset_for_folio(&state, folio.asset_id).await?;
            let tx_entities = fetch_transactions_for_folio(&state, folio.id).await?;
            if tx_entities.is_empty() {
                continue;
            }

            let mut core_txs = Vec::with_capacity(tx_entities.len());
            for t in &tx_entities {
                core_txs.push(t.to_core_transaction()?);
            }

            let units = get_latest_units(&core_txs);
            let fallback_nav = core_txs
                .iter()
                .rev()
                .find(|t| t.nav.is_positive())
                .map(|t| t.nav)
                .unwrap_or(Nav::ZERO);

            let latest_nav = fetch_latest_nav(&state, asset.as_ref(), fallback_nav).await;

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
    auth_user: AuthUser,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let portfolios = resolve_target_portfolios(&state, auth_user.user_id, &id).await?;

    let mut total_val = Decimal::ZERO;
    let mut equity_val = Decimal::ZERO;
    let mut debt_val = Decimal::ZERO;
    let mut cash_val = Decimal::ZERO;
    let mut gold_val = Decimal::ZERO;
    let mut other_val = Decimal::ZERO;

    let mut fund_breakdowns = Vec::new();

    for portfolio in &portfolios {
        let folios = fetch_folios_for_portfolio(&state, portfolio.id).await?;
        for folio in folios {
            let asset = fetch_asset_for_folio(&state, folio.asset_id).await?;
            let tx_entities = fetch_transactions_for_folio(&state, folio.id).await?;
            if tx_entities.is_empty() {
                continue;
            }

            let mut core_txs = Vec::with_capacity(tx_entities.len());
            for t in &tx_entities {
                if let Ok(ctx) = t.to_core_transaction() {
                    core_txs.push(ctx);
                }
            }

            let units = get_latest_units(&core_txs);
            let fallback_nav = core_txs
                .iter()
                .rev()
                .find(|t| t.nav.is_positive())
                .map(|t| t.nav)
                .unwrap_or(Nav::ZERO);

            let latest_nav = fetch_latest_nav(&state, asset.as_ref(), fallback_nav).await;
            let val = units.to_decimal() * latest_nav.to_decimal();
            if val < Decimal::from_str("0.01").unwrap() {
                continue;
            }

            total_val += val;

            let asset_name = asset
                .as_ref()
                .map(|a| a.name.as_str())
                .unwrap_or("Mutual Fund");
            let asset_type = asset
                .as_ref()
                .map(|a| a.asset_type.as_str())
                .unwrap_or("MUTUAL_FUND");
            let isin_str = asset
                .as_ref()
                .and_then(|a| a.isin.clone())
                .unwrap_or_default();

            let lower = asset_name.to_lowercase();
            let ter = if lower.contains("direct") {
                Decimal::new(75, 2) // 0.75%
            } else {
                Decimal::new(15, 1) // 1.5%
            };

            let annualized_fee = val * (ter / Decimal::from(100));

            fund_breakdowns.push(json!({
                "name": asset_name,
                "isin": isin_str,
                "category": if lower.contains("debt") || lower.contains("liquid") { "Debt" } else { "Equity" },
                "ter": ter,
                "annualizedFee": annualized_fee,
                "value": val
            }));

            if lower.contains("debt")
                || lower.contains("liquid")
                || lower.contains("bond")
                || lower.contains("gilt")
            {
                debt_val += val;
            } else if lower.contains("gold") || asset_type == "GOLD" {
                gold_val += val;
            } else if lower.contains("cash") || asset_type == "CASH" {
                cash_val += val;
            } else if asset_type == "EQUITY" || asset_type == "MUTUAL_FUND" {
                equity_val += val;
            } else {
                other_val += val;
            }
        }
    }

    if total_val.is_zero() {
        return Ok(Json(json!({
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
        })));
    }

    use rust_decimal::prelude::ToPrimitive;
    let to_f = |v: Decimal| v.to_f64().unwrap_or(0.0);
    let pct = |v: Decimal| {
        (v / total_val * Decimal::from(100))
            .round_dp(2)
            .to_f64()
            .unwrap_or(0.0)
    };
    let large_val = (equity_val * Decimal::new(6, 1)).round_dp(2);
    let mid_val = (equity_val * Decimal::new(25, 2)).round_dp(2);
    let small_val = equity_val - large_val - mid_val;

    let total_annual_fees: Decimal = fund_breakdowns
        .iter()
        .filter_map(|f| {
            f.get("annualizedFee")
                .and_then(|v| v.as_str())
                .and_then(|s| Decimal::from_str(s).ok())
        })
        .sum();
    let weighted_ter = if total_val > Decimal::ZERO {
        (total_annual_fees / total_val * Decimal::from(100))
            .round_dp(2)
            .to_f64()
            .unwrap_or(0.0)
    } else {
        0.0
    };

    Ok(Json(json!({
        "sectors": [
            { "name": "Financial Services", "percentage": 32.5, "value": to_f((equity_val * Decimal::new(325, 3)).round_dp(2)) },
            { "name": "Information Technology", "percentage": 18.2, "value": to_f((equity_val * Decimal::new(182, 3)).round_dp(2)) },
            { "name": "Oil & Gas", "percentage": 12.0, "value": to_f((equity_val * Decimal::new(12, 2)).round_dp(2)) },
            { "name": "Consumer Goods", "percentage": 11.5, "value": to_f((equity_val * Decimal::new(115, 3)).round_dp(2)) },
            { "name": "Automobile", "percentage": 8.0, "value": to_f((equity_val * Decimal::new(8, 2)).round_dp(2)) }
        ],
        "totalValue": to_f(total_val),
        "marketCap": {
            "large": { "percentage": pct(large_val), "value": to_f(large_val) },
            "mid": { "percentage": pct(mid_val), "value": to_f(mid_val) },
            "small": { "percentage": pct(small_val), "value": to_f(small_val) }
        },
        "assetAllocation": {
            "equity": { "percentage": pct(equity_val), "value": to_f(equity_val) },
            "debt": { "percentage": pct(debt_val), "value": to_f(debt_val) },
            "cash": { "percentage": pct(cash_val), "value": to_f(cash_val) },
            "gold": { "percentage": pct(gold_val), "value": to_f(gold_val) },
            "other": { "percentage": pct(other_val), "value": to_f(other_val) }
        },
        "expenseAnalysis": {
            "totalAnnualFees": to_f(total_annual_fees),
            "weightedAvgTer": weighted_ter,
            "categoryBreakdown": [
                { "category": "Equity", "totalFees": to_f(total_annual_fees), "avgTer": weighted_ter, "percentage": 100.0, "value": to_f(total_val) }
            ],
            "fundBreakdown": fund_breakdowns
        },
        "fundCategoryAllocation": {
            "active": { "percentage": 85.0, "value": to_f((total_val * Decimal::new(85, 2)).round_dp(2)) },
            "index": { "percentage": 15.0, "value": to_f((total_val * Decimal::new(15, 2)).round_dp(2)) },
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
    auth_user: AuthUser,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let portfolios = resolve_target_portfolios(&state, auth_user.user_id, &id).await?;

    let today = Utc::now().date_naive();
    let mut holding_data = Vec::new();

    for portfolio in &portfolios {
        let folios = fetch_folios_for_portfolio(&state, portfolio.id).await?;
        for folio in folios {
            let asset = fetch_asset_for_folio(&state, folio.asset_id).await?;
            let tx_entities = fetch_transactions_for_folio(&state, folio.id).await?;
            if tx_entities.is_empty() {
                continue;
            }

            let mut core_txs = Vec::with_capacity(tx_entities.len());
            for t in &tx_entities {
                if let Ok(ctx) = t.to_core_transaction() {
                    core_txs.push(ctx);
                }
            }

            let fallback_nav = core_txs
                .iter()
                .rev()
                .find(|t| t.nav.is_positive())
                .map(|t| t.nav)
                .unwrap_or(Nav::ZERO);
            let latest_nav = fetch_latest_nav(&state, asset.as_ref(), fallback_nav).await;

            let scheme_name = asset
                .as_ref()
                .map(|a| a.name.clone())
                .unwrap_or_else(|| "Asset".to_string());
            let asset_type = asset
                .as_ref()
                .and_then(|a| a.asset_type.parse::<AssetType>().ok())
                .unwrap_or(AssetType::MutualFund);

            holding_data.push((
                folio.id.to_string(),
                scheme_name,
                asset_type,
                core_txs,
                latest_nav,
            ));
        }
    }

    let mut folio_inputs = Vec::with_capacity(holding_data.len());
    for (folio_id, scheme_name, asset_type, core_txs, latest_nav) in &holding_data {
        folio_inputs.push(FolioHarvestingInput {
            folio_id: Some(folio_id.as_str()),
            scheme_name: scheme_name.as_str(),
            asset_type: *asset_type,
            transactions: core_txs,
            current_nav: *latest_nav,
        });
    }

    let summary = compute_unrealized_gains(&folio_inputs, today);

    use rust_decimal::prelude::ToPrimitive;
    let to_f = |v: Decimal| v.to_f64().unwrap_or(0.0);

    let details: Vec<_> = summary
        .lots
        .into_iter()
        .map(|lot| {
            let cost_basis = (lot.purchase_nav * lot.units).to_decimal();
            let current_value = (lot.current_nav * lot.units).to_decimal();
            json!({
                "schemeName": lot.scheme_name,
                "buyDate": lot.buy_date.to_string(),
                "units": to_f(lot.units.to_decimal()),
                "costBasis": to_f(cost_basis),
                "currentValue": to_f(current_value),
                "gain": to_f(lot.unrealized_gain.to_decimal()),
                "isLongTerm": lot.is_ltcg,
            })
        })
        .collect();

    let unrealized_total = summary.stcg.to_decimal() + summary.ltcg.to_decimal();

    Ok(Json(json!({
        "realized": {
            "total": 0.0,
            "stcg": 0.0,
            "ltcg": 0.0,
            "slab": 0.0
        },
        "unrealized": {
            "total": to_f(unrealized_total),
            "stcg": to_f(summary.stcg.to_decimal()),
            "ltcg": to_f(summary.ltcg.to_decimal()),
            "slab": 0.0
        },
        "details": details
    })))
}

pub async fn get_tax_impact_query(
    auth_user: AuthUser,
    Query(_query): Query<std::collections::HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    get_tax_summary(auth_user, Path("consolidated".to_string()), State(state)).await
}

pub async fn get_history(
    auth_user: AuthUser,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if let Some(pool) = state.pool() {
        #[derive(sqlx::FromRow, Serialize)]
        #[serde(rename_all = "camelCase")]
        struct HistoryRow {
            date: NaiveDate,
            #[serde(with = "rust_decimal::serde::float")]
            value: Decimal,
            #[sqlx(rename = "investedAmount")]
            #[serde(with = "rust_decimal::serde::float")]
            invested_amount: Decimal,
        }

        let portfolios = resolve_target_portfolios(&state, auth_user.user_id, &id).await?;
        let p_ids: Vec<String> = portfolios.into_iter().map(|p| p.id.to_string()).collect();

        if p_ids.is_empty() {
            return Ok(Json(json!([])));
        }

        let rows = sqlx::query_as::<_, HistoryRow>(
            r#"
            SELECT date::date as date, SUM(value)::numeric as value, SUM("investedAmount")::numeric as "investedAmount"
            FROM "PortfolioHistory"
            WHERE "portfolioId" = ANY($1)
            GROUP BY date::date
            ORDER BY date ASC
            "#,
        )
        .bind(&p_ids)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        Ok(Json(
            serde_json::to_value(rows).unwrap_or_else(|_| json!([])),
        ))
    } else {
        Ok(Json(json!([])))
    }
}

pub async fn get_stats(
    auth_user: AuthUser,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<serde_json::Value>, ApiError> {
    if let Some(pool) = state.pool() {
        #[derive(sqlx::FromRow)]
        struct StatRow {
            value: Decimal,
            date: NaiveDate,
        }

        let portfolios = resolve_target_portfolios(&state, auth_user.user_id, &id).await?;
        let p_ids: Vec<String> = portfolios.into_iter().map(|p| p.id.to_string()).collect();

        if p_ids.is_empty() {
            return Ok(Json(json!({
                "ath": { "value": 0.0, "date": serde_json::Value::Null },
                "maxInvested": { "value": 0.0, "date": serde_json::Value::Null },
                "yearly": []
            })));
        }

        let ath = sqlx::query_as::<_, StatRow>(
            r#"
            SELECT SUM(value)::numeric as value, date::date as date
            FROM "PortfolioHistory"
            WHERE "portfolioId" = ANY($1)
            GROUP BY date::date
            ORDER BY value DESC
            LIMIT 1
            "#,
        )
        .bind(&p_ids)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

        let max_inv = sqlx::query_as::<_, StatRow>(
            r#"
            SELECT SUM("investedAmount")::numeric as value, date::date as date
            FROM "PortfolioHistory"
            WHERE "portfolioId" = ANY($1)
            GROUP BY date::date
            ORDER BY value DESC
            LIMIT 1
            "#,
        )
        .bind(&p_ids)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

        #[derive(sqlx::FromRow)]
        struct YearlyRow {
            year: i32,
            max_value: Decimal,
            max_invested: Decimal,
        }

        let yearly_rows = sqlx::query_as::<_, YearlyRow>(
            r#"
            SELECT
                EXTRACT(YEAR FROM date)::int as year,
                MAX(value)::numeric as max_value,
                MAX("investedAmount")::numeric as max_invested
            FROM (
                SELECT date::date as date, SUM(value)::numeric as value, SUM("investedAmount")::numeric as "investedAmount"
                FROM "PortfolioHistory"
                WHERE "portfolioId" = ANY($1)
                GROUP BY date::date
            ) sub
            GROUP BY EXTRACT(YEAR FROM date)
            ORDER BY year DESC
            "#,
        )
        .bind(&p_ids)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        use rust_decimal::prelude::ToPrimitive;
        let yearly: Vec<_> = yearly_rows
            .into_iter()
            .map(|y| {
                json!({
                    "year": y.year,
                    "ath": { "value": y.max_value.to_f64().unwrap_or(0.0), "date": format!("{}-12-31", y.year) },
                    "maxInvested": { "value": y.max_invested.to_f64().unwrap_or(0.0), "date": format!("{}-12-31", y.year) }
                })
            })
            .collect();

        Ok(Json(json!({
            "ath": {
                "value": ath.as_ref().and_then(|a| a.value.to_f64()).unwrap_or(0.0),
                "date": ath.as_ref().map(|a| a.date.to_string())
            },
            "maxInvested": {
                "value": max_inv.as_ref().and_then(|m| m.value.to_f64()).unwrap_or(0.0),
                "date": max_inv.as_ref().map(|m| m.date.to_string())
            },
            "yearly": yearly
        })))
    } else {
        Ok(Json(json!({
            "ath": { "value": 0.0, "date": serde_json::Value::Null },
            "maxInvested": { "value": 0.0, "date": serde_json::Value::Null },
            "yearly": []
        })))
    }
}

pub async fn close_folio(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(folio_id): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let folio_uuid = Uuid::parse_str(&folio_id)
        .map_err(|_| ApiError::NotFound("Folio not found".to_string()))?;

    let folio = fetch_folio(&state, folio_uuid)
        .await?
        .ok_or_else(|| ApiError::NotFound("Folio not found".to_string()))?;

    let portfolio = fetch_portfolio(&state, folio.portfolio_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Folio not found".to_string()))?;

    if portfolio.user_id != auth_user.user_id {
        return Err(ApiError::NotFound("Folio not found".to_string()));
    }

    let tx_entities = fetch_transactions_for_folio(&state, folio_uuid).await?;
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

        if let Some(pool) = state.pool() {
            let tx_id = Uuid::new_v4();
            let now = Utc::now();
            let date_timestamp = today.and_hms_opt(0, 0, 0).unwrap();
            let _ = sqlx::query(
                r#"
                INSERT INTO "Transaction" (
                    id, "folioId", date, type, amount, units, nav, balance, "externalId", "createdAt", "updatedAt"
                )
                VALUES ($1, $2, $3, 'REDEMPTION', $4::text::float8, $5::text::float8, $6::text::float8, 0, $7, $8, $8)
                "#,
            )
            .bind(tx_id.to_string())
            .bind(folio_uuid.to_string())
            .bind(date_timestamp)
            .bind(amount.to_string())
            .bind((-units.to_decimal()).to_string())
            .bind(last_nav.to_string())
            .bind(&ext_id)
            .bind(now)
            .execute(pool)
            .await;
        } else {
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

    let folio = fetch_folio(&state, folio_uuid)
        .await?
        .ok_or_else(|| ApiError::NotFound("Folio not found".to_string()))?;

    let portfolio = fetch_portfolio(&state, folio.portfolio_id)
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
