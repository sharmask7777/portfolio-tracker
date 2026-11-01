//! Section 112A Statutory Grandfathering and Capital Gains calculation.
//!
//! Implements Indian Income Tax Act capital gains taxation rules:
//! - Section 112A / Section 55(2)(ac) LTCG grandfathering using 31-Jan-2018 Fair Market Value (FMV) NAV.
//! - Pre/Post-Budget 2024 (23-Jul-2024) rates and holding period thresholds.
//! - Finance Act 2023 Section 50AA debt mutual fund taxation (post 01-Apr-2023 purchase).
//! - Pre-Finance Act 2023 debt fund indexation / LTCG holding periods.

use chrono::NaiveDate;
use rust_decimal::Decimal;

pub use crate::tax::classification::TaxClassification;
pub use crate::tax::constants::*;
use crate::tax::rules::is_equity;
use crate::tax::{BuyLot, RealizedGain};
use crate::types::{AssetType, Money, Nav, Units};

/// Computes deemed cost of acquisition under Section 55(2)(ac) of the Income Tax Act, 1961.
///
/// # Statutory Context & Grandfathering Formula:
/// Introduced by Finance Act 2018 when LTCG tax on listed equity and equity mutual funds was
/// reintroduced under Section 112A. Any gains accrued up to January 31, 2018 are grandfathered (tax-exempt).
///
/// For an equity asset acquired on or before January 31, 2018 and held long-term (> 12 months):
/// ```text
/// deemed_unit_nav = max(actual_purchase_nav, min(fmv_as_of_jan31_2018, sell_nav))
/// deemed_cost = units * deemed_unit_nav
/// ```
///
/// # Statutory Scenarios & Loss Limitation:
/// 1. **Sell Price > FMV > Buy Price**:
///    `min(fmv, sell) = fmv`, so `deemed_unit_nav = fmv`.
///    Capital gain is calculated only on appreciation occurring after Jan 31, 2018 (`sell - fmv`).
///    All historical gains accrued up to Jan 31, 2018 are completely tax-exempt.
///
/// 2. **Buy Price < Sell Price < FMV (Loss Limitation Rule)**:
///    `min(fmv, sell) = sell`, so `deemed_unit_nav = max(buy, sell) = sell`.
///    Taxable gain is `sell - sell = 0`.
///    The statute explicitly prevents taxpayers from creating artificial capital losses against the
///    Jan 31, 2018 FMV when the position is actually sold at a net economic profit over original cost.
///
/// 3. **Sell Price < Buy Price < FMV (Genuine Economic Loss)**:
///    `min(fmv, sell) = sell`, so `deemed_unit_nav = max(buy, sell) = buy`.
///    Capital loss is `sell - buy`.
///    The genuine out-of-pocket economic loss is fully preserved and eligible for capital loss set-off.
///
/// # Arguments
/// * `buy_date` - Calendar date when units were acquired.
/// * `sell_date` - Calendar date when units were redeemed or sold.
/// * `units` - Number of units being redeemed.
/// * `actual_nav` - Original purchase price per unit.
/// * `sell_nav` - Redemption price per unit.
/// * `grandfather_nav` - Highest NAV recorded on January 31, 2018 (FMV).
/// * `is_equity_asset` - Whether the security is classified as an equity instrument.
/// * `is_anchor` - Whether the lot is a synthetic anchor lot (bypasses grandfathering).
///
/// # Returns
/// A tuple containing:
/// `(deemed_cost, is_grandfathered, status_description, fmv_nav, total_fmv_amount)`
#[allow(clippy::too_many_arguments)]
pub fn compute_deemed_cost(
    buy_date: NaiveDate,
    sell_date: NaiveDate,
    units: Units,
    actual_nav: Nav,
    sell_nav: Nav,
    grandfather_nav: Option<Nav>,
    is_equity_asset: bool,
    is_anchor: bool,
) -> (Money, bool, String, Nav, Money) {
    let cost_of_acquisition = actual_nav * units;
    let anniversary = buy_date
        .checked_add_months(chrono::Months::new(12))
        .unwrap_or(buy_date + chrono::Duration::days(365));
    let is_long_term = sell_date > anniversary;

    if is_equity_asset && buy_date <= GRANDFATHER_DATE && is_long_term && !is_anchor {
        let is_grandfathered = true;
        let status = "Grandfathered u/s 55(2)(ac)".to_string();

        if let Some(fmv) = grandfather_nav {
            // Statutory formula: Deemed Unit Cost = max(Buy Price, min(Grandfather NAV, Sell Price))
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
///
/// Convenience wrapper over [`calculate_gain_with_expenses`] with zero transfer expenses.
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
///
/// # Statutory Computation Steps:
/// 1. Classifies the transaction under [`TaxClassification::classify`].
/// 2. Derives deemed cost of acquisition via [`compute_deemed_cost`].
/// 3. Computes net capital gain:
///    `gain = gross_consideration - deemed_cost_of_acquisition - transfer_expenses`
/// 4. If `gain > 0`, applies statutory tax rate:
///    `tax_before_cess = gain * tax_rate`
/// 5. Computes statutory 4% Health and Education Cess:
///    `cess = tax_before_cess * 0.04`
///    `estimated_tax = tax_before_cess + cess`
///
/// # Arguments
/// * `asset_name` - Descriptive name of the asset/fund.
/// * `asset_type` - Mutual fund, stock, fixed deposit, etc.
/// * `lot` - Matched acquisition [`BuyLot`].
/// * `units_sold` - Number of units being redeemed.
/// * `sell_nav` - Per-unit realization price.
/// * `sell_date` - Date of realization.
/// * `tax_slab` - Applicable slab rate for short-term debt gains.
/// * `grandfather_nav` - Optional FMV NAV as of 31-Jan-2018.
/// * `transfer_expenses` - Exit load or brokerage expenses deducted from proceeds.
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
    let is_eq = is_equity(asset_type, asset_name);
    let asset_class = if is_eq {
        "Equity".to_string()
    } else if asset_type == AssetType::FixedDeposit {
        "Fixed Deposit".to_string()
    } else {
        "Debt".to_string()
    };

    let classification = TaxClassification::classify(is_eq, buy_date, sell_date, tax_slab);
    let holding_type = classification.holding_type;
    let tax_type = classification.tax_type;
    let section = classification.section;
    let tax_rate = classification.tax_rate;
    let holding_period_days = classification.holding_days;

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
        sell_date,
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
