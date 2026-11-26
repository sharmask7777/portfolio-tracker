//! Portfolio X-Ray hierarchy, TER expense analysis, and exposure aggregation.
//!
//! Provides:
//! - [`distribute_basis_points`]: Hare-Niemeyer largest-remainder allocator ensuring
//!   integer basis points sum exactly to the target total (e.g. `10_000` bps = 100.00%).
//! - [`compute_expense_analysis`]: Category-aware Direct vs Regular TER comparison across
//!   Equity, Debt, Liquid, and Gold schemes.
//! - [`compute_portfolio_exposures`] and [`compute_xray_report`]: Look-through sector and
//!   stock exposure aggregation.
//! - [`build_portfolio_hierarchy`]: 4-level `AssetClass -> Sector -> Stock -> Scheme` tree
//!   with `exclude_arbitrage`, tail gap reconciliation, and multi-denominator weights.

use crate::types::Money;
use crate::xray::catalog::CatalogHolding;
use crate::xray::security_master::{normalize_identifier, resolve_security_classification};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Distributes `total_bps` (typically `10_000` for 100.00%) across `weights` using the
/// Hare-Niemeyer largest-remainder method so the returned basis points sum exactly to `total_bps`.
pub fn distribute_basis_points(weights: &[Decimal], total_bps: i64) -> Vec<i64> {
    if weights.is_empty() || total_bps <= 0 {
        return vec![0; weights.len()];
    }
    let sum: Decimal = weights.iter().copied().sum();
    if sum <= Decimal::ZERO {
        return vec![0; weights.len()];
    }

    let total_dec = Decimal::from(total_bps);
    let mut floors = Vec::with_capacity(weights.len());
    let mut remainders = Vec::with_capacity(weights.len());
    let mut allocated: i64 = 0;

    for (idx, &w) in weights.iter().enumerate() {
        let exact = (w / sum) * total_dec;
        let floor_val = exact.floor().to_i64().unwrap_or(0).max(0);
        let rem = exact - Decimal::from(floor_val);
        allocated += floor_val;
        floors.push(floor_val);
        remainders.push((idx, rem));
    }

    let mut remaining = total_bps - allocated;
    remainders.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));

    for (idx, _) in remainders {
        if remaining <= 0 {
            break;
        }
        floors[idx] += 1;
        remaining -= 1;
    }

    floors
}

/// Input scheme descriptor for TER expense analysis.
#[derive(Debug, Clone, PartialEq)]
pub struct ExpenseSchemeInput {
    /// Scheme name.
    pub scheme_name: String,
    /// Current market value of the scheme.
    pub current_value: Money,
    /// Optional explicit TER percentage (e.g. `1.45` for 1.45%).
    pub explicit_ter_pct: Option<f64>,
}

/// Category-aware TER expense analysis result.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExpenseAnalysis {
    /// Weighted average TER percentage across the portfolio.
    pub weighted_avg_ter_pct: f64,
    /// Estimated annual fee in rupees at current valuation.
    pub estimated_annual_fee: Money,
    /// Estimated annual savings if all Regular plans were switched to Direct plans.
    pub potential_annual_savings: Money,
    /// Total value held in Regular plans.
    pub regular_plan_value: Money,
    /// Total value held in Direct plans.
    pub direct_plan_value: Money,
}

/// Infers `(is_direct, default_direct_ter_pct, default_regular_ter_pct)` by scheme category.
fn infer_category_ter_defaults(scheme_name: &str) -> (bool, f64, f64) {
    let upper = scheme_name.to_ascii_uppercase();
    let is_direct = upper.contains("DIRECT");

    if upper.contains("LIQUID") || upper.contains("OVERNIGHT") || upper.contains("MONEY MARKET") {
        (is_direct, 0.15, 0.30)
    } else if upper.contains("GOLD") || upper.contains("SILVER") {
        (is_direct, 0.35, 0.75)
    } else if upper.contains("DEBT")
        || upper.contains("GILT")
        || upper.contains("BOND")
        || upper.contains("CREDIT")
        || upper.contains("ARBITRAGE")
    {
        (is_direct, 0.40, 0.90)
    } else {
        // Equity / Hybrid default
        (is_direct, 0.65, 1.55)
    }
}

