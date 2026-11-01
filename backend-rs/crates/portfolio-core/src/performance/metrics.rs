//! Performance metrics calculation (Invested, Current Value, Gains, Absolute Return, CAGR, XIRR).
//!
//! Provides comprehensive portfolio return analytics adhering to institutional financial standards:
//!
//! - **Absolute Return**: Net nominal gain as a percentage of total invested capital:
//!   $$\text{Absolute Return} = \frac{\text{Current Value} - \text{Invested Capital}}{\text{Invested Capital}}$$
//! - **CAGR (Compound Annual Growth Rate)**: Point-to-point geometric progression rate:
//!   $$\text{CAGR} = \left(\frac{\text{Current Value}}{\text{Invested Capital}}\right)^{\frac{365.25}{\text{days}}} - 1$$
//! - **XIRR (Internal Rate of Return)**: Cash-flow-weighted annualized return solving $NPV(r) = 0$.
//! - **Post-Tax Returns**: Calculates estimated unrealized tax liability using applicable tax slabs
//!   and derives net-of-tax portfolio value, post-tax absolute return, and post-tax XIRR.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};

use crate::error::PortfolioError;
use crate::holdings::Transaction;
use crate::performance::xirr::{CashFlow, calculate_xirr};
use crate::types::{AssetType, Money, Nav, Units};

/// Comprehensive performance metrics for a position, folio, or aggregated portfolio.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerformanceMetrics {
    /// Total capital invested across active holding units.
    pub invested_amount: Money,
    /// Current gross market valuation (`units * current_nav`).
    pub current_value: Money,
    /// Total nominal capital gain or loss (`current_value - invested_amount`).
    pub total_gain: Money,
    /// Simple nominal percentage return (`total_gain / invested_amount`).
    pub absolute_return: Decimal,
    /// Annualized compound growth rate for multi-day single-investment spans.
    pub cagr: Option<Decimal>,
    /// Money-weighted annualized internal rate of return across all cash flows.
    pub xirr: Option<Decimal>,
    /// Annualized internal rate of return net of estimated unrealized capital gains tax.
    pub post_tax_xirr: Option<Decimal>,
    /// Absolute percentage return net of estimated unrealized capital gains tax.
    pub post_tax_absolute_return: Option<Decimal>,
    /// Estimated statutory tax liability on unrealized gains.
    pub estimated_tax: Option<Money>,
}

/// Optional configuration and overrides for performance calculation.
#[derive(Debug, Clone, Default)]
pub struct PerformanceOptions {
    /// Explicit unit balance override (e.g. from CAMS/KFintech CAS statement).
    pub current_units_override: Option<Units>,
    /// Marginal tax slab applicable to the investor (e.g. `0.30` for 30%).
    pub tax_slab: Option<Decimal>,
    /// Asset class (MutualFund, Stock, etc.).
    pub asset_type: Option<AssetType>,
    /// Scheme or security name.
    pub asset_name: Option<String>,
    /// As-of evaluation date for valuation and XIRR terminal cash flow.
    pub as_of_date: Option<NaiveDate>,
}

impl PerformanceOptions {
    /// Creates a new default [`PerformanceOptions`].
    pub fn new() -> Self {
        Self::default()
    }

    /// Builder method specifying an explicit active unit balance override.
    pub fn with_units_override(mut self, units: Units) -> Self {
        self.current_units_override = Some(units);
        self
    }

    /// Builder method specifying the investor's tax slab.
    pub fn with_tax_slab(mut self, slab: Decimal) -> Self {
        self.tax_slab = Some(slab);
        self
    }

    /// Builder method specifying the asset type.
    pub fn with_asset_type(mut self, asset_type: AssetType) -> Self {
        self.asset_type = Some(asset_type);
        self
    }

    /// Builder method specifying the asset name.
    pub fn with_asset_name(mut self, asset_name: impl Into<String>) -> Self {
        self.asset_name = Some(asset_name.into());
        self
    }

    /// Builder method specifying the valuation as-of date.
    pub fn with_as_of_date(mut self, date: NaiveDate) -> Self {
        self.as_of_date = Some(date);
        self
    }
}

/// Calculates absolute return: `(current_value - invested_amount) / invested_amount`.
///
/// Returns `Decimal::ZERO` if invested amount is zero or negative.
pub fn calculate_absolute_return(invested_amount: Money, current_value: Money) -> Decimal {
    if invested_amount.is_zero() || invested_amount.is_negative() {
        return Decimal::ZERO;
    }
    let gain = current_value - invested_amount;
    gain / invested_amount
}

