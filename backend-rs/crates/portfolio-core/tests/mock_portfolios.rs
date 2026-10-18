//! Canonical 10 Mock Portfolios Test Specification (RED Phase).
//!
//! Strongly-typed, human-readable BDD test suite transcribed directly from
//! `backend/src/test/mock-portfolios.spec.ts`.
//!
//! Validates:
//! 1. Aurora Growth Family - Multi-folio scheme consolidation with distinct PANs
//! 2. Zephyr Exited Fund - Fully redeemed / zero-holding fund isolation
//! 3. Titan Bluechip Retained - Partial redemptions with active remaining units
//! 4. Olympus Hybrid - Direct equities + mutual funds stock intersection
//! 5. Sovereign Safety - Pure debt/liquid fund portfolio (zero equity exposure)
//! 6. Nova Multi-Asset - Alternative assets (Gold, Real Estate) + mutual funds
//! 7. Solaria Family Hub - Multi-member profile isolation and cascading deletion
//! 8. Vintage Heritage Fund - Section 112A LTCG Grandfathering (31-Jan-2018 NAV)
//! 9. Tax Optimizer ELSS - 3-Year ELSS Lock-in enforcement vs harvestable units
//! 10. Lifecycle Manager - Folio manual close and complete database purge
//!
//! In the TDD RED phase, all tests are wired up to verify that the domain interface
//! compiles and fails assertions with clear error messages until business logic is implemented.

use std::str::FromStr;

use chrono::NaiveDate;
use rust_decimal::Decimal;

use portfolio_core::error::PortfolioError;
use portfolio_core::holdings::{
    consolidate_by_scheme, get_latest_units, FamilyRegistry, Folio, ManagedProfile, Portfolio,
    Transaction, TransactionType,
};
use portfolio_core::performance::{get_metrics, PerformanceOptions};
use portfolio_core::tax::{
    calculate_gain, calculate_portfolio_tax, is_elss, is_equity, simulate_sell, BuyLot, TaxType,
};
use portfolio_core::types::{AssetType, FolioNumber, Isin, Money, Nav, Pan, Units};

// ============================================================================
// Ergonomic Test Fixture Helpers
// ============================================================================

fn date(year: i32, month: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(year, month, day).expect("valid test date")
}

fn dec(s: &str) -> Decimal {
    Decimal::from_str(s).expect("valid decimal literal")
}

fn money(s: &str) -> Money {
    Money::from_str(s).expect("valid money literal")
}

fn units(s: &str) -> Units {
    Units::from_str(s).expect("valid units literal")
}

fn nav(s: &str) -> Nav {
    Nav::from_str(s).expect("valid nav literal")
}