/// Computes category-aware Direct vs Regular TER expense analysis.
pub fn compute_expense_analysis(schemes: &[ExpenseSchemeInput]) -> ExpenseAnalysis {
    let mut total_value = Money::ZERO;
    let mut weighted_ter_sum = 0.0_f64;
    let mut estimated_annual_fee = Money::ZERO;
    let mut potential_annual_savings = Money::ZERO;
    let mut regular_plan_value = Money::ZERO;
    let mut direct_plan_value = Money::ZERO;

    for s in schemes {
        if !s.current_value.is_positive() {
            continue;
        }
        let val_f64 = s.current_value.as_decimal().to_f64().unwrap_or(0.0);
        let (is_direct, direct_ter, regular_ter) = infer_category_ter_defaults(&s.scheme_name);
        let effective_ter =
            s.explicit_ter_pct
                .unwrap_or(if is_direct { direct_ter } else { regular_ter });

        total_value += s.current_value;
        weighted_ter_sum += val_f64 * effective_ter;

        let fee_dec = s.current_value.as_decimal()
            * Decimal::from_f64_retain(effective_ter / 100.0).unwrap_or(Decimal::ZERO);
        estimated_annual_fee += Money::new(fee_dec);

        if is_direct {
            direct_plan_value += s.current_value;
        } else {
            regular_plan_value += s.current_value;
            let spread = (effective_ter - direct_ter).max(0.0);
            let savings_dec = s.current_value.as_decimal()
                * Decimal::from_f64_retain(spread / 100.0).unwrap_or(Decimal::ZERO);
            potential_annual_savings += Money::new(savings_dec);
        }
    }

    let total_val_f64 = total_value.as_decimal().to_f64().unwrap_or(0.0);
    let weighted_avg_ter_pct = if total_val_f64 > 0.0 {
        weighted_ter_sum / total_val_f64
    } else {
        0.0
    };

    ExpenseAnalysis {
        weighted_avg_ter_pct,
        estimated_annual_fee,
        potential_annual_savings,
        regular_plan_value,
        direct_plan_value,
    }
}

/// Input scheme for portfolio exposure, X-Ray, and hierarchy construction.
#[derive(Debug, Clone, PartialEq)]
pub struct HierarchySchemeInput {
    /// Scheme name.
    pub scheme_name: String,
    /// Asset class label (e.g. `"Equity"`, `"Debt"`, `"Gold"`, `"Arbitrage"`).
    pub asset_class: String,
    /// Whether this scheme is a cash-futures arbitrage fund.
    pub is_arbitrage: bool,
    /// Current market value of this scheme.
    pub current_value: Money,
    /// Underlying stock/asset holdings (weights in `0..=100`).
    pub holdings: Vec<CatalogHolding>,
}

/// Aggregated stock exposure across the portfolio.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StockExposure {
    /// Canonical normalized stock name.
    pub stock_name: String,
    /// Resolved sector.
    pub sector: String,
    /// Total rupee exposure across all schemes.
    pub exposure_value: Money,
    /// Weight as percentage of total portfolio (`0..=100`).
    pub portfolio_weight_pct: f64,
}

/// Summary X-Ray report across schemes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct XrayReport {
    /// Total portfolio value included in the report.
    pub total_value: Money,
    /// Top underlying stock exposures sorted by descending value.
    pub stock_exposures: Vec<StockExposure>,
    /// Sector weights (`sector -> percentage 0..=100`).
    pub sector_weights: BTreeMap<String, f64>,
}

/// Computes aggregated stock exposures across all schemes.
pub fn compute_portfolio_exposures(schemes: &[HierarchySchemeInput]) -> Vec<StockExposure> {
    let total_value: Money = schemes.iter().map(|s| s.current_value).sum();
    if !total_value.is_positive() {
        return Vec::new();
    }

    let mut by_stock: BTreeMap<String, (String, Money)> = BTreeMap::new();
    let hundred = Decimal::from(100);

    for scheme in schemes {
        if !scheme.current_value.is_positive() {
            continue;
        }
        for h in &scheme.holdings {
            if h.weight_pct <= Decimal::ZERO {
                continue;
            }
            let norm = normalize_identifier(&h.name);
            let key = if norm.is_empty() {
                h.name.to_ascii_uppercase()
            } else {
                norm
            };
            let (resolved_sector, _) = resolve_security_classification(None, None, &h.name);
            let sector = h
                .sector
                .clone()
                .or_else(|| resolved_sector.map(str::to_string))
                .unwrap_or_else(|| "Other".to_string());
            let exp_val = Money::new(scheme.current_value.as_decimal() * (h.weight_pct / hundred));
            let entry = by_stock.entry(key).or_insert((sector, Money::ZERO));
            entry.1 += exp_val;
        }
    }

    let total_f64 = total_value.as_decimal().to_f64().unwrap_or(1.0);
    let mut exposures: Vec<StockExposure> = by_stock
        .into_iter()
        .map(|(stock_name, (sector, exposure_value))| {
            let pct = (exposure_value.as_decimal().to_f64().unwrap_or(0.0) / total_f64) * 100.0;
            StockExposure {
                stock_name,
                sector,
                exposure_value,
                portfolio_weight_pct: pct,
            }
        })
        .collect();

    exposures.sort_by(|a, b| {
        b.exposure_value
            .cmp(&a.exposure_value)
            .then_with(|| a.stock_name.cmp(&b.stock_name))
    });
    exposures
}

