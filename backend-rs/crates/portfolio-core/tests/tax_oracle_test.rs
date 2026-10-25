//! Dedicated Statutory Tax Invariant Oracle and Golden Vectors Suite.
//!
//! Enforces:
//! 1. Section 112A Grandfathering loss limitation: deemed cost >= actual cost; actual loss cannot be amplified or turned into gain.
//! 2. Post-Budget 2024 rate cutoff: transactions on/after 2024-07-23 strictly apply 12.5% LTCG and 20% STCG; Section 50AA debt is slab-taxed.
//! 3. Advance Tax period conservation: sum of Table F quarter gains equals net realized gain, and tax components roll up identically.
//! 4. Section 70 Capital loss set-off invariants: no negative taxable gain, LTCL cannot offset STCG/Slab, STCL offsets Slab -> STCG -> LTCG.
//! 5. Golden vectors suite: 33 hermetic, verified statutory scenarios loaded via compile-time `include_str!`.

use std::str::FromStr;

use chrono::NaiveDate;
use proptest::prelude::*;
use rust_decimal::Decimal;
use serde::Deserialize;

use portfolio_core::tax::constants::*;
use portfolio_core::tax::grandfathering::{
    calculate_gain, calculate_gain_with_expenses, compute_deemed_cost,
};
use portfolio_core::tax::{
    AdvanceTaxQuarter, BuyLot, HoldingType, RealizedGain, TaxClassification, TaxSection, TaxType,
    apply_capital_loss_set_off_with_slab, build_advance_tax_matrix,
};
use portfolio_core::types::{AssetType, Money, Nav, Units};

