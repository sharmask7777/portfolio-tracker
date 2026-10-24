//! Mutual fund portfolio overlap and stock intersection engine.

use std::collections::BTreeMap;

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Underlying constituent holding of a fund or portfolio.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FundHolding {
    pub name: String,
    pub weight: Decimal,
}

impl FundHolding {
    pub fn new(name: impl Into<String>, weight: Decimal) -> Self {
        Self {
            name: name.into(),
            weight,
        }
    }
}

/// A common stock held across two mutual funds.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommonStock {
    pub name: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub weight_a: Decimal,
    #[serde(with = "rust_decimal::serde::float")]
    pub weight_b: Decimal,
}

/// Detailed overlap analysis between two funds.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FundOverlap {
    pub fund_a: String,
    pub fund_b: String,
    #[serde(with = "rust_decimal::serde::float")]
    pub overlap_percentage: Decimal,
    pub common_stocks: Vec<CommonStock>,
}

/// Deterministic canonical stock name normalizer.
///
/// Strips punctuation, converts to uppercase, and removes corporate suffixes
/// (e.g. "LTD", "LIMITED", "CORP", "INC", "PVT", "EQUITY", "COMPANY", "CO", etc.)
/// so that holdings from different AMCs/funds deduplicate and intersect cleanly.
pub fn normalize_stock_name(name: &str) -> String {
    let clean: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() {
                c.to_ascii_uppercase()
            } else {
                ' '
            }
        })
        .collect();

    const STOP_WORDS: &[&str] = &[
        "LIMITED",
        "LTD",
        "CORP",
        "CORPORATION",
        "INC",
        "PVT",
        "EQUITY",
        "HOLDING",
        "HOLDINGS",
        "COMPANY",
        "CO",
    ];

    let tokens: Vec<&str> = clean
        .split_whitespace()
        .filter(|t| !STOP_WORDS.contains(t))
        .collect();

    if tokens.is_empty() {
        clean.split_whitespace().collect::<Vec<_>>().join(" ")
    } else {
        tokens.join(" ")
    }
}

