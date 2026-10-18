//! Capital gains tax, Section 112A grandfathering, and sell simulation.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::error::PortfolioError;
use crate::holdings::{Folio, Transaction};
use crate::types::{AssetType, FolioNumber, Isin, Money, Nav, Pan, Units};

/// Indian Income Tax capital gains classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TaxType {
    Stcg,
    Ltcg,
    Slab,
}

/// Relevant IT Act sections for capital gains under Pre/Post-Budget 2024 rules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TaxSection {
    Sec111A15,
    Sec111A20,
    Sec112A10,
    Sec112A12_5,
    Sec50AA,
    Sec112Debt12_5,
    Sec112Debt20,
    Slab,
}

/// Holding period classification (Short-Term vs Long-Term).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HoldingType {
    ShortTerm,
    LongTerm,
}

/// An active or historical purchase lot tracked for FIFO matching.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BuyLot {
    pub date: NaiveDate,
    pub units: Units,
    pub nav: Nav,
    pub amount: Money,
    pub original_units: Units,
    pub isin: Option<Isin>,
    pub is_bonus: bool,
    pub is_anchor: bool,
}

impl BuyLot {
    pub fn new(date: NaiveDate, units: Units, nav: Nav, amount: Money) -> Self {
        Self {
            date,
            units,
            nav,
            amount,
            original_units: units,
            isin: None,
            is_bonus: false,
            is_anchor: false,
        }
    }

    pub fn with_isin(mut self, isin: Isin) -> Self {
        self.isin = Some(isin);
        self
    }

    pub fn with_bonus(mut self, is_bonus: bool) -> Self {
        self.is_bonus = is_bonus;
        self
    }

    pub fn with_anchor(mut self, is_anchor: bool) -> Self {
        self.is_anchor = is_anchor;
        self
    }
}

/// Detailed calculation for a single realized gain matching a redemption to a buy lot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RealizedGain {
    pub asset_name: String,
    pub folio_number: Option<FolioNumber>,
    pub isin: Option<Isin>,
    pub pan: Option<Pan>,
    pub asset_class: String,
    pub section: TaxSection,
    pub buy_date: NaiveDate,
    pub sell_date: NaiveDate,
    pub holding_period_days: i64,
    pub holding_type: HoldingType,
    pub units: Units,
    pub buy_nav: Nav,
    pub sell_nav: Nav,
    pub gross_consideration: Money,
    pub cost_of_acquisition: Money,
    pub fmv_as_of_jan31_2018: Nav,
    pub total_fmv_jan31_2018: Money,
    pub deemed_cost_of_acquisition: Money,
    pub transfer_expenses: Money,
    pub gain: Money,
    pub tax_type: TaxType,
    pub tax_rate: Decimal,
    pub tax_before_cess: Money,
    pub cess: Money,
    pub estimated_tax: Money,
    pub is_grandfathered: bool,
    pub grandfathered_status: String,
}

/// Tax summary for a category (realized or unrealized).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct TaxCategorySummary {
    pub stcg: Money,
    pub ltcg: Money,
    pub slab: Money,
    pub total: Money,
    pub details: Vec<RealizedGain>,
}

/// Overall portfolio tax summary separating realized from unrealized gains.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct TaxPortfolioSummary {
    pub has_synthetic_anchors: bool,
    pub realized: TaxCategorySummary,
    pub unrealized: TaxCategorySummary,
}

/// Result of simulating a unit redemption, including tax impact and lock-in verification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SellSimulation {
    pub asset_name: String,
    pub units_to_sell: Units,
    pub estimated_value: Money,
    pub total_gain: Money,
    pub exit_load: Money,
    pub matched_lots: Vec<RealizedGain>,
}

/// Calculates capital gain for a specific buy lot redemption under Section 112A / Section 55(2)(ac).
///
/// NOTE: In TDD RED state, this returns zeroed stub values to confirm test assertion failure.
// Legacy 1:1 API parity with TypeScript TaxService.calculateGain
#[allow(clippy::too_many_arguments)]
pub fn calculate_gain(
    asset_name: &str,
    _asset_type: AssetType,
    lot: &BuyLot,
    units_sold: Units,
    sell_nav: Nav,
    sell_date: NaiveDate,
    _tax_slab: Decimal,
    _grandfather_nav: Option<Nav>,
) -> RealizedGain {
    // RED phase stub
    RealizedGain {
        asset_name: asset_name.to_string(),
        folio_number: None,
        isin: lot.isin.clone(),
        pan: None,
        asset_class: String::new(),
        section: TaxSection::Slab,
        buy_date: lot.date,
        sell_date,
        holding_period_days: 0,
        holding_type: HoldingType::ShortTerm,
        units: units_sold,
        buy_nav: lot.nav,
        sell_nav,
        gross_consideration: Money::zero(),
        cost_of_acquisition: Money::zero(),
        fmv_as_of_jan31_2018: Nav::zero(),
        total_fmv_jan31_2018: Money::zero(),
        deemed_cost_of_acquisition: Money::zero(),
        transfer_expenses: Money::zero(),
        gain: Money::zero(),
        tax_type: TaxType::Slab,
        tax_rate: Decimal::ZERO,
        tax_before_cess: Money::zero(),
        cess: Money::zero(),
        estimated_tax: Money::zero(),
        is_grandfathered: false,
        grandfathered_status: String::new(),
    }
}