// ============================================================================
// PORTFOLIO 1: Aurora Growth Family (Multi-Folio Scheme Consolidation)
// ============================================================================
#[test]
fn test_portfolio_1_scheme_consolidation() {
    // Folio 1 Transactions (Investor A)
    let folio1_txs = vec![
        Transaction::new(
            "tx-1",
            date(2023, 1, 10),
            TransactionType::Purchase,
            money("-50000"),
            units("500"),
            nav("100"),
            units("500"),
        ),
        Transaction::new(
            "tx-2",
            date(2023, 6, 15),
            TransactionType::PurchaseSip,
            money("-50000"),
            units("400"),
            nav("125"),
            units("900"),
        ),
    ];

    // Folio 2 Transactions (Investor B / Second Folio)
    let folio2_txs = vec![Transaction::new(
        "tx-3",
        date(2023, 3, 20),
        TransactionType::Purchase,
        money("-30000"),
        units("250"),
        nav("120"),
        units("250"),
    )];

    let isin = Isin::new("INF209K01165").expect("Valid ISIN");
    let folio1 = Folio::new(
        "folio-aurora-1",
        FolioNumber::new("101/AURORA").unwrap(),
        "Aurora Large Cap Growth Fund",
        AssetType::MutualFund,
    )
    .with_isin(isin.clone())
    .with_pan(Pan::new("ABCDE1234F").unwrap())
    .with_transactions(folio1_txs.clone());

    let folio2 = Folio::new(
        "folio-aurora-2",
        FolioNumber::new("202/AURORA").unwrap(),
        "Aurora Large Cap Growth Fund",
        AssetType::MutualFund,
    )
    .with_isin(isin.clone())
    .with_pan(Pan::new("ALPAC1001A").unwrap())
    .with_transactions(folio2_txs.clone());

    // 1. Verify individual latest units
    let units1 = get_latest_units(&folio1_txs);
    let units2 = get_latest_units(&folio2_txs);
    assert_eq!(units1, units("900"), "Folio 1 must have 900 active units");
    assert_eq!(units2, units("250"), "Folio 2 must have 250 active units");
    assert_eq!(
        units1 + units2,
        units("1150"),
        "Aggregated units must be 1150"
    );

    // 2. Verify individual metrics @ NAV 150
    let current_price = nav("150");
    let metrics1 = get_metrics(
        &folio1_txs,
        current_price,
        Some(PerformanceOptions::new().with_units_override(units1)),
    );
    let metrics2 = get_metrics(
        &folio2_txs,
        current_price,
        Some(PerformanceOptions::new().with_units_override(units2)),
    );

    assert_eq!(
        metrics1.current_value,
        money("135000"),
        "Folio 1 valuation @ 150 = 135,000 (900 * 150)"
    );
    assert_eq!(
        metrics1.invested_amount,
        money("100000"),
        "Folio 1 invested amount = 100,000"
    );

    assert_eq!(
        metrics2.current_value,
        money("37500"),
        "Folio 2 valuation @ 150 = 37,500 (250 * 150)"
    );
    assert_eq!(
        metrics2.invested_amount,
        money("30000"),
        "Folio 2 invested amount = 30,000"
    );

    // 3. Verify consolidated scheme aggregation without duplicate valuation
    let consolidated = consolidate_by_scheme(&[folio1, folio2], current_price);
    assert_eq!(consolidated.len(), 1, "Must consolidate into 1 scheme group");
    let scheme = &consolidated[0];
    assert_eq!(scheme.isin.as_ref(), Some(&isin));
    assert_eq!(
        scheme.total_units,
        units("1150"),
        "Consolidated units must equal 1150"
    );
    assert_eq!(
        scheme.total_current_value,
        money("172500"),
        "Consolidated valuation must be 172,500 (1150 * 150)"
    );
    assert_eq!(
        scheme.total_invested_amount,
        money("130000"),
        "Consolidated invested amount must be 130,000 (100,000 + 30,000)"
    );
}

// ============================================================================
// PORTFOLIO 2: Zephyr Exited Fund (Fully Redeemed / Zero Holdings)
// ============================================================================
#[test]
fn test_portfolio_2_fully_redeemed_zero_holdings() {
    let transactions = vec![
        Transaction::new(
            "tx-z1",
            date(2022, 1, 1),
            TransactionType::Purchase,
            money("-100000"),
            units("1000"),
            nav("100"),
            units("1000"),
        ),
        Transaction::new(
            "tx-z2",
            date(2023, 5, 15),
            TransactionType::Redemption,
            money("150000"),
            units("-1000"),
            nav("150"),
            units("0"),
        ),
    ];

    // 1. Verify latest units is zero
    let latest_units = get_latest_units(&transactions);
    assert_eq!(
        latest_units,
        Units::zero(),
        "Fully redeemed position must have 0 units"
    );

    // 2. Metrics for closed fund: currentValue and investedAmount must be cleanly zero
    let metrics = get_metrics(
        &transactions,
        nav("160"),
        Some(PerformanceOptions::new().with_units_override(latest_units)),
    );
    assert_eq!(
        metrics.current_value,
        Money::zero(),
        "Closed position currentValue must be 0"
    );
    assert_eq!(
        metrics.invested_amount,
        Money::zero(),
        "Closed position investedAmount must be 0"
    );

    // 3. Tax calculation: Realized gain must be recognized even when active balance is zero
    let tax = calculate_portfolio_tax(
        "Zephyr Momentum Fund",
        AssetType::MutualFund,
        &transactions,
        nav("160"),
        dec("0.3"),
        None,
    );
    assert_eq!(
        tax.realized.total,
        money("50000"),
        "Realized gain must be 50,000 (150,000 - 100,000)"
    );
    assert_eq!(
        tax.unrealized.total,
        Money::zero(),
        "Unrealized gain must be 0 when zero units remain"
    );
}

