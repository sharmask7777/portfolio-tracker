#![allow(missing_docs, clippy::unwrap_used, clippy::panic)]

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

#[test]
fn test_get_latest_units_with_zeroed_intermediate_balances() {
    use portfolio_core::holdings::registry::get_latest_units;
    use portfolio_core::holdings::{Transaction, TransactionType};
    use portfolio_core::types::{Money, Nav, Units};
    use rust_decimal::Decimal;

    let txs = vec![
        Transaction::new(
            "t1",
            chrono::NaiveDate::from_ymd_opt(2025, 1, 1).unwrap(),
            TransactionType::Purchase,
            Money::new(Decimal::from(10000)),
            Units::new(Decimal::from(100)),
            Nav::new(Decimal::from(100)),
            Units::new(Decimal::from(100)),
        ),
        Transaction::new(
            "t2",
            chrono::NaiveDate::from_ymd_opt(2025, 2, 1).unwrap(),
            TransactionType::Purchase,
            Money::new(Decimal::from(5000)),
            Units::new(Decimal::from(50)),
            Nav::new(Decimal::from(100)),
            Units::ZERO,
        ),
        Transaction::new(
            "t3",
            chrono::NaiveDate::from_ymd_opt(2025, 3, 1).unwrap(),
            TransactionType::Purchase,
            Money::new(Decimal::from(2500)),
            Units::new(Decimal::from(25)),
            Nav::new(Decimal::from(100)),
            Units::ZERO,
        ),
    ];

    assert_eq!(get_latest_units(&txs), Units::new(Decimal::from(175)));
}

#[test]
fn test_reversal_lots_purchase_and_redemption() {
    use portfolio_core::holdings::lot::process_fifo_lots_with_summary;
    use portfolio_core::holdings::{Transaction, TransactionType};
    use portfolio_core::types::{Money, Nav, Units};
    use rust_decimal::Decimal;

    // Purchase 100 units, then purchase reversal of -40 units -> 60 units left, 0 taxable depletions
    let txs = vec![
        Transaction::new(
            "p1",
            chrono::NaiveDate::from_ymd_opt(2025, 1, 1).unwrap(),
            TransactionType::Purchase,
            Money::new(Decimal::from(10000)),
            Units::new(Decimal::from(100)),
            Nav::new(Decimal::from(100)),
            Units::new(Decimal::from(100)),
        ),
        Transaction::new(
            "rev1",
            chrono::NaiveDate::from_ymd_opt(2025, 1, 5).unwrap(),
            TransactionType::Reversal,
            Money::new(Decimal::from(-4000)),
            Units::new(Decimal::from(-40)),
            Nav::new(Decimal::from(100)),
            Units::new(Decimal::from(60)),
        ),
    ];

    let summary = process_fifo_lots_with_summary(&txs);
    assert!(summary.has_synthetic_anchors);
    assert_eq!(summary.depletions.len(), 0);
    let remaining: Units = summary.active_lots.iter().map(|l| l.remaining_units).sum();
    assert_eq!(remaining, Units::new(Decimal::from(60)));
}

#[test]
fn test_normalize_cas_tx_type_ordering() {
    use portfolio_core::parser::normalize_cas_tx_type;

    assert_eq!(normalize_cas_tx_type("SIP Reversal"), "REVERSAL");
    assert_eq!(
        normalize_cas_tx_type("Dividend Reinvestment"),
        "DIVIDEND_REINVEST"
    );
    assert_eq!(
        normalize_cas_tx_type("Purchase Reinvest"),
        "DIVIDEND_REINVEST"
    );
    assert_eq!(normalize_cas_tx_type("SWP"), "SWP");
    assert_eq!(normalize_cas_tx_type("STP In"), "STP_IN");
    assert_eq!(normalize_cas_tx_type("STP Out"), "STP_OUT");
    assert_eq!(normalize_cas_tx_type("Bonus Allotment"), "BONUS");
}

