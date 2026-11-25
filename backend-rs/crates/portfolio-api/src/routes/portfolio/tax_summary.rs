//! Portfolio tax summary, Schedule CG ITR verification, and CSV export route handlers.

use std::collections::{BTreeSet, HashMap};
use std::str::FromStr;

use axum::Json;
use axum::extract::{Path, Query, State};
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::IntoResponse;
use chrono::{Datelike, NaiveDate, Utc};
use portfolio_core::tax::{
    AdvanceTaxAccrualMatrix, GRANDFATHER_DATE, SectionTotalsMap, TaxCategorySummary, TaxReport,
    build_advance_tax_matrix, build_section_totals, calculate_portfolio_tax,
    generate_itr_schedule_cg_csv, verify_itr_invariants,
};
use portfolio_core::types::{AssetType, FolioNumber, Isin, Money, Pan};
use portfolio_db::PortfolioRepository;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::Serialize;
use ts_rs::TS;

use super::{fetch_historical_nav_by_date, fetch_latest_nav, resolve_target_portfolios};
use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::state::AppState;

/// Query parameters for tax summary and Schedule CG CSV endpoints.
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxSummaryQuery {
    /// Optional Indian Financial Year filter (e.g., `"2024-25"`).
    pub fy: Option<String>,
    /// Optional marginal income tax slab rate as a decimal (e.g., `"0.30"`).
    pub tax_slab: Option<String>,
}

/// Serialized realized capital gain lot detail for HTTP/TS contract parity.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RealizedGainDetailDto {
    /// Scheme or asset name.
    pub asset_name: String,
    /// Folio number, if available.
    pub folio_number: Option<String>,
    /// Scheme ISIN, if available.
    pub isin: Option<String>,
    /// Investor PAN, if available.
    pub pan: Option<String>,
    /// Asset class label.
    pub asset_class: String,
    /// Statutory Income Tax Act section (e.g., `"112A"`, `"111A"`, `"50AA"`).
    pub section: String,
    /// Acquisition date (`YYYY-MM-DD`).
    pub buy_date: String,
    /// Redemption/sale date (`YYYY-MM-DD`).
    pub sell_date: String,
    /// Holding period in calendar days.
    pub holding_period_days: i64,
    /// Holding classification (`"LTCG"` or `"STCG"`).
    pub holding_type: String,
    /// Redeemed units.
    #[ts(type = "number")]
    pub units: f64,
    /// Acquisition NAV per unit.
    #[ts(type = "number")]
    pub buy_nav: f64,
    /// Redemption NAV per unit.
    #[ts(type = "number")]
    pub sell_nav: f64,
    /// Gross sale consideration.
    #[ts(type = "number")]
    pub gross_consideration: f64,
    /// Original cost of acquisition.
    #[ts(type = "number")]
    pub cost_of_acquisition: f64,
    /// Section 55(2)(ac) deemed cost of acquisition.
    #[ts(type = "number")]
    pub deemed_cost_of_acquisition: f64,
    /// Fair Market Value per unit as of Jan 31, 2018.
    #[ts(type = "number")]
    pub fmv_as_of_jan31_2018: f64,
    /// Total Fair Market Value as of Jan 31, 2018.
    #[ts(type = "number")]
    pub total_fmv_jan31_2018: f64,
    /// Transfer expenses.
    #[ts(type = "number")]
    pub transfer_expenses: f64,
    /// Net capital gain or loss.
    #[ts(type = "number")]
    pub gain: f64,
    /// Tax classification (`"LTCG"`, `"STCG"`, `"SLAB"`).
    pub tax_type: String,
    /// Applicable statutory tax rate.
    #[ts(type = "number")]
    pub tax_rate: f64,
    /// Tax before 4% Health & Education Cess.
    #[ts(type = "number")]
    pub tax_before_cess: f64,
    /// 4% Health & Education Cess.
    #[ts(type = "number")]
    pub cess: f64,
    /// Total estimated tax including cess.
    #[ts(type = "number")]
    pub estimated_tax: f64,
    /// Advance tax installment quarter (e.g., `"Q1"`, `"Q2"`, `"Q3"`, `"Q4"`, `"Q5"`).
    pub advance_tax_quarter: Option<String>,
    /// Whether Section 55(2)(ac) grandfathering applied.
    pub is_grandfathered: bool,
    /// Grandfathering status label.
    pub grandfathered_status: String,
}

