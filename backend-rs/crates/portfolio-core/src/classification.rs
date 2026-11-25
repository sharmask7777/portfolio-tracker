//! Centralized asset classification and category representation.
//!
//! Enforces the single source of truth mandate across all API endpoints,
//! X-Ray analysis, and client presentation views.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Canonical asset category enumeration.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
pub enum AssetCategory {
    /// Listed equity and equity-oriented mutual funds.
    Equity,
    /// Fixed income, debt mutual funds, and bonds.
    Debt,
    /// Multi-asset and hybrid mutual funds.
    Hybrid,
    /// Physical gold, gold ETFs, and sovereign gold bonds.
    Gold,
    /// Cash, overnight, and liquid instruments.
    Cash,
    /// Arbitrage and cash-futures spread funds.
    Arbitrage,
    /// Real estate, private equity, or unclassified assets.
    Other,
}

impl AssetCategory {
    /// Returns the human-readable display label for the asset category.
    pub fn display_name(&self) -> &'static str {
        match self {
            Self::Equity => "Equity",
            Self::Debt => "Debt",
            Self::Hybrid => "Hybrid",
            Self::Gold => "Gold",
            Self::Cash => "Cash",
            Self::Arbitrage => "Arbitrage",
            Self::Other => "Other",
        }
    }

    /// Returns the standardized UI hex color code for visualization.
    pub fn color(&self) -> &'static str {
        match self {
            Self::Equity => "#3b82f6",    // Blue
            Self::Debt => "#10b981",      // Green
            Self::Hybrid => "#8b5cf6",    // Purple
            Self::Gold => "#f59e0b",      // Amber / Gold
            Self::Cash => "#06b6d4",      // Cyan
            Self::Arbitrage => "#ec4899", // Pink
            Self::Other => "#71717a",     // Muted Zinc
        }
    }
}

/// Non-domestic-equity mutual fund keywords (debt, money market, commodity, hybrid, international).
const NON_DOMESTIC_EQUITY_KEYWORDS: &[&str] = &[
    "debt",
    "bond",
    "liquid",
    "gilt",
    "money market",
    "overnight",
    "floating rate",
    "banking & psu",
    "banking and psu",
    "dynamic bond",
    "credit risk",
    "conservative",
    "income",
    "duration",
    "treasury",
    "multi asset",
    "dynamic asset",
    "equity savings",
    "gold",
    "silver",
    "commodity",
    "fof",
    "fund of fund",
    "fund of funds",
    "international",
    "overseas",
    "global",
    "greater china",
    "emerging markets",
    "fang+",
    "hang seng",
    "nasdaq",
    "s&p 500",
    "us equity",
];

/// Returns `true` if a mutual fund scheme name qualifies as a domestic equity-oriented scheme
/// for Indian capital gains taxation (Section 112A / 111A).
///
/// Arbitrage, ELSS, flexi-cap, and domestic index funds return `true`.
/// Debt, liquid, overnight, floating rate, banking & PSU, dynamic bond, credit risk,
/// multi-asset, dynamic asset, equity savings, gold/silver, FoF, and international funds return `false`.
pub fn is_domestic_equity_scheme(name: &str) -> bool {
    let lower = name.trim().to_lowercase();
    !NON_DOMESTIC_EQUITY_KEYWORDS
        .iter()
        .any(|keyword| lower.contains(keyword))
}

/// Classifies an asset by its statutory/declared asset type and name string.
///
/// Pure deterministic function with zero I/O.
pub fn classify_asset(asset_type: &str, name: &str) -> AssetCategory {
    let type_upper = asset_type.trim().to_uppercase();
    let name_lower = name.trim().to_lowercase();

    if type_upper == "GOLD"
        || name_lower.contains("gold")
        || name_lower.contains("sgb")
        || name_lower.contains("sovereign gold")
    {
        return AssetCategory::Gold;
    }

    if type_upper == "CASH"
        || name_lower.contains("cash")
        || name_lower.contains("overnight")
        || name_lower.contains("liquid fund")
    {
        return AssetCategory::Cash;
    }

    if name_lower.contains("arbitrage") {
        return AssetCategory::Arbitrage;
    }

    if type_upper == "DEBT"
        || name_lower.contains("debt")
        || name_lower.contains("liquid")
        || name_lower.contains("bond")
        || name_lower.contains("gilt")
        || name_lower.contains("treasury")
    {
        return AssetCategory::Debt;
    }

    if type_upper == "HYBRID"
        || name_lower.contains("hybrid")
        || name_lower.contains("balanced advantage")
        || name_lower.contains("dynamic asset")
        || name_lower.contains("multi asset")
        || name_lower.contains("equity savings")
    {
        return AssetCategory::Hybrid;
    }

    if type_upper == "EQUITY"
        || type_upper == "MUTUAL_FUND"
        || name_lower.contains("equity")
        || name_lower.contains("growth")
        || name_lower.contains("index")
        || name_lower.contains("nifty")
        || name_lower.contains("sensex")
        || name_lower.contains("fund")
    {
        return AssetCategory::Equity;
    }

    AssetCategory::Other
}