/// Calculates Compound Annual Growth Rate (CAGR).
///
/// # Mathematical Formulation:
///
/// $$\text{CAGR} = \left(\frac{\text{current\_value}}{\text{invested\_amount}}\right)^{\frac{1}{\text{years}}} - 1$$
///
/// where $\text{years} = \frac{\text{end\_date} - \text{start\_date}}{365.25}$.
/// The 365.25 factor accounts for leap years over multi-year holding periods.
///
/// # Errors
/// - [`PortfolioError::InvalidTransaction`] if `invested_amount <= 0`, `current_value < 0`,
///   or `end_date <= start_date`.
pub fn calculate_cagr(
    invested_amount: Money,
    current_value: Money,
    start_date: NaiveDate,
    end_date: NaiveDate,
) -> Result<Decimal, PortfolioError> {
    if invested_amount <= Money::ZERO {
        return Err(PortfolioError::InvalidTransaction {
            reason: "Invested amount must be greater than zero for CAGR calculation".to_string(),
        });
    }
    if current_value < Money::ZERO {
        return Err(PortfolioError::InvalidTransaction {
            reason: "Current value cannot be negative for CAGR calculation".to_string(),
        });
    }
    let diff_days = (end_date - start_date).num_days();
    if diff_days <= 0 {
        return Err(PortfolioError::InvalidTransaction {
            reason: "End date must be strictly after start date for CAGR calculation".to_string(),
        });
    }
    if current_value.is_zero() {
        return Ok(Decimal::from(-1));
    }

    let years = diff_days as f64 / 365.25;
    let inv_f64 = invested_amount
        .to_f64()
        .ok_or_else(|| PortfolioError::InvalidTransaction {
            reason: "Failed to convert invested_amount to f64".to_string(),
        })?;
    let cur_f64 = current_value
        .to_f64()
        .ok_or_else(|| PortfolioError::InvalidTransaction {
            reason: "Failed to convert current_value to f64".to_string(),
        })?;

    let ratio = cur_f64 / inv_f64;
    let cagr_f64 = ratio.powf(1.0 / years) - 1.0;

    let dec_cagr =
        Decimal::from_f64_retain(cagr_f64).ok_or_else(|| PortfolioError::InvalidTransaction {
            reason: "Failed to convert CAGR result to Decimal".to_string(),
        })?;

    let rounded = dec_cagr.round_dp(8).normalize();
    if rounded.is_zero() {
        Ok(Decimal::ZERO)
    } else {
        Ok(rounded)
    }
}