#[test]
fn test_build_portfolio_hierarchy_and_expense_analysis() {
    use portfolio_core::types::Money;
    use portfolio_core::xray::catalog::CatalogHolding;
    use portfolio_core::xray::hierarchy::{
        ExpenseSchemeInput, HierarchySchemeInput, build_portfolio_hierarchy,
        compute_expense_analysis,
    };
    use rust_decimal::Decimal;

    let schemes = vec![
        HierarchySchemeInput {
            scheme_name: "Nifty 50 Direct".to_string(),
            asset_class: "Equity".to_string(),
            is_arbitrage: false,
            current_value: Money::new(Decimal::from(100_000)),
            holdings: vec![CatalogHolding {
                name: "HDFC Bank Ltd.".to_string(),
                sector: Some("Financial Services".to_string()),
                weight_pct: Decimal::from(60),
            }],
        },
        HierarchySchemeInput {
            scheme_name: "Arbitrage Regular".to_string(),
            asset_class: "Arbitrage".to_string(),
            is_arbitrage: true,
            current_value: Money::new(Decimal::from(50_000)),
            holdings: vec![],
        },
    ];

    let tree = build_portfolio_hierarchy(&schemes, true);
    assert_eq!(tree.len(), 1);
    assert_eq!(tree[0].parent_bps, 10_000);
    let sector_bps_sum: i64 = tree[0].children.iter().map(|c| c.parent_bps).sum();
    assert_eq!(sector_bps_sum, 10_000);

    let exp = compute_expense_analysis(&[
        ExpenseSchemeInput {
            scheme_name: "HDFC Flexi Cap Regular".to_string(),
            current_value: Money::new(Decimal::from(100_000)),
            explicit_ter_pct: None,
        },
        ExpenseSchemeInput {
            scheme_name: "Parag Parikh Direct".to_string(),
            current_value: Money::new(Decimal::from(100_000)),
            explicit_ter_pct: None,
        },
    ]);
    assert!(exp.potential_annual_savings.is_positive());
    assert!(exp.weighted_avg_ter_pct > 0.5);
}

#[test]
fn test_calculate_drag_attribution_with_negative_xirr() {
    use portfolio_core::performance::metrics::calculate_drag_attribution;
    use portfolio_core::types::Money;
    use rust_decimal::Decimal;
    use std::str::FromStr;

    let res = calculate_drag_attribution(
        Some(Decimal::from_str("-0.05").unwrap()),
        Some(Decimal::from_str("-0.05").unwrap()),
        Money::ZERO,
        Money::ZERO,
        Money::ZERO,
        Decimal::from_str("0.06").unwrap(),
        None,
    )
    .unwrap();

    assert!(
        res.inflation_drag > Decimal::ZERO,
        "inflation_drag should be positive even when nominal_xirr <= 0"
    );
}

#[test]
fn test_classification_and_parser_and_insights_coverage() {
    use portfolio_core::classification::{AssetCategory, is_domestic_equity_scheme};
    use portfolio_core::insights::{InsightInput, generate_smart_insights};
    use portfolio_core::parser::normalize_cas_tx_type;

    // Test AssetCategory methods
    for cat in [
        AssetCategory::Equity,
        AssetCategory::Debt,
        AssetCategory::Hybrid,
        AssetCategory::Gold,
        AssetCategory::Cash,
        AssetCategory::Arbitrage,
        AssetCategory::Other,
    ] {
        assert_ne!(cat.display_name(), "");
        assert_ne!(cat.color(), "");
    }

    // Test is_domestic_equity_scheme keywords
    assert!(!is_domestic_equity_scheme(
        "Aditya Birla Sun Life Liquid Fund"
    ));
    assert!(!is_domestic_equity_scheme("HDFC Short Term Debt Fund"));
    assert!(!is_domestic_equity_scheme(
        "ICICI Prudential Multi Asset Fund"
    ));
    assert!(!is_domestic_equity_scheme("Nippon India Gold ETF"));
    assert!(!is_domestic_equity_scheme(
        "SBI International Global Opportunities Fund"
    ));
    assert!(!is_domestic_equity_scheme(
        "Franklin Templeton Treasury Bill Fund"
    ));
    assert!(is_domestic_equity_scheme("UTI Nifty 50 Index Fund"));

    // Test normalize_cas_tx_type cases
    assert_eq!(normalize_cas_tx_type("REVERSAL OF PURCHASE"), "REVERSAL");
    assert_eq!(normalize_cas_tx_type("STAMP DUTY CHARGED"), "STAMP_DUTY");
    assert_eq!(normalize_cas_tx_type("SYSTEMATIC WITHDRAWAL PLAN"), "SWP");
    assert_eq!(normalize_cas_tx_type("STP IN FROM SCHEME"), "STP_IN");
    assert_eq!(normalize_cas_tx_type("STP OUT TO SCHEME"), "STP_OUT");
    assert_eq!(normalize_cas_tx_type("SWITCH IN FROM OTHER"), "SWITCH_IN");
    assert_eq!(normalize_cas_tx_type("SWITCH OUT TO OTHER"), "SWITCH_OUT");
    assert_eq!(
        normalize_cas_tx_type("DIVIDEND REINVESTMENT"),
        "DIVIDEND_REINVEST"
    );
    assert_eq!(normalize_cas_tx_type("IDCW PAYOUT"), "DIVIDEND_PAYOUT");
    assert_eq!(normalize_cas_tx_type("BONUS ISSUE ALLOTMENT"), "BONUS");
    assert_eq!(normalize_cas_tx_type("SIP REGISTRATION INSTALLMENT"), "SIP");
    assert_eq!(normalize_cas_tx_type("REDEMPTION PROCEEDS"), "REDEMPTION");
    assert_eq!(normalize_cas_tx_type("PURCHASE OF UNITS"), "PURCHASE");
    assert_eq!(normalize_cas_tx_type("BUY TRANSACTION"), "PURCHASE");
    assert_eq!(normalize_cas_tx_type("NFO ALLOTMENT"), "PURCHASE");
    assert_eq!(normalize_cas_tx_type("ALLOTMENT UNITS"), "PURCHASE");
    assert_eq!(normalize_cas_tx_type("UNRECOGNIZED TRANSACTION"), "OTHER");

    // Test smart insights proliferation
    let insights = generate_smart_insights(&InsightInput {
        total_value: Money::from_str("1000000.00").unwrap(),
        regular_plan_value: Money::ZERO,
        potential_annual_ter_savings: Money::ZERO,
        max_single_stock_pct: 15.0,
        max_single_stock_name: Some("RELIANCE".to_string()),
        active_scheme_count: 18,
    });
    assert!(insights.iter().any(|i| i.code == "SCHEME_PROLIFERATION"));
    assert!(
        insights
            .iter()
            .any(|i| i.code == "SINGLE_STOCK_CONCENTRATION")
    );
}

