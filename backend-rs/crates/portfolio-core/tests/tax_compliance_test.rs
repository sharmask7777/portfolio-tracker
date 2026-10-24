use chrono::NaiveDate;
use rust_decimal::Decimal;
use std::str::FromStr;

use portfolio_core::holdings::{Transaction, TransactionType};
use portfolio_core::performance::{PerformanceOptions, get_metrics};
use portfolio_core::tax::{
    AdvanceTaxQuarter, TaxSection, TaxType, calculate_portfolio_tax, calculate_unrealized_tax,
    get_exit_load, simulate_sell_transactions_with_metadata,
};
use portfolio_core::types::{AssetType, Money, Nav, Units};

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

fn tx(id: &str, d: NaiveDate, tx_type: TransactionType, u: Units, n: Nav) -> Transaction {
    let amt = u * n;
    let bal = if tx_type.is_inflow() { Units::ZERO } else { u };
    Transaction::new(id, d, tx_type, amt, u, n, bal)
}

#[test]
fn test_unrealized_tax_equity_stcg_post_budget_2024() {
    // Bought 2024-08-01, evaluated on 2024-10-01 (held < 365 days -> STCG 20%)
    let txs = vec![tx(
        "t1",
        date(2024, 8, 1),
        TransactionType::Buy,
        units("10"),
        nav("100"),
    )];
    let as_of = date(2024, 10, 1);
    let current_nav = nav("150");
    let tax_slab = dec("0.30");

    // Gain = (150 - 100) * 10 = 500
    // Tax Rate for STCG post-budget 2024 is 20%
    // Estimated Tax = 500 * 0.20 = 100
    let estimated_tax = calculate_unrealized_tax(
        "Equity Fund",
        AssetType::MutualFund,
        &txs,
        current_nav,
        tax_slab,
        Some(as_of),
        None,
    );

    assert_eq!(estimated_tax, money("100"));
}

#[test]
fn test_unrealized_tax_equity_ltcg_post_budget_2024() {
    // Bought 2023-01-01, evaluated on 2024-10-01 (held >= 365 days -> LTCG 12.5%)
    let txs = vec![tx(
        "t1",
        date(2023, 1, 1),
        TransactionType::Buy,
        units("10"),
        nav("100"),
    )];
    let as_of = date(2024, 10, 1);
    let current_nav = nav("200");
    let tax_slab = dec("0.30");

    // Gain = (200 - 100) * 10 = 1000
    // Tax Rate for LTCG post-budget 2024 is 12.5%
    // Estimated Tax = 1000 * 0.125 = 125
    let estimated_tax = calculate_unrealized_tax(
        "Equity Fund",
        AssetType::MutualFund,
        &txs,
        current_nav,
        tax_slab,
        Some(as_of),
        None,
    );

    assert_eq!(estimated_tax, money("125"));
}

#[test]
fn test_unrealized_tax_debt_section_50aa() {
    // Bought post 01-Apr-2023: Section 50AA applies (taxed at slab rate, e.g. 30%)
    let txs = vec![tx(
        "t1",
        date(2023, 4, 15),
        TransactionType::Buy,
        units("100"),
        nav("100"),
    )];
    let as_of = date(2024, 10, 1);
    let current_nav = nav("120");
    let tax_slab = dec("0.30");

    // Gain = (120 - 100) * 100 = 2000
    // Tax = 2000 * 0.30 = 600
    let estimated_tax = calculate_unrealized_tax(
        "Corporate Debt Fund",
        AssetType::MutualFund,
        &txs,
        current_nav,
        tax_slab,
        Some(as_of),
        None,
    );

    assert_eq!(estimated_tax, money("600"));
}