/// Realized capital gains summary block.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RealizedTaxBlockDto {
    /// Total realized capital gain/loss.
    #[ts(type = "number")]
    pub total: f64,
    /// Realized Short-Term Capital Gain/Loss.
    #[ts(type = "number")]
    pub stcg: f64,
    /// Realized Long-Term Capital Gain/Loss.
    #[ts(type = "number")]
    pub ltcg: f64,
    /// Realized slab-taxed gain/loss (e.g., Section 50AA).
    #[ts(type = "number")]
    pub slab: f64,
    /// Taxable STCG after Section 70 set-offs.
    #[serde(rename = "taxableSTCG")]
    #[ts(type = "number")]
    pub taxable_stcg: f64,
    /// Taxable LTCG after Section 70 set-offs.
    #[serde(rename = "taxableLTCG")]
    #[ts(type = "number")]
    pub taxable_ltcg: f64,
    /// Section 112A exemption applied for the selected FY.
    #[ts(type = "number")]
    pub exempt_ltcg_112a: f64,
    /// Lot-level realized gain details.
    pub details: Vec<RealizedGainDetailDto>,
    /// ITR Schedule CG Table F advance tax matrix.
    #[ts(type = "Record<string, unknown>")]
    pub table_f: AdvanceTaxAccrualMatrix,
    /// Section-wise totals (111A, 112A, 50AA, etc.).
    #[ts(type = "Record<string, unknown>")]
    pub section_totals: SectionTotalsMap,
}

/// Unrealized capital gains summary block.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct UnrealizedTaxBlockDto {
    /// Total unrealized gain/loss.
    #[ts(type = "number")]
    pub total: f64,
    /// Unrealized STCG.
    #[ts(type = "number")]
    pub stcg: f64,
    /// Unrealized LTCG.
    #[ts(type = "number")]
    pub ltcg: f64,
    /// Unrealized slab-taxed gain.
    #[ts(type = "number")]
    pub slab: f64,
}

/// Complete FY-scoped, ITR-verified tax summary response.
#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TaxSummaryResponse {
    /// Active Indian Financial Year (e.g., `"2024-25"`).
    pub financial_year: String,
    /// All Financial Years present in realized transactions (descending).
    pub available_fys: Vec<String>,
    /// Whether any folio contains synthetic opening-balance anchor transactions.
    pub has_synthetic_anchors: bool,
    /// Realized capital gains and statutory set-off summary.
    pub realized: RealizedTaxBlockDto,
    /// Unrealized capital gains summary.
    pub unrealized: UnrealizedTaxBlockDto,
    /// Top-level alias for ITR Schedule CG Table F.
    #[ts(type = "Record<string, unknown>")]
    pub table_f: AdvanceTaxAccrualMatrix,
    /// Top-level alias for section-wise totals.
    #[ts(type = "Record<string, unknown>")]
    pub section_totals: SectionTotalsMap,
    /// Top-level alias for lot-level realized gain details.
    pub details: Vec<RealizedGainDetailDto>,
}

/// Returns the Indian Financial Year string (e.g., `"2024-25"`) for a calendar date.
fn financial_year_for_date(date: NaiveDate) -> String {
    let start_year = if date.month() >= 4 {
        date.year()
    } else {
        date.year() - 1
    };
    let end_yy = (start_year + 1) % 100;
    format!("{start_year}-{end_yy:02}")
}

/// Computes the statutory Section 112A annual LTCG exemption limit for a given FY.
fn section_112a_limit_for_fy(fy: &str) -> Decimal {
    let start_year = fy
        .split('-')
        .next()
        .and_then(|s| s.trim().parse::<i32>().ok())
        .unwrap_or(2024);
    if start_year >= 2024 {
        Decimal::from(125_000)
    } else {
        Decimal::from(100_000)
    }
}

