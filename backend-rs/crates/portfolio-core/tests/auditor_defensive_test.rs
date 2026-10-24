use chrono::NaiveDate;
use rust_decimal::Decimal;
use std::str::FromStr;

use portfolio_core::holdings::{Transaction, TransactionType, get_latest_units};
use portfolio_core::performance::{PerformanceOptions, get_metrics};
use portfolio_core::tax::{
    HoldingType, TaxClassification, TaxType, apply_capital_loss_set_off_with_slab,
    compute_deemed_cost, is_equity,
};
use portfolio_core::types::{AssetType, Money, Nav, Units};
use portfolio_core::xray::{CommonStock, FundOverlap};

#[test]
fn test_get_latest_units_fractional_dust_does_not_resurrect_earlier_balance() {
    // Buy 500 units with balance 500
    // Then redeem with remaining balance recorded as 0.0004 (fractional dust < 0.001)
    let t1 = Transaction::new(
        "tx-1",
        NaiveDate::from_ymd_opt(2023, 1, 1).unwrap(),
        TransactionType::Purchase,
        Money::from_str("50000.00").unwrap(),
        Units::from_str("500.0000").unwrap(),
        Nav::from_str("100.0000").unwrap(),
        Units::from_str("500.0000").unwrap(),
    );
    let t2 = Transaction::new(
        "tx-2",
        NaiveDate::from_ymd_opt(2023, 6, 1).unwrap(),
        TransactionType::Redemption,
        Money::from_str("60000.00").unwrap(),
        Units::from_str("-499.9996").unwrap(),
        Nav::from_str("120.0000").unwrap(),
        Units::from_str("0.0004").unwrap(), // Dust remaining in CAS
    );

    let latest_units = get_latest_units(&[t1, t2]);
    assert_eq!(
        latest_units,
        Units::ZERO,
        "Fractional dust below 0.001 must return 0 units, NOT resurrect the 500 units from tx-1!"
    );
}

#[test]
fn test_get_latest_units_falls_back_to_fifo_when_balances_are_zero() {
    // Imported transactions without balance tracking (all balance = 0)
    let t1 = Transaction::new(
        "tx-1",
        NaiveDate::from_ymd_opt(2023, 1, 1).unwrap(),
        TransactionType::Purchase,
        Money::from_str("10000.00").unwrap(),
        Units::from_str("100.0000").unwrap(),
        Nav::from_str("100.0000").unwrap(),
        Units::ZERO, // No balance recorded
    );
    let t2 = Transaction::new(
        "tx-2",
        NaiveDate::from_ymd_opt(2023, 2, 1).unwrap(),
        TransactionType::Purchase,
        Money::from_str("5000.00").unwrap(),
        Units::from_str("50.0000").unwrap(),
        Nav::from_str("100.0000").unwrap(),
        Units::ZERO, // No balance recorded
    );

    let latest_units = get_latest_units(&[t1, t2]);
    assert_eq!(
        latest_units,
        Units::from_str("150.0000").unwrap(),
        "When transaction balances are zero/unpopulated, FIFO lots must derive the true active units!"
    );
}

#[test]
fn test_get_metrics_as_of_date_evaluation_for_active_holding() {
    // Single purchase on 2023-01-01 evaluated on 2024-01-01 with current NAV 150
    let t1 = Transaction::new(
        "tx-1",
        NaiveDate::from_ymd_opt(2023, 1, 1).unwrap(),
        TransactionType::Purchase,
        Money::from_str("10000.00").unwrap(),
        Units::from_str("100.0000").unwrap(),
        Nav::from_str("100.0000").unwrap(),
        Units::from_str("100.0000").unwrap(),
    );

    let current_nav = Nav::from_str("150.0000").unwrap();
    let options =
        PerformanceOptions::new().with_as_of_date(NaiveDate::from_ymd_opt(2024, 1, 1).unwrap());
    let metrics = get_metrics(&[t1], current_nav, Some(options));

    assert_eq!(
        metrics.invested_amount,
        Money::from_str("10000.00").unwrap()
    );
    assert_eq!(metrics.current_value, Money::from_str("15000.00").unwrap());
    assert!(
        metrics.xirr.is_some(),
        "XIRR must be computable for active holding when evaluated at valuation date!"
    );
    assert!(
        metrics.cagr.is_some(),
        "CAGR must be computable for active holding held across 1 year!"
    );
}

#[test]
fn test_dividend_reinvestment_does_not_count_as_external_cash_outflow() {
    let t_div = Transaction::new(
        "tx-div",
        NaiveDate::from_ymd_opt(2023, 4, 1).unwrap(),
        TransactionType::DividendReinvestment,
        Money::from_str("2500.00").unwrap(),
        Units::from_str("25.0000").unwrap(),
        Nav::from_str("100.0000").unwrap(),
        Units::from_str("125.0000").unwrap(),
    );

    assert_eq!(
        t_div.cash_flow_amount(),
        Money::ZERO,
        "DividendReinvestment does not take external cash from investor bank account, cash flow must be 0 for XIRR!"
    );
}

