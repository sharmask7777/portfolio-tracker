//! Deterministic Extended Internal Rate of Return (XIRR) solver.
//!
//! Uses Brent's method with interval bracketing `[-0.9999, 10.0]` (with expanding bounds if needed)
//! and a damped Newton-Raphson fallback. Zero I/O, deterministic, and free of NaN / indefinite loops.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};

use crate::error::PortfolioError;
use crate::types::Money;

/// A dated cash flow record for XIRR calculation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CashFlow {
    pub date: NaiveDate,
    pub amount: Decimal,
}

impl CashFlow {
    pub fn new(date: NaiveDate, amount: Decimal) -> Self {
        Self { date, amount }
    }

    pub fn from_amount(amount: Decimal, date: NaiveDate) -> Self {
        Self { date, amount }
    }
}

/// Evaluates the Net Present Value function f(r) = sum_i C_i * (1 + r)^(-(t_i - t_0)/365).
fn evaluate_npv(pairs: &[(f64, f64)], r: f64) -> f64 {
    if r <= -1.0 {
        return f64::NAN;
    }
    let one_plus_r = 1.0 + r;
    let ln_one_plus_r = one_plus_r.ln();
    pairs
        .iter()
        .map(|&(w, c)| c * (-w * ln_one_plus_r).exp())
        .sum()
}

/// Evaluates the derivative f'(r) = - (1 / (1 + r)) * sum_i w_i * C_i * (1 + r)^(-w_i).
fn evaluate_d_npv(pairs: &[(f64, f64)], r: f64) -> f64 {
    if r <= -1.0 {
        return f64::NAN;
    }
    let one_plus_r = 1.0 + r;
    let ln_one_plus_r = one_plus_r.ln();
    let sum: f64 = pairs
        .iter()
        .map(|&(w, c)| -w * c * (-w * ln_one_plus_r).exp())
        .sum();
    sum / one_plus_r
}

/// Brent's root-finding method on bracket `[a, b]` where `f(a) * f(b) <= 0`.
fn brent_root<F>(f: F, mut a: f64, mut b: f64, tol: f64, max_iter: usize) -> Result<f64, ()>
where
    F: Fn(f64) -> f64,
{
    let mut fa = f(a);
    let mut fb = f(b);

    if fa.abs() < tol {
        return Ok(a);
    }
    if fb.abs() < tol {
        return Ok(b);
    }
    if fa * fb > 0.0 {
        return Err(());
    }

    if fa.abs() < fb.abs() {
        std::mem::swap(&mut a, &mut b);
        std::mem::swap(&mut fa, &mut fb);
    }

    let mut c = a;
    let mut fc = fa;
    let mut mflag = true;
    let mut d = 0.0;

    for _ in 0..max_iter {
        if fb.abs() < tol || (b - a).abs() < tol {
            return Ok(b);
        }

        let mut s = if (fa - fc).abs() > 1e-15 && (fb - fc).abs() > 1e-15 {
            // Inverse quadratic interpolation
            (a * fb * fc) / ((fa - fb) * (fa - fc))
                + (b * fa * fc) / ((fb - fa) * (fb - fc))
                + (c * fa * fb) / ((fc - fa) * (fc - fb))
        } else if (fb - fa).abs() > 1e-15 {
            // Secant method
            b - fb * (b - a) / (fb - fa)
        } else {
            (a + b) / 2.0
        };

        let condition1 =
            !(((3.0 * a + b) / 4.0 <= s && s <= b) || (b <= s && s <= (3.0 * a + b) / 4.0));
        let condition2 = mflag && (s - b).abs() >= (b - c).abs() / 2.0;
        let condition3 = !mflag && (s - b).abs() >= (c - d).abs() / 2.0;
        let condition4 = mflag && (b - c).abs() < tol;
        let condition5 = !mflag && (c - d).abs() < tol;

        if condition1 || condition2 || condition3 || condition4 || condition5 || !s.is_finite() {
            s = (a + b) / 2.0;
            mflag = true;
        } else {
            mflag = false;
        }

        let fs = f(s);
        d = c;
        c = b;
        fc = fb;

        if fa * fs < 0.0 {
            b = s;
            fb = fs;
        } else {
            a = s;
            fa = fs;
        }

        if fa.abs() < fb.abs() {
            std::mem::swap(&mut a, &mut b);
            std::mem::swap(&mut fa, &mut fb);
        }
    }

    if fb.abs() < 1e-5 { Ok(b) } else { Err(()) }
}

/// Fallback Newton-Raphson method with step damping.
fn newton_raphson<F, DF>(f: F, df: DF, initial_guess: f64, max_iter: usize) -> Result<f64, ()>
where
    F: Fn(f64) -> f64,
    DF: Fn(f64) -> f64,
{
    let mut r = initial_guess;
    for _ in 0..max_iter {
        let y = f(r);
        if y.abs() < 1e-10 {
            return Ok(r);
        }
        let dy = df(r);
        if dy.abs() < 1e-14 || !dy.is_finite() {
            break;
        }
        let mut r_next = r - y / dy;
        if r_next <= -0.999999 {
            r_next = (r - 0.999999) / 2.0;
        }
        if (r_next - r).abs() < 1e-11 && f(r_next).abs() < 1e-6 {
            return Ok(r_next);
        }
        r = r_next;
    }
    if f(r).abs() < 1e-5 { Ok(r) } else { Err(()) }
}

