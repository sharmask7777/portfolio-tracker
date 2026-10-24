//! Section 112A Statutory Grandfathering and Capital Gains calculation.
//!
//! Implements Indian Income Tax Act capital gains taxation rules:
//! - Section 112A / Section 55(2)(ac) LTCG grandfathering using 31-Jan-2018 FMV NAV.
//! - Pre/Post-Budget 2024 (23-Jul-2024) rates and holding period thresholds.
//! - Finance Act 2023 Section 50AA debt mutual fund taxation (post 01-Apr-2023 purchase).
//! - Pre-Finance Act 2023 debt fund indexation / LTCG holding periods.

use chrono::NaiveDate;
use rust_decimal::Decimal;

use crate::tax::rules::is_equity;
use crate::tax::{BuyLot, HoldingType, RealizedGain, TaxSection, TaxType};
use crate::types::{AssetType, Money, Nav, Units};

/// Statutory date for Section 55(2)(ac) LTCG Grandfathering (31 January 2018).
pub const GRANDFATHER_DATE: NaiveDate = match NaiveDate::from_ymd_opt(2018, 1, 31) {
    Some(d) => d,
    None => panic!("invalid statutory grandfather date"),
};

/// Budget 2024 effective enactment date (23 July 2024).
pub const BUDGET_2024_DATE: NaiveDate = match NaiveDate::from_ymd_opt(2024, 7, 23) {
    Some(d) => d,
    None => panic!("invalid budget 2024 date"),
};

/// Finance Act 2023 Section 50AA effective purchase date for specified mutual funds (01 April 2023).
pub const DEBT_NEW_REGIME_DATE: NaiveDate = match NaiveDate::from_ymd_opt(2023, 4, 1) {
    Some(d) => d,
    None => panic!("invalid debt regime date"),
};

/// Statutory Health and Education Cess rate (4%).
pub const CESS_RATE: Decimal = Decimal::from_parts(4, 0, 0, false, 2);

/// Computes Section 55(2)(ac) / Section 112A deemed cost of acquisition:
///
/// If asset is equity and purchase date <= 31-Jan-2018 with FMV provided:
///   `deemed_nav = max(actual_purchase_nav, min(fmv, sell_nav))`
///   `deemed_cost = units * deemed_nav`
///   `is_grandfathered = true`
///
/// Loss limitation rule: if `sell_nav < fmv`, deemed NAV drops to `sell_nav`
/// (or `actual_purchase_nav` if `sell_nav < actual_purchase_nav`),
/// preventing artificial capital loss claims while allowing genuine economic loss.
pub fn compute_deemed_cost(
    buy_date: NaiveDate,
    units: Units,
    actual_nav: Nav,
    sell_nav: Nav,
    grandfather_nav: Option<Nav>,
    is_equity_asset: bool,
    is_anchor: bool,
) -> (Money, bool, String, Nav, Money) {
    let cost_of_acquisition = actual_nav * units;

    if is_equity_asset && buy_date <= GRANDFATHER_DATE && !is_anchor {
        let is_grandfathered = true;
        let status = "Grandfathered u/s 55(2)(ac)".to_string();

        if let Some(fmv) = grandfather_nav {
            // Deemed Unit Cost = max(Buy Price, min(Grandfather NAV, Sell Price))
            let deemed_unit_nav = actual_nav.max(fmv.min(sell_nav));
            let deemed_cost = deemed_unit_nav * units;
            let total_fmv = fmv * units;
            (deemed_cost, is_grandfathered, status, fmv, total_fmv)
        } else {
            (
                cost_of_acquisition,
                is_grandfathered,
                status,
                Nav::ZERO,
                Money::ZERO,
            )
        }
    } else if !is_equity_asset && buy_date < DEBT_NEW_REGIME_DATE && !is_anchor {
        (
            cost_of_acquisition,
            true,
            "Grandfathered Debt (Pre-50AA)".to_string(),
            Nav::ZERO,
            Money::ZERO,
        )
    } else {
        (
            cost_of_acquisition,
            false,
            "Non-Grandfathered".to_string(),
            Nav::ZERO,
            Money::ZERO,
        )
    }
}

/// Calculates capital gain for a specific buy lot redemption under Section 112A / Section 55(2)(ac).
#[allow(clippy::too_many_arguments)]
pub fn calculate_gain(
    asset_name: &str,
    asset_type: AssetType,
    lot: &BuyLot,
    units_sold: Units,
    sell_nav: Nav,
    sell_date: NaiveDate,
    tax_slab: Decimal,
    grandfather_nav: Option<Nav>,
) -> RealizedGain {
    calculate_gain_with_expenses(
        asset_name,
        asset_type,
        lot,
        units_sold,
        sell_nav,
        sell_date,
        tax_slab,
        grandfather_nav,
        Money::ZERO,
    )
}

