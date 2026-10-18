//! Comprehensive Property-Based Testing (PBT) suite for portfolio-core.
//!
//! Validates fundamental financial invariants ported from TypeScript fast-check suites:
//! - Property 1: Conservation of Units (FIFO lots balance identity)
//! - Property 2: Section 112A Statutory Grandfathering Bounds & Loss Limitation
//! - Property 3: Portfolio Overlap Symmetry, Bounds, and Self-Overlap
//! - Property 4: XIRR Monotonicity with respect to terminal portfolio valuation

use chrono::NaiveDate;
use proptest::prelude::*;
use rust_decimal::Decimal;

use portfolio_core::holdings::{
    Folio, Transaction, TransactionType, get_latest_units, is_unit_addition, is_unit_redemption,
};
use portfolio_core::performance::xirr::{CashFlow, calculate_xirr_with_terminal_value};
use portfolio_core::tax::BuyLot;
use portfolio_core::tax::grandfathering::{GRANDFATHER_DATE, calculate_gain, compute_deemed_cost};
use portfolio_core::types::{AssetType, FolioNumber, Money, Nav, Units};
use portfolio_core::xray::{FundHolding, calculate_fund_overlap};

const STOCK_CATALOG: &[&str] = &[
    "HDFC Bank Ltd.",
    "HDFC Bank Limited",
    "Reliance Industries Ltd",
    "Reliance Industries Limited",
    "Infosys Ltd",
    "Infosys Limited",
    "Tata Consultancy Services Ltd.",
    "TCS",
    "ITC Limited",
    "Larsen & Toubro Ltd",
    "Bharti Airtel Ltd",
    "State Bank of India",
    "Kotak Mahindra Bank Ltd",
    "Axis Bank Ltd",
    "ICICI Bank Ltd",
];

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 256,
        failure_persistence: None,
        .. ProptestConfig::default()
    })]

    // ========================================================================
    // Property 1: Conservation of Units
    // ========================================================================
    // For any series of purchases, SIPs, and valid redemptions:
    // sum(bought_units) - sum(sold_units) == latest_units.
    #[test]
    fn prop_conservation_of_units(
        actions in proptest::collection::vec((0u8..=2u8, 1000u32..=5_000_000u32, 100_000u32..=5_000_000u32), 1..=25)
    ) {
        let mut txs = Vec::new();
        let mut running_balance = Units::ZERO;
        let mut expected_total_bought = Units::ZERO;
        let mut expected_total_sold = Units::ZERO;
        let base_date = NaiveDate::from_ymd_opt(2021, 1, 1).unwrap();

        for (i, &(action_type, units_raw, nav_raw)) in actions.iter().enumerate() {
            let tx_date = base_date + chrono::Duration::days(i as i64 * 10);
            let nav = Nav::new(Decimal::new(nav_raw as i64, 4));

            if action_type == 0 || (action_type == 2 && running_balance.is_zero()) {
                // Buy / Purchase
                let units = Units::new(Decimal::new(units_raw as i64, 4));
                let amount = -(units * nav);
                running_balance += units;
                expected_total_bought += units;

                txs.push(Transaction::new(
                    format!("tx-buy-{i}"),
                    tx_date,
                    TransactionType::Purchase,
                    amount,
                    units,
                    nav,
                    running_balance,
                ));
            } else if action_type == 1 {
                // SIP
                let units = Units::new(Decimal::new(units_raw as i64, 4));
                let amount = -(units * nav);
                running_balance += units;
                expected_total_bought += units;

                txs.push(Transaction::new(
                    format!("tx-sip-{i}"),
                    tx_date,
                    TransactionType::PurchaseSip,
                    amount,
                    units,
                    nav,
                    running_balance,
                ));
            } else {
                // Redemption: sell a fraction of available units
                let fraction_pct = (units_raw % 100) + 1; // 1% to 100%
                let fraction_dec = Decimal::new(fraction_pct as i64, 2);
                let mut units_to_redeem = Units::new(running_balance.to_decimal() * fraction_dec);
                if units_to_redeem > running_balance {
                    units_to_redeem = running_balance;
                }

                if units_to_redeem.is_positive() {
                    let amount = units_to_redeem * nav;
                    running_balance -= units_to_redeem;
                    expected_total_sold += units_to_redeem;

                    txs.push(Transaction::new(
                        format!("tx-red-{i}"),
                        tx_date,
                        TransactionType::Redemption,
                        amount,
                        -units_to_redeem,
                        nav,
                        running_balance,
                    ));
                }
            }
        }

        let computed_latest = get_latest_units(&txs);
        let computed_bought: Units = txs
            .iter()
            .filter(|t| is_unit_addition(t.tx_type))
            .map(|t| t.units.abs())
            .sum();
        let computed_sold: Units = txs
            .iter()
            .filter(|t| is_unit_redemption(t.tx_type))
            .map(|t| t.units.abs())
            .sum();

        // 1. Transaction book audit matches expected trackers
        prop_assert_eq!(computed_bought, expected_total_bought);
        prop_assert_eq!(computed_sold, expected_total_sold);

        // 2. Invariant: Total Bought - Total Sold == Latest Units
        prop_assert_eq!(computed_bought - computed_sold, computed_latest);

        // 3. Folio encapsulation preserves unit conservation
        let mut folio = Folio::new(
            "f-test",
            FolioNumber::new("FOLIO-123").unwrap(),
            "Test Fund",
            AssetType::MutualFund,
        );
        folio.transactions = txs;
        prop_assert_eq!(get_latest_units(&folio.transactions), computed_latest);
    }

    // ========================================================================
    // Property 2: Section 112A Grandfathering Bounds & Loss Limitation
    // ========================================================================
    // For equity purchases prior to 31-Jan-2018 with FMV:
    // 1. actual_nav <= deemed_nav <= max(actual_nav, fmv)
    // 2. If sell_nav > fmv > actual_nav: deemed_nav == fmv
    // 3. If fmv > sell_nav > actual_nav: deemed_nav == sell_nav (taxable gain is exactly 0)
    #[test]
    fn prop_section_112a_grandfathering_bounds(
        days_from_2000 in 0i64..=6605i64, // 2000-01-01 to 2018-01-31 (pre-Jan 31 2018)
        actual_nav_raw in 10_000i64..=500_000i64, // 100.00 to 5000.00
        sell_nav_raw in 10_000i64..=500_000i64,
        fmv_raw in 10_000i64..=500_000i64,
    ) {
        let buy_date = NaiveDate::from_ymd_opt(2000, 1, 1).unwrap() + chrono::Duration::days(days_from_2000);
        prop_assert!(buy_date <= GRANDFATHER_DATE);

        let actual_nav = Nav::new(Decimal::new(actual_nav_raw, 2));
        let sell_nav = Nav::new(Decimal::new(sell_nav_raw, 2));
        let fmv = Nav::new(Decimal::new(fmv_raw, 2));
        let units = Units::new(Decimal::from(10));

        let (deemed_cost, is_grandfathered, _, _, _) =
            compute_deemed_cost(buy_date, units, actual_nav, sell_nav, Some(fmv), true, false);

        prop_assert!(is_grandfathered);

        let deemed_nav = Nav::new(deemed_cost.to_decimal() / units.to_decimal());

        // Invariant 1: actual_nav <= deemed_nav <= max(actual_nav, fmv)
        prop_assert!(
            deemed_nav >= actual_nav,
            "Deemed NAV {} must be >= Actual NAV {}",
            deemed_nav,
            actual_nav
        );
        let upper_bound = actual_nav.max(fmv);
        prop_assert!(
            deemed_nav <= upper_bound,
            "Deemed NAV {} must be <= max(actual, fmv) {}",
            deemed_nav,
            upper_bound
        );

        // Invariant 2: If sell_nav > fmv > actual_nav => deemed_nav == fmv
        if sell_nav > fmv && fmv > actual_nav {
            prop_assert_eq!(
                deemed_nav,
                fmv,
                "When sell_nav > fmv > actual_nav, deemed_nav must equal fmv"
            );
        }

        // Invariant 3: If fmv > sell_nav > actual_nav => deemed_nav == sell_nav (0 taxable gain)
        if fmv > sell_nav && sell_nav > actual_nav {
            prop_assert_eq!(
                deemed_nav,
                sell_nav,
                "When fmv > sell_nav > actual_nav, deemed_nav must equal sell_nav"
            );

            let lot = BuyLot::new(buy_date, units, actual_nav, units * actual_nav);

            let sell_date = NaiveDate::from_ymd_opt(2024, 8, 1).unwrap();
            let realized = calculate_gain(
                "Synthetic Bluechip Fund",
                AssetType::MutualFund,
                &lot,
                units,
                sell_nav,
                sell_date,
                Decimal::new(30, 2),
                Some(fmv),
            );

            prop_assert_eq!(
                realized.gain,
                Money::ZERO,
                "Loss limitation rule: taxable gain must be exactly zero when fmv > sell_nav > actual_nav"
            );
        }
    }

    // ========================================================================
    // Property 3: Overlap Symmetry & Invariant Range
    // ========================================================================
    // For arbitrary fund holdings collections with positive weights:
    // 1. calculate_fund_overlap(A, B).overlap_percentage == calculate_fund_overlap(B, A).overlap_percentage
    // 2. 0 <= overlap_percentage <= 100
    // 3. calculate_fund_overlap(A, A).overlap_percentage == sum(weights_A)
    // 4. Common stocks are sorted by max weight descending
    #[test]
    fn prop_overlap_symmetry_and_invariant_range(
        holdings_a_raw in proptest::collection::vec((0usize..STOCK_CATALOG.len(), 10u32..=2500u32), 0..=12),
        holdings_b_raw in proptest::collection::vec((0usize..STOCK_CATALOG.len(), 10u32..=2500u32), 0..=12),
    ) {
        let mut holdings_a: Vec<FundHolding> = holdings_a_raw
            .into_iter()
            .map(|(idx, w_raw)| {
                FundHolding::new(
                    STOCK_CATALOG[idx],
                    Decimal::new(w_raw as i64, 2), // 0.10 to 25.00%
                )
            })
            .collect();

        let mut holdings_b: Vec<FundHolding> = holdings_b_raw
            .into_iter()
            .map(|(idx, w_raw)| {
                FundHolding::new(
                    STOCK_CATALOG[idx],
                    Decimal::new(w_raw as i64, 2),
                )
            })
            .collect();

        // Normalize weights if sum exceeds 100%
        let sum_a: Decimal = holdings_a.iter().map(|h| h.weight).sum();
        if sum_a > Decimal::from(100) {
            let factor = Decimal::from(100) / sum_a;
            for h in &mut holdings_a {
                h.weight = (h.weight * factor).round_dp(4);
            }
        }

        let sum_b: Decimal = holdings_b.iter().map(|h| h.weight).sum();
        if sum_b > Decimal::from(100) {
            let factor = Decimal::from(100) / sum_b;
            for h in &mut holdings_b {
                h.weight = (h.weight * factor).round_dp(4);
            }
        }

        let overlap_ab = calculate_fund_overlap("Fund Alpha", &holdings_a, "Fund Beta", &holdings_b);
        let overlap_ba = calculate_fund_overlap("Fund Beta", &holdings_b, "Fund Alpha", &holdings_a);

        // Invariant 1: Strict Symmetry
        prop_assert_eq!(
            overlap_ab.overlap_percentage,
            overlap_ba.overlap_percentage,
            "Overlap percentage must be strictly symmetric: overlap(A, B) != overlap(B, A)"
        );

        // Invariant 2: Range [0, 100]
        prop_assert!(
            overlap_ab.overlap_percentage >= Decimal::ZERO,
            "Overlap cannot be negative: {}",
            overlap_ab.overlap_percentage
        );
        prop_assert!(
            overlap_ab.overlap_percentage <= Decimal::from(100),
            "Overlap cannot exceed 100%: {}",
            overlap_ab.overlap_percentage
        );

        // Invariant 3: Self-overlap equals sum of weights
        let overlap_self = calculate_fund_overlap("Fund Alpha", &holdings_a, "Fund Alpha", &holdings_a);
        let total_weights_a: Decimal = holdings_a.iter().map(|h| h.weight).sum();
        prop_assert_eq!(
            overlap_self.overlap_percentage,
            total_weights_a,
            "Self-overlap must strictly equal sum(weights_A)"
        );

        // Invariant 4: Common stocks sorted by maximum weight descending
        for i in 0..overlap_ab.common_stocks.len().saturating_sub(1) {
            let max_curr = overlap_ab.common_stocks[i].weight_a.max(overlap_ab.common_stocks[i].weight_b);
            let max_next = overlap_ab.common_stocks[i + 1].weight_a.max(overlap_ab.common_stocks[i + 1].weight_b);
            prop_assert!(
                max_curr >= max_next,
                "Common stocks must be ordered descending by max weight: {} < {}",
                max_curr,
                max_next
            );
        }
    }

    // ========================================================================
    // Property 4: XIRR Monotonicity
    // ========================================================================
    // For 2-to-5 investment cash flows and terminal valuations V1 < V2:
    // XIRR(V2) > XIRR(V1).
    #[test]
    fn prop_xirr_monotonicity(
        investment_amounts in proptest::collection::vec(100_000u32..=5_000_000u32, 2..=5),
        v1_raw in 500_000u32..=20_000_000u32,
        v_diff_raw in 50_000u32..=5_000_000u32,
    ) {
        let t0 = NaiveDate::from_ymd_opt(2021, 1, 1).unwrap();
        let mut flows = Vec::new();

        for (i, &amt_raw) in investment_amounts.iter().enumerate() {
            let flow_date = t0 + chrono::Duration::days((i as i64 + 1) * 60);
            let flow_amt = -Decimal::new(amt_raw as i64, 2); // strictly negative investment outflow
            flows.push(CashFlow::new(flow_date, flow_amt));
        }

        let last_flow_date = flows.last().unwrap().date;
        let terminal_date = last_flow_date + chrono::Duration::days(120);

        let v1 = Decimal::new(v1_raw as i64, 2);
        let v2 = v1 + Decimal::new(v_diff_raw as i64, 2);
        prop_assert!(v2 > v1);

        let xirr1 = calculate_xirr_with_terminal_value(&flows, Money::new(v1), terminal_date);
        let xirr2 = calculate_xirr_with_terminal_value(&flows, Money::new(v2), terminal_date);

        prop_assert!(xirr1.is_ok(), "xirr1 must converge: {:?}", xirr1.err());
        prop_assert!(xirr2.is_ok(), "xirr2 must converge: {:?}", xirr2.err());

        let r1 = xirr1.unwrap();
        let r2 = xirr2.unwrap();

        prop_assert!(
            r2 > r1,
            "Monotonicity invariant violated: XIRR(V2={}) = {} must be > XIRR(V1={}) = {}",
            v2,
            r2,
            v1,
            r1
        );
    }
}