/// Calculates the Extended Internal Rate of Return (XIRR) from a series of cash flows.
///
/// Returns `Ok(Decimal)` representing the annualized internal rate of return.
///
/// # Errors
/// - `PortfolioError::InvalidTransaction` if cash flows are empty, contain only identical dates,
///   or lack at least one positive and one negative cash flow.
/// - `PortfolioError::XirrConvergenceFailure` if root-finding fails to converge within 100 iterations.
pub fn calculate_xirr(flows: &[CashFlow]) -> Result<Decimal, PortfolioError> {
    if flows.is_empty() {
        return Err(PortfolioError::InvalidTransaction {
            reason: "Cash flows cannot be empty for XIRR calculation".to_string(),
        });
    }

    let first_date = flows[0].date;
    if flows.iter().all(|f| f.date == first_date) {
        return Err(PortfolioError::InvalidTransaction {
            reason: "All cash flow dates are identical".to_string(),
        });
    }

    let has_positive = flows.iter().any(|f| f.amount > Decimal::ZERO);
    let has_negative = flows.iter().any(|f| f.amount < Decimal::ZERO);
    if !has_positive || !has_negative {
        return Err(PortfolioError::InvalidTransaction {
            reason: "Cash flows must contain at least one positive and one negative flow"
                .to_string(),
        });
    }

    // Filter non-zero flows and sort chronologically
    let mut sorted_flows: Vec<CashFlow> = flows
        .iter()
        .filter(|f| !f.amount.is_zero())
        .cloned()
        .collect();

    if sorted_flows.is_empty() {
        return Err(PortfolioError::InvalidTransaction {
            reason: "Cash flows contain only zero amounts".to_string(),
        });
    }

    sorted_flows.sort_by_key(|f| f.date);
    let t0 = sorted_flows[0].date;

    // Normalization scale factor to prevent f64 overflow with huge amounts
    let max_abs = sorted_flows
        .iter()
        .map(|f| f.amount.abs().to_f64().unwrap_or(1.0))
        .fold(0.0f64, f64::max);
    let scale = if max_abs > 0.0 { max_abs } else { 1.0 };

    let pairs: Vec<(f64, f64)> = sorted_flows
        .iter()
        .map(|f| {
            let days = (f.date - t0).num_days() as f64;
            let w = days / 365.0;
            let c = f.amount.to_f64().unwrap_or(0.0) / scale;
            (w, c)
        })
        .collect();

    let f = |r: f64| evaluate_npv(&pairs, r);
    let df = |r: f64| evaluate_d_npv(&pairs, r);

    // 1. Initial Bracket [-0.9999, 10.0]
    let initial_a = -0.9999;
    let initial_b = 10.0;
    let mut bracket = None;

    if f(initial_a) * f(initial_b) <= 0.0 {
        bracket = Some((initial_a, initial_b));
    } else {
        // Grid search in [-0.9999, 10.0]
        let sample_points = [
            -0.9999, -0.99, -0.95, -0.9, -0.8, -0.6, -0.4, -0.2, -0.1, 0.0, 0.05, 0.1, 0.2, 0.3,
            0.5, 0.7, 1.0, 1.5, 2.0, 3.0, 5.0, 7.0, 10.0,
        ];
        for i in 0..sample_points.len() - 1 {
            let x0 = sample_points[i];
            let x1 = sample_points[i + 1];
            if f(x0) * f(x1) <= 0.0 {
                bracket = Some((x0, x1));
                break;
            }
        }

        // Expand bounds upwards if still not bracketed
        if bracket.is_none() {
            let upper_points = [20.0, 50.0, 100.0, 500.0, 1000.0, 10000.0];
            let mut prev = initial_b;
            for &next in &upper_points {
                if f(prev) * f(next) <= 0.0 {
                    bracket = Some((prev, next));
                    break;
                }
                prev = next;
            }
        }

        // Expand bounds downwards towards -1.0 if still not bracketed
        if bracket.is_none() {
            let lower_points = [-0.99999, -0.999999];
            let mut prev = initial_a;
            for &next in &lower_points {
                if f(prev) * f(next) <= 0.0 {
                    bracket = Some((next, prev));
                    break;
                }
                prev = next;
            }
        }
    }

    // Solve via Brent's method if bracketed
    let mut solved_rate = None;
    if let Some((a, b)) = bracket {
        solved_rate = brent_root(f, a, b, 1e-11, 100).ok();
    }

    // Fallback to Newton-Raphson if Brent failed or bracket was not found
    if solved_rate.is_none() {
        let guesses = [0.1, 0.0, -0.2, 0.5, 1.0, -0.5, 2.0];
        for &guess in &guesses {
            if let Ok(root) = newton_raphson(f, df, guess, 100) {
                solved_rate = Some(root);
                break;
            }
        }
    }

    let rate = solved_rate.ok_or(PortfolioError::XirrConvergenceFailure {
        iterations: 100,
        last_guess: Decimal::ZERO,
    })?;

    if !rate.is_finite() {
        return Err(PortfolioError::XirrConvergenceFailure {
            iterations: 100,
            last_guess: Decimal::ZERO,
        });
    }

    let dec_rate =
        Decimal::from_f64_retain(rate).ok_or(PortfolioError::XirrConvergenceFailure {
            iterations: 100,
            last_guess: Decimal::ZERO,
        })?;

    let rounded = dec_rate.round_dp(8).normalize();
    if rounded.is_zero() {
        Ok(Decimal::ZERO)
    } else {
        Ok(rounded)
    }
}

