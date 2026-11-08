#![allow(missing_docs, clippy::unwrap_used, clippy::panic)]

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

        let sell_date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
        let (deemed_cost, is_grandfathered, _, _, _) =
            compute_deemed_cost(buy_date, sell_date, units, actual_nav, sell_nav, Some(fmv), true, false);

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
        let r1 = xirr1.unwrap();
        let r2 = xirr2.unwrap();

        if r1 < Decimal::from(10) {
            prop_assert!(
                r2 > r1,
                "Monotonicity invariant violated: XIRR(V2={}) = {} must be > XIRR(V1={}) = {}",
                v2,
                r2,
                v1,
                r1
            );
        } else {
            prop_assert!(
                r2 >= r1,
                "Ceiling clamp monotonicity violated: XIRR(V2={}) = {} must be >= XIRR(V1={}) = {}",
                v2,
                r2,
                v1,
                r1
            );
        }
    }

    // ========================================================================
    // Property 5: Fisher Real XIRR Monotonicity with Inflation
    // ========================================================================
    // For any post-tax return r > -0.90, if 0.0 <= i1 < i2 <= 1.0, then
    // calculate_post_tax_real_xirr(r, i1) > calculate_post_tax_real_xirr(r, i2).
    #[test]
    fn prop_real_xirr_monotonic_with_inflation(
        r_raw in -8000i64..=200_000i64, // -80% to +2000%
        i1_raw in 0u32..=5000u32,       // 0% to 50%
        i_diff_raw in 100u32..=5000u32, // +1% to +50%
    ) {
        use portfolio_core::performance::metrics::calculate_post_tax_real_xirr;

        let r = Decimal::new(r_raw, 4);
        let i1 = Decimal::new(i1_raw as i64, 4);
        let i2 = i1 + Decimal::new(i_diff_raw as i64, 4);
        prop_assert!(i2 > i1);

        let real1 = calculate_post_tax_real_xirr(Some(r), i1).unwrap().unwrap();
        let real2 = calculate_post_tax_real_xirr(Some(r), i2).unwrap().unwrap();

        prop_assert!(
            real1 > real2,
            "Fisher monotonicity violated: for r={}, real(i1={}) = {} must be > real(i2={}) = {}",
            r, i1, real1, i2, real2
        );
    }

    // ========================================================================
    // Property 6: Zero Tax Drag on Losses or Non-Taxable Positions
    // ========================================================================
    #[test]
    fn prop_zero_tax_drag_on_loss_portfolio(
        loss_xirr_raw in -5000i64..=0i64, // -50% to 0%
        cpi_raw in 0u32..=1200u32,        // 0% to 12%
    ) {
        use portfolio_core::performance::metrics::calculate_drag_attribution;

        let nominal = Decimal::new(loss_xirr_raw, 4);
        let inflation = Decimal::new(cpi_raw as i64, 4);

        let drag = calculate_drag_attribution(
            Some(nominal),
            Some(nominal), // In losses, post-tax XIRR == nominal XIRR
            Money::ZERO,
            Money::ZERO,
            Money::ZERO,
            inflation,
            None,
        ).unwrap();

        prop_assert_eq!(drag.debt_drag, Decimal::ZERO);
        prop_assert_eq!(drag.equity_drag, Decimal::ZERO);
        prop_assert_eq!(drag.cess_and_other_drag, Decimal::ZERO);
    }

    // ========================================================================
    // Property 7: Section 112A Harvest Ticket Exemption Bounding & Invariants
    // ========================================================================
    #[test]
    fn prop_section_112a_harvest_ticket_invariants(
        realized_fy_raw in 0u32..=200_000u32, // ₹0 to ₹2,00,000 realized LTCG
        gain_per_lot_raw in 100u32..=50_000u32, // ₹100 to ₹50,000 gain
        lot_count in 1usize..=10usize,
    ) {
        use portfolio_core::tax::harvesting::{FolioHarvestingInput, get_harvesting_opportunities};

        let realized_fy = Money::new(Decimal::new(realized_fy_raw as i64, 0));
        let as_of = NaiveDate::from_ymd_opt(2025, 3, 15).unwrap();
        let buy_date_ltcg = NaiveDate::from_ymd_opt(2023, 1, 1).unwrap(); // > 365 days

        let mut txs_list = Vec::new();
        for i in 0..lot_count {
            let buy_nav = Nav::new(Decimal::new(100, 0));
            let current_nav = Nav::new(Decimal::new(100 + (gain_per_lot_raw as i64 / 10).max(1), 0));
            let tx = vec![Transaction::new(
                format!("tx-{i}"),
                buy_date_ltcg,
                TransactionType::Purchase,
                Money::new(Decimal::from(-10000)),
                Units::new(Decimal::from(100)),
                buy_nav,
                Units::new(Decimal::from(100)),
            )];
            txs_list.push((tx, current_nav));
        }

        let inputs: Vec<FolioHarvestingInput<'_>> = txs_list.iter().map(|(tx, nav)| {
            FolioHarvestingInput::new("HDFC Top 100 Equity Fund - Direct", AssetType::MutualFund, tx, *nav)
        }).collect();

        let summary = get_harvesting_opportunities(&inputs, as_of, realized_fy, None);

        let statutory_exemption = Money::new(Decimal::from(125_000));
        let expected_remaining = (statutory_exemption - realized_fy).max(Money::ZERO);
        prop_assert_eq!(summary.remaining_exemption, expected_remaining);

        // Invariant 1: Total harvested LTCG never exceeds remaining exemption
        prop_assert!(
            summary.total_potential_harvest <= summary.remaining_exemption,
            "Harvest {} exceeded remaining exemption {}",
            summary.total_potential_harvest,
            summary.remaining_exemption
        );

        // Invariant 2: When realized LTCG >= ₹1.25L, ticket returns 0 opportunities
        if realized_fy >= statutory_exemption {
            prop_assert_eq!(summary.remaining_exemption, Money::ZERO);
            prop_assert_eq!(summary.total_potential_harvest, Money::ZERO);
            prop_assert!(summary.opportunities.is_empty());
        }

        // Invariant 3: Sum of opportunity gains equals total_potential_harvest
        let opportunities_sum: Money = summary.opportunities.iter().map(|op| op.unrealized_gain).sum();
        prop_assert_eq!(opportunities_sum, summary.total_potential_harvest);
    }
}