#[test]
fn test_leap_year_holding_period_statutory_anniversary() {
    // Bought on 2024-01-01 (2024 is leap year, 366 days).
    // Sold on 2024-12-31: exactly 365 days elapsed, but NOT more than 12 months (anniversary is 2025-01-01).
    let buy_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
    let sell_date = NaiveDate::from_ymd_opt(2024, 12, 31).unwrap();

    let classification = TaxClassification::classify(
        true,
        buy_date,
        sell_date,
        Decimal::from_str("0.30").unwrap(),
    );
    assert_eq!(
        classification.holding_type,
        HoldingType::ShortTerm,
        "Selling before completing 12 months in a leap year is Short-Term Capital Gain (<= 12 months)!"
    );
    assert_eq!(classification.tax_type, TaxType::Stcg);

    // Sold on 2025-01-02: more than 12 months -> Long-Term
    let sell_date_lt = NaiveDate::from_ymd_opt(2025, 1, 2).unwrap();
    let classification_lt = TaxClassification::classify(
        true,
        buy_date,
        sell_date_lt,
        Decimal::from_str("0.30").unwrap(),
    );
    assert_eq!(classification_lt.holding_type, HoldingType::LongTerm);
    assert_eq!(classification_lt.tax_type, TaxType::Ltcg);
}

#[test]
fn test_gold_silver_and_international_funds_are_not_equity() {
    assert!(!is_equity(
        AssetType::MutualFund,
        "Nippon India ETF Gold BeES"
    ));
    assert!(!is_equity(AssetType::MutualFund, "HDFC Gold Fund"));
    assert!(!is_equity(
        AssetType::MutualFund,
        "ICICI Prudential Silver ETF"
    ));
    assert!(!is_equity(
        AssetType::MutualFund,
        "Motilal Oswal Nasdaq 100 FoF"
    ));
    assert!(!is_equity(
        AssetType::MutualFund,
        "Franklin Asian Equity Fund of Fund"
    ));
    assert!(!is_equity(AssetType::MutualFund, "DSP World Gold Fund"));

    // Domestic equity funds remain equity
    assert!(is_equity(
        AssetType::MutualFund,
        "Parag Parikh Flexi Cap Fund"
    ));
    assert!(is_equity(AssetType::MutualFund, "SBI Small Cap Fund"));
}

#[test]
fn test_grandfathering_not_applied_to_short_term_redemptions() {
    // Bought 2018-01-05 (before Jan 31, 2018), but sold 2018-05-10 (holding period ~4 months, STCG)
    let buy_date = NaiveDate::from_ymd_opt(2018, 1, 5).unwrap();
    let sell_date = NaiveDate::from_ymd_opt(2018, 5, 10).unwrap();
    let units = Units::from_str("100.0000").unwrap();
    let buy_nav = Nav::from_str("50.0000").unwrap();
    let sell_nav = Nav::from_str("80.0000").unwrap();
    let fmv = Some(Nav::from_str("70.0000").unwrap());

    let (deemed_cost, is_gf, _, _, _) = compute_deemed_cost(
        buy_date, sell_date, units, buy_nav, sell_nav, fmv, true, false,
    );

    assert!(
        !is_gf,
        "Short-term capital asset can never be grandfathered under Section 55(2)(ac)!"
    );
    assert_eq!(
        deemed_cost,
        buy_nav * units,
        "Deemed cost for short-term gain must be actual cost of acquisition!"
    );
}

#[test]
fn test_section_50aa_debt_loss_set_off_with_stcg() {
    // Taxpayer has:
    // - Section 50AA Debt STCL of -₹20,000 (realized_slab = -20000)
    // - Equity STCG of +₹50,000 (realized_stcg = +50000)
    // - Equity LTCG of +₹30,000 (realized_ltcg = +30000)
    let stcg = Money::from_str("50000.00").unwrap();
    let ltcg = Money::from_str("30000.00").unwrap();
    let slab_loss = Money::from_str("-20000.00").unwrap();

    let (taxable_stcg, taxable_ltcg, taxable_slab) =
        apply_capital_loss_set_off_with_slab(stcg, ltcg, slab_loss);

    assert_eq!(
        taxable_slab,
        Money::ZERO,
        "Slab loss should be fully absorbed"
    );
    assert_eq!(
        taxable_stcg,
        Money::from_str("30000.00").unwrap(),
        "Section 50AA STCL of 20,000 should set off Equity STCG down to 30,000!"
    );
    assert_eq!(
        taxable_ltcg,
        Money::from_str("30000.00").unwrap(),
        "LTCG remains untouched since STCL was absorbed by STCG"
    );
}

#[test]
fn test_fund_overlap_and_common_stock_serialize_numbers_as_floats() {
    let stock = CommonStock {
        name: "RELIANCE".to_string(),
        weight_a: Decimal::from_str("9.50").unwrap(),
        weight_b: Decimal::from_str("6.25").unwrap(),
    };
    let overlap = FundOverlap {
        fund_a: "Fund A".to_string(),
        fund_b: "Fund B".to_string(),
        overlap_percentage: Decimal::from_str("25.75").unwrap(),
        common_stocks: vec![stock],
    };

    let json_str = serde_json::to_string(&overlap).unwrap();
    // Verify JSON contains numeric literals, not quoted strings
    assert!(
        json_str.contains("\"overlapPercentage\":25.75"),
        "overlapPercentage must serialize as float number, got: {}",
        json_str
    );
    assert!(
        json_str.contains("\"weightA\":9.5"),
        "weightA must serialize as float number, got: {}",
        json_str
    );
    assert!(
        json_str.contains("\"weightB\":6.25"),
        "weightB must serialize as float number, got: {}",
        json_str
    );
}
