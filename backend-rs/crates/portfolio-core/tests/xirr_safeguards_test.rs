use chrono::NaiveDate;
use rust_decimal::Decimal;
use std::str::FromStr;

use portfolio_core::holdings::{Transaction, TransactionType};
use portfolio_core::performance::xirr::{CashFlow, calculate_xirr};
use portfolio_core::performance::{PerformanceOptions, get_metrics};
use portfolio_core::types::{Money, Nav, Units};

fn date(y: i32, m: u32, d: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(y, m, d).unwrap()
}

fn dec(s: &str) -> Decimal {
    Decimal::from_str(s).unwrap()
}

#[test]
fn test_xirr_short_duration_under_30_days_falls_back_to_absolute_return() {
    // 3.95% gain over 1 day: on day 0 invest 50,000, on day 1 redeem 51,971.31
    // Mathematically (1.0395)^365 - 1 = 1,398,099 (139 million percent!)
    // Financial guardrail must return the Absolute Return (0.0394262) instead of exploding.
    let flows = vec![
        CashFlow::new(date(2026, 1, 1), dec("-50000")),
        CashFlow::new(date(2026, 1, 2), dec("51971.31")),
    ];

    let result = calculate_xirr(&flows).expect("XIRR calculation should succeed with guardrail");
    // Expected absolute return: (51971.31 - 50000) / 50000 = 0.0394262 (3.94%)
    assert!(
        result < dec("0.10"),
        "Short-term duration (< 30 days) must not annualize astronomically, got: {}",
        result
    );
    assert_eq!(result, dec("0.0394262"));
}

#[test]
fn test_xirr_clamping_to_max_1000_percent() {
    // Highly extreme compounding over 40 days (diff_days >= 30) that would exceed 1000% (10.0)
    let flows = vec![
        CashFlow::new(date(2026, 1, 1), dec("-10000")),
        CashFlow::new(date(2026, 2, 10), dec("50000")), // 5x in 40 days
    ];

    let result = calculate_xirr(&flows).expect("XIRR should succeed");
    assert!(
        result <= dec("10.0"),
        "XIRR must be clamped to maximum 10.0 (1000%), got: {}",
        result
    );
    assert!(
        result >= dec("-1.0"),
        "XIRR must be clamped to minimum -1.0 (-100%), got: {}",
        result
    );
}

#[test]
fn test_invesco_arbitrage_scenario_with_proper_as_of_date() {
    // Folio purchased on 2025-12-31 with stamp duty, valued on 2026-10-19 (today)
    // Invested: ~50,000, Current value: 51,971.31 over 292 days
    let tx1 = Transaction::new(
        "tx-buy",
        date(2025, 12, 31),
        TransactionType::Purchase,
        Money::new(dec("49997.50")),
        Units::new(dec("1402.935")),
        Nav::new(dec("35.6378")),
        Units::new(dec("1402.935")),
    );
    let tx2 = Transaction::new(
        "tx-stamp",
        date(2025, 12, 31),
        TransactionType::StampDuty,
        Money::new(dec("2.50")),
        Units::ZERO,
        Nav::ZERO,
        Units::ZERO,
    );

    let latest_nav = Nav::new(dec("37.0447"));
    let as_of_today = date(2026, 10, 19);

    let options = PerformanceOptions::new().with_as_of_date(as_of_today);
    let metrics = get_metrics(&[tx1, tx2], latest_nav, Some(options));

    assert_eq!(metrics.invested_amount, Money::new(dec("49997.52")));
    assert_eq!(metrics.current_value, Money::new(dec("51971.31")));
    assert_eq!(metrics.total_gain, Money::new(dec("1973.79")));

    let xirr = metrics.xirr.expect("XIRR should be present");
    // Over 292 days, a 3.95% return is annualized to ~4.9% - 5.0%, NEVER 1685111% or 1398099%!
    assert!(
        xirr > dec("0.04") && xirr < dec("0.06"),
        "Realistic annualized XIRR expected (~4.9%), got: {}",
        xirr
    );
}