// ============================================================================
// PORTFOLIO 3: Titan Bluechip Retained (Partial Redemption Retained)
// ============================================================================
#[test]
fn test_portfolio_3_partial_redemption_retained() {
    let transactions = vec![
        Transaction::new(
            "tx-t1",
            date(2022, 2, 1),
            TransactionType::Purchase,
            money("-200000"),
            units("2000"),
            nav("100"),
            units("2000"),
        ),
        Transaction::new(
            "tx-t2",
            date(2023, 4, 10),
            TransactionType::Redemption,
            money("140000"),
            units("-1000"),
            nav("140"),
            units("1000"),
        ),
    ];

    // 1. Verify residual units
    let remaining_units = get_latest_units(&transactions);
    assert_eq!(
        remaining_units,
        units("1000"),
        "Must retain 1000 units after 50% partial redemption"
    );

    // 2. Performance metrics @ current price 180
    let current_price = nav("180");
    let metrics = get_metrics(
        &transactions,
        current_price,
        Some(PerformanceOptions::new().with_units_override(remaining_units)),
    );

    assert_eq!(
        metrics.current_value,
        money("180000"),
        "Current value must be 180,000 (1000 * 180)"
    );
    assert_eq!(
        metrics.invested_amount,
        money("100000"),
        "Invested amount for remaining 1000 units @ cost 100 must be 100,000"
    );
    assert_eq!(
        metrics.total_gain,
        money("80000"),
        "Total gain must be 80,000 (180,000 - 100,000)"
    );
    assert_eq!(
        metrics.absolute_return,
        dec("0.80"),
        "Absolute return must be 0.80 (80%)"
    );
}

// ============================================================================
// PORTFOLIO 4: Olympus Hybrid (Direct Equity and Mutual Fund Intersection)
// ============================================================================
#[test]
fn test_portfolio_4_direct_equity_and_mf_intersection() {
    let direct_stock_tx = vec![Transaction::new(
        "tx-s1",
        date(2024, 1, 5),
        TransactionType::Buy,
        money("-150000"),
        units("100"),
        nav("1500"),
        units("100"),
    )];

    let current_units = get_latest_units(&direct_stock_tx);
    let current_price = nav("1850");
    let metrics = get_metrics(
        &direct_stock_tx,
        current_price,
        Some(
            PerformanceOptions::new()
                .with_units_override(current_units)
                .with_asset_type(AssetType::Stock)
                .with_asset_name("Synthetix Tech Ltd"),
        ),
    );

    assert_eq!(current_units, units("100"), "Stock units must be 100");
    assert_eq!(
        metrics.current_value,
        money("185000"),
        "Stock current valuation must be 185,000 (100 * 1850)"
    );
    assert_eq!(
        metrics.invested_amount,
        money("150000"),
        "Stock invested cost must be 150,000"
    );
    assert_eq!(
        metrics.total_gain,
        money("35000"),
        "Stock gain must be 35,000 (185,000 - 150,000)"
    );
    assert_eq!(
        metrics.absolute_return,
        dec("35000") / dec("150000"),
        "Absolute return must be 35000 / 150000"
    );
    assert!(
        AssetType::Stock.is_equity(),
        "Direct stock must be classified as equity"
    );
}

