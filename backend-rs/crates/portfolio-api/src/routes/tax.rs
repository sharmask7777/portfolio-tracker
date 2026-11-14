//! Tax simulation and tax harvesting routes.

use axum::extract::{Query, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use portfolio_core::error::PortfolioError;
use portfolio_core::tax::grandfathering::GRANDFATHER_DATE;
use portfolio_core::tax::harvesting::{FolioHarvestingInput, get_harvesting_opportunities};
use portfolio_core::tax::rules::simulate_sell_transactions_with_metadata;
use portfolio_core::tax::{RealizedGain, SellSimulation, TaxType};
use portfolio_core::types::{AssetType, Money, Nav, Units};
use portfolio_db::error::DbError;

use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::routes::portfolio::{
    fetch_asset_for_folio, fetch_folio, fetch_folios_for_portfolio, fetch_historical_nav_by_date,
    fetch_latest_nav, fetch_portfolio, fetch_transactions_for_folio, fetch_user_portfolios,
    resolve_target_portfolios,
};
use crate::state::AppState;

/// Request parameters for simulating a mutual fund or asset sale.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct SimulationSellRequest {
    /// Optional folio ID to simulate sale from an existing portfolio position.
    #[ts(optional = nullable)]
    pub folio_id: Option<Uuid>,
    /// Asset name if simulating hypothetical asset or when folio ID is not provided.
    #[ts(optional = nullable)]
    pub asset_name: Option<String>,
    /// Asset type classification (e.g. `"MUTUAL_FUND"`, `"EQUITY"`, `"GOLD"`).
    #[ts(optional = nullable)]
    pub asset_type: Option<String>,
    /// Number of units to simulate selling.
    #[ts(type = "number")]
    pub units: Decimal,
    /// Explicit current price / NAV override (if omitted, looks up latest database/market NAV).
    #[ts(optional = nullable, type = "number")]
    pub current_price: Option<Decimal>,
    /// Applicable investor income tax slab rate (defaults to 30% / 0.30 if omitted).
    #[ts(optional = nullable, type = "number")]
    pub tax_slab: Option<Decimal>,
    /// Hypothetical redemption date (defaults to current UTC date if omitted).
    #[ts(optional = nullable)]
    pub sell_date: Option<NaiveDate>,
}

pub type SimulateSellRequest = SimulationSellRequest;

/// Tax and cess breakdown component for a specific capital gains classification.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct TaxBreakdownItem {
    /// Taxable capital gain amount.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub amount: Decimal,
    /// Statutory base tax before health and education cess.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub tax: Decimal,
    /// Health & Education Cess (4% of base tax).
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub cess: Decimal,
}

/// Consolidated tax breakdown across Short-Term (STCG), Long-Term (LTCG), and Slab taxation.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct TaxBreakdown {
    /// Section 111A Short-Term Capital Gains component (20% post-July 23, 2024).
    pub stcg: TaxBreakdownItem,
    /// Section 112A Long-Term Capital Gains component (12.5% post-July 23, 2024).
    pub ltcg: TaxBreakdownItem,
    /// Section 50AA or regular income tax slab component.
    pub slab: TaxBreakdownItem,
    /// Total estimated tax liability including cess.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub total_tax: Decimal,
}

impl TaxBreakdownItem {
    pub const ZERO: Self = Self {
        amount: Decimal::ZERO,
        tax: Decimal::ZERO,
        cess: Decimal::ZERO,
    };

    pub fn add(&mut self, amount: Decimal, tax: Decimal, cess: Decimal) {
        self.amount += amount;
        self.tax += tax;
        self.cess += cess;
    }
}

impl TaxBreakdown {
    pub fn from_matched_lots(lots: &[RealizedGain]) -> Self {
        let mut stcg = TaxBreakdownItem::ZERO;
        let mut ltcg = TaxBreakdownItem::ZERO;
        let mut slab = TaxBreakdownItem::ZERO;
        let mut total_tax = Decimal::ZERO;

        for lot in lots {
            let item = match lot.tax_type {
                TaxType::Stcg => &mut stcg,
                TaxType::Ltcg => &mut ltcg,
                TaxType::Slab => &mut slab,
            };
            item.add(
                lot.gain.to_decimal(),
                lot.tax_before_cess.to_decimal(),
                lot.cess.to_decimal(),
            );
            total_tax += lot.estimated_tax.to_decimal();
        }

        Self {
            stcg,
            ltcg,
            slab,
            total_tax,
        }
    }
}

