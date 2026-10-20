//! Market capitalization and asset allocation breakdown structures and calculators.

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Market capitalization breakdown across large, mid, and small cap equities.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct MarketCapBreakdown {
    pub large_cap: Decimal,
    pub mid_cap: Decimal,
    pub small_cap: Decimal,
}

impl MarketCapBreakdown {
    pub fn new(large_cap: Decimal, mid_cap: Decimal, small_cap: Decimal) -> Self {
        Self {
            large_cap,
            mid_cap,
            small_cap,
        }
    }

    pub fn zero() -> Self {
        Self::default()
    }

    pub fn total(&self) -> Decimal {
        self.large_cap + self.mid_cap + self.small_cap
    }

    /// Normalizes components to sum to 100% (or Decimal::ZERO if total is zero).
    pub fn normalize(&self) -> Self {
        let total = self.total();
        if total.is_zero() {
            return Self::zero();
        }
        let factor = Decimal::from(100) / total;
        Self {
            large_cap: self.large_cap * factor,
            mid_cap: self.mid_cap * factor,
            small_cap: self.small_cap * factor,
        }
    }
}

/// Asset allocation breakdown across broad asset classes (Equity, Debt, Cash, Alternatives).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct AssetAllocationBreakdown {
    pub equity: Decimal,
    pub debt: Decimal,
    pub cash: Decimal,
    pub alternatives: Decimal,
}

impl AssetAllocationBreakdown {
    pub fn new(equity: Decimal, debt: Decimal, cash: Decimal, alternatives: Decimal) -> Self {
        Self {
            equity,
            debt,
            cash,
            alternatives,
        }
    }

    pub fn zero() -> Self {
        Self::default()
    }

    pub fn total(&self) -> Decimal {
        self.equity + self.debt + self.cash + self.alternatives
    }

    /// Normalizes components to sum to 100% (or Decimal::ZERO if total is zero).
    pub fn normalize(&self) -> Self {
        let total = self.total();
        if total.is_zero() {
            return Self::zero();
        }
        let factor = Decimal::from(100) / total;
        Self {
            equity: self.equity * factor,
            debt: self.debt * factor,
            cash: self.cash * factor,
            alternatives: self.alternatives * factor,
        }
    }
}

/// Aggregates multiple fund market cap breakdowns weighted by portfolio value.
///
/// Each tuple is `(portfolio_value, breakdown)`.
pub fn aggregate_market_cap(funds: &[(Decimal, MarketCapBreakdown)]) -> MarketCapBreakdown {
    let total_value: Decimal = funds.iter().map(|(val, _)| (*val).max(Decimal::ZERO)).sum();

    if total_value <= Decimal::ZERO {
        return MarketCapBreakdown::zero();
    }

    let mut large_weighted = Decimal::ZERO;
    let mut mid_weighted = Decimal::ZERO;
    let mut small_weighted = Decimal::ZERO;

    for (val, breakdown) in funds {
        let v = (*val).max(Decimal::ZERO);
        if v.is_zero() {
            continue;
        }
        let weight = v / total_value;
        large_weighted += breakdown.large_cap * weight;
        mid_weighted += breakdown.mid_cap * weight;
        small_weighted += breakdown.small_cap * weight;
    }

    MarketCapBreakdown {
        large_cap: large_weighted,
        mid_cap: mid_weighted,
        small_cap: small_weighted,
    }
}

/// Aggregates multiple fund asset allocation breakdowns weighted by portfolio value.
///
/// Each tuple is `(portfolio_value, breakdown)`.
pub fn aggregate_asset_allocation(
    funds: &[(Decimal, AssetAllocationBreakdown)],
) -> AssetAllocationBreakdown {
    let total_value: Decimal = funds.iter().map(|(val, _)| (*val).max(Decimal::ZERO)).sum();

    if total_value <= Decimal::ZERO {
        return AssetAllocationBreakdown::zero();
    }

    let mut equity_weighted = Decimal::ZERO;
    let mut debt_weighted = Decimal::ZERO;
    let mut cash_weighted = Decimal::ZERO;
    let mut alt_weighted = Decimal::ZERO;

    for (val, breakdown) in funds {
        let v = (*val).max(Decimal::ZERO);
        if v.is_zero() {
            continue;
        }
        let weight = v / total_value;
        equity_weighted += breakdown.equity * weight;
        debt_weighted += breakdown.debt * weight;
        cash_weighted += breakdown.cash * weight;
        alt_weighted += breakdown.alternatives * weight;
    }

    AssetAllocationBreakdown {
        equity: equity_weighted,
        debt: debt_weighted,
        cash: cash_weighted,
        alternatives: alt_weighted,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn dec(s: &str) -> Decimal {
        Decimal::from_str(s).unwrap()
    }

    #[test]
    fn test_market_cap_breakdown_totals_and_normalization() {
        let mc = MarketCapBreakdown::new(dec("70"), dec("20"), dec("10"));
        assert_eq!(mc.total(), dec("100"));

        let unnormalized = MarketCapBreakdown::new(dec("35"), dec("10"), dec("5"));
        let norm = unnormalized.normalize();
        assert_eq!(norm.total(), dec("100"));
        assert_eq!(norm.large_cap, dec("70"));
        assert_eq!(norm.mid_cap, dec("20"));
        assert_eq!(norm.small_cap, dec("10"));
    }

    #[test]
    fn test_asset_allocation_breakdown_aggregation() {
        let fund1 = (
            dec("100000"),
            AssetAllocationBreakdown::new(dec("100"), dec("0"), dec("0"), dec("0")),
        );
        let fund2 = (
            dec("100000"),
            AssetAllocationBreakdown::new(dec("0"), dec("80"), dec("20"), dec("0")),
        );

        let aggregated = aggregate_asset_allocation(&[fund1, fund2]);
        assert_eq!(aggregated.equity, dec("50"));
        assert_eq!(aggregated.debt, dec("40"));
        assert_eq!(aggregated.cash, dec("10"));
        assert_eq!(aggregated.alternatives, dec("0"));
        assert_eq!(aggregated.total(), dec("100"));
    }

    #[test]
    fn test_serde_defaults_for_missing_fields() {
        let json_mc = r#"{"largeCap": "75"}"#;
        let mc: MarketCapBreakdown = serde_json::from_str(json_mc).unwrap();
        assert_eq!(mc.large_cap, dec("75"));
        assert_eq!(mc.mid_cap, dec("0"));
        assert_eq!(mc.small_cap, dec("0"));

        let json_aa = r#"{"equity": "60", "debt": "40"}"#;
        let aa: AssetAllocationBreakdown = serde_json::from_str(json_aa).unwrap();
        assert_eq!(aa.equity, dec("60"));
        assert_eq!(aa.debt, dec("40"));
        assert_eq!(aa.cash, dec("0"));
        assert_eq!(aa.alternatives, dec("0"));
    }
}