// ============================================================================
// PORTFOLIO 5: Sovereign Safety (Pure Debt & Liquid Funds - Zero Equity)
// ============================================================================
#[test]
fn test_portfolio_5_pure_debt_and_liquid_funds() {
    let liquid_tx = vec![Transaction::new(
        "tx-l1",
        date(2024, 1, 1),
        TransactionType::Purchase,
        money("-500000"),
        units("500"),
        nav("1000"),
        units("500"),
    )];

    let current_units = get_latest_units(&liquid_tx);
    let metrics = get_metrics(
        &liquid_tx,
        nav("1050"),
        Some(
            PerformanceOptions::new()
                .with_units_override(current_units)
                .with_asset_type(AssetType::MutualFund)
                .with_asset_name("Alpha Liquid Cash Fund"),
        ),
    );

    assert_eq!(
        current_units,
        units("500"),
        "Debt fund units must equal 500"
    );
    assert_eq!(
        metrics.current_value,
        money("525000"),
        "Valuation must be 525,000 (500 * 1050)"
    );
    assert_eq!(
        metrics.total_gain,
        money("25000"),
        "Total gain must be 25,000"
    );
    assert_eq!(
        metrics.absolute_return,
        dec("0.05"),
        "Absolute return must be 0.05 (5%)"
    );
    assert!(
        !is_equity(AssetType::MutualFund, "Alpha Liquid Cash Fund"),
        "Liquid fund must be classified as non-equity"
    );
}

// ============================================================================
// PORTFOLIO 6: Nova Multi-Asset (Alternative Assets: Gold & Real Estate)
// ============================================================================
#[test]
fn test_portfolio_6_alternative_assets_gold() {
    let gold_tx = vec![Transaction::new(
        "tx-g1",
        date(2022, 1, 1),
        TransactionType::Buy,
        money("-250000"),
        units("50"),
        nav("5000"),
        units("50"),
    )];

    let current_units = get_latest_units(&gold_tx);
    let current_price = nav("7200"); // Live Gold price per gram
    let metrics = get_metrics(
        &gold_tx,
        current_price,
        Some(
            PerformanceOptions::new()
                .with_units_override(current_units)
                .with_asset_type(AssetType::Sgb)
                .with_asset_name("Sovereign Gold Bond Series V"),
        ),
    );

    assert!(
        AssetType::Sgb.is_alternative(),
        "SGB must be classified as an alternative asset"
    );
    assert!(AssetType::Sgb.is_gold(), "SGB must be classified as gold");
    assert_eq!(current_units, units("50"), "SGB units must equal 50");
    assert_eq!(
        metrics.current_value,
        money("360000"),
        "SGB valuation must be 360,000 (50 * 7200)"
    );
    assert_eq!(
        metrics.total_gain,
        money("110000"),
        "SGB total gain must be 110,000"
    );
    assert_eq!(
        metrics.absolute_return,
        dec("0.44"),
        "Absolute return must be 110000 / 250000 = 0.44 (44%)"
    );
}