/// Response object detailing the simulated tax, gains, and exit load from selling units.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct SimulationSellResponse {
    /// Name of the simulated asset.
    pub asset_name: String,
    /// Number of units requested to sell.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub units_to_sell: Decimal,
    /// Gross proceeds from selling the units.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub estimated_value: Decimal,
    /// Total nominal capital gain or loss.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub total_gain: Decimal,
    /// Net taxable capital gain after applicable statutory exemptions.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub taxable_gain: Decimal,
    /// Estimated tax liability including health and education cess.
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub estimated_tax: Decimal,
    /// Exit load penalty deducted by AMC (if redemption occurs within exit load window).
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub exit_load: Decimal,
    /// Breakdown by capital gains tax bucket (STCG, LTCG, Slab).
    pub tax_breakdown: TaxBreakdown,
    /// FIFO-matched purchase lots realized in this redemption.
    pub matched_lots: Vec<RealizedGain>,
}

pub type SimulationResponse = SimulationSellResponse;

/// Read-only tax breakdown response for portfolio-wide tax reporting.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct TaxViewResponse {
    pub breakdown: TaxBreakdown,
    pub matched_lots: Vec<RealizedGain>,
}

pub trait TsExportExt: TS {
    fn export_to(path: impl AsRef<std::path::Path>) -> Result<(), Box<dyn std::error::Error>>
    where
        Self: 'static,
    {
        let content = Self::export_to_string()?;
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(path, content)?;
        Ok(())
    }
}

impl<T: TS + ?Sized> TsExportExt for T {}

fn to_simulation_response(sim: SellSimulation) -> SimulationSellResponse {
    let tax_breakdown = TaxBreakdown::from_matched_lots(&sim.matched_lots);
    SimulationSellResponse {
        asset_name: sim.asset_name,
        units_to_sell: sim.units_to_sell.to_decimal(),
        estimated_value: sim.estimated_value.to_decimal(),
        total_gain: sim.total_gain.to_decimal(),
        taxable_gain: sim.taxable_gain.to_decimal(),
        estimated_tax: sim.estimated_tax.to_decimal(),
        exit_load: sim.exit_load.to_decimal(),
        tax_breakdown,
        matched_lots: sim.matched_lots,
    }
}

/// Query parameters for evaluating LTCG tax harvesting opportunities.
#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct HarvestingQuery {
    /// Scope ID (portfolio UUID or aggregate scope like `"consolidated"`).
    pub scope_id: Option<String>,
    /// Valuation as-of date (defaults to current date if omitted).
    pub as_of: Option<NaiveDate>,
    /// Realized Section 112A LTCG already booked in current FY (offsets ₹1.25L annual exemption).
    pub realized_ltcg: Option<Decimal>,
}

