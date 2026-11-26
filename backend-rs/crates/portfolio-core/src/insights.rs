//! Portfolio smart insights and financial goal progress calculations.

use crate::types::Money;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};

/// Severity level for a generated portfolio insight.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum InsightSeverity {
    /// Informational observation.
    Info,
    /// Actionable optimization opportunity.
    Opportunity,
    /// Concentration or cost warning.
    Warning,
}

/// A single actionable portfolio insight.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartInsight {
    /// Machine-readable insight code.
    pub code: String,
    /// Short title for display.
    pub title: String,
    /// Detailed explanation.
    pub message: String,
    /// Severity level.
    pub severity: InsightSeverity,
}

/// Input metrics for generating smart portfolio insights.
#[derive(Debug, Clone, PartialEq)]
pub struct InsightInput {
    /// Total current portfolio value.
    pub total_value: Money,
    /// Total value held in Regular (commission-paying) mutual fund plans.
    pub regular_plan_value: Money,
    /// Estimated annual fee savings if Regular plans were switched to Direct.
    pub potential_annual_ter_savings: Money,
    /// Highest single-stock portfolio weight percentage (`0..=100`).
    pub max_single_stock_pct: f64,
    /// Name of the highest-weight single stock, if any.
    pub max_single_stock_name: Option<String>,
    /// Number of active schemes.
    pub active_scheme_count: usize,
}

/// Generates deterministic, actionable smart insights from portfolio metrics.
pub fn generate_smart_insights(input: &InsightInput) -> Vec<SmartInsight> {
    let mut insights = Vec::new();

    if input.regular_plan_value.is_positive() && input.potential_annual_ter_savings.is_positive() {
        insights.push(SmartInsight {
            code: "REGULAR_PLAN_TER_DRAG".to_string(),
            title: "Switch Regular Plans to Direct".to_string(),
            message: format!(
                "You hold ₹{} in Regular plans; switching to Direct could save ~₹{}/year in TER.",
                input.regular_plan_value.as_decimal().round_dp(0),
                input.potential_annual_ter_savings.as_decimal().round_dp(0),
            ),
            severity: InsightSeverity::Opportunity,
        });
    }

    if input.max_single_stock_pct >= 10.0 {
        let stock_label = input
            .max_single_stock_name
            .as_deref()
            .unwrap_or("a single stock");
        insights.push(SmartInsight {
            code: "SINGLE_STOCK_CONCENTRATION".to_string(),
            title: "High Single-Stock Concentration".to_string(),
            message: format!(
                "Look-through exposure to {} is {:.1}% of your portfolio (above 10% threshold).",
                stock_label, input.max_single_stock_pct
            ),
            severity: InsightSeverity::Warning,
        });
    }

    if input.active_scheme_count > 15 {
        insights.push(SmartInsight {
            code: "SCHEME_PROLIFERATION".to_string(),
            title: "Consider Consolidating Schemes".to_string(),
            message: format!(
                "You hold {} active schemes; consolidating overlapping funds can simplify tracking.",
                input.active_scheme_count
            ),
            severity: InsightSeverity::Info,
        });
    }

    insights
}

/// Goal progress calculation result.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GoalProgress {
    /// Goal name.
    pub goal_name: String,
    /// Target corpus amount.
    pub target_amount: Money,
    /// Current allocated corpus.
    pub current_amount: Money,
    /// Completion percentage (`0.0..=100.0`, capped at `100.0`).
    pub progress_pct: f64,
    /// Remaining shortfall (`Money::ZERO` if target is met or exceeded).
    pub shortfall: Money,
    /// Whether the goal target has been reached.
    pub is_achieved: bool,
}

/// Computes progress toward a financial goal.
pub fn compute_goal_progress(
    goal_name: &str,
    target_amount: Money,
    current_amount: Money,
) -> GoalProgress {
    let is_achieved = target_amount.is_positive() && current_amount >= target_amount;
    let shortfall = if current_amount >= target_amount {
        Money::ZERO
    } else {
        target_amount - current_amount
    };

    let progress_pct = if target_amount.is_positive() {
        let cur = current_amount.as_decimal().to_f64().unwrap_or(0.0).max(0.0);
        let tgt = target_amount.as_decimal().to_f64().unwrap_or(1.0);
        ((cur / tgt) * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    GoalProgress {
        goal_name: goal_name.to_string(),
        target_amount,
        current_amount,
        progress_pct,
        shortfall,
        is_achieved,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn test_generate_smart_insights_and_goal_progress() {
        let insights = generate_smart_insights(&InsightInput {
            total_value: Money::from_str("500000").unwrap(),
            regular_plan_value: Money::from_str("100000").unwrap(),
            potential_annual_ter_savings: Money::from_str("750").unwrap(),
            max_single_stock_pct: 15.0,
            max_single_stock_name: Some("HDFC Bank".to_string()),
            active_scheme_count: 5,
        });
        assert_ne!(insights.len(), 0);

        let achieved = compute_goal_progress(
            "Emergency",
            Money::from_str("100000").unwrap(),
            Money::from_str("120000").unwrap(),
        );
        assert!(achieved.is_achieved);
        assert_eq!(achieved.shortfall, Money::ZERO);
        assert_eq!(achieved.progress_pct, 100.0);

        let in_progress = compute_goal_progress(
            "House",
            Money::from_str("200000").unwrap(),
            Money::from_str("50000").unwrap(),
        );
        assert!(!in_progress.is_achieved);
        assert_eq!(in_progress.shortfall, Money::from_str("150000").unwrap());
        assert!((in_progress.progress_pct - 25.0).abs() < 0.01);
    }
}
