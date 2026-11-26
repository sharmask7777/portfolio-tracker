//! Curated scheme-level fallback holdings catalog for X-Ray look-through.
//!
//! Provides deterministic proxy holdings when live AMC monthly portfolio disclosures
//! are unavailable for a given mutual fund scheme.

use crate::xray::allocation::AssetAllocationBreakdown;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;

/// A single underlying holding entry for X-Ray catalog and hierarchy calculations.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogHolding {
    /// Security or asset name.
    pub name: String,
    /// Optional sector classification.
    pub sector: Option<String>,
    /// Portfolio weight percentage (`0..=100`).
    pub weight_pct: Decimal,
}

/// Resolves curated fallback equity/asset holdings for a scheme name when live AMC
/// portfolio disclosures are unavailable.
///
/// Returns `(holdings, allocation_breakdown)` if a curated proxy matches the scheme
/// category (e.g. Nifty 50 Index, Parag Parikh Flexi Cap, Arbitrage, Liquid/Debt, Gold).
pub fn resolve_fallback_holdings(
    scheme_name: &str,
) -> Option<(Vec<CatalogHolding>, AssetAllocationBreakdown)> {
    let upper = scheme_name.to_ascii_uppercase();
    let d = |s: &str| Decimal::from_str(s).unwrap_or(Decimal::ZERO);

    if upper.contains("ARBITRAGE") {
        let holdings = vec![CatalogHolding {
            name: "Cash & Cash Equivalents (Arbitrage)".to_string(),
            sector: Some("Cash & Equivalents".to_string()),
            weight_pct: d("100.0"),
        }];
        let alloc = AssetAllocationBreakdown {
            equity: d("0.0"),
            debt: d("35.0"),
            cash: d("65.0"),
            alternatives: d("0.0"),
        };
        return Some((holdings, alloc));
    }

    if upper.contains("LIQUID")
        || upper.contains("OVERNIGHT")
        || upper.contains("MONEY MARKET")
        || upper.contains("GILT")
        || upper.contains("CORPORATE BOND")
    {
        let holdings = vec![CatalogHolding {
            name: "Sovereign & AAA Money Market".to_string(),
            sector: Some("Debt & Money Market".to_string()),
            weight_pct: d("100.0"),
        }];
        let alloc = AssetAllocationBreakdown {
            equity: d("0.0"),
            debt: d("85.0"),
            cash: d("15.0"),
            alternatives: d("0.0"),
        };
        return Some((holdings, alloc));
    }

    if upper.contains("GOLD") || upper.contains("SILVER") {
        let holdings = vec![CatalogHolding {
            name: "Physical Bullion / Commodity".to_string(),
            sector: Some("Commodities".to_string()),
            weight_pct: d("100.0"),
        }];
        let alloc = AssetAllocationBreakdown {
            equity: d("0.0"),
            debt: d("0.0"),
            cash: d("2.0"),
            alternatives: d("98.0"),
        };
        return Some((holdings, alloc));
    }

    if upper.contains("NIFTY 50") || upper.contains("SENSEX") || upper.contains("LARGE CAP") {
        let holdings = vec![
            CatalogHolding {
                name: "HDFC Bank Ltd.".to_string(),
                sector: Some("Financial Services".to_string()),
                weight_pct: d("11.5"),
            },
            CatalogHolding {
                name: "ICICI Bank Ltd.".to_string(),
                sector: Some("Financial Services".to_string()),
                weight_pct: d("8.2"),
            },
            CatalogHolding {
                name: "Reliance Industries Ltd.".to_string(),
                sector: Some("Oil, Gas & Consumable Fuels".to_string()),
                weight_pct: d("8.8"),
            },
            CatalogHolding {
                name: "Infosys Ltd.".to_string(),
                sector: Some("Information Technology".to_string()),
                weight_pct: d("6.1"),
            },
            CatalogHolding {
                name: "TCS Ltd.".to_string(),
                sector: Some("Information Technology".to_string()),
                weight_pct: d("4.0"),
            },
        ];
        let alloc = AssetAllocationBreakdown {
            equity: d("98.5"),
            debt: d("0.0"),
            cash: d("1.5"),
            alternatives: d("0.0"),
        };
        return Some((holdings, alloc));
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_fallback_holdings_known_schemes_and_miss() {
        let (arb, arb_alloc) =
            resolve_fallback_holdings("Kotak Equity Arbitrage Fund").expect("Arbitrage fallback");
        assert_ne!(arb.len(), 0);
        assert!(arb_alloc.cash > Decimal::ZERO);

        let (nifty, nifty_alloc) =
            resolve_fallback_holdings("UTI Nifty 50 Index Fund").expect("Nifty 50 fallback");
        assert_ne!(nifty.len(), 0);
        assert!(nifty_alloc.equity > Decimal::ZERO);

        let (liq, liq_alloc) =
            resolve_fallback_holdings("HDFC Liquid Fund - Direct Growth").expect("Liquid fallback");
        assert_ne!(liq.len(), 0);
        assert!(liq_alloc.debt > Decimal::ZERO);

        assert!(resolve_fallback_holdings("Completely Unknown Scheme").is_none());
    }
}