/// Calculates portfolio-level realized and unrealized tax across all transactions in a scheme/folio.
pub fn calculate_portfolio_tax(
    asset_name: &str,
    asset_type: AssetType,
    transactions: &[Transaction],
    current_nav: Nav,
    _tax_slab: Decimal,
    _grandfather_nav: Option<Nav>,
) -> TaxPortfolioSummary {
    let (active_lots, depletions) = crate::holdings::process_fifo_lots(transactions);
    let is_eq = is_equity(asset_type, asset_name);

    let mut realized_stcg = Money::ZERO;
    let mut realized_ltcg = Money::ZERO;
    let mut realized_details = Vec::new();

    for d in depletions {
        let holding_days = (d.redemption_date - d.lot_purchase_date).num_days();
        let is_lt = if is_eq {
            holding_days >= 365
        } else {
            holding_days >= 1095
        };

        if is_lt {
            realized_ltcg += d.realized_gain;
        } else {
            realized_stcg += d.realized_gain;
        }

        realized_details.push(RealizedGain {
            asset_name: asset_name.to_string(),
            folio_number: None,
            isin: None,
            pan: None,
            asset_class: if is_eq {
                "Equity".to_string()
            } else {
                "Debt".to_string()
            },
            section: if is_lt {
                TaxSection::Sec112A10
            } else {
                TaxSection::Sec111A15
            },
            buy_date: d.lot_purchase_date,
            sell_date: d.redemption_date,
            holding_period_days: holding_days,
            holding_type: if is_lt {
                HoldingType::LongTerm
            } else {
                HoldingType::ShortTerm
            },
            units: d.units,
            buy_nav: d.purchase_nav,
            sell_nav: d.redemption_nav,
            gross_consideration: d.proceeds,
            cost_of_acquisition: d.cost_basis,
            fmv_as_of_jan31_2018: Nav::ZERO,
            total_fmv_jan31_2018: Money::ZERO,
            deemed_cost_of_acquisition: d.cost_basis,
            transfer_expenses: Money::ZERO,
            gain: d.realized_gain,
            tax_type: if is_lt { TaxType::Ltcg } else { TaxType::Stcg },
            tax_rate: Decimal::ZERO,
            tax_before_cess: Money::ZERO,
            cess: Money::ZERO,
            estimated_tax: Money::ZERO,
            is_grandfathered: false,
            grandfathered_status: String::new(),
        });
    }

    let mut unrealized_total = Money::ZERO;
    for lot in active_lots {
        let current_val = current_nav * lot.remaining_units;
        let cost_val = lot.purchase_nav * lot.remaining_units;
        let gain = current_val - cost_val;
        unrealized_total += gain;
    }

    TaxPortfolioSummary {
        has_synthetic_anchors: false,
        realized: TaxCategorySummary {
            stcg: realized_stcg,
            ltcg: realized_ltcg,
            slab: Money::ZERO,
            total: realized_stcg + realized_ltcg,
            details: realized_details,
        },
        unrealized: TaxCategorySummary {
            stcg: Money::ZERO,
            ltcg: Money::ZERO,
            slab: Money::ZERO,
            total: unrealized_total,
            details: Vec::new(),
        },
    }
}

/// Checks if an asset is ELSS based on fund name.
pub fn is_elss(asset_name: &str) -> bool {
    let lower = asset_name.to_lowercase();
    lower.contains("elss") || lower.contains("tax saver") || lower.contains("tax plan")
}

/// Checks if an asset is classified as equity for taxation.
pub fn is_equity(asset_type: AssetType, asset_name: &str) -> bool {
    if asset_type == AssetType::Stock {
        return true;
    }
    if asset_type == AssetType::MutualFund {
        let lower = asset_name.to_lowercase();
        let debt_keywords = [
            "debt",
            "bond",
            "liquid",
            "gilt",
            "money market",
            "overnight",
            "credit risk",
            "conservative",
            "income",
            "duration",
            "treasury",
        ];
        return !debt_keywords.iter().any(|keyword| lower.contains(keyword));
    }
    false
}

/// Computes locked units for ELSS funds subject to the 3-year statutory lock-in requirement.
///
/// NOTE: In TDD RED state, returns Units::zero().
pub fn get_locked_units(
    _asset_name: &str,
    _transactions: &[Transaction],
    _as_of: NaiveDate,
) -> Units {
    // RED phase stub
    Units::zero()
}

/// Simulates selling units from a folio, enforcing ELSS lock-in checks and FIFO lot matching.
///
/// NOTE: In TDD RED state, returns an error or dummy simulation to establish RED state.
pub fn simulate_sell(
    _folio: &Folio,
    _units_to_sell: Units,
    _sell_date: NaiveDate,
    _current_price: Nav,
    _tax_slab: Decimal,
) -> Result<SellSimulation, PortfolioError> {
    // RED phase stub: returns error to confirm RED assertion
    Err(PortfolioError::InvalidTransaction {
        reason: "Simulate sell stub not implemented in RED state".to_string(),
    })
}
