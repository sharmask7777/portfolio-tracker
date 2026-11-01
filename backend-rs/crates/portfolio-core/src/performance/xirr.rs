//! Deterministic Extended Internal Rate of Return (XIRR) solver.
//!
//! # Mathematical Background & Numerical Architecture:
//! The Extended Internal Rate of Return (XIRR) is the annualized discount rate $r$ that satisfies:
//!
//! $$f(r) = \sum_{i=0}^{n} C_i (1 + r)^{-\frac{t_i - t_0}{365}} = 0$$
//!
//! where:
//! - $C_i$ is the cash flow amount at date $t_i$ (negative for investments/outflows, positive for redemptions/inflows).
//! - $t_0$ is the date of the initial cash flow.
//! - $w_i = \frac{t_i - t_0}{365}$ is the year fraction elapsed between $t_0$ and $t_i$.
//!
//! # Numerical Stability Safeguards:
//! 1. **Brent-Dekker Hybrid Solver**: Combines bisection, the secant method, and inverse quadratic
//!    interpolation. Guarantees linear bisection convergence in worst cases while achieving superlinear
//!    speed in standard scenarios.
//! 2. **Damped Newton-Raphson Fallback**: If bracket search fails, a multi-guess Newton-Raphson solver
//!    with derivative singularity protection and step damping toward the $r > -1.0$ singularity is employed.
//! 3. **Cash Flow Normalization**: Amounts are normalized by $\max_i |C_i|$ to prevent floating-point
//!    overflow when evaluating cash flows in crores / millions.
//! 4. **Duration Guardrail**: For periods under 30 days, annualized compounding creates astronomically
//!    distorted figures; absolute return is returned instead as an industry-standard proxy.
//! 5. **Zero-I/O & Pure Determinism**: Free of memory allocation loops, random jitter, or non-deterministic floats.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};

use crate::error::PortfolioError;
use crate::types::Money;

/// A dated cash flow record for XIRR calculation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CashFlow {
    /// Date when the cash flow transpired.
    pub date: NaiveDate,
    /// Signed monetary amount (negative for outflows/investments, positive for inflows/redemptions).
    pub amount: Decimal,
}

impl CashFlow {
    /// Constructs a new [`CashFlow`].
    pub fn new(date: NaiveDate, amount: Decimal) -> Self {
        Self { date, amount }
    }

    /// Alternate constructor accepting `(amount, date)`.
    pub fn from_amount(amount: Decimal, date: NaiveDate) -> Self {
        Self { date, amount }
    }
}

/// Evaluates Net Present Value: $f(r) = \sum_i C_i (1 + r)^{-w_i}$.
///
/// Computed using exponents of logarithms for numerical stability:
/// $(1 + r)^{-w_i} = \exp(-w_i \cdot \ln(1 + r))$.
///
/// Returns `f64::NAN` if $r \le -1.0$ (undefined logarithm).
fn evaluate_npv(weight_amount_pairs: &[(f64, f64)], rate: f64) -> f64 {
    if rate <= -1.0 {
        return f64::NAN;
    }
    let one_plus_r = 1.0 + rate;
    let ln_one_plus_r = one_plus_r.ln();
    weight_amount_pairs
        .iter()
        .map(|&(year_weight, scaled_amount)| scaled_amount * (-year_weight * ln_one_plus_r).exp())
        .sum()
}

/// Evaluates the first derivative of NPV:
///
/// $$f'(r) = -\frac{1}{1 + r} \sum_i w_i C_i (1 + r)^{-w_i}$$
///
/// Derived via chain rule: $\frac{d}{dr} \exp(-w_i \ln(1+r)) = -\frac{w_i}{1+r} \exp(-w_i \ln(1+r))$.
fn evaluate_d_npv(weight_amount_pairs: &[(f64, f64)], rate: f64) -> f64 {
    if rate <= -1.0 {
        return f64::NAN;
    }
    let one_plus_r = 1.0 + rate;
    let ln_one_plus_r = one_plus_r.ln();
    let sum: f64 = weight_amount_pairs
        .iter()
        .map(|&(year_weight, scaled_amount)| {
            -year_weight * scaled_amount * (-year_weight * ln_one_plus_r).exp()
        })
        .sum();
    sum / one_plus_r
}