/// Computes a full X-Ray report (stock exposures + sector weights).
pub fn compute_xray_report(schemes: &[HierarchySchemeInput]) -> XrayReport {
    let total_value: Money = schemes.iter().map(|s| s.current_value).sum();
    let stock_exposures = compute_portfolio_exposures(schemes);
    let mut sector_weights: BTreeMap<String, f64> = BTreeMap::new();
    for exp in &stock_exposures {
        *sector_weights.entry(exp.sector.clone()).or_insert(0.0) += exp.portfolio_weight_pct;
    }
    XrayReport {
        total_value,
        stock_exposures,
        sector_weights,
    }
}

/// A node in the 4-level `AssetClass -> Sector -> Stock -> Scheme` portfolio hierarchy.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HierarchyNode {
    /// Display name of the node.
    pub name: String,
    /// Node level (`"AssetClass"`, `"Sector"`, `"Stock"`, or `"Scheme"`).
    pub level: String,
    /// Rupee value represented by this node.
    pub value: Money,
    /// Weight in basis points relative to the parent (sums to `10_000` across siblings).
    pub parent_bps: i64,
    /// Weight as percentage of total portfolio (`0..=100`).
    pub portfolio_pct: f64,
    /// Child nodes.
    pub children: Vec<HierarchyNode>,
}