/// Internal helper building both the verified [`TaxReport`] and [`TaxSummaryResponse`].
async fn build_verified_tax_summary(
    state: &AppState,
    user_id: uuid::Uuid,
    target_id: &str,
    query: &TaxSummaryQuery,
) -> Result<(TaxReport, TaxSummaryResponse), ApiError> {
    let portfolios = resolve_target_portfolios(state, user_id, target_id).await?;
    let slab_value = query
        .tax_slab
        .as_deref()
        .and_then(|s| Decimal::from_str(s).ok())
        .unwrap_or_else(|| Decimal::new(3, 1)); // 0.30

    let portfolio_ids: Vec<uuid::Uuid> = portfolios.iter().map(|p| p.id).collect();

    let mut all_realized_details = Vec::new();
    let mut total_unrealized_stcg = Decimal::ZERO;
    let mut total_unrealized_ltcg = Decimal::ZERO;
    let mut total_unrealized_slab = Decimal::ZERO;
    let mut total_unrealized = Decimal::ZERO;
    let mut has_synthetic_anchors = false;

    for &pid in &portfolio_ids {
        let Some(bundle) = state.db.fetch_portfolio_bundle(pid).await? else {
            continue;
        };
        for folio in bundle.folios {
            let Some(asset) = bundle.assets.iter().find(|a| a.id == folio.asset_id) else {
                continue;
            };
            let tx_entities: Vec<_> = bundle
                .transactions
                .iter()
                .filter(|t| t.folio_id == folio.id)
                .collect();
            if tx_entities.is_empty() {
                continue;
            }

            let mut core_txs = Vec::with_capacity(tx_entities.len());
            for tx_entity in tx_entities {
                if tx_entity.tx_type.eq_ignore_ascii_case("OPENING_BALANCE")
                    || tx_entity
                        .external_id
                        .as_deref()
                        .is_some_and(|e| e.starts_with("SYNTHETIC") || e.starts_with("ANCHOR"))
                {
                    has_synthetic_anchors = true;
                }
                if let Ok(core_tx) = tx_entity.to_core_transaction() {
                    core_txs.push(core_tx);
                }
            }

            let fallback = core_txs
                .iter()
                .rev()
                .find(|t| t.nav.is_positive())
                .map(|t| (t.date, t.nav));
            let latest_nav = fetch_latest_nav(state, Some(asset), fallback).await;
            let asset_type = asset
                .asset_type
                .parse::<AssetType>()
                .unwrap_or(AssetType::MutualFund);

            let grandfather_nav = if let Some(ref amfi) = asset.amfi_code {
                fetch_historical_nav_by_date(state, amfi, GRANDFATHER_DATE).await
            } else {
                None
            };

            let tax_summary = calculate_portfolio_tax(
                &asset.name,
                asset_type,
                &core_txs,
                latest_nav,
                slab_value,
                grandfather_nav,
            );

            total_unrealized_stcg += tax_summary.unrealized.stcg.to_decimal();
            total_unrealized_ltcg += tax_summary.unrealized.ltcg.to_decimal();
            total_unrealized_slab += tax_summary.unrealized.slab.to_decimal();
            total_unrealized += tax_summary.unrealized.total.to_decimal();

            for mut gain in tax_summary.realized.details {
                if gain.folio_number.is_none() {
                    gain.folio_number = FolioNumber::new(&folio.number).ok();
                }
                if gain.pan.is_none() {
                    gain.pan = folio.pan.as_deref().and_then(|p| Pan::new(p).ok());
                }
                if gain.isin.is_none() {
                    gain.isin = asset
                        .isin
                        .as_deref()
                        .and_then(|isin_str| Isin::new(isin_str).ok());
                }
                all_realized_details.push(gain);
            }
        }
    }

    let mut fy_set = BTreeSet::new();
    for g in &all_realized_details {
        fy_set.insert(financial_year_for_date(g.sell_date));
    }
    let current_fy = financial_year_for_date(Utc::now().date_naive());
    let mut available_fys: Vec<String> = fy_set.into_iter().rev().collect();
    if available_fys.is_empty() {
        available_fys.push(current_fy);
    }

    let selected_fy = query
        .fy
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .map_or_else(|| available_fys[0].clone(), str::to_string);

    let mut fy_details: Vec<_> = all_realized_details
        .into_iter()
        .filter(|g| financial_year_for_date(g.sell_date) == selected_fy)
        .collect();
    fy_details.sort_by_key(|a| std::cmp::Reverse(a.sell_date));

    let mut total_realized_stcg = Decimal::ZERO;
    let mut total_realized_ltcg = Decimal::ZERO;
    let mut total_realized_slab = Decimal::ZERO;
    let mut total_realized = Decimal::ZERO;

    for g in &fy_details {
        let amt = g.gain.to_decimal();
        total_realized += amt;
        match g.tax_type {
            portfolio_core::tax::TaxType::Stcg => total_realized_stcg += amt,
            portfolio_core::tax::TaxType::Ltcg => total_realized_ltcg += amt,
            portfolio_core::tax::TaxType::Slab => total_realized_slab += amt,
        }
    }

    let table_f = build_advance_tax_matrix(&fy_details);
    let section_totals = build_section_totals(&fy_details);

    // Statutory Section 70 set-off mechanics
    let stcl = if total_realized_stcg < Decimal::ZERO {
        total_realized_stcg.abs()
    } else {
        Decimal::ZERO
    };
    let ltcl = if total_realized_ltcg < Decimal::ZERO {
        total_realized_ltcg.abs()
    } else {
        Decimal::ZERO
    };
    let mut stcg = if total_realized_stcg > Decimal::ZERO {
        total_realized_stcg
    } else {
        Decimal::ZERO
    };
    let mut ltcg = if total_realized_ltcg > Decimal::ZERO {
        total_realized_ltcg
    } else {
        Decimal::ZERO
    };

    let set_off_lt = ltcg.min(ltcl);
    ltcg -= set_off_lt;

    let mut rem_stcl = stcl;
    let set_off_st = stcg.min(rem_stcl);
    stcg -= set_off_st;
    rem_stcl -= set_off_st;

    let set_off_st_lt = ltcg.min(rem_stcl);
    ltcg -= set_off_st_lt;

    let taxable_stcg = stcg;
    let taxable_ltcg = ltcg;

    let exemption_limit = section_112a_limit_for_fy(&selected_fy);
    let exempt_ltcg_112a = taxable_ltcg.min(exemption_limit).max(Decimal::ZERO);

    let core_summary = portfolio_core::tax::TaxPortfolioSummary {
        has_synthetic_anchors,
        realized: TaxCategorySummary {
            total: Money::new(total_realized),
            stcg: Money::new(total_realized_stcg),
            ltcg: Money::new(total_realized_ltcg),
            slab: Money::new(total_realized_slab),
            taxable_stcg: Money::new(taxable_stcg),
            taxable_ltcg: Money::new(taxable_ltcg),
            taxable_slab: Money::new(total_realized_slab.max(Decimal::ZERO)),
            details: fy_details.clone(),
        },
        unrealized: TaxCategorySummary {
            total: Money::new(total_unrealized),
            stcg: Money::new(total_unrealized_stcg),
            ltcg: Money::new(total_unrealized_ltcg),
            slab: Money::new(total_unrealized_slab),
            taxable_stcg: Money::zero(),
            taxable_ltcg: Money::zero(),
            taxable_slab: Money::zero(),
            details: Vec::new(),
        },
        table_f: Some(table_f.clone()),
        section_totals: Some(section_totals.clone()),
    };

    let report = TaxReport::new(
        selected_fy.clone(),
        core_summary,
        Money::new(exempt_ltcg_112a),
    );
    verify_itr_invariants(&report)
        .map_err(|e| ApiError::Internal(format!("ITR invariant verification failed: {e}")))?;

    let d2f = |v: Decimal| v.to_f64().unwrap_or(0.0);
    let details: Vec<RealizedGainDetailDto> = fy_details
        .iter()
        .map(|g| RealizedGainDetailDto {
            asset_name: g.asset_name.clone(),
            folio_number: g.folio_number.as_ref().map(|f| f.as_str().to_string()),
            isin: g.isin.as_ref().map(|i| i.as_str().to_string()),
            pan: g.pan.as_ref().map(|p| p.as_str().to_string()),
            asset_class: g.asset_class.clone(),
            section: g.section.to_string(),
            buy_date: g.buy_date.to_string(),
            sell_date: g.sell_date.to_string(),
            holding_period_days: g.holding_period_days,
            holding_type: format!("{:?}", g.holding_type),
            units: d2f(g.units.to_decimal()),
            buy_nav: d2f(g.buy_nav.to_decimal()),
            sell_nav: d2f(g.sell_nav.to_decimal()),
            gross_consideration: d2f(g.gross_consideration.to_decimal()),
            cost_of_acquisition: d2f(g.cost_of_acquisition.to_decimal()),
            deemed_cost_of_acquisition: d2f(g.deemed_cost_of_acquisition.to_decimal()),
            fmv_as_of_jan31_2018: d2f(g.fmv_as_of_jan31_2018.to_decimal()),
            total_fmv_jan31_2018: d2f(g.total_fmv_jan31_2018.to_decimal()),
            transfer_expenses: d2f(g.transfer_expenses.to_decimal()),
            gain: d2f(g.gain.to_decimal()),
            tax_type: format!("{:?}", g.tax_type).to_uppercase(),
            tax_rate: d2f(g.tax_rate),
            tax_before_cess: d2f(g.tax_before_cess.to_decimal()),
            cess: d2f(g.cess.to_decimal()),
            estimated_tax: d2f(g.estimated_tax.to_decimal()),
            advance_tax_quarter: g
                .advance_tax_quarter
                .as_ref()
                .map(|q| q.as_str().to_string()),
            is_grandfathered: g.is_grandfathered,
            grandfathered_status: g.grandfathered_status.clone(),
        })
        .collect();

    let response = TaxSummaryResponse {
        financial_year: selected_fy,
        available_fys,
        has_synthetic_anchors,
        realized: RealizedTaxBlockDto {
            total: d2f(total_realized),
            stcg: d2f(total_realized_stcg),
            ltcg: d2f(total_realized_ltcg),
            slab: d2f(total_realized_slab),
            taxable_stcg: d2f(taxable_stcg),
            taxable_ltcg: d2f(taxable_ltcg),
            exempt_ltcg_112a: d2f(exempt_ltcg_112a),
            details: details.clone(),
            table_f: table_f.clone(),
            section_totals: section_totals.clone(),
        },
        unrealized: UnrealizedTaxBlockDto {
            total: d2f(total_unrealized),
            stcg: d2f(total_unrealized_stcg),
            ltcg: d2f(total_unrealized_ltcg),
            slab: d2f(total_unrealized_slab),
        },
        table_f,
        section_totals,
        details,
    };

    Ok((report, response))
}