#[test]
fn test_tax_rules_exit_load_and_simulation_defensive_coverage() {
    use portfolio_core::holdings::{Transaction, TransactionType};
    use portfolio_core::tax::{
        get_exit_load, parse_exit_load_from_metadata, simulate_sell_transactions_with_metadata,
    };
    use portfolio_core::types::{AssetType, Money, Nav, Units};
    use rust_decimal::Decimal;
    use std::str::FromStr;

    // Exit load metadata string parsing
    assert_eq!(
        parse_exit_load_from_metadata("Nil beyond 365 days", 400),
        Some(Decimal::ZERO)
    );
    assert_eq!(
        parse_exit_load_from_metadata("No exit load after 90 days", 100),
        Some(Decimal::ZERO)
    );
    assert_eq!(
        parse_exit_load_from_metadata("No exit load after 90 days", 30),
        None
    );
    assert_eq!(
        parse_exit_load_from_metadata("1% if redeemed within 365 days", 180),
        Some(Decimal::from_str("0.01").unwrap())
    );
    assert_eq!(
        parse_exit_load_from_metadata("1% if redeemed within 365 days", 400),
        Some(Decimal::ZERO)
    );
    assert_eq!(
        parse_exit_load_from_metadata("nil", 10),
        Some(Decimal::ZERO)
    );
    assert_eq!(parse_exit_load_from_metadata("", 10), None);

    // Test is_elss_scheme and is_lot_locked
    use portfolio_core::tax::{is_elss_scheme, is_lot_locked};
    assert!(is_elss_scheme(
        AssetType::MutualFund,
        "Mirae Asset ELSS Tax Saver Fund"
    ));
    assert!(!is_elss_scheme(
        AssetType::Stock,
        "Mirae Asset ELSS Tax Saver Fund"
    ));
    assert!(is_lot_locked(
        NaiveDate::from_ymd_opt(2023, 1, 1).unwrap(),
        NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()
    ));
    assert!(!is_lot_locked(
        NaiveDate::from_ymd_opt(2020, 1, 1).unwrap(),
        NaiveDate::from_ymd_opt(2024, 1, 1).unwrap()
    ));

    // Test AssetAllocationBreakdown normalize with non-zero
    use portfolio_core::xray::AssetAllocationBreakdown;
    let alloc = AssetAllocationBreakdown {
        equity: Decimal::from(60),
        debt: Decimal::from(30),
        cash: Decimal::from(10),
        alternatives: Decimal::ZERO,
    };
    let norm = alloc.normalize();
    assert_eq!(norm.total(), Decimal::from(100));

    let d0 = NaiveDate::from_ymd_opt(2023, 1, 1).unwrap();
    let liquid_val = Money::from_str("100000.00").unwrap();

    // Liquid graduated schedule
    assert!(
        get_exit_load(
            "Nippon India Liquid Fund",
            AssetType::MutualFund,
            d0,
            d0 + chrono::Duration::days(1),
            liquid_val,
            None
        )
        .to_decimal()
            > Decimal::ZERO
    );
    assert!(
        get_exit_load(
            "Nippon India Liquid Fund",
            AssetType::MutualFund,
            d0,
            d0 + chrono::Duration::days(2),
            liquid_val,
            None
        )
        .to_decimal()
            > Decimal::ZERO
    );
    assert!(
        get_exit_load(
            "Nippon India Liquid Fund",
            AssetType::MutualFund,
            d0,
            d0 + chrono::Duration::days(3),
            liquid_val,
            None
        )
        .to_decimal()
            > Decimal::ZERO
    );
    assert!(
        get_exit_load(
            "Nippon India Liquid Fund",
            AssetType::MutualFund,
            d0,
            d0 + chrono::Duration::days(4),
            liquid_val,
            None
        )
        .to_decimal()
            > Decimal::ZERO
    );
    assert!(
        get_exit_load(
            "Nippon India Liquid Fund",
            AssetType::MutualFund,
            d0,
            d0 + chrono::Duration::days(5),
            liquid_val,
            None
        )
        .to_decimal()
            > Decimal::ZERO
    );
    assert!(
        get_exit_load(
            "Nippon India Liquid Fund",
            AssetType::MutualFund,
            d0,
            d0 + chrono::Duration::days(6),
            liquid_val,
            None
        )
        .to_decimal()
            > Decimal::ZERO
    );
    assert_eq!(
        get_exit_load(
            "Nippon India Liquid Fund",
            AssetType::MutualFund,
            d0,
            d0 + chrono::Duration::days(8),
            liquid_val,
            None
        ),
        Money::ZERO
    );

    // Arbitrage fund exit load
    assert!(
        get_exit_load(
            "Kotak Equity Arbitrage Fund",
            AssetType::MutualFund,
            d0,
            d0 + chrono::Duration::days(15),
            liquid_val,
            None
        )
        .to_decimal()
            > Decimal::ZERO
    );
    assert_eq!(
        get_exit_load(
            "Kotak Equity Arbitrage Fund",
            AssetType::MutualFund,
            d0,
            d0 + chrono::Duration::days(35),
            liquid_val,
            None
        ),
        Money::ZERO
    );

    // Debt fund default exit load (<90 days vs >=90 days)
    assert!(
        get_exit_load(
            "HDFC Corporate Bond Fund",
            AssetType::MutualFund,
            d0,
            d0 + chrono::Duration::days(45),
            liquid_val,
            None
        )
        .to_decimal()
            > Decimal::ZERO
    );
    assert_eq!(
        get_exit_load(
            "HDFC Corporate Bond Fund",
            AssetType::MutualFund,
            d0,
            d0 + chrono::Duration::days(120),
            liquid_val,
            None
        ),
        Money::ZERO
    );

    // simulate_sell_transactions_with_metadata error branches
    let tx = Transaction::new(
        "tx-1",
        NaiveDate::from_ymd_opt(2023, 1, 1).unwrap(),
        TransactionType::Purchase,
        Money::from_str("10000.00").unwrap(),
        Units::from_str("100.0000").unwrap(),
        Nav::from_str("100.0000").unwrap(),
        Units::from_str("100.0000").unwrap(),
    );

    // 1. Zero units error
    let res_zero = simulate_sell_transactions_with_metadata(
        "HDFC Top 100",
        AssetType::MutualFund,
        std::slice::from_ref(&tx),
        Units::ZERO,
        NaiveDate::from_ymd_opt(2023, 6, 1).unwrap(),
        Nav::from_str("110.0000").unwrap(),
        Decimal::from_str("0.30").unwrap(),
        None,
        None,
    );
    assert!(res_zero.is_err());

    // 2. Insufficient units error
    let res_insuff = simulate_sell_transactions_with_metadata(
        "HDFC Top 100",
        AssetType::MutualFund,
        &[tx],
        Units::from_str("200.0000").unwrap(),
        NaiveDate::from_ymd_opt(2023, 6, 1).unwrap(),
        Nav::from_str("110.0000").unwrap(),
        Decimal::from_str("0.30").unwrap(),
        None,
        None,
    );
    assert!(res_insuff.is_err());
}