/// Calculates the weighted intersection and overlap between two mutual funds.
///
/// Overlap formula:
/// `overlap = sum_{c in A cap B} min(weight_A(c), weight_B(c))`
///
/// Properties:
/// - Strictly symmetric: `overlap(A, B).overlap_percentage == overlap(B, A).overlap_percentage`
/// - Self-overlap: `overlap(A, A).overlap_percentage == sum(weights_A)`
/// - Bounded: `0 <= overlap_percentage <= 100` (for funds with valid weights)
/// - Common stocks are sorted by maximum weight descending.
pub fn calculate_fund_overlap(
    name_a: &str,
    holdings_a: &[FundHolding],
    name_b: &str,
    holdings_b: &[FundHolding],
) -> FundOverlap {
    if holdings_a.is_empty() || holdings_b.is_empty() {
        return FundOverlap {
            fund_a: name_a.to_string(),
            fund_b: name_b.to_string(),
            overlap_percentage: Decimal::ZERO,
            common_stocks: Vec::new(),
        };
    }

    // Aggregate holdings by normalized key for Fund A
    let mut map_a: BTreeMap<String, (String, Decimal)> = BTreeMap::new();
    for h in holdings_a {
        if h.weight <= Decimal::ZERO {
            continue;
        }
        let key = normalize_stock_name(&h.name);
        if key.is_empty() {
            continue;
        }
        map_a
            .entry(key)
            .and_modify(|(_, w)| *w += h.weight)
            .or_insert_with(|| (h.name.clone(), h.weight));
    }

    // Aggregate holdings by normalized key for Fund B
    let mut map_b: BTreeMap<String, (String, Decimal)> = BTreeMap::new();
    for h in holdings_b {
        if h.weight <= Decimal::ZERO {
            continue;
        }
        let key = normalize_stock_name(&h.name);
        if key.is_empty() {
            continue;
        }
        map_b
            .entry(key)
            .and_modify(|(_, w)| *w += h.weight)
            .or_insert_with(|| (h.name.clone(), h.weight));
    }

    let mut overlap_percentage = Decimal::ZERO;
    let mut common_stocks = Vec::new();

    // Iterate through map_a in deterministic order
    for (key, (disp_a, weight_a)) in &map_a {
        if let Some((_, weight_b)) = map_b.get(key) {
            let common_weight = (*weight_a).min(*weight_b);
            overlap_percentage += common_weight;

            common_stocks.push(CommonStock {
                name: disp_a.clone(),
                weight_a: *weight_a,
                weight_b: *weight_b,
            });
        }
    }

    // Sort common stocks by maximum weight descending, breaking ties by name
    common_stocks.sort_by(|x, y| {
        let max_x = x.weight_a.max(x.weight_b);
        let max_y = y.weight_a.max(y.weight_b);
        max_y.cmp(&max_x).then_with(|| x.name.cmp(&y.name))
    });

    FundOverlap {
        fund_a: name_a.to_string(),
        fund_b: name_b.to_string(),
        overlap_percentage,
        common_stocks,
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
    fn test_normalize_stock_name() {
        assert_eq!(normalize_stock_name("HDFC Bank Ltd."), "HDFC BANK");
        assert_eq!(normalize_stock_name("HDFC Bank Limited"), "HDFC BANK");
        assert_eq!(normalize_stock_name("hdfc bank"), "HDFC BANK");
        assert_eq!(
            normalize_stock_name("Reliance Industries Limited"),
            "RELIANCE INDUSTRIES"
        );
        assert_eq!(
            normalize_stock_name("Reliance Industries Ltd."),
            "RELIANCE INDUSTRIES"
        );
        assert_eq!(
            normalize_stock_name("Tata Consultancy Services Corp."),
            "TATA CONSULTANCY SERVICES"
        );
        assert_eq!(normalize_stock_name("Infosys Ltd"), "INFOSYS");
        assert_eq!(
            normalize_stock_name("Larsen & Toubro Ltd."),
            "LARSEN TOUBRO"
        );
        assert_eq!(normalize_stock_name("ITC Limited"), "ITC");
        assert_eq!(normalize_stock_name("Ltd"), "LTD");
    }

    #[test]
    fn test_calculate_fund_overlap_symmetry_and_values() {
        let fund_a_holdings = vec![
            FundHolding::new("HDFC Bank Ltd.", dec("10.0")),
            FundHolding::new("Reliance Industries Ltd", dec("8.5")),
            FundHolding::new("Infosys Ltd", dec("7.0")),
            FundHolding::new("TCS Ltd", dec("5.0")),
        ];

        let fund_b_holdings = vec![
            FundHolding::new("HDFC Bank Limited", dec("6.0")), // min(10.0, 6.0) = 6.0
            FundHolding::new("Reliance Industries", dec("9.0")), // min(8.5, 9.0) = 8.5
            FundHolding::new("ICICI Bank Ltd", dec("8.0")),    // No match
            FundHolding::new("Infosys Limited", dec("7.0")),   // min(7.0, 7.0) = 7.0
        ];

        let overlap_ab =
            calculate_fund_overlap("Fund A", &fund_a_holdings, "Fund B", &fund_b_holdings);
        let overlap_ba =
            calculate_fund_overlap("Fund B", &fund_b_holdings, "Fund A", &fund_a_holdings);

        // Expected overlap: 6.0 + 8.5 + 7.0 = 21.5
        assert_eq!(overlap_ab.overlap_percentage, dec("21.5"));
        assert_eq!(overlap_ba.overlap_percentage, dec("21.5"));
        assert_eq!(overlap_ab.common_stocks.len(), 3);
        assert_eq!(overlap_ba.common_stocks.len(), 3);

        // Sorting: max(weightA, weightB)
        // Reliance: max(8.5, 9.0) = 9.0
        // Infosys: max(7.0, 7.0) = 7.0
        // HDFC: max(10.0, 6.0) = 10.0
        // Order: HDFC (10.0), Reliance (9.0), Infosys (7.0)
        assert_eq!(overlap_ab.common_stocks[0].name, "HDFC Bank Ltd.");
        assert_eq!(overlap_ab.common_stocks[1].name, "Reliance Industries Ltd");
        assert_eq!(overlap_ab.common_stocks[2].name, "Infosys Ltd");
    }

    #[test]
    fn test_self_overlap_equals_sum_of_weights() {
        let holdings = vec![
            FundHolding::new("Stock 1", dec("25.0")),
            FundHolding::new("Stock 2", dec("35.0")),
            FundHolding::new("Stock 3", dec("40.0")),
        ];

        let overlap = calculate_fund_overlap("Alpha", &holdings, "Alpha", &holdings);
        assert_eq!(overlap.overlap_percentage, dec("100.0"));
    }
}