#[test]
fn test_unrealized_tax_loss_yields_zero_tax() {
    // Bought 2024-01-01 at 100, current nav 80 (loss of 200)
    let txs = vec![tx(
        "t1",
        date(2024, 1, 1),
        TransactionType::Buy,
        units("10"),
        nav("100"),
    )];
    let as_of = date(2024, 10, 1);
    let current_nav = nav("80");
    let tax_slab = dec("0.30");

    let estimated_tax = calculate_unrealized_tax(
        "Equity Fund",
        AssetType::MutualFund,
        &txs,
        current_nav,
        tax_slab,
        Some(as_of),
        None,
    );

    assert_eq!(estimated_tax, money("0"));
}

#[test]
fn test_performance_metrics_post_tax_parity() {
    // Exactly matches TypeScript test case:
    // Buy 10 units at 100 on 2026-01-01, current price 150 as of 2026-05-17
    // Gain = 500, STCG Tax (20%) = 100
    // Current Value = 1500, Post-Tax Value = 1400
    // Post-Tax Absolute Return = (1400 - 1000) / 1000 = 0.40
    let txs = vec![tx(
        "t1",
        date(2026, 1, 1),
        TransactionType::Buy,
        units("10"),
        nav("100"),
    )];
    let options = PerformanceOptions::new()
        .with_units_override(units("10"))
        .with_tax_slab(dec("0.30"))
        .with_asset_type(AssetType::MutualFund)
        .with_asset_name("Equity Fund")
        .with_as_of_date(date(2026, 5, 17));

    let metrics = get_metrics(&txs, nav("150"), Some(options));

    assert_eq!(metrics.estimated_tax, Some(money("100")));
    assert_eq!(metrics.current_value, money("1500"));
    assert_eq!(metrics.invested_amount, money("1000"));
    assert_eq!(metrics.absolute_return, dec("0.5"));
    assert_eq!(metrics.post_tax_absolute_return, Some(dec("0.4")));

    // Post-tax XIRR must be strictly less than pre-tax XIRR, but positive
    assert!(metrics.xirr.is_some());
    assert!(metrics.post_tax_xirr.is_some());
    let pre_tax_xirr = metrics.xirr.unwrap();
    let post_tax_xirr = metrics.post_tax_xirr.unwrap();
    assert!(post_tax_xirr < pre_tax_xirr);
    assert!(post_tax_xirr > Decimal::ZERO);
}

#[test]
fn test_closed_position_calculates_realized_xirr() {
    // Buy on 2023-01-01 at 100, sell on 2024-01-01 at 120 (gain of 20%)
    let txs = vec![
        tx(
            "t1",
            date(2023, 1, 1),
            TransactionType::Buy,
            units("100"),
            nav("100"),
        ),
        tx(
            "t2",
            date(2024, 1, 1),
            TransactionType::Sell,
            units("100"),
            nav("120"),
        ),
    ];

    let options = PerformanceOptions::new().with_as_of_date(date(2024, 1, 1));
    let metrics = get_metrics(&txs, nav("120"), Some(options));

    // Units are 0, so invested and current value are 0
    assert_eq!(metrics.current_value, money("0"));
    assert_eq!(metrics.invested_amount, money("0"));
    // BUT historical realized XIRR must be calculated, not None!
    assert!(metrics.xirr.is_some());
    let xirr = metrics.xirr.unwrap();
    // Annualized return for ~1 year from 10,000 to 12,000 should be ~20% (0.20)
    assert!(xirr > dec("0.19") && xirr < dec("0.21"));
}

#[test]
fn test_advance_tax_quarters_and_table_f() {
    let q1 = AdvanceTaxQuarter::from_date(date(2024, 5, 15));
    assert_eq!(q1, AdvanceTaxQuarter::Q1);

    let q2a = AdvanceTaxQuarter::from_date(date(2024, 6, 20));
    assert_eq!(q2a, AdvanceTaxQuarter::Q2A);

    let q2b = AdvanceTaxQuarter::from_date(date(2024, 7, 25));
    assert_eq!(q2b, AdvanceTaxQuarter::Q2B);

    let q3 = AdvanceTaxQuarter::from_date(date(2024, 10, 15));
    assert_eq!(q3, AdvanceTaxQuarter::Q3);

    let q4 = AdvanceTaxQuarter::from_date(date(2025, 1, 15));
    assert_eq!(q4, AdvanceTaxQuarter::Q4);

    let q5 = AdvanceTaxQuarter::from_date(date(2025, 3, 20));
    assert_eq!(q5, AdvanceTaxQuarter::Q5);
}

