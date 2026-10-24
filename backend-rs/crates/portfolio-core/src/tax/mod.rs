//! Capital gains tax, Section 112A grandfathering, ELSS lock-in, and tax harvesting engine.

pub mod grandfathering;
pub mod harvesting;
pub mod rules;

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::holdings::{Transaction, process_fifo_lots};
use crate::types::{AssetType, FolioNumber, Isin, Money, Nav, Pan, Units};

pub use grandfathering::{
    BUDGET_2024_DATE, CESS_RATE, DEBT_NEW_REGIME_DATE, GRANDFATHER_DATE, calculate_gain,
    calculate_gain_with_expenses, compute_deemed_cost,
};
pub use harvesting::{
    FolioHarvestingInput, HarvestingOpportunity, HarvestingSummary,
    LTCG_EXEMPTION_LIMIT_BUDGET_2024_DECIMAL, LTCG_EXEMPTION_LIMIT_PRE_BUDGET_2024_DECIMAL,
    LTCG_TAX_RATE_BUDGET_2024, UnrealizedLotGain, UnrealizedTaxSummary, compute_unrealized_gains,
    get_harvesting_opportunities, ltcg_exemption_limit_budget_2024,
    ltcg_exemption_limit_pre_budget_2024,
};
pub use rules::{
    elss_lock_in_expiry, get_locked_units, is_elss, is_elss_scheme, is_equity, is_lot_locked,
    simulate_sell, simulate_sell_transactions,
};

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

impl std::fmt::Display for TaxSection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaxSection::Sec111A15 => write!(f, "111A (15%)"),
            TaxSection::Sec111A20 => write!(f, "111A (20%)"),
            TaxSection::Sec112A10 => write!(f, "112A (10%)"),
            TaxSection::Sec112A12_5 => write!(f, "112A (12.5%)"),
            TaxSection::Sec50AA => write!(f, "50AA (Slab)"),
            TaxSection::Sec112Debt12_5 => write!(f, "112 Debt (12.5%)"),
            TaxSection::Sec112Debt20 => write!(f, "112 Debt (20% Indexed)"),
            TaxSection::Slab => write!(f, "SLAB"),
        }
    }
}

/// Holding period classification (Short-Term vs Long-Term).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HoldingType {
    ShortTerm,
    LongTerm,
}

/// Statutory advance tax quarters adjusted for Budget 2024 (23 July 2024).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AdvanceTaxQuarter {
    #[serde(rename = "Q1 (01/04 - 15/06)")]
    Q1,
    #[serde(rename = "Q2a (16/06 - 22/07)")]
    Q2A,
    #[serde(rename = "Q2b (23/07 - 15/09)")]
    Q2B,
    #[serde(rename = "Q3 (16/09 - 15/12)")]
    Q3,
    #[serde(rename = "Q4 (16/12 - 15/03)")]
    Q4,
    #[serde(rename = "Q5 (16/03 - 31/03)")]
    Q5,
}

impl AdvanceTaxQuarter {
    pub fn as_str(&self) -> &'static str {
        match self {
            AdvanceTaxQuarter::Q1 => "Q1 (01/04 - 15/06)",
            AdvanceTaxQuarter::Q2A => "Q2a (16/06 - 22/07)",
            AdvanceTaxQuarter::Q2B => "Q2b (23/07 - 15/09)",
            AdvanceTaxQuarter::Q3 => "Q3 (16/09 - 15/12)",
            AdvanceTaxQuarter::Q4 => "Q4 (16/12 - 15/03)",
            AdvanceTaxQuarter::Q5 => "Q5 (16/03 - 31/03)",
        }
    }

    pub fn from_date(date: NaiveDate) -> Self {
        use chrono::Datelike;
        let month = date.month();
        let day = date.day();

        if (month == 4) || (month == 5) || (month == 6 && day <= 15) {
            AdvanceTaxQuarter::Q1
        } else if (month == 6 && day >= 16) || (month == 7 && day <= 22) {
            AdvanceTaxQuarter::Q2A
        } else if (month == 7 && day >= 23) || (month == 8) || (month == 9 && day <= 15) {
            AdvanceTaxQuarter::Q2B
        } else if (month == 9 && day >= 16)
            || (month == 10)
            || (month == 11)
            || (month == 12 && day <= 15)
        {
            AdvanceTaxQuarter::Q3
        } else if (month == 12 && day >= 16)
            || (month == 1)
            || (month == 2)
            || (month == 3 && day <= 15)
        {
            AdvanceTaxQuarter::Q4
        } else {
            AdvanceTaxQuarter::Q5
        }
    }
}