/// Aggregates performance metrics for a given set of transactions and current valuation price.
///
/// # Return Computation Process:
/// 1. Resolves active units using options override or [`crate::holdings::get_latest_units`].
/// 2. If active units are zero or negative, computes realized XIRR across past cash flows
///    and sets current holding values to zero.
/// 3. Computes active invested capital via FIFO tax lot cost basis (`units * purchase_nav`).
/// 4. Computes gross market value, nominal gain, absolute return, and CAGR.
/// 5. Constructs dated cash flows including a terminal cash flow `+current_value` at `as_of_date`
///    and solves for annualized XIRR.
/// 6. If tax slab and asset details are provided, calculates estimated unrealized capital gains tax,
///    post-tax valuation, post-tax absolute return, and post-tax XIRR.
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
        let flows: Vec<CashFlow> = transactions.iter().map(|t| t.to_cash_flow()).collect();
        let xirr = calculate_xirr(&flows).ok();

        return PerformanceMetrics {
            invested_amount: Money::ZERO,
            current_value: Money::ZERO,
            total_gain: Money::ZERO,
            absolute_return: Decimal::ZERO,
            cagr: None,
            xirr,
            post_tax_xirr: xirr,
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

    let first_date = transactions.iter().map(|t| t.date).min();
    let last_date = transactions.iter().map(|t| t.date).max();
    let as_of_date = options
        .as_ref()
        .and_then(|o| o.as_of_date)
        .or(last_date)
        .unwrap_or_else(|| chrono::Utc::now().date_naive());

    let cagr = if let Some(start) = first_date {
        if start < as_of_date && invested_amount.is_positive() {
            calculate_cagr(invested_amount, current_value, start, as_of_date).ok()
        } else {
            None
        }
    } else {
        None
    };

    let mut flows: Vec<CashFlow> = transactions.iter().map(|t| t.to_cash_flow()).collect();

    if current_value.is_positive() {
        flows.push(CashFlow::new(as_of_date, current_value.to_decimal()));
    }

    let xirr = calculate_xirr(&flows).ok();

    let mut estimated_tax = None;
    let mut post_tax_xirr = None;
    let mut post_tax_absolute_return = None;

    if let Some(PerformanceOptions {
        tax_slab: Some(tax_slab),
        asset_type: Some(asset_type),
        asset_name: Some(asset_name),
        ..
    }) = options.as_ref()
    {
        let est_tax = crate::tax::calculate_unrealized_tax(
            asset_name,
            *asset_type,
            transactions,
            current_price,
            *tax_slab,
            Some(as_of_date),
            None,
        );
        estimated_tax = Some(est_tax);
        let post_tax_val = if current_value > est_tax {
            current_value - est_tax
        } else {
            Money::ZERO
        };
        post_tax_absolute_return = Some(calculate_absolute_return(invested_amount, post_tax_val));

        let mut post_tax_flows: Vec<CashFlow> =
            transactions.iter().map(|t| t.to_cash_flow()).collect();
        if post_tax_val.is_positive() {
            post_tax_flows.push(CashFlow::new(as_of_date, post_tax_val.to_decimal()));
        }
        post_tax_xirr = calculate_xirr(&post_tax_flows).ok();
    }

    PerformanceMetrics {
        invested_amount,
        current_value,
        total_gain,
        absolute_return,
        cagr,
        xirr,
        post_tax_xirr,
        post_tax_absolute_return,
        estimated_tax,
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

    fn money(s: &str) -> Money {
        Money::from_str(s).expect("valid money")
    }

    fn units(s: &str) -> Units {
        Units::from_str(s).expect("valid units")
    }

    fn nav(s: &str) -> Nav {
        Nav::from_str(s).expect("valid nav")
    }

    #[test]
    fn test_cagr_multi_year_single_investment() {
        // 10,000 invested on 2020-01-01, value 14,641 on 2024-01-01 (4 years = 1461 days / 365.25 = 4.0 years)
        // 10,000 * 1.1^4 = 14,641 -> exactly 10% CAGR
        let cagr = calculate_cagr(
            money("10000"),
            money("14641"),
            date(2020, 1, 1),
            date(2024, 1, 1),
        )
        .expect("CAGR calculation should succeed");

        assert_eq!(cagr, dec("0.1"));
    }

    #[test]
    fn test_cagr_two_year_approximate() {
        // 100 invested on 2022-01-01, value 121 on 2024-01-01
        let cagr = calculate_cagr(
            money("100"),
            money("121"),
            date(2022, 1, 1),
            date(2024, 1, 1),
        )
        .expect("CAGR calculation should succeed");

        // Approximately 10%
        let diff = (cagr - dec("0.10")).abs();
        assert!(diff < dec("0.001"), "CAGR diff was {diff}");
    }

    #[test]
    fn test_cagr_edge_cases() {
        // Zero invested amount -> error
        assert!(matches!(
            calculate_cagr(
                Money::ZERO,
                money("100"),
                date(2023, 1, 1),
                date(2024, 1, 1)
            ),
            Err(PortfolioError::InvalidTransaction { .. })
        ));

        // Negative current value -> error
        assert!(matches!(
            calculate_cagr(
                money("100"),
                money("-50"),
                date(2023, 1, 1),
                date(2024, 1, 1)
            ),
            Err(PortfolioError::InvalidTransaction { .. })
        ));

        // End date <= start date -> error
        assert!(matches!(
            calculate_cagr(
                money("100"),
                money("110"),
                date(2024, 1, 1),
                date(2023, 1, 1)
            ),
            Err(PortfolioError::InvalidTransaction { .. })
        ));
        assert!(matches!(
            calculate_cagr(
                money("100"),
                money("110"),
                date(2024, 1, 1),
                date(2024, 1, 1)
            ),
            Err(PortfolioError::InvalidTransaction { .. })
        ));

        // Zero current value -> 100% loss (-1)
        let total_loss = calculate_cagr(
            money("100"),
            Money::ZERO,
            date(2023, 1, 1),
            date(2024, 1, 1),
        )
        .expect("Zero current value should return -1");
        assert_eq!(total_loss, dec("-1"));
    }

    #[test]
    fn test_absolute_return() {
        assert_eq!(
            calculate_absolute_return(money("100"), money("150")),
            dec("0.5")
        );
        assert_eq!(
            calculate_absolute_return(money("100"), money("80")),
            dec("-0.2")
        );
        assert_eq!(
            calculate_absolute_return(Money::ZERO, money("100")),
            Decimal::ZERO
        );
    }

    #[test]
    fn test_performance_metrics_single_buy_with_as_of_date() {
        use crate::holdings::TransactionType;

        let tx = Transaction::new(
            "tx-1",
            date(2023, 1, 1),
            TransactionType::Purchase,
            money("10000"),
            units("100"),
            nav("100"),
            units("100"),
        );

        // Without as_of_date, single buy defaults to tx.date, so XIRR has identical dates and returns None
        let metrics_no_date = get_metrics(std::slice::from_ref(&tx), nav("120"), None);
        assert_eq!(metrics_no_date.invested_amount, money("10000"));
        assert_eq!(metrics_no_date.current_value, money("12000"));
        assert_eq!(metrics_no_date.total_gain, money("2000"));
        assert_eq!(metrics_no_date.absolute_return, dec("0.2"));
        assert_eq!(metrics_no_date.xirr, None);

        // With explicit as_of_date 1 year later, XIRR and CAGR are calculated accurately
        let options = PerformanceOptions::new().with_as_of_date(date(2024, 1, 1));
        let metrics = get_metrics(&[tx], nav("120"), Some(options));
        assert_eq!(metrics.invested_amount, money("10000"));
        assert_eq!(metrics.current_value, money("12000"));
        assert_eq!(metrics.total_gain, money("2000"));
        assert_eq!(metrics.absolute_return, dec("0.2"));
        assert_eq!(metrics.xirr, Some(dec("0.2")));
        assert!(metrics.cagr.is_some());
    }

    #[test]
    fn test_performance_metrics_with_tax_slab_and_post_tax() {
        use crate::holdings::TransactionType;

        let tx = Transaction::new(
            "tx-1",
            date(2023, 1, 1),
            TransactionType::Purchase,
            money("10000"),
            units("100"),
            nav("100"),
            units("100"),
        );

        let options = PerformanceOptions::new()
            .with_as_of_date(date(2024, 1, 1))
            .with_tax_slab(dec("0.30"))
            .with_asset_type(AssetType::MutualFund)
            .with_asset_name("Test Equity Scheme");

        let metrics = get_metrics(&[tx], nav("150"), Some(options));

        // Invested: 10,000; Current Value: 15,000; Unrealized Gain: 5,000
        assert_eq!(metrics.invested_amount, money("10000"));
        assert_eq!(metrics.current_value, money("15000"));
        assert_eq!(metrics.total_gain, money("5000"));
        assert_eq!(metrics.absolute_return, dec("0.5"));
        assert_eq!(metrics.xirr, Some(dec("0.5")));

        // Post-tax metrics
        // Gain = 5,000; LTCG rate (pre-budget 2024) = 10% -> Tax = 500
        // Post-tax value = 14,500 -> Post-tax return = 45% (0.45)
        assert_eq!(metrics.estimated_tax, Some(money("500")));
        assert_eq!(metrics.post_tax_absolute_return, Some(dec("0.45")));
        assert_eq!(metrics.post_tax_xirr, Some(dec("0.45")));
    }

    #[test]
    fn test_performance_metrics_zero_units_returns_empty() {
        let metrics = get_metrics(&[], nav("100"), None);
        assert_eq!(metrics.invested_amount, Money::ZERO);
        assert_eq!(metrics.current_value, Money::ZERO);
        assert_eq!(metrics.total_gain, Money::ZERO);
        assert_eq!(metrics.absolute_return, Decimal::ZERO);
        assert_eq!(metrics.cagr, None);
        assert_eq!(metrics.xirr, None);
        assert_eq!(metrics.post_tax_xirr, None);
        assert_eq!(metrics.post_tax_absolute_return, None);
        assert_eq!(metrics.estimated_tax, None);
    }

    #[test]
    fn test_performance_metrics_serde_camel_case_parity() {
        use crate::holdings::TransactionType;

        let tx = Transaction::new(
            "tx-1",
            date(2023, 1, 1),
            TransactionType::Purchase,
            money("10000"),
            units("100"),
            nav("100"),
            units("100"),
        );
        let options = PerformanceOptions::new()
            .with_as_of_date(date(2024, 1, 1))
            .with_tax_slab(dec("0.30"))
            .with_asset_type(AssetType::MutualFund)
            .with_asset_name("Test Equity Scheme");

        let metrics = get_metrics(&[tx], nav("150"), Some(options));
        let json = serde_json::to_string(&metrics).expect("serialization should succeed");

        // Verify camelCase JSON keys
        assert!(json.contains("\"investedAmount\":"));
        assert!(json.contains("\"currentValue\":"));
        assert!(json.contains("\"totalGain\":"));
        assert!(json.contains("\"absoluteReturn\":"));
        assert!(json.contains("\"cagr\":"));
        assert!(json.contains("\"xirr\":"));
        assert!(json.contains("\"postTaxXirr\":"));
        assert!(json.contains("\"postTaxAbsoluteReturn\":"));
        assert!(json.contains("\"estimatedTax\":"));

        // Roundtrip deserialization
        let deserialized: PerformanceMetrics =
            serde_json::from_str(&json).expect("deserialization should succeed");
        assert_eq!(deserialized, metrics);
    }
}
