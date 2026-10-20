//! Automated Integration Test for Differential Parity (`portfolio-parity`).
//!
//! Loads `tests/fixtures/synthetic/portfolio_scenarios.json` and asserts zero regressions
//! or numerical discrepancies across all financial scenarios and precision invariants.

use portfolio_parity::run_differential_tests;

#[test]
fn test_differential_dual_runner_parity() {
    let report = run_differential_tests().expect("Parity harness failed to load or run scenarios");

    println!("{}", report.format_report());

    assert_eq!(
        report.failed_scenarios, 0,
        "Zero scenario failures allowed. Failed: {}",
        report.failed_scenarios
    );
    assert_eq!(
        report.failed_checks, 0,
        "Zero individual precision check failures allowed. Failed: {}",
        report.failed_checks
    );
    assert!(
        report.total_scenarios >= 9,
        "Must validate all required synthetic financial scenarios (got {})",
        report.total_scenarios
    );
    assert!(
        report.is_all_passed(),
        "Full numerical equivalence required across all scenarios"
    );
}