#[test]
fn test_capital_loss_set_off_rules() {
    // LTCL set off against LTCG
    // STCL set off against STCG first, then LTCG
    let txs = vec![
        // Buy lot 1: Equity held > 1 yr, sold at gain 10,000
        tx(
            "t1",
            date(2023, 1, 1),
            TransactionType::Buy,
            units("100"),
            nav("100"),
        ),
        tx(
            "t2",
            date(2024, 8, 1),
            TransactionType::Sell,
            units("100"),
            nav("200"),
        ),
        // Buy lot 2: Equity held < 1 yr, sold at loss -4,000
        tx(
            "t3",
            date(2024, 5, 1),
            TransactionType::Buy,
            units("100"),
            nav("100"),
        ),
        tx(
            "t4",
            date(2024, 8, 1),
            TransactionType::Sell,
            units("100"),
            nav("60"),
        ),
    ];

    let summary = calculate_portfolio_tax(
        "Equity Fund",
        AssetType::MutualFund,
        &txs,
        nav("200"),
        dec("0.30"),
        None,
    );

    // Realized STCG = -4,000 (STCL)
    // Realized LTCG = +10,000
    // STCL sets off against LTCG: remaining taxable LTCG = 6,000, taxable STCG = 0
    assert_eq!(summary.realized.taxable_stcg, money("0"));
    assert_eq!(summary.realized.taxable_ltcg, money("6000"));
}

#[test]
fn test_exit_load_calculation_and_metadata_parsing() {
    let buy = date(2024, 1, 1);
    let val = money("100000");

    // Stocks: 0% exit load
    assert_eq!(
        get_exit_load(
            "Reliance Industries",
            AssetType::Stock,
            buy,
            date(2024, 2, 1),
            val,
            None
        ),
        money("0")
    );

    // ELSS: 0% exit load
    assert_eq!(
        get_exit_load(
            "Axis ELSS Tax Saver Fund",
            AssetType::MutualFund,
            buy,
            date(2024, 6, 1),
            val,
            None
        ),
        money("0")
    );

    // Parag Parikh: 2% < 365d, 1% < 730d, 0% >= 730d
    let pp = "Parag Parikh Flexi Cap Fund";
    assert_eq!(
        get_exit_load(pp, AssetType::MutualFund, buy, date(2024, 6, 1), val, None),
        money("2000") // 2%
    );
    assert_eq!(
        get_exit_load(pp, AssetType::MutualFund, buy, date(2025, 6, 1), val, None),
        money("1000") // 1%
    );
    assert_eq!(
        get_exit_load(pp, AssetType::MutualFund, buy, date(2026, 6, 1), val, None),
        money("0")
    );

    // Standard Equity: 1% < 365d, 0% >= 365d
    let eq = "HDFC Top 100 Fund";
    assert_eq!(
        get_exit_load(eq, AssetType::MutualFund, buy, date(2024, 6, 1), val, None),
        money("1000") // 1%
    );
    assert_eq!(
        get_exit_load(eq, AssetType::MutualFund, buy, date(2025, 6, 1), val, None),
        money("0")
    );

    // Arbitrage: 0.25% < 30d, 0% >= 30d
    let arb = "Kotak Arbitrage Fund";
    assert_eq!(
        get_exit_load(
            arb,
            AssetType::MutualFund,
            buy,
            date(2024, 1, 15),
            val,
            None
        ),
        money("250") // 0.25%
    );
    assert_eq!(
        get_exit_load(
            arb,
            AssetType::MutualFund,
            buy,
            date(2024, 2, 15),
            val,
            None
        ),
        money("0")
    );

    // Metadata tier parsing
    let meta = "1% if redeemed within 30 days, Nil thereafter";
    assert_eq!(
        get_exit_load(
            "Custom Fund",
            AssetType::MutualFund,
            buy,
            date(2024, 1, 15),
            val,
            Some(meta)
        ),
        money("1000")
    );
    assert_eq!(
        get_exit_load(
            "Custom Fund",
            AssetType::MutualFund,
            buy,
            date(2024, 2, 15),
            val,
            Some(meta)
        ),
        money("0")
    );
}

