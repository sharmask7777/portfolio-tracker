//! Performance metrics calculation (Invested, Current Value, Gains, Absolute Return, CAGR, XIRR).

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
    pub as_of_date: Option<NaiveDate>,
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

    pub fn with_as_of_date(mut self, date: NaiveDate) -> Self {
        self.as_of_date = Some(date);
        self
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
/// Formula: `(current_value / invested_amount) ^ (1 / years) - 1`, where `years = diff_days / 365.25`.
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

    let mut flows: Vec<CashFlow> = transactions
        .iter()
        .map(|t| {
            let amount = if t.tx_type.is_outflow() {
                -t.amount.abs()
            } else if t.tx_type.is_inflow() {
                t.amount.abs()
            } else {
                t.amount
            };
            CashFlow::new(t.date, amount.to_decimal())
        })
        .collect();

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
        let tax_summary = crate::tax::calculate_portfolio_tax(
            asset_name,
            *asset_type,
            transactions,
            current_price,
            *tax_slab,
            None,
        );
        let tax = tax_summary.unrealized.total;
        estimated_tax = Some(tax);
        let post_tax_val = if current_value > tax {
            current_value - tax
        } else {
            Money::ZERO
        };
        post_tax_absolute_return = Some(calculate_absolute_return(invested_amount, post_tax_val));

        let mut post_tax_flows: Vec<CashFlow> = transactions
            .iter()
            .map(|t| {
                let amount = if t.tx_type.is_outflow() {
                    -t.amount.abs()
                } else if t.tx_type.is_inflow() {
                    t.amount.abs()
                } else {
                    t.amount
                };
                CashFlow::new(t.date, amount.to_decimal())
            })
            .collect();
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
        assert_eq!(metrics.estimated_tax, Some(money("5000")));
        assert_eq!(metrics.post_tax_absolute_return, Some(Decimal::ZERO));
        assert_eq!(metrics.post_tax_xirr, Some(Decimal::ZERO));
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