/// Brent's root-finding method on bracket `[a, b]` where `f(a) * f(b) <= 0`.
///
/// Combines inverse quadratic interpolation, secant method, and bisection safeguards.
fn brent_root<F>(
    objective_fn: F,
    mut lower_bound: f64,
    mut upper_bound: f64,
    tolerance: f64,
    max_iter: usize,
) -> Result<f64, ()>
where
    F: Fn(f64) -> f64,
{
    let mut f_lower = objective_fn(lower_bound);
    let mut f_upper = objective_fn(upper_bound);

    if f_lower.abs() < tolerance {
        return Ok(lower_bound);
    }
    if f_upper.abs() < tolerance {
        return Ok(upper_bound);
    }
    if f_lower * f_upper > 0.0 {
        return Err(());
    }

    // Ensure |f(upper_bound)| <= |f(lower_bound)| so upper_bound is the best guess
    if f_lower.abs() < f_upper.abs() {
        std::mem::swap(&mut lower_bound, &mut upper_bound);
        std::mem::swap(&mut f_lower, &mut f_upper);
    }

    let mut previous_bound = lower_bound;
    let mut f_previous = f_lower;
    let mut force_bisection = true;
    let mut step_two_iterations_ago = 0.0;

    for _ in 0..max_iter {
        if f_upper.abs() < tolerance || (upper_bound - lower_bound).abs() < tolerance {
            return Ok(upper_bound);
        }

        // Interpolation step: inverse quadratic if 3 distinct points, otherwise secant
        let mut candidate_root = if (f_lower - f_previous).abs() > 1e-15
            && (f_upper - f_previous).abs() > 1e-15
        {
            // Inverse quadratic interpolation
            (lower_bound * f_upper * f_previous) / ((f_lower - f_upper) * (f_lower - f_previous))
                + (upper_bound * f_lower * f_previous)
                    / ((f_upper - f_lower) * (f_upper - f_previous))
                + (previous_bound * f_lower * f_upper)
                    / ((f_previous - f_lower) * (f_previous - f_upper))
        } else if (f_upper - f_lower).abs() > 1e-15 {
            // Secant method
            upper_bound - f_upper * (upper_bound - lower_bound) / (f_upper - f_lower)
        } else {
            (lower_bound + upper_bound) / 2.0
        };

        // Verification conditions deciding whether to accept interpolation or fall back to bisection
        let condition1 = !(((3.0 * lower_bound + upper_bound) / 4.0 <= candidate_root
            && candidate_root <= upper_bound)
            || (upper_bound <= candidate_root
                && candidate_root <= (3.0 * lower_bound + upper_bound) / 4.0));
        let condition2 = force_bisection
            && (candidate_root - upper_bound).abs() >= (upper_bound - previous_bound).abs() / 2.0;
        let condition3 = !force_bisection
            && (candidate_root - upper_bound).abs()
                >= (previous_bound - step_two_iterations_ago).abs() / 2.0;
        let condition4 = force_bisection && (upper_bound - previous_bound).abs() < tolerance;
        let condition5 =
            !force_bisection && (previous_bound - step_two_iterations_ago).abs() < tolerance;

        if condition1
            || condition2
            || condition3
            || condition4
            || condition5
            || !candidate_root.is_finite()
        {
            candidate_root = (lower_bound + upper_bound) / 2.0;
            force_bisection = true;
        } else {
            force_bisection = false;
        }

        let f_candidate = objective_fn(candidate_root);
        step_two_iterations_ago = previous_bound;
        previous_bound = upper_bound;
        f_previous = f_upper;

        if f_lower * f_candidate < 0.0 {
            upper_bound = candidate_root;
            f_upper = f_candidate;
        } else {
            lower_bound = candidate_root;
            f_lower = f_candidate;
        }

        if f_lower.abs() < f_upper.abs() {
            std::mem::swap(&mut lower_bound, &mut upper_bound);
            std::mem::swap(&mut f_lower, &mut f_upper);
        }
    }

    if f_upper.abs() < 1e-5 {
        Ok(upper_bound)
    } else {
        Err(())
    }
}

/// Fallback Newton-Raphson root-finder with step damping toward the $r = -1.0$ boundary.
fn newton_raphson<F, DF>(
    objective_fn: F,
    derivative_fn: DF,
    initial_guess: f64,
    max_iter: usize,
) -> Result<f64, ()>
where
    F: Fn(f64) -> f64,
    DF: Fn(f64) -> f64,
{
    let mut rate = initial_guess;
    for _ in 0..max_iter {
        let value = objective_fn(rate);
        if value.abs() < 1e-10 {
            return Ok(rate);
        }
        let derivative = derivative_fn(rate);
        if derivative.abs() < 1e-14 || !derivative.is_finite() {
            break;
        }
        let mut rate_next = rate - value / derivative;
        // Damping: prevent step from crashing into or below the -100% boundary
        if rate_next <= -0.999999 {
            rate_next = (rate - 0.999999) / 2.0;
        }
        if (rate_next - rate).abs() < 1e-11 && objective_fn(rate_next).abs() < 1e-6 {
            return Ok(rate_next);
        }
        rate = rate_next;
    }
    if objective_fn(rate).abs() < 1e-5 {
        Ok(rate)
    } else {
        Err(())
    }
}