// ============================================================================
// PORTFOLIO 7: Solaria Family Hub (Multi-Member Profile Cascading Deletion)
// ============================================================================
#[test]
fn test_portfolio_7_multi_member_cascading_deletion() {
    let mut registry = FamilyRegistry::new();

    let user_id = "user-solaria-main";
    let child_profile_id = "profile-child-solaria";
    let primary_profile_id = "profile-solaria-primary";
    let other_user_profile_id = "profile-other-user";

    // Primary Member
    let primary_profile = ManagedProfile::new(
        primary_profile_id,
        user_id,
        "Solaria Primary Member",
        Pan::new("ABCDE1234F").unwrap(),
        dec("0.30"),
    )
    .with_portfolios(vec![Portfolio::new(
        "portfolio-primary-1",
        "Primary Core Portfolio",
    )]);
    registry.add_profile(primary_profile);

    // Child Member with child portfolios and folios
    let child_folio_1 = Folio::new(
        "folio-child-1",
        FolioNumber::new("FOLIO-C1").unwrap(),
        "Child Growth Fund",
        AssetType::MutualFund,
    );
    let child_folio_2 = Folio::new(
        "folio-child-2",
        FolioNumber::new("FOLIO-C2").unwrap(),
        "Child Bluechip Fund",
        AssetType::MutualFund,
    );
    let child_portfolio =
        Portfolio::new("portfolio-child-1", "Child Future Portfolio").with_folios(vec![
            child_folio_1,
            child_folio_2,
        ]);
    let child_profile = ManagedProfile::new(
        child_profile_id,
        user_id,
        "Solaria Child Member",
        Pan::new("IOTAI9009I").unwrap(),
        dec("0.30"),
    )
    .with_portfolios(vec![child_portfolio]);
    registry.add_profile(child_profile);

    // Sibling member from another user to verify tenant isolation
    let other_profile = ManagedProfile::new(
        other_user_profile_id,
        "user-other",
        "Other Tenant Member",
        Pan::new("XYZAB5678C").unwrap(),
        dec("0.20"),
    );
    registry.add_profile(other_profile);

    // Execute cascading deletion of the child profile
    let deletion_result = registry.delete_managed_profile(user_id, child_profile_id);

    // In RED phase, deletion fails or assertions verify isolated cascading removal
    assert!(
        deletion_result.is_ok(),
        "Managed profile deletion should succeed"
    );
    assert_eq!(deletion_result.unwrap().id, child_profile_id);

    // Child profile should no longer exist
    assert!(
        registry.get_profile(child_profile_id).is_none(),
        "Deleted child profile must no longer exist"
    );

    // Primary profile for the user should remain intact
    let remaining_user_profiles = registry.get_profiles_for_user(user_id);
    assert_eq!(
        remaining_user_profiles.len(),
        1,
        "Exactly 1 profile should remain for the user"
    );
    assert_eq!(remaining_user_profiles[0].id, primary_profile_id);

    // Other user's profile must be completely isolated and unaffected
    assert!(
        registry.get_profile(other_user_profile_id).is_some(),
        "Unrelated profile must not be deleted"
    );
}

// ============================================================================
// PORTFOLIO 8: Vintage Heritage Fund (Section 112A LTCG Grandfathering)
// ============================================================================
#[test]
fn test_portfolio_8_grandfathering_section_112a() {
    let buy_lot = BuyLot::new(
        date(2016, 4, 1),
        units("1000"),
        nav("40"),
        money("40000"),
    );
    let grandfather_nav = nav("70"); // FMV as of 31-Jan-2018
    let sell_nav = nav("120");
    let sell_date = date(2024, 8, 15); // Post Budget 2024

    let realized_gain = calculate_gain(
        "Vintage Heritage Equity Fund",
        AssetType::MutualFund,
        &buy_lot,
        units("1000"),
        sell_nav,
        sell_date,
        dec("0.3"),
        Some(grandfather_nav),
    );

    // Section 55(2)(ac) formula:
    // Deemed Cost = max(Buy Price, min(Grandfather NAV, Sell Price))
    // Deemed Cost = max(40, min(70, 120)) = 70
    // Total deemed cost = 1000 * 70 = 70,000
    // Gross Consideration = 1000 * 120 = 120,000
    // Gain = 120,000 - 70,000 = 50,000
    assert!(
        realized_gain.is_grandfathered,
        "Lot acquired before 31-Jan-2018 must be grandfathered"
    );
    assert_eq!(
        realized_gain.deemed_cost_of_acquisition,
        money("70000"),
        "Deemed cost of acquisition must be 70,000"
    );
    assert_eq!(
        realized_gain.gain,
        money("50000"),
        "Taxable capital gain must be 50,000 (120,000 - 70,000)"
    );
    assert_eq!(
        realized_gain.tax_type,
        TaxType::Ltcg,
        "Holding period > 1 year must be LTCG"
    );
}