// ============================================================================
// Golden Vectors Deserialization Models
// ============================================================================

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct GoldenTaxSuite {
    version: String,
    description: String,
    grandfathering_vectors: Vec<GrandfatheringVector>,
    classification_vectors: Vec<ClassificationVector>,
    loss_set_off_vectors: Vec<LossSetOffVector>,
    advance_tax_vectors: Vec<AdvanceTaxVector>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct GrandfatheringVector {
    id: String,
    description: String,
    asset_name: String,
    buy_date: String,
    sell_date: String,
    units: String,
    buy_nav: String,
    sell_nav: String,
    fmv_nav: String,
    transfer_expenses: String,
    is_bonus: bool,
    expected_is_grandfathered: bool,
    expected_deemed_cost: String,
    expected_gain: String,
    expected_tax_type: TaxType,
    expected_section: TaxSection,
    expected_tax_rate: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct ClassificationVector {
    id: String,
    description: String,
    is_equity: bool,
    buy_date: String,
    sell_date: String,
    tax_slab: String,
    expected_holding_type: HoldingType,
    expected_tax_type: TaxType,
    expected_section: TaxSection,
    expected_tax_rate: String,
    expected_holding_days: i64,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct LossSetOffVector {
    id: String,
    description: String,
    realized_stcg: String,
    realized_ltcg: String,
    realized_slab: String,
    expected_taxable_stcg: String,
    expected_taxable_ltcg: String,
    expected_taxable_slab: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct AdvanceTaxVector {
    id: String,
    sell_date: String,
    expected_quarter: String,
}

// ============================================================================
// Property-Based Invariant Tests (256 cases each)
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig {
        cases: 256,
        failure_persistence: None,
        .. ProptestConfig::default()
    })]

    /// Invariant 1: Section 112A Grandfathering Loss Limitation
    /// - Deemed cost can never be less than actual cost (deemed_cost >= actual_cost).
    /// - Deemed cost is bounded above by max(actual_nav, fmv) * units.
    /// - If actual sale is less than cost (sale < cost), grandfathering cannot turn loss into gain (gain <= 0).
    /// - If actual sale is less than cost, deemed cost must equal actual cost (loss cannot be amplified).
    /// - If actual sale exceeds cost (sale >= cost), grandfathering cannot produce an artificial loss (gain >= 0).
    /// - If fmv >= sale >= cost, taxable gain is wiped down to exactly 0.
    #[test]
    fn prop_grandfathering_loss_limitation(
        days_pre_2018 in 0i64..=6605i64, // 2000-01-01 to 2018-01-31
        actual_cost_paise in 100u32..=1_000_000u32, // NAV: 1.00 to 10,000.00
        fmv_paise in 100u32..=1_000_000u32,
        sale_paise in 100u32..=1_000_000u32,
        units_raw in 1000u32..=100_000u32, // Units: 1.000 to 100.000
    ) {
        let buy_date = NaiveDate::from_ymd_opt(2000, 1, 1).unwrap() + chrono::Duration::days(days_pre_2018);
        prop_assert!(buy_date <= GRANDFATHER_DATE);

        let actual_nav = Nav::new(Decimal::new(actual_cost_paise as i64, 2));
        let fmv = Nav::new(Decimal::new(fmv_paise as i64, 2));
        let sell_nav = Nav::new(Decimal::new(sale_paise as i64, 2));
        let units = Units::new(Decimal::new(units_raw as i64, 3));

        // Sell date well past 1-year anniversary to qualify as Long-Term Capital Asset
        let sell_date = NaiveDate::from_ymd_opt(2024, 8, 1).unwrap();

        let (deemed_cost, is_grandfathered, _, _, _) =
            compute_deemed_cost(buy_date, sell_date, units, actual_nav, sell_nav, Some(fmv), true, false);

        prop_assert!(is_grandfathered, "Long-term equity bought <= 31-Jan-2018 must be grandfathered");

        let actual_cost = actual_nav * units;
        let gross_consideration = sell_nav * units;

        // Invariant 1.1: Deemed cost can never be less than actual cost
        prop_assert!(
            deemed_cost >= actual_cost,
            "Deemed cost {} must be >= Actual cost {}",
            deemed_cost,
            actual_cost
        );

        // Invariant 1.2: Deemed cost is bounded above by max(actual_nav, fmv) * units
        let upper_bound_nav = actual_nav.max(fmv);
        let upper_bound_cost = upper_bound_nav * units;
        prop_assert!(
            deemed_cost <= upper_bound_cost,
            "Deemed cost {} must be <= max(actual, fmv) cost {}",
            deemed_cost,
            upper_bound_cost
        );

        let lot = BuyLot::new(buy_date, units, actual_nav, actual_cost);
        let realized = calculate_gain(
            "Synthetic Bluechip Fund",
            AssetType::MutualFund,
            &lot,
            units,
            sell_nav,
            sell_date,
            Decimal::from_str("0.30").unwrap(),
            Some(fmv),
        );

        let gain = realized.gain;

        // Invariant 1.3: If actual sale is less than cost, grandfathering cannot turn loss into gain
        if sell_nav < actual_nav {
            prop_assert!(
                gain <= Money::ZERO,
                "Actual loss cannot be turned into gain: sell_nav={}, actual_nav={}, gain={}",
                sell_nav,
                actual_nav,
                gain
            );
            // Invariant 1.4: Loss limitation prevents loss amplification (deemed cost equals actual cost)
            prop_assert_eq!(
                deemed_cost,
                actual_cost,
                "In loss scenario, deemed cost must equal actual cost"
            );
            prop_assert_eq!(
                gain,
                gross_consideration - actual_cost,
                "Actual economic loss must be preserved exactly"
            );
        }

        // Invariant 1.5: If actual sale is greater than or equal to cost, grandfathering cannot produce an artificial loss
        if sell_nav >= actual_nav {
            prop_assert!(
                gain >= Money::ZERO,
                "Sale at or above cost cannot produce a loss: sell_nav={}, actual_nav={}, gain={}",
                sell_nav,
                actual_nav,
                gain
            );
        }

        // Invariant 1.6: If fmv >= sale >= cost, taxable gain is wiped down to exactly 0
        if fmv >= sell_nav && sell_nav >= actual_nav {
            prop_assert_eq!(
                gain,
                Money::ZERO,
                "When FMV >= sell_nav >= actual_nav, gain must be exactly zero"
            );
            prop_assert_eq!(
                deemed_cost,
                gross_consideration,
                "When FMV >= sell_nav >= actual_nav, deemed cost must equal gross consideration"
            );
        }
    }

    /// Invariant 2: Statutory Rate Cutoff (Budget 2024 & Section 50AA)
    /// - Equity transactions on/after 2024-07-23 strictly apply 12.5% LTCG and 20% STCG.
    /// - Equity transactions strictly before 2024-07-23 strictly apply 10% LTCG and 15% STCG.
    /// - Debt transactions purchased on/after 2023-04-01 strictly apply Section 50AA Slab rate.
    #[test]
    fn prop_statutory_rate_cutoff(
        is_equity in proptest::bool::ANY,
        holding_days in 1i64..=1500i64,
        days_from_budget in -180i64..=180i64,
        tax_slab_pct in 5u32..=35u32,
    ) {
        let sell_date = BUDGET_2024_DATE + chrono::Duration::days(days_from_budget);
        let buy_date = sell_date - chrono::Duration::days(holding_days);
        let tax_slab = Decimal::new(tax_slab_pct as i64, 2);

        let classification = TaxClassification::classify(is_equity, buy_date, sell_date, tax_slab);

        if is_equity {
            let anniversary = buy_date
                .checked_add_months(chrono::Months::new(12))
                .unwrap_or(buy_date + chrono::Duration::days(365));
            let is_lt = sell_date >= anniversary;

            if sell_date >= BUDGET_2024_DATE {
                // Post-Budget 2024
                if is_lt {
                    prop_assert_eq!(classification.holding_type, HoldingType::LongTerm);
                    prop_assert_eq!(classification.tax_type, TaxType::Ltcg);
                    prop_assert_eq!(classification.section, TaxSection::Sec112A12_5);
                    prop_assert_eq!(classification.tax_rate, RATE_EQUITY_LTCG_POST_BUDGET);
                } else {
                    prop_assert_eq!(classification.holding_type, HoldingType::ShortTerm);
                    prop_assert_eq!(classification.tax_type, TaxType::Stcg);
                    prop_assert_eq!(classification.section, TaxSection::Sec111A20);
                    prop_assert_eq!(classification.tax_rate, RATE_EQUITY_STCG_POST_BUDGET);
                }
            } else {
                // Pre-Budget 2024
                if is_lt {
                    prop_assert_eq!(classification.holding_type, HoldingType::LongTerm);
                    prop_assert_eq!(classification.tax_type, TaxType::Ltcg);
                    prop_assert_eq!(classification.section, TaxSection::Sec112A10);
                    prop_assert_eq!(classification.tax_rate, RATE_EQUITY_LTCG_PRE_BUDGET);
                } else {
                    prop_assert_eq!(classification.holding_type, HoldingType::ShortTerm);
                    prop_assert_eq!(classification.tax_type, TaxType::Stcg);
                    prop_assert_eq!(classification.section, TaxSection::Sec111A15);
                    prop_assert_eq!(classification.tax_rate, RATE_EQUITY_STCG_PRE_BUDGET);
                }
            }
        } else if buy_date >= DEBT_NEW_REGIME_DATE {
            // Section 50AA Debt: Always Short-Term / Slab regardless of holding period
            prop_assert_eq!(classification.holding_type, HoldingType::ShortTerm);
            prop_assert_eq!(classification.tax_type, TaxType::Slab);
            prop_assert_eq!(classification.section, TaxSection::Sec50AA);
            prop_assert_eq!(classification.tax_rate, tax_slab);
        }
    }

    /// Invariant 3: Advance Tax Period Conservation
    /// - Sum of realized gains across Table F quarters strictly equals total net realized gain.
    /// - Sum of estimated taxes across Table F quarters strictly equals total estimated tax.
    /// - For each quarter, quarter_totals[q] strictly equals quarter.estimated_tax.
    /// - For each quarter, quarter.total_gain strictly equals sum of its sectional subcomponents.
    #[test]
    fn prop_advance_tax_period_conservation(
        redemptions in proptest::collection::vec(
            (
                1u32..=360u32, // day offset from 2024-04-01 across FY 2024-25
                1000u32..=50_000u32, // units raw
                1000u32..=20_000u32, // buy nav
                500u32..=30_000u32,  // sell nav
                proptest::bool::ANY, // is equity
            ),
            1..=15
        )
    ) {
        let fy_start = NaiveDate::from_ymd_opt(2024, 4, 1).unwrap();
        let mut details: Vec<RealizedGain> = Vec::new();
        let tax_slab = Decimal::from_str("0.30").unwrap();

        for &(day_offset, units_raw, buy_nav_raw, sell_nav_raw, is_eq) in &redemptions {
            let sell_date = fy_start + chrono::Duration::days(day_offset as i64);
            let buy_date = sell_date - chrono::Duration::days(200); // 200 days prior
            let units = Units::new(Decimal::new(units_raw as i64, 3));
            let buy_nav = Nav::new(Decimal::new(buy_nav_raw as i64, 2));
            let sell_nav = Nav::new(Decimal::new(sell_nav_raw as i64, 2));

            let lot = BuyLot::new(buy_date, units, buy_nav, units * buy_nav);
            let asset_name = if is_eq { "Synthetic Equity Fund" } else { "Synthetic Liquid Debt Fund" };
            let asset_type = if is_eq { AssetType::MutualFund } else { AssetType::FixedDeposit };

            let gain = calculate_gain(
                asset_name,
                asset_type,
                &lot,
                units,
                sell_nav,
                sell_date,
                tax_slab,
                None,
            );
            details.push(gain);
        }

        let matrix = build_advance_tax_matrix(&details);

        // Invariant 3.1: Sum of quarter gains == sum of details gains
        let expected_total_gain: Money = details.iter().map(|g| g.gain).sum();
        let computed_total_gain: Money = matrix.quarters.values().map(|q| q.total_gain).sum();
        prop_assert_eq!(
            computed_total_gain,
            expected_total_gain,
            "Conservation of total gain across Table F quarters failed"
        );

        // Invariant 3.2: Sum of quarter estimated tax == sum of details estimated tax
        let expected_total_tax: Money = details.iter().map(|g| g.estimated_tax).sum();
        let computed_total_tax: Money = matrix.quarters.values().map(|q| q.estimated_tax).sum();
        prop_assert_eq!(
            computed_total_tax,
            expected_total_tax,
            "Conservation of estimated tax across Table F quarters failed"
        );

        // Invariant 3.3: Quarter totals consistency & subcomponent sums
        for (q_name, q_data) in &matrix.quarters {
            if let Some(&total) = matrix.quarter_totals.get(q_name) {
                prop_assert_eq!(
                    total,
                    q_data.estimated_tax,
                    "Quarter total mismatch for quarter {}",
                    q_name
                );
            }

            let component_sum = q_data.stcg15
                + q_data.stcg20
                + q_data.ltcg10
                + q_data.ltcg12_5
                + q_data.debt_ltcg12_5
                + q_data.debt_ltcg20
                + q_data.slab;
            prop_assert_eq!(
                q_data.total_gain,
                component_sum,
                "Sectional component sum mismatch for quarter {}",
                q_name
            );

            prop_assert_eq!(
                q_data.estimated_tax,
                q_data.tax_before_cess + q_data.cess,
                "Tax before cess + cess mismatch for quarter {}",
                q_name
            );
        }
    }

    /// Invariant 4: Section 70 Capital Loss Set-Off Invariants
    /// - Taxable gains can never be negative.
    /// - Taxable gains can never exceed gross positive gains.
    /// - LTCL can ONLY set off LTCG; it cannot touch STCG or Slab.
    /// - Total STCL (Equity STCL + Section 50AA Slab STCL) sets off Slab -> STCG -> LTCG.
    #[test]
    fn prop_section_70_capital_loss_set_off(
        stcg_cents in -1_000_000i64..=1_000_000i64,
        ltcg_cents in -1_000_000i64..=1_000_000i64,
        slab_cents in -1_000_000i64..=1_000_000i64,
    ) {
        let stcg = Money::new(Decimal::new(stcg_cents, 2));
        let ltcg = Money::new(Decimal::new(ltcg_cents, 2));
        let slab = Money::new(Decimal::new(slab_cents, 2));

        let (taxable_stcg, taxable_ltcg, taxable_slab) =
            apply_capital_loss_set_off_with_slab(stcg, ltcg, slab);

        // Invariant 4.1: No negative taxable amounts
        prop_assert!(taxable_stcg >= Money::ZERO, "Taxable STCG cannot be negative");
        prop_assert!(taxable_ltcg >= Money::ZERO, "Taxable LTCG cannot be negative");
        prop_assert!(taxable_slab >= Money::ZERO, "Taxable Slab cannot be negative");

        // Invariant 4.2: Taxable amounts never exceed gross positive components
        prop_assert!(
            taxable_stcg <= stcg.max(Money::ZERO),
            "Taxable STCG {} cannot exceed gross STCG {}",
            taxable_stcg,
            stcg
        );
        prop_assert!(
            taxable_ltcg <= ltcg.max(Money::ZERO),
            "Taxable LTCG {} cannot exceed gross LTCG {}",
            taxable_ltcg,
            ltcg
        );
        prop_assert!(
            taxable_slab <= slab.max(Money::ZERO),
            "Taxable Slab {} cannot exceed gross Slab {}",
            taxable_slab,
            slab
        );

        // Invariant 4.3: LTCL restriction (LTCL cannot set off STCG or Slab)
        if ltcg < Money::ZERO && stcg >= Money::ZERO && slab >= Money::ZERO {
            prop_assert_eq!(
                taxable_stcg,
                stcg,
                "LTCL must not offset STCG: ltcg={}, stcg={}, taxable_stcg={}",
                ltcg,
                stcg,
                taxable_stcg
            );
            prop_assert_eq!(
                taxable_slab,
                slab,
                "LTCL must not offset Slab: ltcg={}, slab={}, taxable_slab={}",
                ltcg,
                slab,
                taxable_slab
            );
            prop_assert_eq!(
                taxable_ltcg,
                Money::ZERO,
                "Negative LTCG cannot result in positive taxable LTCG"
            );
        }

        // Invariant 4.4: STCL absorbs gains in priority order (Slab -> STCG -> LTCG)
        let total_stcl = (if stcg < Money::ZERO { stcg.abs() } else { Money::ZERO })
            + (if slab < Money::ZERO { slab.abs() } else { Money::ZERO });

        if total_stcl.is_zero() {
            // No STCL: taxable amounts must equal positive gains (with LTCL absorbing LTCG)
            prop_assert_eq!(taxable_stcg, stcg.max(Money::ZERO));
            prop_assert_eq!(taxable_slab, slab.max(Money::ZERO));
            let expected_ltcg = if ltcg > Money::ZERO { ltcg } else { Money::ZERO };
            prop_assert_eq!(taxable_ltcg, expected_ltcg);
        } else {
            // STCL is present: verify STCL absorbs positive components
            let gross_slab = slab.max(Money::ZERO);
            let gross_stcg = stcg.max(Money::ZERO);
            let gross_ltcg = ltcg.max(Money::ZERO);

            let remaining_after_slab = if total_stcl >= gross_slab { total_stcl - gross_slab } else { Money::ZERO };
            let remaining_after_stcg = if remaining_after_slab >= gross_stcg { remaining_after_slab - gross_stcg } else { Money::ZERO };
            let expected_ltcg = if gross_ltcg > remaining_after_stcg { gross_ltcg - remaining_after_stcg } else { Money::ZERO };

            prop_assert_eq!(taxable_ltcg, expected_ltcg, "LTCG absorption by remaining STCL mismatch");
        }
    }
}

// ============================================================================
// Golden Vectors Suite Test (Strict Zero-I/O via compile-time include_str!)
// ============================================================================

#[test]
fn test_golden_tax_vectors() {
    let data = include_str!("fixtures/golden_tax_vectors.json");
    assert!(
        !data.is_empty(),
        "Golden tax vectors fixture must not be empty"
    );

    let suite: GoldenTaxSuite =
        serde_json::from_str(data).expect("Failed to deserialize golden_tax_vectors.json");

    assert_eq!(suite.version, "1.0");

    let total_vectors = suite.grandfathering_vectors.len()
        + suite.classification_vectors.len()
        + suite.loss_set_off_vectors.len()
        + suite.advance_tax_vectors.len();

    assert!(
        total_vectors >= 25,
        "Fixture must contain 25+ verified scenarios, found {}",
        total_vectors
    );

    // 1. Verify Grandfathering Vectors
    for v in &suite.grandfathering_vectors {
        let buy_date = NaiveDate::from_str(&v.buy_date)
            .unwrap_or_else(|_| panic!("Invalid buy_date in vector {}", v.id));
        let sell_date = NaiveDate::from_str(&v.sell_date)
            .unwrap_or_else(|_| panic!("Invalid sell_date in vector {}", v.id));
        let units = Units::from_str(&v.units)
            .unwrap_or_else(|_| panic!("Invalid units in vector {}", v.id));
        let buy_nav = Nav::from_str(&v.buy_nav)
            .unwrap_or_else(|_| panic!("Invalid buy_nav in vector {}", v.id));
        let sell_nav = Nav::from_str(&v.sell_nav)
            .unwrap_or_else(|_| panic!("Invalid sell_nav in vector {}", v.id));
        let fmv_nav = Nav::from_str(&v.fmv_nav)
            .unwrap_or_else(|_| panic!("Invalid fmv_nav in vector {}", v.id));
        let transfer_expenses = Money::from_str(&v.transfer_expenses)
            .unwrap_or_else(|_| panic!("Invalid transfer_expenses in vector {}", v.id));

        let expected_deemed_cost = Money::from_str(&v.expected_deemed_cost)
            .unwrap_or_else(|_| panic!("Invalid expected_deemed_cost in vector {}", v.id));
        let expected_gain = Money::from_str(&v.expected_gain)
            .unwrap_or_else(|_| panic!("Invalid expected_gain in vector {}", v.id));
        let expected_tax_rate = Decimal::from_str(&v.expected_tax_rate)
            .unwrap_or_else(|_| panic!("Invalid expected_tax_rate in vector {}", v.id));

        let buy_lot = BuyLot::new(buy_date, units, buy_nav, units * buy_nav).with_bonus(v.is_bonus);

        let realized = calculate_gain_with_expenses(
            &v.asset_name,
            AssetType::MutualFund,
            &buy_lot,
            units,
            sell_nav,
            sell_date,
            Decimal::from_str("0.30").unwrap(),
            Some(fmv_nav),
            transfer_expenses,
        );

        assert_eq!(
            realized.is_grandfathered, v.expected_is_grandfathered,
            "Vector {}: is_grandfathered mismatch",
            v.id
        );
        assert_eq!(
            realized.deemed_cost_of_acquisition, expected_deemed_cost,
            "Vector {}: deemed_cost mismatch",
            v.id
        );
        assert_eq!(
            realized.gain, expected_gain,
            "Vector {}: gain mismatch",
            v.id
        );
        assert_eq!(
            realized.tax_type, v.expected_tax_type,
            "Vector {}: tax_type mismatch",
            v.id
        );
        assert_eq!(
            realized.section, v.expected_section,
            "Vector {}: section mismatch",
            v.id
        );
        assert_eq!(
            realized.tax_rate, expected_tax_rate,
            "Vector {}: tax_rate mismatch",
            v.id
        );
    }

    // 2. Verify Classification Vectors
    for v in &suite.classification_vectors {
        let buy_date = NaiveDate::from_str(&v.buy_date)
            .unwrap_or_else(|_| panic!("Invalid buy_date in vector {}", v.id));
        let sell_date = NaiveDate::from_str(&v.sell_date)
            .unwrap_or_else(|_| panic!("Invalid sell_date in vector {}", v.id));
        let tax_slab = Decimal::from_str(&v.tax_slab)
            .unwrap_or_else(|_| panic!("Invalid tax_slab in vector {}", v.id));
        let expected_tax_rate = Decimal::from_str(&v.expected_tax_rate)
            .unwrap_or_else(|_| panic!("Invalid expected_tax_rate in vector {}", v.id));

        let classification =
            TaxClassification::classify(v.is_equity, buy_date, sell_date, tax_slab);

        assert_eq!(
            classification.holding_type, v.expected_holding_type,
            "Vector {}: holding_type mismatch",
            v.id
        );
        assert_eq!(
            classification.tax_type, v.expected_tax_type,
            "Vector {}: tax_type mismatch",
            v.id
        );
        assert_eq!(
            classification.section, v.expected_section,
            "Vector {}: section mismatch",
            v.id
        );
        assert_eq!(
            classification.tax_rate, expected_tax_rate,
            "Vector {}: tax_rate mismatch",
            v.id
        );
        assert_eq!(
            classification.holding_days, v.expected_holding_days,
            "Vector {}: holding_days mismatch",
            v.id
        );
    }

    // 3. Verify Loss Set-Off Vectors
    for v in &suite.loss_set_off_vectors {
        let stcg = Money::from_str(&v.realized_stcg)
            .unwrap_or_else(|_| panic!("Invalid realized_stcg in vector {}", v.id));
        let ltcg = Money::from_str(&v.realized_ltcg)
            .unwrap_or_else(|_| panic!("Invalid realized_ltcg in vector {}", v.id));
        let slab = Money::from_str(&v.realized_slab)
            .unwrap_or_else(|_| panic!("Invalid realized_slab in vector {}", v.id));

        let expected_taxable_stcg = Money::from_str(&v.expected_taxable_stcg)
            .unwrap_or_else(|_| panic!("Invalid expected_taxable_stcg in vector {}", v.id));
        let expected_taxable_ltcg = Money::from_str(&v.expected_taxable_ltcg)
            .unwrap_or_else(|_| panic!("Invalid expected_taxable_ltcg in vector {}", v.id));
        let expected_taxable_slab = Money::from_str(&v.expected_taxable_slab)
            .unwrap_or_else(|_| panic!("Invalid expected_taxable_slab in vector {}", v.id));

        let (taxable_stcg, taxable_ltcg, taxable_slab) =
            apply_capital_loss_set_off_with_slab(stcg, ltcg, slab);

        assert_eq!(
            taxable_stcg, expected_taxable_stcg,
            "Vector {}: taxable_stcg mismatch",
            v.id
        );
        assert_eq!(
            taxable_ltcg, expected_taxable_ltcg,
            "Vector {}: taxable_ltcg mismatch",
            v.id
        );
        assert_eq!(
            taxable_slab, expected_taxable_slab,
            "Vector {}: taxable_slab mismatch",
            v.id
        );
    }

    // 4. Verify Advance Tax Quarter Vectors
    for v in &suite.advance_tax_vectors {
        let sell_date = NaiveDate::from_str(&v.sell_date)
            .unwrap_or_else(|_| panic!("Invalid sell_date in vector {}", v.id));

        let quarter = AdvanceTaxQuarter::from_date(sell_date);
        assert_eq!(
            quarter.as_str(),
            v.expected_quarter,
            "Vector {}: quarter as_str mismatch",
            v.id
        );
    }
}
