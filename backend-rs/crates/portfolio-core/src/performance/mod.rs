//! Performance metrics and return calculations (Absolute Return, CAGR, XIRR).

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::error::PortfolioError;
use crate::holdings::Transaction;
use crate::types::{AssetType, Money, Nav, Units};

/// Comprehensive performance metrics for a position, folio, or aggregated portfolio.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub invested_amount: Money,
    pub current_value: Money,
    pub total_gain: Money,
    pub absolute_return: Decimal,
    pub cagr: Option<Decimal>,
    pub xirr: Option<Decimal>,
    pub post_tax_xirr: Option<Decimal>,
    pub post_tax_absolute_return: Option<Decimal>,
    pub estimated_tax: Option<Money>,
}

/// Optional configuration and overrides for performance calculation.
#[derive(Debug, Clone, Default)]
pub struct PerformanceOptions {
    pub current_units_override: Option<Units>,
    pub tax_slab: Option<Decimal>,
    pub asset_type: Option<AssetType>,
    pub asset_name: Option<String>,
}

impl PerformanceOptions {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_units_override(mut self, units: Units) -> Self {
        self.current_units_override = Some(units);
        self
    }

    pub fn with_tax_slab(mut self, slab: Decimal) -> Self {
        self.tax_slab = Some(slab);
        self
    }

    pub fn with_asset_type(mut self, asset_type: AssetType) -> Self {
        self.asset_type = Some(asset_type);
        self
    }

    pub fn with_asset_name(mut self, asset_name: impl Into<String>) -> Self {
        self.asset_name = Some(asset_name.into());
        self
    }
}

/// A dated cash flow record for XIRR calculation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CashFlow {
    pub amount: Money,
    pub date: NaiveDate,
}

impl CashFlow {
    pub fn new(amount: Money, date: NaiveDate) -> Self {
        Self { amount, date }
    }
}

/// Calculates absolute return: `(current_value - invested_amount) / invested_amount`.
pub fn calculate_absolute_return(invested_amount: Money, current_value: Money) -> Decimal {
    if invested_amount.is_zero() || invested_amount.is_negative() {
        return Decimal::ZERO;
    }
    let gain = current_value - invested_amount;
    gain / invested_amount
}

/// Calculates Compound Annual Growth Rate (CAGR).
///
/// NOTE: In TDD RED state, this returns Decimal::ZERO.
pub fn calculate_cagr(
    _invested_amount: Money,
    _current_value: Money,
    _start_date: NaiveDate,
    _end_date: NaiveDate,
) -> Decimal {
    // RED phase stub
    Decimal::ZERO
}

/// Calculates Extended Internal Rate of Return (XIRR).
///
/// NOTE: In TDD RED state, this returns Ok(Decimal::ZERO).
pub fn calculate_xirr(
    _flows: &[CashFlow],
    _current_value: Money,
    _as_of_date: NaiveDate,
) -> Result<Decimal, PortfolioError> {
    // RED phase stub
    Ok(Decimal::ZERO)
}

/// Aggregates metrics for a given set of transactions and current valuation price.
pub fn get_metrics(
    transactions: &[Transaction],
    current_price: Nav,
    options: Option<PerformanceOptions>,
) -> PerformanceMetrics {
    let current_units = options
        .as_ref()
        .and_then(|o| o.current_units_override)
        .unwrap_or_else(|| crate::holdings::get_latest_units(transactions));

    if current_units.is_zero() || current_units.is_negative() {
        return PerformanceMetrics {
            invested_amount: Money::ZERO,
            current_value: Money::ZERO,
            total_gain: Money::ZERO,
            absolute_return: Decimal::ZERO,
            cagr: None,
            xirr: None,
            post_tax_xirr: None,
            post_tax_absolute_return: None,
            estimated_tax: None,
        };
    }

    let current_value = current_price * current_units;

    // Calculate invested amount from active FIFO tax lots
    let (active_lots, _) = crate::holdings::process_fifo_lots(transactions);
    let active_lot_units: Units = active_lots.iter().map(|l| l.remaining_units).sum();

    let invested_amount = if active_lot_units.is_positive() {
        let fifo_cost: Money = active_lots
            .iter()
            .map(|lot| lot.remaining_units * lot.purchase_nav)
            .sum();

        // If units were overridden and differ from active lots, pro-rate cost
        if current_units == active_lot_units {
            fifo_cost
        } else {
            let ratio = (current_units / active_lot_units).unwrap_or(Decimal::ONE);
            fifo_cost * ratio
        }
    } else {
        Money::ZERO
    };

    let total_gain = current_value - invested_amount;
    let absolute_return = calculate_absolute_return(invested_amount, current_value);

    PerformanceMetrics {
        invested_amount,
        current_value,
        total_gain,
        absolute_return,
        cagr: None,
        xirr: None,
        post_tax_xirr: None,
        post_tax_absolute_return: None,
        estimated_tax: None,
    }
}