/// Calculates capital gain with optional transfer expenses / exit load.
#[allow(clippy::too_many_arguments)]
pub fn calculate_gain_with_expenses(
    asset_name: &str,
    asset_type: AssetType,
    lot: &BuyLot,
    units_sold: Units,
    sell_nav: Nav,
    sell_date: NaiveDate,
    tax_slab: Decimal,
    grandfather_nav: Option<Nav>,
    transfer_expenses: Money,
) -> RealizedGain {
    let buy_date = lot.date;
    let holding_period_days = (sell_date - buy_date).num_days();

    let is_eq = is_equity(asset_type, asset_name);
    let asset_class = if is_eq {
        "Equity".to_string()
    } else if asset_type == AssetType::FixedDeposit {
        "Fixed Deposit".to_string()
    } else {
        "Debt".to_string()
    };

    let is_post_budget_2024 = sell_date >= BUDGET_2024_DATE;
    let is_post_debt_regime = buy_date >= DEBT_NEW_REGIME_DATE;

    let holding_type: HoldingType;
    let tax_type: TaxType;
    let section: TaxSection;
    let tax_rate: Decimal;

    if is_eq {
        let is_long_term = holding_period_days >= 365;
        holding_type = if is_long_term {
            HoldingType::LongTerm
        } else {
            HoldingType::ShortTerm
        };
        tax_type = if is_long_term {
            TaxType::Ltcg
        } else {
            TaxType::Stcg
        };

        if is_long_term {
            section = if is_post_budget_2024 {
                TaxSection::Sec112A12_5
            } else {
                TaxSection::Sec112A10
            };
            tax_rate = if is_post_budget_2024 {
                Decimal::from_parts(125, 0, 0, false, 3) // 0.125 (12.5%)
            } else {
                Decimal::from_parts(10, 0, 0, false, 2) // 0.10 (10%)
            };
        } else {
            section = if is_post_budget_2024 {
                TaxSection::Sec111A20
            } else {
                TaxSection::Sec111A15
            };
            tax_rate = if is_post_budget_2024 {
                Decimal::from_parts(20, 0, 0, false, 2) // 0.20 (20%)
            } else {
                Decimal::from_parts(15, 0, 0, false, 2) // 0.15 (15%)
            };
        }
    } else if is_post_debt_regime {
        // Finance Act 2023 Sec 50AA: All debt mutual funds purchased >= 01-Apr-2023 are taxed at slab rates
        holding_type = HoldingType::ShortTerm;
        tax_type = TaxType::Slab;
        section = TaxSection::Sec50AA;
        tax_rate = tax_slab;
    } else {
        // Pre-01-Apr-2023 debt funds: indexation / LTCG threshold (3 years / 1095 days, or 730 days post-Budget 2024)
        let lt_threshold = if is_post_budget_2024 { 730 } else { 1095 };
        let is_debt_long_term = holding_period_days >= lt_threshold;

        holding_type = if is_debt_long_term {
            HoldingType::LongTerm
        } else {
            HoldingType::ShortTerm
        };
        tax_type = if is_debt_long_term {
            TaxType::Ltcg
        } else {
            TaxType::Slab
        };

        if is_debt_long_term {
            section = if is_post_budget_2024 {
                TaxSection::Sec112Debt12_5
            } else {
                TaxSection::Sec112Debt20
            };
            tax_rate = if is_post_budget_2024 {
                Decimal::from_parts(125, 0, 0, false, 3) // 12.5%
            } else {
                Decimal::from_parts(20, 0, 0, false, 2) // 20%
            };
        } else {
            section = TaxSection::Slab;
            tax_rate = tax_slab;
        }
    }

    let actual_buy_nav = if lot.is_bonus { Nav::ZERO } else { lot.nav };
    let cost_of_acquisition = actual_buy_nav * units_sold;
    let gross_consideration = sell_nav * units_sold;

    let (
        deemed_cost_of_acquisition,
        is_grandfathered,
        grandfathered_status,
        fmv_as_of_jan31_2018,
        total_fmv_jan31_2018,
    ) = compute_deemed_cost(
        buy_date,
        units_sold,
        actual_buy_nav,
        sell_nav,
        grandfather_nav,
        is_eq,
        lot.is_anchor,
    );

    let gain = gross_consideration - deemed_cost_of_acquisition - transfer_expenses;

    let tax_before_cess = if gain.is_positive() {
        Money::new(gain.to_decimal() * tax_rate)
    } else {
        Money::ZERO
    };

    let cess = Money::new(tax_before_cess.to_decimal() * CESS_RATE);
    let estimated_tax = tax_before_cess + cess;

    RealizedGain {
        asset_name: asset_name.to_string(),
        folio_number: None,
        isin: lot.isin.clone(),
        pan: None,
        asset_class,
        section,
        buy_date,
        sell_date,
        holding_period_days,
        holding_type,
        units: units_sold,
        buy_nav: actual_buy_nav,
        sell_nav,
        gross_consideration,
        cost_of_acquisition,
        fmv_as_of_jan31_2018,
        total_fmv_jan31_2018,
        deemed_cost_of_acquisition,
        transfer_expenses,
        gain,
        tax_type,
        tax_rate,
        tax_before_cess,
        cess,
        estimated_tax,
        is_grandfathered,
        grandfathered_status,
        advance_tax_quarter: Some(crate::tax::AdvanceTaxQuarter::from_date(sell_date)),
    }
}