/// Convenience helper calculating XIRR by appending a terminal current value if positive.
pub fn calculate_xirr_with_terminal_value(
    flows: &[CashFlow],
    current_value: Money,
    as_of_date: NaiveDate,
) -> Result<Decimal, PortfolioError> {
    let mut all_flows = flows.to_vec();
    if current_value.is_positive() {
        all_flows.push(CashFlow::new(as_of_date, current_value.to_decimal()));
    }
    calculate_xirr(&all_flows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("valid test date")
    }

    fn dec(s: &str) -> Decimal {
        Decimal::from_str(s).expect("valid decimal")
    }

    #[test]
    fn test_xirr_simple_one_year_10_percent() {
        let flows = vec![
            CashFlow::new(date(2023, 1, 1), dec("-100")),
            CashFlow::new(date(2024, 1, 1), dec("110")),
        ];
        let xirr = calculate_xirr(&flows).expect("XIRR should succeed");
        assert_eq!(xirr, dec("0.1"));
    }

    #[test]
    fn test_xirr_standard_sip_plus_terminal_value() {
        // SIP of 100 on Jan 1 and 100 on Jul 1, terminal value 220 on Jan 1 next year
        let flows = vec![
            CashFlow::new(date(2023, 1, 1), dec("-100")),
            CashFlow::new(date(2023, 7, 1), dec("-100")),
            CashFlow::new(date(2024, 1, 1), dec("220")),
        ];
        let xirr = calculate_xirr(&flows).expect("SIP XIRR should succeed");
        // Rate is roughly 13.5%
        assert!(xirr > dec("0.10"));
        assert!(xirr < dec("0.20"));
    }

    #[test]
    fn test_xirr_negative_return_market_crash_30_percent() {
        // -100 invested on 2023-01-01, 70 returned on 2024-01-01 (exact 1 year)
        let flows = vec![
            CashFlow::new(date(2023, 1, 1), dec("-100")),
            CashFlow::new(date(2024, 1, 1), dec("70")),
        ];
        let xirr = calculate_xirr(&flows).expect("Negative XIRR should succeed");
        assert_eq!(xirr, dec("-0.3"));
    }

    #[test]
    fn test_xirr_zero_return() {
        let flows = vec![
            CashFlow::new(date(2023, 1, 1), dec("-100")),
            CashFlow::new(date(2024, 1, 1), dec("100")),
        ];
        let xirr = calculate_xirr(&flows).expect("Zero return XIRR should succeed");
        assert_eq!(xirr, Decimal::ZERO);
    }

    #[test]
    fn test_xirr_edge_cases_clean_errors() {
        // 1. Empty cash flows
        let empty_result = calculate_xirr(&[]);
        assert!(matches!(
            empty_result,
            Err(PortfolioError::InvalidTransaction { .. })
        ));

        // 2. All positive cash flows
        let all_pos = vec![
            CashFlow::new(date(2023, 1, 1), dec("100")),
            CashFlow::new(date(2024, 1, 1), dec("110")),
        ];
        assert!(matches!(
            calculate_xirr(&all_pos),
            Err(PortfolioError::InvalidTransaction { .. })
        ));

        // 3. All negative cash flows
        let all_neg = vec![
            CashFlow::new(date(2023, 1, 1), dec("-100")),
            CashFlow::new(date(2024, 1, 1), dec("-110")),
        ];
        assert!(matches!(
            calculate_xirr(&all_neg),
            Err(PortfolioError::InvalidTransaction { .. })
        ));

        // 4. Single cash flow
        let single = vec![CashFlow::new(date(2023, 1, 1), dec("-100"))];
        assert!(matches!(
            calculate_xirr(&single),
            Err(PortfolioError::InvalidTransaction { .. })
        ));

        // 5. All dates identical
        let same_dates = vec![
            CashFlow::new(date(2023, 1, 1), dec("-100")),
            CashFlow::new(date(2023, 1, 1), dec("110")),
        ];
        assert!(matches!(
            calculate_xirr(&same_dates),
            Err(PortfolioError::InvalidTransaction { .. })
        ));
    }
}