// ============================================================================
// PORTFOLIO 9: Tax Optimizer ELSS (3-Year Lock-in Enforcement)
// ============================================================================
#[test]
fn test_portfolio_9_elss_3yr_lockin() {
    let now = date(2024, 1, 1);
    let four_years_ago = date(2020, 1, 1);
    let one_year_ago = date(2023, 1, 1);

    let transactions = vec![
        Transaction::new(
            "tx-e1",
            four_years_ago,
            TransactionType::Purchase,
            money("-50000"),
            units("500"),
            nav("100"),
            units("500"),
        ),
        Transaction::new(
            "tx-e2",
            one_year_ago,
            TransactionType::PurchaseSip,
            money("-50000"),
            units("400"),
            nav("125"),
            units("900"),
        ),
    ];

    let mock_folio = Folio::new(
        "folio-elss-optimizer",
        FolioNumber::new("MOCK-ELSS-909").unwrap(),
        "Apex ELSS Tax Shield Fund",
        AssetType::MutualFund,
    )
    .with_transactions(transactions);

    assert!(
        is_elss(&mock_folio.asset_name),
        "Fund name must be detected as ELSS"
    );

    // 1. Selling 500 units (unlocked, purchased 4 years ago) must succeed
    let sell_500_result = simulate_sell(
        &mock_folio,
        units("500"),
        now,
        nav("125"),
        dec("0.3"),
    );
    assert!(
        sell_500_result.is_ok(),
        "Selling 500 unlocked units (>3 years) must succeed"
    );
    let simulation = sell_500_result.unwrap();
    assert_eq!(
        simulation.estimated_value,
        money("62500"),
        "Estimated redemption value must be 62,500 (500 * 125)"
    );

    // 2. Selling 700 units (exceeds 500 unlocked units; 400 are locked) must fail
    let sell_700_result = simulate_sell(
        &mock_folio,
        units("700"),
        now,
        nav("125"),
        dec("0.3"),
    );
    assert!(
        matches!(
            sell_700_result,
            Err(PortfolioError::UnitsLocked { .. }) | Err(PortfolioError::InsufficientUnits { .. })
        ),
        "Selling 700 units must fail with UnitsLocked or InsufficientUnits"
    );
}

// ============================================================================
// PORTFOLIO 10: Lifecycle Manager (Folio Manual Close and Direct Deletion)
// ============================================================================
#[test]
fn test_portfolio_10_folio_lifecycle_manual_close() {
    let active_transactions = vec![Transaction::new(
        "tx-lc1",
        date(2023, 1, 1),
        TransactionType::Purchase,
        money("-60000"),
        units("600"),
        nav("100"),
        units("600"),
    )];

    // 1. Initial state: 600 active units
    let current_units = get_latest_units(&active_transactions);
    assert_eq!(
        current_units,
        units("600"),
        "Initial active units must be 600"
    );

    // 2. Simulate MANUAL_CLOSE redemption transaction
    let close_tx = Transaction::new(
        "tx-close-manual",
        date(2023, 6, 1),
        TransactionType::Redemption,
        money("66000"), // 600 * 110
        units("-600"),
        nav("110"),
        units("0"),
    )
    .with_external_id("MANUAL_CLOSE-folio-10-12345");

    let mut updated_txs = active_transactions.clone();
    updated_txs.push(close_tx);

    let new_units = get_latest_units(&updated_txs);
    assert_eq!(
        new_units,
        Units::zero(),
        "After manual close, units must be 0"
    );

    // 3. Performance metrics after close: currentValue and investedAmount must be 0
    let metrics_after_close = get_metrics(
        &updated_txs,
        nav("110"),
        Some(PerformanceOptions::new().with_units_override(new_units)),
    );
    assert_eq!(
        metrics_after_close.current_value,
        Money::zero(),
        "After manual close, current valuation must be 0"
    );
    assert_eq!(
        metrics_after_close.invested_amount,
        Money::zero(),
        "After manual close, invested amount must be 0"
    );
}
