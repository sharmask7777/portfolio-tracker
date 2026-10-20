//! Automated Differential Parity Harness (`portfolio-parity`).
//!
//! Validates mathematical equivalence and precision bounds between
//! the TypeScript and Rust implementations across synthetic financial scenarios.
//!
//! Evaluates:
//! - Units within <= 0.0001
//! - Currency amounts (gain, cost, tax) within <= ₹0.01
//! - Returns and XIRR within <= 10^-6

use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use portfolio_core::holdings::{
    Folio, Transaction, TransactionType, consolidate_by_scheme, get_latest_units,
};
use portfolio_core::performance::{PerformanceOptions, get_metrics};
use portfolio_core::tax::{
    BuyLot, HoldingType, TaxType, calculate_gain, calculate_portfolio_tax, get_locked_units,
    is_elss, simulate_sell,
};
use portfolio_core::types::{AssetType, FolioNumber, Isin, Money, Nav, Pan, Units};
use portfolio_core::xray::{FundHolding, calculate_fund_overlap};

// ============================================================================
// Fixture Data Models
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenariosFile {
    pub version: String,
    pub description: String,
    pub scenarios: Vec<ScenarioDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioDefinition {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub inputs: serde_json::Value,
    pub expected: serde_json::Value,
}

// ============================================================================
// Assertion & Result Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResult {
    pub name: String,
    pub actual: String,
    pub expected: String,
    pub diff: String,
    pub tolerance: String,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScenarioResult {
    pub id: String,
    pub name: String,
    pub category: String,
    pub description: String,
    pub checks: Vec<CheckResult>,
    pub passed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DifferentialReport {
    pub total_scenarios: usize,
    pub passed_scenarios: usize,
    pub failed_scenarios: usize,
    pub total_checks: usize,
    pub passed_checks: usize,
    pub failed_checks: usize,
    pub scenarios: Vec<ScenarioResult>,
}

impl DifferentialReport {
    pub fn is_all_passed(&self) -> bool {
        self.failed_scenarios == 0 && self.failed_checks == 0
    }

    pub fn format_report(&self) -> String {
        let mut out = String::new();
        out.push_str(
            "================================================================================\n",
        );
        out.push_str(
            "          AUTOMATED DIFFERENTIAL PARITY CERTIFICATION REPORT                    \n",
        );
        out.push_str(
            "           Dual-Runner Mathematical Equivalence Validation                      \n",
        );
        out.push_str(
            "================================================================================\n\n",
        );

        for (idx, scenario) in self.scenarios.iter().enumerate() {
            let status = if scenario.passed { "[PASS]" } else { "[FAIL]" };
            out.push_str(&format!(
                "{:02}. {} {} ({})\n",
                idx + 1,
                status,
                scenario.name,
                scenario.category
            ));
            out.push_str(&format!("    Description: {}\n", scenario.description));

            for check in &scenario.checks {
                let mark = if check.passed { "✓" } else { "✗" };
                out.push_str(&format!(
                    "    {} {:<32} Actual: {:<18} Expected: {:<18} Diff: {:<10} (Tol: {})\n",
                    mark, check.name, check.actual, check.expected, check.diff, check.tolerance
                ));
            }
            out.push('\n');
        }

        out.push_str(
            "--------------------------------------------------------------------------------\n",
        );
        out.push_str("SUMMARY CERTIFICATION METRICS:\n");
        out.push_str(&format!(
            "  Scenarios Passed:   {}/{} ({:.1}%)\n",
            self.passed_scenarios,
            self.total_scenarios,
            if self.total_scenarios > 0 {
                (self.passed_scenarios as f64 / self.total_scenarios as f64) * 100.0
            } else {
                0.0
            }
        ));
        out.push_str(&format!(
            "  Individual Checks:  {}/{} ({:.1}%)\n",
            self.passed_checks,
            self.total_checks,
            if self.total_checks > 0 {
                (self.passed_checks as f64 / self.total_checks as f64) * 100.0
            } else {
                0.0
            }
        ));
        out.push_str("  Precision Invariants:\n");
        out.push_str("    - Units:               Δ <= 0.0001\n");
        out.push_str("    - Financial Amounts:   Δ <= ₹0.01\n");
        out.push_str("    - Returns & XIRR:      Δ <= 10^-6 (0.000001)\n");

        let verdict = if self.is_all_passed() {
            "PARITY STATUS: FULL NUMERICAL EQUIVALENCE ACHIEVED (PASS)"
        } else {
            "PARITY STATUS: REGRESSIONS OR DISCREPANCIES DETECTED (FAIL)"
        };
        out.push_str(&format!("\n{}\n", verdict));
        out.push_str(
            "================================================================================\n",
        );

        out
    }
}

// ============================================================================
// Precision Verification Helpers
// ============================================================================

pub fn check_units(name: &str, actual: Units, expected: Units) -> CheckResult {
    let diff = (actual.to_decimal() - expected.to_decimal()).abs();
    let passed = diff <= Decimal::from_str("0.0001").unwrap();
    CheckResult {
        name: name.to_string(),
        actual: format!("{actual}"),
        expected: format!("{expected}"),
        diff: format!("{diff}"),
        tolerance: "0.0001".to_string(),
        passed,
    }
}

pub fn check_money(name: &str, actual: Money, expected: Money) -> CheckResult {
    let diff = (actual.to_decimal() - expected.to_decimal()).abs();
    let passed = diff <= Decimal::from_str("0.01").unwrap();
    CheckResult {
        name: name.to_string(),
        actual: format!("₹{actual}"),
        expected: format!("₹{expected}"),
        diff: format!("₹{diff}"),
        tolerance: "₹0.01".to_string(),
        passed,
    }
}

pub fn check_rate(name: &str, actual: Decimal, expected: Decimal) -> CheckResult {
    let diff = (actual - expected).abs();
    let passed = diff <= Decimal::from_str("0.000001").unwrap();
    CheckResult {
        name: name.to_string(),
        actual: format!("{actual}"),
        expected: format!("{expected}"),
        diff: format!("{diff}"),
        tolerance: "10^-6".to_string(),
        passed,
    }
}

pub fn check_bool(name: &str, actual: bool, expected: bool) -> CheckResult {
    let passed = actual == expected;
    CheckResult {
        name: name.to_string(),
        actual: format!("{actual}"),
        expected: format!("{expected}"),
        diff: if passed {
            "0".to_string()
        } else {
            "mismatch".to_string()
        },
        tolerance: "exact".to_string(),
        passed,
    }
}

pub fn check_str(name: &str, actual: &str, expected: &str) -> CheckResult {
    let passed = actual == expected;
    CheckResult {
        name: name.to_string(),
        actual: actual.to_string(),
        expected: expected.to_string(),
        diff: if passed {
            "0".to_string()
        } else {
            "mismatch".to_string()
        },
        tolerance: "exact".to_string(),
        passed,
    }
}

pub fn check_count(name: &str, actual: usize, expected: usize) -> CheckResult {
    let passed = actual == expected;
    CheckResult {
        name: name.to_string(),
        actual: format!("{actual}"),
        expected: format!("{expected}"),
        diff: if passed {
            "0".to_string()
        } else {
            format!("{}", (actual as i64 - expected as i64).abs())
        },
        tolerance: "exact".to_string(),
        passed,
    }
}

// ============================================================================
// Scenario File Loader
// ============================================================================

pub fn find_scenarios_path() -> Result<PathBuf, String> {
    let relative_candidates = [
        "tests/fixtures/synthetic/portfolio_scenarios.json",
        "../tests/fixtures/synthetic/portfolio_scenarios.json",
        "../../tests/fixtures/synthetic/portfolio_scenarios.json",
        "../../../tests/fixtures/synthetic/portfolio_scenarios.json",
        "../../../../tests/fixtures/synthetic/portfolio_scenarios.json",
    ];

    for candidate in &relative_candidates {
        let p = PathBuf::from(candidate);
        if p.exists() {
            return Ok(p);
        }
    }

    // Try starting from CARGO_MANIFEST_DIR and walking up
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let mut curr: Option<&Path> = Some(&manifest_dir);
    while let Some(dir) = curr {
        let target = dir.join("tests/fixtures/synthetic/portfolio_scenarios.json");
        if target.exists() {
            return Ok(target);
        }
        curr = dir.parent();
    }

    // Try starting from current_dir and walking up
    if let Ok(cwd) = std::env::current_dir() {
        let mut curr: Option<&Path> = Some(&cwd);
        while let Some(dir) = curr {
            let target = dir.join("tests/fixtures/synthetic/portfolio_scenarios.json");
            if target.exists() {
                return Ok(target);
            }
            curr = dir.parent();
        }
    }

    Err("Could not find portfolio_scenarios.json in any ancestor directory".to_string())
}

pub fn load_scenarios_from_file(path: &Path) -> Result<ScenariosFile, String> {
    let contents = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.display(), e))?;
    let file: ScenariosFile = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse JSON in {}: {}", path.display(), e))?;
    Ok(file)
}

