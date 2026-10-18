//! Statutory lock-in rules, asset classification, and redemption simulation.
//!
//! Enforces:
//! - ELSS (Equity Linked Savings Scheme) 3-year statutory lock-in from each SIP/purchase lot date.
//! - Leap-year robust lock-in maturity date arithmetic.
//! - Sell simulation verifying unlocked unit availability before calculating tax consequences.

use chrono::{Datelike, NaiveDate};
use rust_decimal::Decimal;

use crate::error::PortfolioError;
use crate::holdings::{Folio, Transaction, process_fifo_lots};
use crate::tax::grandfathering::calculate_gain;
use crate::tax::{BuyLot, SellSimulation};
use crate::types::{AssetType, Money, Nav, Units};

/// Checks if a mutual fund scheme is an ELSS (Equity Linked Savings Scheme) based on scheme name.
pub fn is_elss(asset_name: &str) -> bool {
    let lower = asset_name.to_lowercase();
    lower.contains("elss") || lower.contains("tax saver") || lower.contains("tax plan")
}

/// Checks if an asset is an ELSS mutual fund.
pub fn is_elss_scheme(asset_type: AssetType, asset_name: &str) -> bool {
    matches!(asset_type, AssetType::MutualFund) && is_elss(asset_name)
}

/// Checks if an asset is classified as equity for Indian capital gains taxation.
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

/// Computes the exact 3-year lock-in maturity date for an ELSS lot.
///
/// Handles leap-year transitions deterministically:
/// A purchase made on Feb 29 (leap year) matures on Feb 28 of the non-leap target year.
pub fn elss_lock_in_expiry(purchase_date: NaiveDate) -> NaiveDate {
    let target_year = purchase_date.year() + 3;
    let month = purchase_date.month();
    let day = purchase_date.day();

    NaiveDate::from_ymd_opt(target_year, month, day).unwrap_or_else(|| {
        // Feb 29 in leap year -> Feb 28 in target non-leap year
        NaiveDate::from_ymd_opt(target_year, month, 28)
            .expect("Feb 28 is always a valid calendar date")
    })
}

/// Returns true if an ELSS purchase lot is still within its 3-year statutory lock-in period as of `as_of`.
pub fn is_lot_locked(purchase_date: NaiveDate, as_of: NaiveDate) -> bool {
    as_of < elss_lock_in_expiry(purchase_date)
}

/// Computes locked units for ELSS funds subject to the 3-year statutory lock-in requirement.
///
/// For non-ELSS assets, returns `Units::ZERO`.
/// For ELSS assets, evaluates all active remaining FIFO lots against `as_of`.
pub fn get_locked_units(asset_name: &str, transactions: &[Transaction], as_of: NaiveDate) -> Units {
    if !is_elss(asset_name) {
        return Units::ZERO;
    }

    let (active_lots, _) = process_fifo_lots(transactions);
    let mut locked_units = Units::ZERO;

    for lot in active_lots {
        if is_lot_locked(lot.purchase_date, as_of) {
            locked_units += lot.remaining_units;
        }
    }

    locked_units
}

/// Simulates a redemption across a raw transaction slice, enforcing lock-in and FIFO lot depletion.
#[allow(clippy::too_many_arguments)]
pub fn simulate_sell_transactions(
    asset_name: &str,
    asset_type: AssetType,
    transactions: &[Transaction],
    units_to_sell: Units,
    sell_date: NaiveDate,
    current_price: Nav,
    tax_slab: Decimal,
    grandfather_nav: Option<Nav>,
) -> Result<SellSimulation, PortfolioError> {
    let (active_lots, _) = process_fifo_lots(transactions);
    let total_units: Units = active_lots.iter().map(|l| l.remaining_units).sum();

    if units_to_sell > total_units {
        return Err(PortfolioError::InsufficientUnits {
            available: total_units,
            requested: units_to_sell,
        });
    }

    if is_elss(asset_name) {
        let locked_units = get_locked_units(asset_name, transactions, sell_date);
        let available_units = total_units - locked_units;

        if units_to_sell > available_units {
            return Err(PortfolioError::UnitsLocked {
                available: available_units,
                locked: locked_units,
            });
        }
    }

    let mut remaining_to_sell = units_to_sell;
    let mut matched_lots = Vec::new();
    let mut total_gain = Money::ZERO;
    let mut taxable_gain = Money::ZERO;
    let mut estimated_tax = Money::ZERO;

    for lot in &active_lots {
        if remaining_to_sell <= Units::ZERO {
            break;
        }

        let units_from_lot = remaining_to_sell.min(lot.remaining_units);
        let buy_lot = BuyLot::new(
            lot.purchase_date,
            units_from_lot,
            lot.purchase_nav,
            units_from_lot * lot.purchase_nav,
        );

        let gain_record = calculate_gain(
            asset_name,
            asset_type,
            &buy_lot,
            units_from_lot,
            current_price,
            sell_date,
            tax_slab,
            grandfather_nav,
        );

        total_gain += gain_record.gain;
        if gain_record.gain.is_positive() {
            taxable_gain += gain_record.gain;
        }
        estimated_tax += gain_record.estimated_tax;
        matched_lots.push(gain_record);

        remaining_to_sell -= units_from_lot;
    }

    let estimated_value = units_to_sell * current_price;
    let exit_load = Money::ZERO;

    Ok(SellSimulation {
        asset_name: asset_name.to_string(),
        units_to_sell,
        estimated_value,
        total_gain,
        taxable_gain,
        estimated_tax,
        exit_load,
        matched_lots,
    })
}

/// Simulates selling units from a folio, enforcing ELSS lock-in checks and FIFO lot matching.
pub fn simulate_sell(
    folio: &Folio,
    units_to_sell: Units,
    sell_date: NaiveDate,
    current_price: Nav,
    tax_slab: Decimal,
) -> Result<SellSimulation, PortfolioError> {
    simulate_sell_transactions(
        &folio.asset_name,
        folio.asset_type,
        &folio.transactions,
        units_to_sell,
        sell_date,
        current_price,
        tax_slab,
        None,
    )
}
