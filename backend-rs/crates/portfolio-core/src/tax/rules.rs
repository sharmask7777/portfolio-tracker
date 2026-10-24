//! Statutory lock-in rules, asset classification, and redemption simulation.
//!
//! Enforces:
//! - ELSS (Equity Linked Savings Scheme) 3-year statutory lock-in from each SIP/purchase lot date.
//! - Leap-year robust lock-in maturity date arithmetic.
//! - Sell simulation verifying unlocked unit availability before calculating tax consequences.

use std::str::FromStr;

use chrono::{Datelike, NaiveDate};
use rust_decimal::Decimal;

use crate::error::PortfolioError;
use crate::holdings::{Folio, Transaction, process_fifo_lots};
use crate::tax::grandfathering::calculate_gain_with_expenses;
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

/// Parses tiered or conditional exit load percentage from fund metadata text.
pub fn parse_exit_load_from_metadata(metadata: &str, holding_days: i64) -> Option<Decimal> {
    let lower = metadata.trim().to_lowercase();
    if lower.is_empty() {
        return None;
    }

    if lower == "nil" || lower == "no exit load" || lower == "nil." || lower == "none" {
        return Some(Decimal::ZERO);
    }

    for prefix in [
        "nil after",
        "nil beyond",
        "no exit load after",
        "no exit load beyond",
    ] {
        if let Some(idx) = lower.find(prefix) {
            let rest = &lower[idx + prefix.len()..];
            let num_str: String = rest
                .chars()
                .skip_while(|c| c.is_whitespace())
                .take_while(|c| c.is_ascii_digit())
                .collect();
            if let Ok(days) = num_str.parse::<i64>()
                && holding_days > days
            {
                return Some(Decimal::ZERO);
            }
        }
    }

    let mut tiers: Vec<(Decimal, i64)> = Vec::new();
    let parts: Vec<&str> = lower.split('%').collect();
    if parts.len() > 1 {
        for i in 0..parts.len() - 1 {
            let left = parts[i];
            let right = parts[i + 1];

            let percent_str: String = left
                .chars()
                .rev()
                .take_while(|c| c.is_ascii_digit() || *c == '.')
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect();

            if let Some(days_pos) = right.find("day") {
                let before_days = &right[..days_pos];
                let days_str: String = before_days
                    .chars()
                    .rev()
                    .skip_while(|c| c.is_whitespace())
                    .take_while(|c| c.is_ascii_digit())
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rev()
                    .collect();

                if let (Ok(p), Ok(d)) = (Decimal::from_str(&percent_str), days_str.parse::<i64>())
                    && p <= Decimal::from(100)
                    && d > 0
                {
                    tiers.push((p / Decimal::from(100), d));
                }
            }
        }
    }

    if !tiers.is_empty() {
        tiers.sort_by_key(|t| t.1);
        for (rate, limit_days) in tiers {
            if holding_days <= limit_days {
                return Some(rate);
            }
        }
        return Some(Decimal::ZERO);
    }

    None
}

/// Calculates the estimated exit load for a redemption lot.
pub fn get_exit_load(
    asset_name: &str,
    asset_type: AssetType,
    buy_date: NaiveDate,
    sell_date: NaiveDate,
    value: Money,
    metadata: Option<&str>,
) -> Money {
    if asset_type == AssetType::Stock || asset_type != AssetType::MutualFund {
        return Money::ZERO;
    }

    let diff_days = (sell_date - buy_date).num_days().max(0);

    // Priority 1 - Fund-Specific Metadata
    if let Some(rate) = metadata.and_then(|meta| parse_exit_load_from_metadata(meta, diff_days)) {
        return Money::new(value.to_decimal() * rate);
    }

    // ELSS: 0% exit load (statutory 3-year lock-in applies instead)
    if is_elss(asset_name) {
        return Money::ZERO;
    }

    let lower = asset_name.to_lowercase();

    // Parag Parikh Flexi Cap: 2% < 365d, 1% < 730d, 0% thereafter
    if lower.contains("parag parikh") {
        if diff_days < 365 {
            return Money::new(value.to_decimal() * Decimal::from_parts(2, 0, 0, false, 2));
        }
        if diff_days < 730 {
            return Money::new(value.to_decimal() * Decimal::from_parts(1, 0, 0, false, 2));
        }
        return Money::ZERO;
    }

    // Arbitrage funds: 0.25% < 30 days
    if lower.contains("arbitrage") {
        if diff_days < 30 {
            return Money::new(value.to_decimal() * Decimal::from_parts(25, 0, 0, false, 4));
        }
        return Money::ZERO;
    }

    // Liquid funds: graduated 7-day exit load schedule
    if lower.contains("liquid") {
        let rate = match diff_days {
            0 | 1 => Some(Decimal::from_parts(70, 0, 0, false, 6)), // 0.000070
            2 => Some(Decimal::from_parts(65, 0, 0, false, 6)),     // 0.000065
            3 => Some(Decimal::from_parts(60, 0, 0, false, 6)),     // 0.000060
            4 => Some(Decimal::from_parts(55, 0, 0, false, 6)),     // 0.000055
            5 => Some(Decimal::from_parts(50, 0, 0, false, 6)),     // 0.000050
            6 => Some(Decimal::from_parts(45, 0, 0, false, 6)),     // 0.000045
            _ => None,
        };
        if let Some(r) = rate {
            return Money::new(value.to_decimal() * r);
        }
        return Money::ZERO;
    }

    // Overnight funds: 0%
    if lower.contains("overnight") {
        return Money::ZERO;
    }

    // Standard Equity rule: 1% if sold within 1 year (365 days)
    if is_equity(asset_type, asset_name) {
        if diff_days < 365 {
            return Money::new(value.to_decimal() * Decimal::from_parts(1, 0, 0, false, 2));
        }
        return Money::ZERO;
    }

    // Default Debt rule: 0.5% if sold within 90 days
    if diff_days < 90 {
        return Money::new(value.to_decimal() * Decimal::from_parts(5, 0, 0, false, 3));
    }

    Money::ZERO
}

/// Simulates a redemption across a raw transaction slice, enforcing lock-in, exit load, and FIFO lot depletion.
#[allow(clippy::too_many_arguments)]
pub fn simulate_sell_transactions_with_metadata(
    asset_name: &str,
    asset_type: AssetType,
    transactions: &[Transaction],
    units_to_sell: Units,
    sell_date: NaiveDate,
    current_price: Nav,
    tax_slab: Decimal,
    grandfather_nav: Option<Nav>,
    exit_load_metadata: Option<&str>,
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
    let mut total_exit_load = Money::ZERO;

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

        let lot_value = units_from_lot * current_price;
        let lot_exit_load = get_exit_load(
            asset_name,
            asset_type,
            lot.purchase_date,
            sell_date,
            lot_value,
            exit_load_metadata,
        );
        total_exit_load += lot_exit_load;

        let gain_record = calculate_gain_with_expenses(
            asset_name,
            asset_type,
            &buy_lot,
            units_from_lot,
            current_price,
            sell_date,
            tax_slab,
            grandfather_nav,
            lot_exit_load,
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

    Ok(SellSimulation {
        asset_name: asset_name.to_string(),
        units_to_sell,
        estimated_value,
        total_gain,
        taxable_gain,
        estimated_tax,
        exit_load: total_exit_load,
        matched_lots,
    })
}

/// Backward-compatible wrapper defaulting exit load metadata to None.
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
    simulate_sell_transactions_with_metadata(
        asset_name,
        asset_type,
        transactions,
        units_to_sell,
        sell_date,
        current_price,
        tax_slab,
        grandfather_nav,
        None,
    )
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