// ============================================================================
// Scenario Runners
// ============================================================================

fn parse_tx(v: &serde_json::Value) -> Transaction {
    let id = v["id"].as_str().unwrap();
    let date = NaiveDate::parse_from_str(v["date"].as_str().unwrap(), "%Y-%m-%d").unwrap();
    let tx_type = match v["type"].as_str().unwrap() {
        "PURCHASE" => TransactionType::Purchase,
        "PURCHASE_SIP" => TransactionType::PurchaseSip,
        "REDEMPTION" => TransactionType::Redemption,
        "BUY" => TransactionType::Buy,
        "SELL" => TransactionType::Sell,
        "SWITCH_IN" => TransactionType::SwitchIn,
        "SWITCH_OUT" => TransactionType::SwitchOut,
        _ => TransactionType::Other,
    };
    let amount = Money::from_str(v["amount"].as_str().unwrap()).unwrap();
    let units = Units::from_str(v["units"].as_str().unwrap()).unwrap();
    let nav = Nav::from_str(v["nav"].as_str().unwrap()).unwrap();
    let balance = Units::from_str(v["balance"].as_str().unwrap()).unwrap();

    Transaction::new(id, date, tx_type, amount, units, nav, balance)
}

pub fn run_scenario(scenario: &ScenarioDefinition) -> ScenarioResult {
    let mut checks = Vec::new();

    match scenario.category.as_str() {
        "scheme_consolidation" => {
            let current_nav =
                Nav::from_str(scenario.inputs["current_nav"].as_str().unwrap()).unwrap();
            let asset_name = scenario.inputs["asset_name"].as_str().unwrap();
            let isin = Isin::new(scenario.inputs["isin"].as_str().unwrap()).unwrap();

            let mut folios = Vec::new();
            let raw_folios = scenario.inputs["folios"].as_array().unwrap();

            for (idx, raw_folio) in raw_folios.iter().enumerate() {
                let folio_id = raw_folio["id"].as_str().unwrap();
                let folio_num =
                    FolioNumber::new(raw_folio["folio_number"].as_str().unwrap()).unwrap();
                let pan = Pan::new(raw_folio["pan"].as_str().unwrap()).unwrap();
                let txs: Vec<Transaction> = raw_folio["transactions"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(parse_tx)
                    .collect();

                let folio = Folio::new(folio_id, folio_num, asset_name, AssetType::MutualFund)
                    .with_isin(isin.clone())
                    .with_pan(pan)
                    .with_transactions(txs.clone());

                let units = get_latest_units(&txs);
                let metrics = get_metrics(
                    &txs,
                    current_nav,
                    Some(PerformanceOptions::new().with_units_override(units)),
                );

                if idx == 0 {
                    let exp_units =
                        Units::from_str(scenario.expected["folio_1_units"].as_str().unwrap())
                            .unwrap();
                    let exp_invested =
                        Money::from_str(scenario.expected["folio_1_invested"].as_str().unwrap())
                            .unwrap();
                    let exp_cur = Money::from_str(
                        scenario.expected["folio_1_current_value"].as_str().unwrap(),
                    )
                    .unwrap();

                    checks.push(check_units("Folio 1 Units", units, exp_units));
                    checks.push(check_money(
                        "Folio 1 Invested",
                        metrics.invested_amount,
                        exp_invested,
                    ));
                    checks.push(check_money(
                        "Folio 1 Current Value",
                        metrics.current_value,
                        exp_cur,
                    ));
                } else if idx == 1 {
                    let exp_units =
                        Units::from_str(scenario.expected["folio_2_units"].as_str().unwrap())
                            .unwrap();
                    let exp_invested =
                        Money::from_str(scenario.expected["folio_2_invested"].as_str().unwrap())
                            .unwrap();
                    let exp_cur = Money::from_str(
                        scenario.expected["folio_2_current_value"].as_str().unwrap(),
                    )
                    .unwrap();

                    checks.push(check_units("Folio 2 Units", units, exp_units));
                    checks.push(check_money(
                        "Folio 2 Invested",
                        metrics.invested_amount,
                        exp_invested,
                    ));
                    checks.push(check_money(
                        "Folio 2 Current Value",
                        metrics.current_value,
                        exp_cur,
                    ));
                }

                folios.push(folio);
            }

            let consolidated = consolidate_by_scheme(&folios, current_nav);
            checks.push(check_count(
                "Consolidated Group Count",
                consolidated.len(),
                1,
            ));

            if let Some(group) = consolidated.first() {
                let exp_total_units = Units::from_str(
                    scenario.expected["consolidated_total_units"]
                        .as_str()
                        .unwrap(),
                )
                .unwrap();
                let exp_invested = Money::from_str(
                    scenario.expected["consolidated_invested_amount"]
                        .as_str()
                        .unwrap(),
                )
                .unwrap();
                let exp_current_val = Money::from_str(
                    scenario.expected["consolidated_current_value"]
                        .as_str()
                        .unwrap(),
                )
                .unwrap();
                let exp_gain = Money::from_str(
                    scenario.expected["consolidated_total_gain"]
                        .as_str()
                        .unwrap(),
                )
                .unwrap();

                checks.push(check_units(
                    "Consolidated Total Units",
                    group.total_units,
                    exp_total_units,
                ));
                checks.push(check_money(
                    "Consolidated Invested Amount",
                    group.total_invested_amount,
                    exp_invested,
                ));
                checks.push(check_money(
                    "Consolidated Current Value",
                    group.total_current_value,
                    exp_current_val,
                ));
                let total_gain = group.total_current_value - group.total_invested_amount;
                checks.push(check_money("Consolidated Total Gain", total_gain, exp_gain));
            }
        }

        "zero_holding_fund" => {
            let current_nav =
                Nav::from_str(scenario.inputs["current_nav"].as_str().unwrap()).unwrap();
            let asset_name = scenario.inputs["asset_name"].as_str().unwrap();
            let tax_slab =
                Decimal::from_str(scenario.inputs["tax_slab"].as_str().unwrap()).unwrap();
            let txs: Vec<Transaction> = scenario.inputs["transactions"]
                .as_array()
                .unwrap()
                .iter()
                .map(parse_tx)
                .collect();

            let latest_units = get_latest_units(&txs);
            let metrics = get_metrics(
                &txs,
                current_nav,
                Some(PerformanceOptions::new().with_units_override(latest_units)),
            );
            let tax = calculate_portfolio_tax(
                asset_name,
                AssetType::MutualFund,
                &txs,
                current_nav,
                tax_slab,
                None,
            );

            let exp_units =
                Units::from_str(scenario.expected["latest_units"].as_str().unwrap()).unwrap();
            let exp_invested =
                Money::from_str(scenario.expected["invested_amount"].as_str().unwrap()).unwrap();
            let exp_val =
                Money::from_str(scenario.expected["current_value"].as_str().unwrap()).unwrap();
            let exp_gain =
                Money::from_str(scenario.expected["total_gain"].as_str().unwrap()).unwrap();
            let exp_return =
                Decimal::from_str(scenario.expected["absolute_return"].as_str().unwrap()).unwrap();
            let exp_realized_total =
                Money::from_str(scenario.expected["realized_gain_total"].as_str().unwrap())
                    .unwrap();
            let exp_realized_ltcg =
                Money::from_str(scenario.expected["realized_ltcg"].as_str().unwrap()).unwrap();
            let exp_unrealized_total =
                Money::from_str(scenario.expected["unrealized_total"].as_str().unwrap()).unwrap();

            checks.push(check_units(
                "Zero Holding Latest Units",
                latest_units,
                exp_units,
            ));
            checks.push(check_money(
                "Zero Holding Invested Amount",
                metrics.invested_amount,
                exp_invested,
            ));
            checks.push(check_money(
                "Zero Holding Current Value",
                metrics.current_value,
                exp_val,
            ));
            checks.push(check_money(
                "Zero Holding Total Gain",
                metrics.total_gain,
                exp_gain,
            ));
            checks.push(check_rate(
                "Zero Holding Absolute Return",
                metrics.absolute_return,
                exp_return,
            ));
            checks.push(check_money(
                "Zero Holding Realized Gain Total",
                tax.realized.total,
                exp_realized_total,
            ));
            checks.push(check_money(
                "Zero Holding Realized LTCG",
                tax.realized.ltcg,
                exp_realized_ltcg,
            ));
            checks.push(check_money(
                "Zero Holding Unrealized Total",
                tax.unrealized.total,
                exp_unrealized_total,
            ));
        }

        "partial_redemption" => {
            let current_nav =
                Nav::from_str(scenario.inputs["current_nav"].as_str().unwrap()).unwrap();
            let txs: Vec<Transaction> = scenario.inputs["transactions"]
                .as_array()
                .unwrap()
                .iter()
                .map(parse_tx)
                .collect();

            let remaining_units = get_latest_units(&txs);
            let metrics = get_metrics(
                &txs,
                current_nav,
                Some(PerformanceOptions::new().with_units_override(remaining_units)),
            );
            let tax = calculate_portfolio_tax(
                scenario.inputs["asset_name"].as_str().unwrap(),
                AssetType::MutualFund,
                &txs,
                current_nav,
                Decimal::from_str("0.30").unwrap(),
                None,
            );

            let exp_units =
                Units::from_str(scenario.expected["remaining_units"].as_str().unwrap()).unwrap();
            let exp_invested =
                Money::from_str(scenario.expected["invested_amount"].as_str().unwrap()).unwrap();
            let exp_cur =
                Money::from_str(scenario.expected["current_value"].as_str().unwrap()).unwrap();
            let exp_gain =
                Money::from_str(scenario.expected["total_gain"].as_str().unwrap()).unwrap();
            let exp_abs_return =
                Decimal::from_str(scenario.expected["absolute_return"].as_str().unwrap()).unwrap();
            let exp_realized_gain =
                Money::from_str(scenario.expected["realized_gain_total"].as_str().unwrap())
                    .unwrap();

            checks.push(check_units(
                "Partial Redemption Remaining Units",
                remaining_units,
                exp_units,
            ));
            checks.push(check_money(
                "Partial Redemption Invested Amount",
                metrics.invested_amount,
                exp_invested,
            ));
            checks.push(check_money(
                "Partial Redemption Current Value",
                metrics.current_value,
                exp_cur,
            ));
            checks.push(check_money(
                "Partial Redemption Total Gain",
                metrics.total_gain,
                exp_gain,
            ));
            checks.push(check_rate(
                "Partial Redemption Absolute Return",
                metrics.absolute_return,
                exp_abs_return,
            ));
            checks.push(check_money(
                "Partial Redemption Realized Gain",
                tax.realized.total,
                exp_realized_gain,
            ));
        }

        "section_112a_grandfathering" => {
            let asset_name = scenario.inputs["asset_name"].as_str().unwrap();
            let buy_date = NaiveDate::parse_from_str(
                scenario.inputs["buy_date"].as_str().unwrap(),
                "%Y-%m-%d",
            )
            .unwrap();
            let buy_units =
                Units::from_str(scenario.inputs["buy_units"].as_str().unwrap()).unwrap();
            let buy_nav = Nav::from_str(scenario.inputs["buy_nav"].as_str().unwrap()).unwrap();
            let buy_amount =
                Money::from_str(scenario.inputs["buy_amount"].as_str().unwrap()).unwrap();
            let buy_lot = BuyLot::new(buy_date, buy_units, buy_nav, buy_amount);

            let grandfather_nav =
                Nav::from_str(scenario.inputs["grandfather_nav"].as_str().unwrap()).unwrap();
            let sell_date = NaiveDate::parse_from_str(
                scenario.inputs["sell_date"].as_str().unwrap(),
                "%Y-%m-%d",
            )
            .unwrap();
            let sell_units =
                Units::from_str(scenario.inputs["sell_units"].as_str().unwrap()).unwrap();
            let sell_nav = Nav::from_str(scenario.inputs["sell_nav"].as_str().unwrap()).unwrap();
            let tax_slab =
                Decimal::from_str(scenario.inputs["tax_slab"].as_str().unwrap()).unwrap();

            let gain = calculate_gain(
                asset_name,
                AssetType::MutualFund,
                &buy_lot,
                sell_units,
                sell_nav,
                sell_date,
                tax_slab,
                Some(grandfather_nav),
            );

            let exp_grandfathered = scenario.expected["is_grandfathered"].as_bool().unwrap();
            let exp_deemed_cost = Money::from_str(
                scenario.expected["deemed_cost_of_acquisition"]
                    .as_str()
                    .unwrap(),
            )
            .unwrap();
            let exp_gross =
                Money::from_str(scenario.expected["gross_consideration"].as_str().unwrap())
                    .unwrap();
            let exp_gain = Money::from_str(scenario.expected["gain"].as_str().unwrap()).unwrap();
            let exp_rate =
                Decimal::from_str(scenario.expected["tax_rate"].as_str().unwrap()).unwrap();
            let exp_tax_before_cess =
                Money::from_str(scenario.expected["tax_before_cess"].as_str().unwrap()).unwrap();
            let exp_cess = Money::from_str(scenario.expected["cess"].as_str().unwrap()).unwrap();
            let exp_tax =
                Money::from_str(scenario.expected["estimated_tax"].as_str().unwrap()).unwrap();

            checks.push(check_bool(
                "Grandfathering Is Grandfathered",
                gain.is_grandfathered,
                exp_grandfathered,
            ));
            checks.push(check_money(
                "Grandfathering Deemed Cost",
                gain.deemed_cost_of_acquisition,
                exp_deemed_cost,
            ));
            checks.push(check_money(
                "Grandfathering Gross Consideration",
                gain.gross_consideration,
                exp_gross,
            ));
            checks.push(check_money(
                "Grandfathering Taxable Gain",
                gain.gain,
                exp_gain,
            ));
            checks.push(check_rate(
                "Grandfathering Tax Rate",
                gain.tax_rate,
                exp_rate,
            ));
            checks.push(check_money(
                "Grandfathering Tax Before Cess",
                gain.tax_before_cess,
                exp_tax_before_cess,
            ));
            checks.push(check_money("Grandfathering Cess", gain.cess, exp_cess));
            checks.push(check_money(
                "Grandfathering Estimated Tax",
                gain.estimated_tax,
                exp_tax,
            ));
        }

        "elss_3yr_lockin" => {
            let asset_name = scenario.inputs["asset_name"].as_str().unwrap();
            let folio_num =
                FolioNumber::new(scenario.inputs["folio_number"].as_str().unwrap()).unwrap();
            let as_of_date = NaiveDate::parse_from_str(
                scenario.inputs["as_of_date"].as_str().unwrap(),
                "%Y-%m-%d",
            )
            .unwrap();
            let current_nav =
                Nav::from_str(scenario.inputs["current_nav"].as_str().unwrap()).unwrap();
            let tax_slab =
                Decimal::from_str(scenario.inputs["tax_slab"].as_str().unwrap()).unwrap();

            let txs: Vec<Transaction> = scenario.inputs["transactions"]
                .as_array()
                .unwrap()
                .iter()
                .map(parse_tx)
                .collect();

            let folio = Folio::new("folio-elss", folio_num, asset_name, AssetType::MutualFund)
                .with_transactions(txs.clone());

            let is_elss_flag = is_elss(asset_name);
            let total_units = get_latest_units(&txs);
            let locked_units = get_locked_units(asset_name, &txs, as_of_date);
            let unlocked_units = total_units - locked_units;

            let exp_is_elss = scenario.expected["is_elss"].as_bool().unwrap();
            let exp_total_units =
                Units::from_str(scenario.expected["total_units"].as_str().unwrap()).unwrap();
            let exp_locked_units =
                Units::from_str(scenario.expected["locked_units"].as_str().unwrap()).unwrap();
            let exp_unlocked_units =
                Units::from_str(scenario.expected["unlocked_units"].as_str().unwrap()).unwrap();

            checks.push(check_bool(
                "ELSS Scheme Classification",
                is_elss_flag,
                exp_is_elss,
            ));
            checks.push(check_units(
                "ELSS Total Units",
                total_units,
                exp_total_units,
            ));
            checks.push(check_units(
                "ELSS Locked Units",
                locked_units,
                exp_locked_units,
            ));
            checks.push(check_units(
                "ELSS Unlocked Units",
                unlocked_units,
                exp_unlocked_units,
            ));

            // Simulation 1: Sell 500 units (unlocked)
            let sim_500 = simulate_sell(
                &folio,
                Units::from_str("500.0000").unwrap(),
                as_of_date,
                current_nav,
                tax_slab,
            );
            checks.push(check_bool(
                "ELSS Sell 500 Unlocked Allowed",
                sim_500.is_ok(),
                scenario.expected["sell_500_allowed"].as_bool().unwrap(),
            ));
            if let Ok(sim) = sim_500 {
                let exp_val = Money::from_str(
                    scenario.expected["sell_500_estimated_value"]
                        .as_str()
                        .unwrap(),
                )
                .unwrap();
                checks.push(check_money(
                    "ELSS Sell 500 Estimated Value",
                    sim.estimated_value,
                    exp_val,
                ));
            }

            // Simulation 2: Sell 700 units (exceeds 500 unlocked units)
            let sim_700 = simulate_sell(
                &folio,
                Units::from_str("700.0000").unwrap(),
                as_of_date,
                current_nav,
                tax_slab,
            );
            checks.push(check_bool(
                "ELSS Sell 700 Locked Blocked",
                sim_700.is_ok(),
                scenario.expected["sell_700_allowed"].as_bool().unwrap(),
            ));
        }

        "alternative_assets_gold" => {
            let asset_type = AssetType::Sgb;
            let current_price =
                Nav::from_str(scenario.inputs["current_price"].as_str().unwrap()).unwrap();
            let txs: Vec<Transaction> = scenario.inputs["transactions"]
                .as_array()
                .unwrap()
                .iter()
                .map(parse_tx)
                .collect();

            let current_units = get_latest_units(&txs);
            let metrics = get_metrics(
                &txs,
                current_price,
                Some(
                    PerformanceOptions::new()
                        .with_units_override(current_units)
                        .with_asset_type(asset_type)
                        .with_asset_name(scenario.inputs["asset_name"].as_str().unwrap()),
                ),
            );

            let exp_units = Units::from_str(scenario.expected["units"].as_str().unwrap()).unwrap();
            let exp_cur =
                Money::from_str(scenario.expected["current_value"].as_str().unwrap()).unwrap();
            let exp_invested =
                Money::from_str(scenario.expected["invested_amount"].as_str().unwrap()).unwrap();
            let exp_gain =
                Money::from_str(scenario.expected["total_gain"].as_str().unwrap()).unwrap();
            let exp_abs_return =
                Decimal::from_str(scenario.expected["absolute_return"].as_str().unwrap()).unwrap();

            checks.push(check_bool(
                "Alternative Asset Classification",
                asset_type.is_alternative(),
                scenario.expected["is_alternative"].as_bool().unwrap(),
            ));
            checks.push(check_bool(
                "Gold Asset Classification",
                asset_type.is_gold(),
                scenario.expected["is_gold"].as_bool().unwrap(),
            ));
            checks.push(check_units("Gold Holding Units", current_units, exp_units));
            checks.push(check_money(
                "Gold Current Valuation",
                metrics.current_value,
                exp_cur,
            ));
            checks.push(check_money(
                "Gold Invested Amount",
                metrics.invested_amount,
                exp_invested,
            ));
            checks.push(check_money("Gold Total Gain", metrics.total_gain, exp_gain));
            checks.push(check_rate(
                "Gold Absolute Return",
                metrics.absolute_return,
                exp_abs_return,
            ));
        }

        "debt_fund_slab_tax" => {
            let asset_name = scenario.inputs["asset_name"].as_str().unwrap();
            let buy_date = NaiveDate::parse_from_str(
                scenario.inputs["buy_date"].as_str().unwrap(),
                "%Y-%m-%d",
            )
            .unwrap();
            let buy_units =
                Units::from_str(scenario.inputs["buy_units"].as_str().unwrap()).unwrap();
            let buy_nav = Nav::from_str(scenario.inputs["buy_nav"].as_str().unwrap()).unwrap();
            let buy_amount =
                Money::from_str(scenario.inputs["buy_amount"].as_str().unwrap()).unwrap();
            let buy_lot = BuyLot::new(buy_date, buy_units, buy_nav, buy_amount);

            let sell_date = NaiveDate::parse_from_str(
                scenario.inputs["sell_date"].as_str().unwrap(),
                "%Y-%m-%d",
            )
            .unwrap();
            let sell_units =
                Units::from_str(scenario.inputs["sell_units"].as_str().unwrap()).unwrap();
            let sell_nav = Nav::from_str(scenario.inputs["sell_nav"].as_str().unwrap()).unwrap();
            let tax_slab =
                Decimal::from_str(scenario.inputs["tax_slab"].as_str().unwrap()).unwrap();

            let gain = calculate_gain(
                asset_name,
                AssetType::MutualFund,
                &buy_lot,
                sell_units,
                sell_nav,
                sell_date,
                tax_slab,
                None,
            );

            let exp_gross =
                Money::from_str(scenario.expected["gross_consideration"].as_str().unwrap())
                    .unwrap();
            let exp_cost =
                Money::from_str(scenario.expected["cost_of_acquisition"].as_str().unwrap())
                    .unwrap();
            let exp_gain = Money::from_str(scenario.expected["gain"].as_str().unwrap()).unwrap();
            let exp_rate =
                Decimal::from_str(scenario.expected["tax_rate"].as_str().unwrap()).unwrap();
            let exp_tax_before_cess =
                Money::from_str(scenario.expected["tax_before_cess"].as_str().unwrap()).unwrap();
            let exp_cess = Money::from_str(scenario.expected["cess"].as_str().unwrap()).unwrap();
            let exp_tax =
                Money::from_str(scenario.expected["estimated_tax"].as_str().unwrap()).unwrap();

            checks.push(check_money(
                "Debt Gross Consideration",
                gain.gross_consideration,
                exp_gross,
            ));
            checks.push(check_money(
                "Debt Cost of Acquisition",
                gain.cost_of_acquisition,
                exp_cost,
            ));
            checks.push(check_money("Debt Capital Gain", gain.gain, exp_gain));
            checks.push(check_bool(
                "Debt Tax Type is Slab",
                gain.tax_type == TaxType::Slab,
                true,
            ));
            checks.push(check_bool(
                "Debt Holding Type is ShortTerm",
                gain.holding_type == HoldingType::ShortTerm,
                true,
            ));
            checks.push(check_rate("Debt Tax Rate", gain.tax_rate, exp_rate));
            checks.push(check_money(
                "Debt Tax Before Cess",
                gain.tax_before_cess,
                exp_tax_before_cess,
            ));
            checks.push(check_money("Debt Cess", gain.cess, exp_cess));
            checks.push(check_money(
                "Debt Estimated Tax",
                gain.estimated_tax,
                exp_tax,
            ));
            checks.push(check_bool(
                "Debt Post-2023 Is Not Grandfathered",
                gain.is_grandfathered,
                false,
            ));
        }

        "multi_year_sip_xirr" => {
            let current_nav =
                Nav::from_str(scenario.inputs["current_nav"].as_str().unwrap()).unwrap();
            let as_of_date = NaiveDate::parse_from_str(
                scenario.inputs["as_of_date"].as_str().unwrap(),
                "%Y-%m-%d",
            )
            .unwrap();
            let txs: Vec<Transaction> = scenario.inputs["transactions"]
                .as_array()
                .unwrap()
                .iter()
                .map(parse_tx)
                .collect();

            let units = get_latest_units(&txs);
            let metrics = get_metrics(
                &txs,
                current_nav,
                Some(
                    PerformanceOptions::new()
                        .with_units_override(units)
                        .with_as_of_date(as_of_date),
                ),
            );

            let exp_units =
                Units::from_str(scenario.expected["total_units"].as_str().unwrap()).unwrap();
            let exp_invested =
                Money::from_str(scenario.expected["invested_amount"].as_str().unwrap()).unwrap();
            let exp_current_val =
                Money::from_str(scenario.expected["current_value"].as_str().unwrap()).unwrap();
            let exp_gain =
                Money::from_str(scenario.expected["total_gain"].as_str().unwrap()).unwrap();
            let exp_abs_return =
                Decimal::from_str(scenario.expected["absolute_return"].as_str().unwrap()).unwrap();
            let exp_xirr = Decimal::from_str(scenario.expected["xirr"].as_str().unwrap()).unwrap();

            checks.push(check_units("Multi-Year SIP Total Units", units, exp_units));
            checks.push(check_money(
                "Multi-Year SIP Invested Amount",
                metrics.invested_amount,
                exp_invested,
            ));
            checks.push(check_money(
                "Multi-Year SIP Current Value",
                metrics.current_value,
                exp_current_val,
            ));
            checks.push(check_money(
                "Multi-Year SIP Total Gain",
                metrics.total_gain,
                exp_gain,
            ));
            checks.push(check_rate(
                "Multi-Year SIP Absolute Return",
                metrics.absolute_return,
                exp_abs_return,
            ));
            checks.push(check_rate(
                "Multi-Year SIP Annualized XIRR",
                metrics.xirr.unwrap_or(Decimal::ZERO),
                exp_xirr,
            ));
        }

        "fund_overlap" => {
            let name_a = scenario.inputs["fund_a"]["name"].as_str().unwrap();
            let holdings_a: Vec<FundHolding> = scenario.inputs["fund_a"]["holdings"]
                .as_array()
                .unwrap()
                .iter()
                .map(|h| {
                    FundHolding::new(
                        h["name"].as_str().unwrap(),
                        Decimal::from_str(h["weight"].as_str().unwrap()).unwrap(),
                    )
                })
                .collect();

            let name_b = scenario.inputs["fund_b"]["name"].as_str().unwrap();
            let holdings_b: Vec<FundHolding> = scenario.inputs["fund_b"]["holdings"]
                .as_array()
                .unwrap()
                .iter()
                .map(|h| {
                    FundHolding::new(
                        h["name"].as_str().unwrap(),
                        Decimal::from_str(h["weight"].as_str().unwrap()).unwrap(),
                    )
                })
                .collect();

            let overlap = calculate_fund_overlap(name_a, &holdings_a, name_b, &holdings_b);

            let exp_overlap =
                Decimal::from_str(scenario.expected["overlap_percentage"].as_str().unwrap())
                    .unwrap();
            let exp_count = scenario.expected["common_stocks_count"].as_u64().unwrap() as usize;

            checks.push(check_rate(
                "Fund Overlap Percentage",
                overlap.overlap_percentage,
                exp_overlap,
            ));
            checks.push(check_count(
                "Common Stocks Count",
                overlap.common_stocks.len(),
                exp_count,
            ));

            if let Some(common_stocks_exp) = scenario.expected["common_stocks"].as_array() {
                for (i, exp_stock) in common_stocks_exp.iter().enumerate() {
                    if let Some(actual_stock) = overlap.common_stocks.get(i) {
                        let exp_name = exp_stock["name"].as_str().unwrap();
                        let exp_w_a =
                            Decimal::from_str(exp_stock["weight_a"].as_str().unwrap()).unwrap();
                        let exp_w_b =
                            Decimal::from_str(exp_stock["weight_b"].as_str().unwrap()).unwrap();

                        checks.push(check_str(
                            &format!("Common Stock [{i}] Name"),
                            &actual_stock.name,
                            exp_name,
                        ));
                        checks.push(check_rate(
                            &format!("Common Stock [{i}] Weight A"),
                            actual_stock.weight_a,
                            exp_w_a,
                        ));
                        checks.push(check_rate(
                            &format!("Common Stock [{i}] Weight B"),
                            actual_stock.weight_b,
                            exp_w_b,
                        ));
                    }
                }
            }
        }

        other => {
            checks.push(CheckResult {
                name: format!("Unknown category: {other}"),
                actual: other.to_string(),
                expected: "known_category".to_string(),
                diff: "unsupported".to_string(),
                tolerance: "none".to_string(),
                passed: false,
            });
        }
    }

    let passed = checks.iter().all(|c| c.passed);

    ScenarioResult {
        id: scenario.id.clone(),
        name: scenario.name.clone(),
        category: scenario.category.clone(),
        description: scenario.description.clone(),
        checks,
        passed,
    }
}

pub fn run_differential_tests() -> Result<DifferentialReport, String> {
    let scenarios_path = find_scenarios_path()?;
    let file = load_scenarios_from_file(&scenarios_path)?;

    let mut scenario_results = Vec::new();
    let mut passed_scenarios = 0;
    let mut failed_scenarios = 0;
    let mut total_checks = 0;
    let mut passed_checks = 0;
    let mut failed_checks = 0;

    for scenario in &file.scenarios {
        let res = run_scenario(scenario);
        if res.passed {
            passed_scenarios += 1;
        } else {
            failed_scenarios += 1;
        }

        total_checks += res.checks.len();
        for c in &res.checks {
            if c.passed {
                passed_checks += 1;
            } else {
                failed_checks += 1;
            }
        }

        scenario_results.push(res);
    }

    Ok(DifferentialReport {
        total_scenarios: file.scenarios.len(),
        passed_scenarios,
        failed_scenarios,
        total_checks,
        passed_checks,
        failed_checks,
        scenarios: scenario_results,
    })
}