/// Calculates the Extended Internal Rate of Return (XIRR) from a series of cash flows.
///
/// Returns `Ok(Decimal)` representing the annualized internal rate of return.
///
/// # Errors
/// - [`PortfolioError::InvalidTransaction`] if cash flows are empty, contain only identical dates,
///   or lack at least one positive and one negative cash flow.
/// - [`PortfolioError::XirrConvergenceFailure`] if root-finding fails to converge within 100 iterations.
pub fn calculate_xirr(flows: &[CashFlow]) -> Result<Decimal, PortfolioError> {
    if flows.is_empty() {
        return Err(PortfolioError::InvalidTransaction {
            reason: "Cash flows cannot be empty for XIRR calculation".to_string(),
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

    let has_positive = sorted_flows.iter().any(|f| f.amount > Decimal::ZERO);
    let has_negative = sorted_flows.iter().any(|f| f.amount < Decimal::ZERO);
    if !has_positive || !has_negative {
        return Err(PortfolioError::InvalidTransaction {
            reason: "Cash flows must contain at least one positive and one negative flow"
                .to_string(),
        });
    }

    sorted_flows.sort_by_key(|f| f.date);
    let first_date = sorted_flows[0].date;
    let last_date = sorted_flows.last().unwrap().date;
    if sorted_flows.iter().all(|f| f.date == first_date) {
        return Err(PortfolioError::InvalidTransaction {
            reason: "All cash flow dates are identical".to_string(),
        });
    }

    let diff_days = (last_date - first_date).num_days();
    // Safety guardrail: If duration is extremely short (< 30 days),
    // compounding causes astronomical, financially useless annualized rates (e.g. 1% in 1 day = 3678%).
    // Return Absolute Return as a proxy matching standard financial conventions.
    if diff_days < 30 {
        let total_invested: Decimal = sorted_flows
            .iter()
            .filter(|f| f.amount < Decimal::ZERO)
            .map(|f| f.amount.abs())
            .sum();
        let total_redeemed: Decimal = sorted_flows
            .iter()
            .filter(|f| f.amount > Decimal::ZERO)
            .map(|f| f.amount)
            .sum();
        if total_invested > Decimal::ZERO {
            let abs_ret = (total_redeemed - total_invested) / total_invested;
            return Ok(abs_ret.round_dp(8).normalize());
        }
    }

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

    let objective_npv = |r: f64| evaluate_npv(&pairs, r);
    let derivative_npv = |r: f64| evaluate_d_npv(&pairs, r);

    // 1. Initial Bracket [-0.9999, 10.0]
    let initial_a = -0.9999;
    let initial_b = 10.0;
    let mut bracket = None;

    if objective_npv(initial_a) * objective_npv(initial_b) <= 0.0 {
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
            if objective_npv(x0) * objective_npv(x1) <= 0.0 {
                bracket = Some((x0, x1));
                break;
            }
        }

        // Expand bounds upwards if still not bracketed
        if bracket.is_none() {
            let upper_points = [20.0, 50.0, 100.0, 500.0, 1000.0, 10000.0];
            let mut prev = initial_b;
            for &next in &upper_points {
                if objective_npv(prev) * objective_npv(next) <= 0.0 {
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
                if objective_npv(prev) * objective_npv(next) <= 0.0 {
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
        solved_rate = brent_root(objective_npv, a, b, 1e-11, 100).ok();
    }

    // Fallback to Newton-Raphson if Brent failed or bracket was not found
    if solved_rate.is_none() {
        let guesses = [0.1, 0.0, -0.2, 0.5, 1.0, -0.5, 2.0];
        for &guess in &guesses {
            if let Ok(root) = newton_raphson(objective_npv, derivative_npv, guess, 100) {
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

    // Clamp astronomical XIRR values (usually data errors or ultra-short terms).
    // 10.0 = 1000% annual return. -1.0 = -100% loss.
    let rate = rate.clamp(-1.0, 10.0);

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

        // 6. Non-zero cash flows have identical dates even with a 0 cash flow on another date
        let zero_flow_other_date = vec![
            CashFlow::new(date(2023, 1, 1), dec("-100")),
            CashFlow::new(date(2023, 1, 1), dec("110")),
            CashFlow::new(date(2024, 1, 1), Decimal::ZERO),
        ];
        assert!(matches!(
            calculate_xirr(&zero_flow_other_date),
            Err(PortfolioError::InvalidTransaction { .. })
        ));
    }

    #[test]
    fn test_xirr_evaluate_npv_and_from_amount() {
        let cf = CashFlow::from_amount(dec("500"), date(2023, 6, 1));
        assert_eq!(cf.amount, dec("500"));
        assert_eq!(cf.date, date(2023, 6, 1));

        let pairs = vec![(0.0, -100.0), (1.0, 110.0)];
        // At r <= -1.0, evaluate_npv returns NAN
        assert!(evaluate_npv(&pairs, -1.5).is_nan());
        assert!(evaluate_d_npv(&pairs, -1.5).is_nan());

        // Normal evaluate_npv at r = 0.10
        let npv = evaluate_npv(&pairs, 0.10);
        assert!(npv.abs() < 1e-10);

        // Near-zero or non-converging dy: signature is newton_raphson(f, df, initial_guess, max_iter)
        let zero_df = |_r: f64| 0.0;
        let dummy_f = |_r: f64| 10.0;
        assert!(newton_raphson(dummy_f, zero_df, 0.1, 50).is_err());
    }
}