impl std::fmt::Display for AdvanceTaxQuarter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Data for a single quarter in Schedule CG Table F.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TableFQuarterData {
    pub stcg15: Money,
    pub stcg20: Money,
    pub ltcg10: Money,
    pub ltcg12_5: Money,
    pub debt_ltcg12_5: Money,
    pub debt_ltcg20: Money,
    pub slab: Money,
    pub total_gain: Money,
    pub tax_before_cess: Money,
    pub cess: Money,
    pub estimated_tax: Money,
}

/// Schedule CG Table F: Advance Tax Accrual Matrix across the statutory quarters.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AdvanceTaxAccrualMatrix {
    pub quarters: std::collections::HashMap<String, TableFQuarterData>,
    pub quarter_totals: std::collections::HashMap<String, Money>,
}

/// Summary metrics for a specific statutory tax section.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionTotalData {
    pub section: String,
    pub gross_consideration: Money,
    pub cost_of_acquisition: Money,
    pub deemed_cost_of_acquisition: Money,
    pub transfer_expenses: Money,
    pub total_gain: Money,
    pub tax_rate: Decimal,
    pub tax_before_cess: Money,
    pub cess: Money,
    pub total_tax: Money,
}

pub type SectionTotalsMap = std::collections::HashMap<String, SectionTotalData>;

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
    pub advance_tax_quarter: Option<AdvanceTaxQuarter>,
}

/// Tax summary for a category (realized or unrealized).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaxCategorySummary {
    pub stcg: Money,
    pub ltcg: Money,
    pub slab: Money,
    pub total: Money,
    pub taxable_stcg: Money,
    pub taxable_ltcg: Money,
    pub details: Vec<RealizedGain>,
}

/// Overall portfolio tax summary separating realized from unrealized gains.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaxPortfolioSummary {
    pub has_synthetic_anchors: bool,
    pub realized: TaxCategorySummary,
    pub unrealized: TaxCategorySummary,
    pub table_f: Option<AdvanceTaxAccrualMatrix>,
    pub section_totals: Option<SectionTotalsMap>,
}

/// Result of simulating a unit redemption, including tax impact and lock-in verification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SellSimulation {
    pub asset_name: String,
    pub units_to_sell: Units,
    pub estimated_value: Money,
    pub total_gain: Money,
    pub taxable_gain: Money,
    pub estimated_tax: Money,
    pub exit_load: Money,
    pub matched_lots: Vec<RealizedGain>,
}

/// Builds Schedule CG Table F: Advance Tax Accrual Matrix across the statutory quarters.
pub fn build_advance_tax_matrix(details: &[RealizedGain]) -> AdvanceTaxAccrualMatrix {
    let quarters_list = [
        AdvanceTaxQuarter::Q1,
        AdvanceTaxQuarter::Q2A,
        AdvanceTaxQuarter::Q2B,
        AdvanceTaxQuarter::Q3,
        AdvanceTaxQuarter::Q4,
        AdvanceTaxQuarter::Q5,
    ];

    let mut quarters = std::collections::HashMap::new();
    let mut quarter_totals = std::collections::HashMap::new();

    for q in quarters_list {
        quarters.insert(q.as_str().to_string(), TableFQuarterData::default());
        quarter_totals.insert(q.as_str().to_string(), Money::ZERO);
    }

    for g in details {
        let q = g
            .advance_tax_quarter
            .unwrap_or_else(|| AdvanceTaxQuarter::from_date(g.sell_date));
        let q_str = q.as_str().to_string();
        if let Some(data) = quarters.get_mut(&q_str) {
            match g.section {
                TaxSection::Sec111A15 => data.stcg15 += g.gain,
                TaxSection::Sec111A20 => data.stcg20 += g.gain,
                TaxSection::Sec112A10 => data.ltcg10 += g.gain,
                TaxSection::Sec112A12_5 => data.ltcg12_5 += g.gain,
                TaxSection::Sec112Debt12_5 => data.debt_ltcg12_5 += g.gain,
                TaxSection::Sec112Debt20 => data.debt_ltcg20 += g.gain,
                TaxSection::Sec50AA | TaxSection::Slab => data.slab += g.gain,
            }
            data.total_gain += g.gain;
            data.tax_before_cess += g.tax_before_cess;
            data.cess += g.cess;
            data.estimated_tax += g.estimated_tax;

            if let Some(total) = quarter_totals.get_mut(&q_str) {
                *total += g.estimated_tax;
            }
        }
    }

    AdvanceTaxAccrualMatrix {
        quarters,
        quarter_totals,
    }
}

