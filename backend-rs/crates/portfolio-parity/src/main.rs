//! CLI entry point for the Automated Differential Parity Harness (`portfolio-parity`).
//!
//! Executes all synthetic scenarios through `portfolio-core`, validates precision bounds
//! against TypeScript benchmark outputs, and prints a formatted certification report.

use std::process::ExitCode;

use portfolio_parity::run_differential_tests;

fn main() -> ExitCode {
    match run_differential_tests() {
        Ok(report) => {
            println!("{}", report.format_report());
            if report.is_all_passed() {
                ExitCode::SUCCESS
            } else {
                eprintln!(
                    "Parity harness failure: {} of {} scenarios failed numerical equivalence checks.",
                    report.failed_scenarios, report.total_scenarios
                );
                ExitCode::FAILURE
            }
        }
        Err(err) => {
            eprintln!("Error running parity validation harness: {err}");
            ExitCode::FAILURE
        }
    }
}