/// Route handler for `GET /api/portfolio/:id/tax-summary` calculating FY-scoped realized and unrealized capital gains.
pub async fn get_tax_summary(
    auth_user: AuthUser,
    Path(id): Path<String>,
    Query(query): Query<TaxSummaryQuery>,
    State(state): State<AppState>,
) -> Result<Json<TaxSummaryResponse>, ApiError> {
    let (_report, response) =
        build_verified_tax_summary(&state, auth_user.user_id, &id, &query).await?;
    Ok(Json(response))
}

/// Route handler for `GET /api/portfolio/:id/tax-report.csv` serving verified 27-column Schedule CG CSV.
pub async fn get_tax_report_csv(
    auth_user: AuthUser,
    Path(id): Path<String>,
    Query(query): Query<TaxSummaryQuery>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let (report, response) =
        build_verified_tax_summary(&state, auth_user.user_id, &id, &query).await?;
    let csv = generate_itr_schedule_cg_csv(&report);
    let filename = format!(
        "attachment; filename=\"schedule-cg-{}.csv\"",
        response.financial_year
    );
    let content_disposition = HeaderValue::from_str(&filename)
        .unwrap_or_else(|_| HeaderValue::from_static("attachment; filename=\"schedule-cg.csv\""));

    Ok((
        StatusCode::OK,
        [
            (
                header::CONTENT_TYPE,
                HeaderValue::from_static("text/csv; charset=utf-8"),
            ),
            (header::CONTENT_DISPOSITION, content_disposition),
        ],
        csv,
    ))
}

/// Route handler for `GET /api/portfolio/tax-impact` computing consolidated tax summary across all user portfolios.
pub async fn get_tax_impact_query(
    auth_user: AuthUser,
    Query(query): Query<HashMap<String, String>>,
    State(state): State<AppState>,
) -> Result<Json<TaxSummaryResponse>, ApiError> {
    let parsed_query = TaxSummaryQuery {
        fy: query.get("fy").cloned(),
        tax_slab: query.get("taxSlab").cloned(),
    };
    let (_report, response) =
        build_verified_tax_summary(&state, auth_user.user_id, "consolidated", &parsed_query)
            .await?;
    Ok(Json(response))
}