/// Builds statutory totals grouped by TaxSection matching Schedule CG.
pub fn build_section_totals(details: &[RealizedGain]) -> SectionTotalsMap {
    let mut totals = std::collections::HashMap::new();

    for g in details {
        let sec_str = g.section.to_string();
        let entry = totals
            .entry(sec_str.clone())
            .or_insert_with(|| SectionTotalData {
                section: sec_str,
                gross_consideration: Money::ZERO,
                cost_of_acquisition: Money::ZERO,
                deemed_cost_of_acquisition: Money::ZERO,
                transfer_expenses: Money::ZERO,
                total_gain: Money::ZERO,
                tax_rate: g.tax_rate,
                tax_before_cess: Money::ZERO,
                cess: Money::ZERO,
                total_tax: Money::ZERO,
            });

        entry.gross_consideration += g.gross_consideration;
        entry.cost_of_acquisition += g.cost_of_acquisition;
        entry.deemed_cost_of_acquisition += g.deemed_cost_of_acquisition;
        entry.transfer_expenses += g.transfer_expenses;
        entry.total_gain += g.gain;
        entry.tax_before_cess += g.tax_before_cess;
        entry.cess += g.cess;
        entry.total_tax += g.estimated_tax;
    }

    totals
}

/// Calculates portfolio-level realized and unrealized tax across all transactions in a scheme/folio,
/// with an explicit valuation date `as_of`.
pub fn calculate_portfolio_tax_with_as_of(
    asset_name: &str,
    asset_type: AssetType,
    transactions: &[Transaction],
    current_nav: Nav,
    tax_slab: Decimal,
    grandfather_nav: Option<Nav>,
    as_of: Option<NaiveDate>,
) -> TaxPortfolioSummary {
    let (active_lots, depletions) = process_fifo_lots(transactions);

    let mut realized_stcg = Money::ZERO;
    let mut realized_ltcg = Money::ZERO;
    let mut realized_slab = Money::ZERO;
    let mut realized_details = Vec::new();

    for d in depletions {
        let buy_lot = BuyLot::new(d.lot_purchase_date, d.units, d.purchase_nav, d.cost_basis);

        let gain_record = calculate_gain(
            asset_name,
            asset_type,
            &buy_lot,
            d.units,
            d.redemption_nav,
            d.redemption_date,
            tax_slab,
            grandfather_nav,
        );

        match gain_record.tax_type {
            TaxType::Ltcg => realized_ltcg += gain_record.gain,
            TaxType::Stcg => realized_stcg += gain_record.gain,
            TaxType::Slab => realized_slab += gain_record.gain,
        }

        realized_details.push(gain_record);
    }

    // Set-off Logic Implementation (matching TS TaxService)
    let stcg_realized = realized_stcg;
    let ltcg_realized = realized_ltcg;

    let stcl = if stcg_realized.is_negative() {
        stcg_realized.abs()
    } else {
        Money::ZERO
    };
    let ltcl = if ltcg_realized.is_negative() {
        ltcg_realized.abs()
    } else {
        Money::ZERO
    };
    let mut stcg = if stcg_realized.is_positive() {
        stcg_realized
    } else {
        Money::ZERO
    };
    let mut ltcg = if ltcg_realized.is_positive() {
        ltcg_realized
    } else {
        Money::ZERO
    };

    // 1. LTCL can ONLY set off LTCG
    let mut remaining_ltcl = ltcl;
    let set_off_lt = ltcg.min(remaining_ltcl);
    ltcg -= set_off_lt;
    remaining_ltcl -= set_off_lt;
    let _ = remaining_ltcl;

    // 2. STCL can set off both STCG and LTCG
    let mut remaining_stcl = stcl;
    let set_off_st = stcg.min(remaining_stcl);
    stcg -= set_off_st;
    remaining_stcl -= set_off_st;

    let set_off_st_lt = ltcg.min(remaining_stcl);
    ltcg -= set_off_st_lt;
    remaining_stcl -= set_off_st_lt;
    let _ = remaining_stcl;

    let taxable_stcg = stcg;
    let taxable_ltcg = ltcg;

    let as_of_date = as_of.unwrap_or_else(|| chrono::Utc::now().date_naive());
    let is_eq = is_equity(asset_type, asset_name);

    let mut u_stcg = Money::ZERO;
    let mut u_ltcg = Money::ZERO;
    let mut u_slab = Money::ZERO;
    let mut unrealized_total = Money::ZERO;

    for lot in &active_lots {
        if lot.remaining_units.is_zero() || lot.remaining_units.is_negative() {
            continue;
        }

        let (deemed_cost, _, _, _, _) = compute_deemed_cost(
            lot.purchase_date,
            lot.remaining_units,
            lot.purchase_nav,
            current_nav,
            grandfather_nav,
            is_eq,
            false,
        );

        let current_val = current_nav * lot.remaining_units;
        let gain = current_val - deemed_cost;
        unrealized_total += gain;

        let holding_days = (as_of_date - lot.purchase_date).num_days();
        let is_post_budget_2024 = as_of_date >= BUDGET_2024_DATE;
        let is_post_debt_regime = lot.purchase_date >= DEBT_NEW_REGIME_DATE;

        if is_eq {
            if holding_days >= 365 {
                u_ltcg += gain;
            } else {
                u_stcg += gain;
            }
        } else if is_post_debt_regime {
            u_slab += gain;
        } else {
            let lt_threshold = if is_post_budget_2024 { 730 } else { 1095 };
            if holding_days >= lt_threshold {
                u_ltcg += gain;
            } else {
                u_slab += gain;
            }
        }
    }

    let has_synthetic_anchors = false;

    let table_f = build_advance_tax_matrix(&realized_details);
    let section_totals = build_section_totals(&realized_details);

    TaxPortfolioSummary {
        has_synthetic_anchors,
        realized: TaxCategorySummary {
            stcg: realized_stcg,
            ltcg: realized_ltcg,
            slab: realized_slab,
            total: realized_stcg + realized_ltcg + realized_slab,
            taxable_stcg,
            taxable_ltcg,
            details: realized_details,
        },
        unrealized: TaxCategorySummary {
            stcg: u_stcg,
            ltcg: u_ltcg,
            slab: u_slab,
            total: unrealized_total,
            taxable_stcg: if u_stcg.is_positive() {
                u_stcg
            } else {
                Money::ZERO
            },
            taxable_ltcg: if u_ltcg.is_positive() {
                u_ltcg
            } else {
                Money::ZERO
            },
            details: Vec::new(),
        },
        table_f: Some(table_f),
        section_totals: Some(section_totals),
    }
}