/// Builds a 4-level `AssetClass -> Sector -> Stock -> Scheme` hierarchy with:
/// - optional `exclude_arbitrage` filtering,
/// - tail gap reconciliation (undisclosed remainder added as `"Undisclosed / Cash Tail"`),
/// - Hare-Niemeyer `distribute_basis_points` so sibling `parent_bps` sum to `10_000`,
/// - multi-denominator weights (`parent_bps` and `portfolio_pct`).
pub fn build_portfolio_hierarchy(
    schemes: &[HierarchySchemeInput],
    exclude_arbitrage: bool,
) -> Vec<HierarchyNode> {
    let filtered: Vec<&HierarchySchemeInput> = schemes
        .iter()
        .filter(|s| s.current_value.is_positive() && (!exclude_arbitrage || !s.is_arbitrage))
        .collect();

    let total_value: Money = filtered.iter().map(|s| s.current_value).sum();
    if !total_value.is_positive() {
        return Vec::new();
    }
    let total_f64 = total_value.as_decimal().to_f64().unwrap_or(1.0);
    let hundred = Decimal::from(100);

    // Group: asset_class -> sector -> stock -> scheme -> value
    type SchemeMap = BTreeMap<String, Money>;
    type StockMap = BTreeMap<String, SchemeMap>;
    type SectorMap = BTreeMap<String, StockMap>;
    let mut tree: BTreeMap<String, SectorMap> = BTreeMap::new();

    for scheme in &filtered {
        let mut allocated_val = Money::ZERO;
        for h in &scheme.holdings {
            if h.weight_pct <= Decimal::ZERO {
                continue;
            }
            let val = Money::new(scheme.current_value.as_decimal() * (h.weight_pct / hundred));
            allocated_val += val;
            let (resolved_sector, _) = resolve_security_classification(None, None, &h.name);
            let sector = h
                .sector
                .clone()
                .or_else(|| resolved_sector.map(str::to_string))
                .unwrap_or_else(|| "Other".to_string());
            let stock_key = h.name.clone();
            *tree
                .entry(scheme.asset_class.clone())
                .or_default()
                .entry(sector)
                .or_default()
                .entry(stock_key)
                .or_default()
                .entry(scheme.scheme_name.clone())
                .or_insert(Money::ZERO) += val;
        }

        // Tail gap reconciliation for undisclosed holdings
        let tail = scheme.current_value - allocated_val;
        if tail.is_positive() {
            *tree
                .entry(scheme.asset_class.clone())
                .or_default()
                .entry("Undisclosed / Cash Tail".to_string())
                .or_default()
                .entry("Undisclosed Portfolio Tail".to_string())
                .or_default()
                .entry(scheme.scheme_name.clone())
                .or_insert(Money::ZERO) += tail;
        }
    }

    let mut ac_nodes = Vec::new();
    let mut ac_weights = Vec::new();

    for (ac_name, sectors) in tree {
        let mut sector_nodes = Vec::new();
        let mut sector_weights = Vec::new();
        let mut ac_val = Money::ZERO;

        for (sec_name, stocks) in sectors {
            let mut stock_nodes = Vec::new();
            let mut stock_weights = Vec::new();
            let mut sec_val = Money::ZERO;

            for (stk_name, scheme_map) in stocks {
                let mut sch_nodes = Vec::new();
                let mut sch_weights = Vec::new();
                let mut stk_val = Money::ZERO;

                for (sch_name, val) in scheme_map {
                    stk_val += val;
                    sch_weights.push(*val.as_decimal());
                    sch_nodes.push(HierarchyNode {
                        name: sch_name,
                        level: "Scheme".to_string(),
                        value: val,
                        parent_bps: 0,
                        portfolio_pct: (val.as_decimal().to_f64().unwrap_or(0.0) / total_f64)
                            * 100.0,
                        children: Vec::new(),
                    });
                }
                let sch_bps = distribute_basis_points(&sch_weights, 10_000);
                for (node, bps) in sch_nodes.iter_mut().zip(sch_bps) {
                    node.parent_bps = bps;
                }

                sec_val += stk_val;
                stock_weights.push(*stk_val.as_decimal());
                stock_nodes.push(HierarchyNode {
                    name: stk_name,
                    level: "Stock".to_string(),
                    value: stk_val,
                    parent_bps: 0,
                    portfolio_pct: (stk_val.as_decimal().to_f64().unwrap_or(0.0) / total_f64)
                        * 100.0,
                    children: sch_nodes,
                });
            }
            let stk_bps = distribute_basis_points(&stock_weights, 10_000);
            for (node, bps) in stock_nodes.iter_mut().zip(stk_bps) {
                node.parent_bps = bps;
            }

            ac_val += sec_val;
            sector_weights.push(*sec_val.as_decimal());
            sector_nodes.push(HierarchyNode {
                name: sec_name,
                level: "Sector".to_string(),
                value: sec_val,
                parent_bps: 0,
                portfolio_pct: (sec_val.as_decimal().to_f64().unwrap_or(0.0) / total_f64) * 100.0,
                children: stock_nodes,
            });
        }
        let sec_bps = distribute_basis_points(&sector_weights, 10_000);
        for (node, bps) in sector_nodes.iter_mut().zip(sec_bps) {
            node.parent_bps = bps;
        }

        ac_weights.push(*ac_val.as_decimal());
        ac_nodes.push(HierarchyNode {
            name: ac_name,
            level: "AssetClass".to_string(),
            value: ac_val,
            parent_bps: 0,
            portfolio_pct: (ac_val.as_decimal().to_f64().unwrap_or(0.0) / total_f64) * 100.0,
            children: sector_nodes,
        });
    }

    let ac_bps = distribute_basis_points(&ac_weights, 10_000);
    for (node, bps) in ac_nodes.iter_mut().zip(ac_bps) {
        node.parent_bps = bps;
    }

    ac_nodes
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    #[test]
    fn test_build_portfolio_hierarchy_and_expense_analysis() {
        let schemes = vec![HierarchySchemeInput {
            scheme_name: "HDFC Top 100 Fund - Direct Growth".to_string(),
            asset_class: "Equity".to_string(),
            is_arbitrage: false,
            current_value: Money::from_str("100000").unwrap(),
            holdings: vec![CatalogHolding {
                name: "HDFC Bank Ltd.".to_string(),
                sector: Some("Financial Services".to_string()),
                weight_pct: Decimal::from_str("60").unwrap(),
            }],
        }];

        let tree = build_portfolio_hierarchy(&schemes, false);
        assert_ne!(tree.len(), 0);
        assert_eq!(tree[0].value, Money::from_str("100000").unwrap());

        let expenses = compute_expense_analysis(&[ExpenseSchemeInput {
            scheme_name: "HDFC Top 100 Fund - Direct Growth".to_string(),
            current_value: Money::from_str("100000").unwrap(),
            explicit_ter_pct: None,
        }]);
        assert!(expenses.estimated_annual_fee > Money::ZERO);
    }
}