#[test]
fn test_withdrawal_simulation_ltcg_12_5_and_exit_load() {
    // Buy 100 units @ 100 on 2023-01-01 (Rs 10,000)
    // Sell on 2024-08-01 (post Budget 2024) @ 200 (Market value Rs 20,000)
    // Holding > 365 days -> LTCG @ 12.5%
    // Exit load = 0 (held > 1 year)
    let txs = vec![tx(
        "t1",
        date(2023, 1, 1),
        TransactionType::Buy,
        units("100"),
        nav("100"),
    )];

    let sim = simulate_sell_transactions_with_metadata(
        "HDFC Top 100 Fund",
        AssetType::MutualFund,
        &txs,
        units("100"),
        date(2024, 8, 1),
        nav("200"),
        dec("0.30"),
        None,
        None,
    )
    .expect("simulation succeeded");

    assert_eq!(sim.estimated_value, money("20000"));
    assert_eq!(sim.total_gain, money("10000"));
    assert_eq!(sim.exit_load, money("0"));

    assert_eq!(sim.matched_lots.len(), 1);
    let lot = &sim.matched_lots[0];
    assert_eq!(lot.tax_type, TaxType::Ltcg);
    assert_eq!(lot.section, TaxSection::Sec112A12_5);
    assert_eq!(lot.tax_rate, dec("0.125")); // 12.5%!
    assert_eq!(lot.tax_before_cess, money("1250")); // 10000 * 12.5% = 1250
    assert_eq!(lot.cess, money("50")); // 1250 * 4% = 50
    assert_eq!(lot.estimated_tax, money("1300")); // 1250 + 50 = 1300
}

#[test]
fn test_withdrawal_simulation_stcg_20_and_exit_load() {
    // Buy 100 units @ 100 on 2024-05-01 (Rs 10,000)
    // Sell on 2024-08-01 (post Budget 2024) @ 200 (Market value Rs 20,000)
    // Holding < 365 days -> STCG @ 20%
    // Exit load = 1% on 20,000 = Rs 200
    // Gain net of exit load = 20,000 - 10,000 - 200 = Rs 9,800
    // Tax before cess = 9,800 * 20% = Rs 1,960
    // Cess = 1,960 * 4% = Rs 78.40
    let txs = vec![tx(
        "t1",
        date(2024, 5, 1),
        TransactionType::Buy,
        units("100"),
        nav("100"),
    )];

    let sim = simulate_sell_transactions_with_metadata(
        "HDFC Top 100 Fund",
        AssetType::MutualFund,
        &txs,
        units("100"),
        date(2024, 8, 1),
        nav("200"),
        dec("0.30"),
        None,
        None,
    )
    .expect("simulation succeeded");

    assert_eq!(sim.estimated_value, money("20000"));
    assert_eq!(sim.exit_load, money("200"));
    assert_eq!(sim.total_gain, money("9800")); // reduced by transfer expenses!

    assert_eq!(sim.matched_lots.len(), 1);
    let lot = &sim.matched_lots[0];
    assert_eq!(lot.tax_type, TaxType::Stcg);
    assert_eq!(lot.section, TaxSection::Sec111A20);
    assert_eq!(lot.tax_rate, dec("0.20")); // 20%!
    assert_eq!(lot.tax_before_cess, money("1960"));
    assert_eq!(lot.cess, money("78.40"));
    assert_eq!(lot.estimated_tax, money("2038.40"));
}