/// Calculates portfolio-level realized and unrealized tax across all transactions in a scheme/folio.
pub fn calculate_portfolio_tax(
    asset_name: &str,
    asset_type: AssetType,
    transactions: &[Transaction],
    current_nav: Nav,
    tax_slab: Decimal,
    grandfather_nav: Option<Nav>,
) -> TaxPortfolioSummary {
    calculate_portfolio_tax_with_as_of(
        asset_name,
        asset_type,
        transactions,
        current_nav,
        tax_slab,
        grandfather_nav,
        None,
    )
}

/// Calculates unrealized capital gains tax liability across active holdings.
pub fn calculate_unrealized_tax(
    asset_name: &str,
    asset_type: AssetType,
    transactions: &[Transaction],
    current_nav: Nav,
    tax_slab: Decimal,
    as_of: Option<NaiveDate>,
    grandfather_nav: Option<Nav>,
) -> Money {
    let as_of_date = as_of.unwrap_or_else(|| chrono::Utc::now().date_naive());
    let summary = calculate_portfolio_tax_with_as_of(
        asset_name,
        asset_type,
        transactions,
        current_nav,
        tax_slab,
        grandfather_nav,
        Some(as_of_date),
    );

    let is_eq = is_equity(asset_type, asset_name);
    let is_post_budget = as_of_date >= BUDGET_2024_DATE;

    let stcg_rate = if is_eq {
        if is_post_budget {
            Decimal::from_parts(20, 0, 0, false, 2) // 0.20 (20%)
        } else {
            Decimal::from_parts(15, 0, 0, false, 2) // 0.15 (15%)
        }
    } else {
        tax_slab
    };

    let ltcg_rate = if is_eq {
        if is_post_budget {
            Decimal::from_parts(125, 0, 0, false, 3) // 0.125 (12.5%)
        } else {
            Decimal::from_parts(10, 0, 0, false, 2) // 0.10 (10%)
        }
    } else if is_post_budget {
        Decimal::from_parts(125, 0, 0, false, 3) // 0.125 (12.5%)
    } else {
        Decimal::from_parts(20, 0, 0, false, 2) // 0.20 (20%)
    };

    let mut estimated_tax = Money::ZERO;

    if summary.unrealized.stcg.is_positive() {
        estimated_tax += Money::new(summary.unrealized.stcg.to_decimal() * stcg_rate);
    }
    if summary.unrealized.ltcg.is_positive() {
        estimated_tax += Money::new(summary.unrealized.ltcg.to_decimal() * ltcg_rate);
    }
    if summary.unrealized.slab.is_positive() {
        estimated_tax += Money::new(summary.unrealized.slab.to_decimal() * tax_slab);
    }

    if estimated_tax.is_negative() {
        Money::ZERO
    } else {
        estimated_tax
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("valid test date")
    }

    fn dec(s: &str) -> Decimal {
        Decimal::from_str(s).expect("valid decimal")
    }

    fn units(s: &str) -> Units {
        Units::from_str(s).expect("valid units")
    }

    fn nav(s: &str) -> Nav {
        Nav::from_str(s).expect("valid nav")
    }

    fn money(s: &str) -> Money {
        Money::from_str(s).expect("valid money")
    }

    // 1. Section 112A deemed cost when sell_nav > fmv > buy_nav
    #[test]
    fn test_section_112a_sell_greater_than_fmv_greater_than_buy() {
        let buy_lot = BuyLot::new(date(2017, 3, 1), units("100"), nav("50"), money("5000"));
        let fmv = nav("100");
        let sell_nav = nav("150");
        let sell_date = date(2024, 8, 1);

        let gain = calculate_gain(
            "Bluechip Growth Fund",
            AssetType::MutualFund,
            &buy_lot,
            units("100"),
            sell_nav,
            sell_date,
            dec("0.3"),
            Some(fmv),
        );

        // Deemed unit cost = max(50, min(100, 150)) = 100
        // Deemed total cost = 100 * 100 = 10,000
        // Gross consideration = 100 * 150 = 15,000
        // Taxable gain = 15,000 - 10,000 = 5,000
        assert!(gain.is_grandfathered);
        assert_eq!(gain.deemed_cost_of_acquisition, money("10000"));
        assert_eq!(gain.gain, money("5000"));
        assert_eq!(gain.tax_type, TaxType::Ltcg);
        assert_eq!(gain.section, TaxSection::Sec112A12_5);
    }

    // 2. Section 112A deemed cost when sell_nav < fmv (loss limitation rule)
    #[test]
    fn test_section_112a_sell_less_than_fmv_loss_limitation() {
        let buy_lot = BuyLot::new(date(2017, 3, 1), units("100"), nav("50"), money("5000"));
        let fmv = nav("100");
        let sell_nav = nav("80");
        let sell_date = date(2024, 8, 1);

        let gain = calculate_gain(
            "Bluechip Growth Fund",
            AssetType::MutualFund,
            &buy_lot,
            units("100"),
            sell_nav,
            sell_date,
            dec("0.3"),
            Some(fmv),
        );

        // Deemed unit cost = max(50, min(100, 80)) = max(50, 80) = 80
        // Deemed total cost = 100 * 80 = 8,000
        // Gross consideration = 100 * 80 = 8,000
        // Taxable gain = 0 (no artificial loss permitted)
        assert!(gain.is_grandfathered);
        assert_eq!(gain.deemed_cost_of_acquisition, money("8000"));
        assert_eq!(gain.gain, money("0"));

        // Case B: Genuine economic loss where sell_nav < buy_nav < fmv
        let sell_nav_loss = nav("40");
        let loss_gain = calculate_gain(
            "Bluechip Growth Fund",
            AssetType::MutualFund,
            &buy_lot,
            units("100"),
            sell_nav_loss,
            sell_date,
            dec("0.3"),
            Some(fmv),
        );
        // Deemed unit cost = max(50, min(100, 40)) = max(50, 40) = 50
        // Deemed total cost = 100 * 50 = 5,000
        // Gross consideration = 100 * 40 = 4,000
        // Gain = 4,000 - 5,000 = -1,000 (actual economic loss allowed)
        assert!(loss_gain.is_grandfathered);
        assert_eq!(loss_gain.deemed_cost_of_acquisition, money("5000"));
        assert_eq!(loss_gain.gain, money("-1000"));
    }

    // 3. Section 112A when bought after Jan 31 2018 (not grandfathered)
    #[test]
    fn test_section_112a_bought_after_jan_31_2018_not_grandfathered() {
        let buy_lot = BuyLot::new(date(2018, 2, 1), units("100"), nav("50"), money("5000"));
        let fmv = nav("100");
        let sell_nav = nav("150");
        let sell_date = date(2024, 8, 1);

        let gain = calculate_gain(
            "Bluechip Growth Fund",
            AssetType::MutualFund,
            &buy_lot,
            units("100"),
            sell_nav,
            sell_date,
            dec("0.3"),
            Some(fmv),
        );

        // Acquired after 31-Jan-2018: Grandfathering does not apply!
        // Deemed cost = 100 * 50 = 5,000
        // Gross consideration = 100 * 150 = 15,000
        // Gain = 10,000
        assert!(!gain.is_grandfathered);
        assert_eq!(gain.deemed_cost_of_acquisition, money("5000"));
        assert_eq!(gain.gain, money("10000"));
    }

    // 4. ELSS lock-in date calculations across leap years
    #[test]
    fn test_elss_lock_in_date_calculations_across_leap_years() {
        // Purchased on leap day: 2020-02-29
        let leap_buy = date(2020, 2, 29);
        let expiry = elss_lock_in_expiry(leap_buy);
        // 2023 is non-leap year: matures on Feb 28, 2023
        assert_eq!(expiry, date(2023, 2, 28));

        assert!(is_lot_locked(leap_buy, date(2023, 2, 27)));
        assert!(!is_lot_locked(leap_buy, date(2023, 2, 28)));
        assert!(!is_lot_locked(leap_buy, date(2023, 3, 1)));

        // Purchased on Feb 28 in non-leap year: 2021-02-28
        let non_leap_buy = date(2021, 2, 28);
        let expiry_2024 = elss_lock_in_expiry(non_leap_buy);
        // 2024 is leap year: matures on Feb 28, 2024
        assert_eq!(expiry_2024, date(2024, 2, 28));
    }

    // 5. Debt post-April 2023 taxation classification
    #[test]
    fn test_debt_post_april_2023_taxation_classification() {
        // Post 01-Apr-2023 purchase: Section 50AA applies (Slab rate regardless of holding period)
        let new_debt_lot =
            BuyLot::new(date(2023, 4, 2), units("1000"), nav("100"), money("100000"));
        let sell_nav = nav("130");
        // Held for 4 years (well over 3 years)
        let sell_date = date(2027, 4, 2);

        let gain_new = calculate_gain(
            "Corporate Bond Debt Fund",
            AssetType::MutualFund,
            &new_debt_lot,
            units("1000"),
            sell_nav,
            sell_date,
            dec("0.30"),
            None,
        );

        assert_eq!(gain_new.tax_type, TaxType::Slab);
        assert_eq!(gain_new.section, TaxSection::Sec50AA);
        assert_eq!(gain_new.holding_type, HoldingType::ShortTerm);
        assert!(!gain_new.is_grandfathered);

        // Pre 01-Apr-2023 purchase: Eligible for LTCG with indexation / lower rate
        let old_debt_lot =
            BuyLot::new(date(2022, 1, 1), units("1000"), nav("100"), money("100000"));
        let gain_old = calculate_gain(
            "Corporate Bond Debt Fund",
            AssetType::MutualFund,
            &old_debt_lot,
            units("1000"),
            sell_nav,
            date(2025, 2, 1), // > 3 years, post Budget 2024
            dec("0.30"),
            None,
        );

        assert_eq!(gain_old.tax_type, TaxType::Ltcg);
        assert_eq!(gain_old.section, TaxSection::Sec112Debt12_5);
        assert_eq!(gain_old.holding_type, HoldingType::LongTerm);
        assert!(gain_old.is_grandfathered);
    }
}
