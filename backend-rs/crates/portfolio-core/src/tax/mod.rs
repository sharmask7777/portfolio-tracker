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

/// Calculates portfolio-level realized and unrealized tax across all transactions in a scheme/folio.
pub fn calculate_portfolio_tax(
    asset_name: &str,
    asset_type: AssetType,
    transactions: &[Transaction],
    current_nav: Nav,
    tax_slab: Decimal,
    grandfather_nav: Option<Nav>,
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
            slab: realized_slab,
            total: realized_stcg + realized_ltcg + realized_slab,
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