/// Route handler for `POST /api/portfolio/:id/tax/simulate-sell` simulating asset sales and capital gains tax impact.
///
/// ## Simulation Lifecycle:
/// 1. Fetches existing transactions for the target folio or builds hypothetical holdings.
/// 2. Performs strict statutory FIFO lot matching against historical buy lots using
///    `simulate_sell_transactions_with_metadata`.
/// 3. Validates statutory restrictions:
///    - **ELSS Lock-In (Section 80C)**: Equity Linked Savings Schemes have a mandatory 3-year lock-in period.
///      If the requested units exceed available unlocked units, returns `ApiError::UnitsLocked` (HTTP 400).
/// 4. Evaluates applicable exit loads from AMC scheme rules.
/// 5. Classifies gains under Section 111A (STCG), Section 112A (LTCG with ₹1.25L exemption), or Section 50AA (Slab).
/// 6. Computes Jan 31, 2018 grandfathering adjustment under Section 55(2)(ac) if acquired prior to Feb 1, 2018.
pub async fn simulate_sell(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<SimulateSellRequest>,
) -> Result<Json<SimulationResponse>, ApiError> {
    if payload.units <= Decimal::ZERO {
        return Err(ApiError::BadRequest(
            "Valid positive units are required for simulation".to_string(),
        ));
    }

    let sell_date = payload.sell_date.unwrap_or_else(|| Utc::now().date_naive());
    let tax_slab = payload.tax_slab.unwrap_or_else(|| Decimal::new(30, 2));

    let (asset_name, asset_type, core_txs, current_price, grandfather_nav, exit_load_metadata) =
        if let Some(folio_id) = payload.folio_id {
            let folio = fetch_folio(&state, folio_id)
                .await?
                .ok_or(DbError::FolioNotFound(folio_id))?;
            let portfolio = fetch_portfolio(&state, folio.portfolio_id)
                .await?
                .ok_or(DbError::PortfolioNotFound(folio.portfolio_id))?;

            if portfolio.user_id != auth_user.user_id {
                return Err(ApiError::Forbidden);
            }

            let asset = fetch_asset_for_folio(&state, folio.asset_id)
                .await?
                .ok_or(DbError::AssetNotFound(folio.asset_id))?;

            let tx_entities = fetch_transactions_for_folio(&state, folio.id).await?;
            let mut core_txs = Vec::with_capacity(tx_entities.len());
            for transaction_entity in &tx_entities {
                core_txs.push(transaction_entity.to_core_transaction()?);
            }

            let fallback = core_txs
                .iter()
                .rev()
                .find(|t| t.nav.is_positive())
                .map(|t| (t.date, t.nav));

            let current_price = match payload.current_price {
                Some(p) => Nav::new(p),
                None => fetch_latest_nav(&state, Some(&asset), fallback).await,
            };

            let asset_type = asset
                .asset_type
                .parse::<AssetType>()
                .map_err(|e| ApiError::BadRequest(e.to_string()))?;

            let grandfather_nav = if let Some(ref amfi) = asset.amfi_code {
                fetch_historical_nav_by_date(&state, amfi, GRANDFATHER_DATE).await
            } else {
                None
            };

            (
                asset.name,
                asset_type,
                core_txs,
                current_price,
                grandfather_nav,
                asset.exit_load_metadata,
            )
        } else {
            let asset_name = payload.asset_name.ok_or_else(|| {
                ApiError::BadRequest("Folio ID or asset name is required".to_string())
            })?;
            let asset_type = payload
                .asset_type
                .unwrap_or_else(|| "MUTUAL_FUND".to_string())
                .parse::<AssetType>()
                .map_err(|e| ApiError::BadRequest(e.to_string()))?;
            let current_price = Nav::new(payload.current_price.unwrap_or(Decimal::ZERO));

            (
                asset_name,
                asset_type,
                Vec::new(),
                current_price,
                None,
                None,
            )
        };

    let simulation = simulate_sell_transactions_with_metadata(
        &asset_name,
        asset_type,
        &core_txs,
        Units::new(payload.units),
        sell_date,
        current_price,
        tax_slab,
        grandfather_nav,
        exit_load_metadata.as_deref(),
    )
    .map_err(|e| match e {
        PortfolioError::UnitsLocked { available, locked } => {
            ApiError::UnitsLocked { available, locked }
        }
        other => ApiError::from(other),
    })?;

    Ok(Json(to_simulation_response(simulation)))
}

/// Individual scheme opportunity for Section 112A tax-free harvesting.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct HarvestOpportunityDto {
    #[ts(optional = nullable)]
    pub folio_id: Option<String>,
    #[ts(optional = nullable)]
    pub folio_number: Option<String>,
    pub scheme_name: String,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub units_to_harvest: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub unrealized_gain: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub current_value: Decimal,
    pub lots_count: usize,
    #[ts(optional = nullable)]
    pub first_lot_date: Option<NaiveDate>,
    #[ts(optional = nullable)]
    pub last_lot_date: Option<NaiveDate>,
}

/// Detailed holding lot evaluation for tax categorization and harvesting.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct UnrealizedLotGainDto {
    pub scheme_name: String,
    pub buy_date: NaiveDate,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub units: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub purchase_nav: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub current_nav: Decimal,
    pub holding_days: i64,
    pub is_ltcg: bool,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub unrealized_gain: Decimal,
}

/// Aggregated breakdown of unrealized capital gains and losses across active holdings.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct UnrealizedSummaryDto {
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub stcg: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub ltcg: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub losses: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub net_gain: Decimal,
    pub lots: Vec<UnrealizedLotGainDto>,
}

/// Strongly-typed response payload for Section 112A tax-free harvesting opportunities.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct HarvestTicketResponse {
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub realized_ltcg_fy: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub remaining_exemption: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub total_potential_harvest: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    #[ts(type = "number")]
    pub estimated_tax_savings: Decimal,
    pub opportunities: Vec<HarvestOpportunityDto>,
    pub unrealized_summary: UnrealizedSummaryDto,
}

pub type HarvestTicket = HarvestTicketResponse;

impl From<portfolio_core::tax::harvesting::HarvestingSummary> for HarvestTicketResponse {
    fn from(summary: portfolio_core::tax::harvesting::HarvestingSummary) -> Self {
        Self {
            realized_ltcg_fy: summary.realized_ltcg_fy.to_decimal(),
            remaining_exemption: summary.remaining_exemption.to_decimal(),
            total_potential_harvest: summary.total_potential_harvest.to_decimal(),
            estimated_tax_savings: summary.estimated_tax_savings.to_decimal(),
            opportunities: summary
                .opportunities
                .into_iter()
                .map(|op| HarvestOpportunityDto {
                    folio_id: op.folio_id,
                    folio_number: op.folio_number,
                    scheme_name: op.scheme_name,
                    units_to_harvest: op.units_to_harvest.to_decimal(),
                    unrealized_gain: op.unrealized_gain.to_decimal(),
                    current_value: op.current_value.to_decimal(),
                    lots_count: op.lots_count,
                    first_lot_date: op.first_lot_date,
                    last_lot_date: op.last_lot_date,
                })
                .collect(),
            unrealized_summary: UnrealizedSummaryDto {
                stcg: summary.unrealized_summary.stcg.to_decimal(),
                ltcg: summary.unrealized_summary.ltcg.to_decimal(),
                losses: summary.unrealized_summary.losses.to_decimal(),
                net_gain: summary.unrealized_summary.net_gain.to_decimal(),
                lots: summary
                    .unrealized_summary
                    .lots
                    .into_iter()
                    .map(|lot| UnrealizedLotGainDto {
                        scheme_name: lot.scheme_name,
                        buy_date: lot.buy_date,
                        units: lot.units.to_decimal(),
                        purchase_nav: lot.purchase_nav.to_decimal(),
                        current_nav: lot.current_nav.to_decimal(),
                        holding_days: lot.holding_days,
                        is_ltcg: lot.is_ltcg,
                        unrealized_gain: lot.unrealized_gain.to_decimal(),
                    })
                    .collect(),
            },
        }
    }
}

/// Route handler for `GET /api/tax/harvesting` and `/api/tax/harvesting-opportunities`.
///
/// Identifies mutual fund lots with unrealized LTCG that can be redeemed tax-free
/// under the remaining Section 112A ₹1.25L annual exemption for the current financial year.
pub async fn get_harvesting(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<HarvestingQuery>,
) -> Result<Json<HarvestTicketResponse>, ApiError> {
    let as_of = query.as_of.unwrap_or_else(|| Utc::now().date_naive());
    let realized_ltcg = Money::new(query.realized_ltcg.unwrap_or(Decimal::ZERO));

    let portfolios = if let Some(ref scope_id) = query.scope_id {
        resolve_target_portfolios(&state, auth_user.user_id, scope_id).await?
    } else {
        fetch_user_portfolios(&state, auth_user.user_id).await?
    };

    let mut folio_data = Vec::new();

    for portfolio in &portfolios {
        let folios = fetch_folios_for_portfolio(&state, portfolio.id).await?;
        for folio in folios {
            let Some(asset) = fetch_asset_for_folio(&state, folio.asset_id).await? else {
                continue;
            };

            let tx_entities = fetch_transactions_for_folio(&state, folio.id).await?;
            let mut core_txs = Vec::with_capacity(tx_entities.len());
            for transaction_entity in &tx_entities {
                core_txs.push(transaction_entity.to_core_transaction()?);
            }

            let fallback = core_txs
                .iter()
                .rev()
                .find(|t| t.nav.is_positive())
                .map(|t| (t.date, t.nav));

            let current_nav = fetch_latest_nav(&state, Some(&asset), fallback).await;

            let asset_type = asset
                .asset_type
                .parse::<AssetType>()
                .unwrap_or(AssetType::MutualFund);

            folio_data.push((
                folio.id.to_string(),
                folio.number,
                asset.name,
                asset_type,
                core_txs,
                current_nav,
                asset.exit_load_metadata,
            ));
        }
    }

    let inputs: Vec<FolioHarvestingInput<'_>> = folio_data
        .iter()
        .map(
            |(
                folio_id,
                folio_number,
                scheme_name,
                asset_type,
                core_transactions,
                current_nav,
                exit_load,
            )| {
                let mut input = FolioHarvestingInput::new(
                    scheme_name,
                    *asset_type,
                    core_transactions,
                    *current_nav,
                )
                .with_folio_id(folio_id)
                .with_folio_number(folio_number);
                if let Some(meta) = exit_load {
                    input = input.with_exit_load_metadata(meta.as_str());
                }
                input
            },
        )
        .collect();

    let summary = get_harvesting_opportunities(&inputs, as_of, realized_ltcg, None);
    Ok(Json(HarvestTicketResponse::from(summary)))
}

/// Constructs and returns the Axum router for tax simulation and harvesting endpoints.
pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/simulate-sell", post(simulate_sell))
        .route("/harvesting", get(get_harvesting))
        .route("/harvesting-opportunities", get(get_harvesting))
}
