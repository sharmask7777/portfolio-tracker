//! Tests for the Security Master catalog and market cap classification engine.
//!
//! Validates:
//! 1. Resolution of Large Cap equities (e.g., HDFC Bank, TCS, Reliance).
//! 2. Resolution of Mid Cap equities (e.g., Indian Hotels, Cummins India, Federal Bank).
//! 3. Resolution of Small Cap equities (e.g., Sonata Software, CEAT, Karur Vysya Bank).
//! 4. Unmapped / foreign / unclassified equities fallback cleanly to MarketCapTier::Other.
//! 5. Lookup by ISIN, symbol, and normalized company name.

use portfolio_core::xray::security_master::{
    MarketCapTier, SEBI_TOP_EQUITIES, classify_stock_market_cap, classify_stock_sector,
    resolve_security_classification,
};

#[test]
fn test_large_cap_resolution() {
    // Lookup by ISIN
    let (sector, tier) = resolve_security_classification(Some("INE040A01034"), None, "HDFC Bank");
    assert_eq!(tier, MarketCapTier::Large);
    assert_eq!(sector, Some("Financial Services"));

    // Lookup by Symbol
    let (sector, tier) = resolve_security_classification(None, Some("TCS"), "Unknown");
    assert_eq!(tier, MarketCapTier::Large);
    assert_eq!(sector, Some("Technology"));

    // Lookup by Name
    let (sector, tier) = resolve_security_classification(None, None, "Reliance Industries Limited");
    assert_eq!(tier, MarketCapTier::Large);
    assert_eq!(sector, Some("Energy"));
}

#[test]
fn test_mid_cap_resolution() {
    // Indian Hotels
    let (sector, tier) = resolve_security_classification(
        Some("INE053A01029"),
        Some("INDHOTEL"),
        "The Indian Hotels Company Ltd",
    );
    assert_eq!(tier, MarketCapTier::Mid);
    assert_eq!(sector, Some("Consumer Cyclical"));

    // Cummins India
    let (sector, tier) =
        resolve_security_classification(None, Some("CUMMINSIND"), "Cummins India Limited");
    assert_eq!(tier, MarketCapTier::Mid);
    assert_eq!(sector, Some("Industrials"));

    // Federal Bank
    let (sector, tier) = resolve_security_classification(None, None, "Federal Bank Ltd.");
    assert_eq!(tier, MarketCapTier::Mid);
    assert_eq!(sector, Some("Financial Services"));
}

#[test]
fn test_small_cap_resolution() {
    // Sonata Software
    let (sector, tier) = resolve_security_classification(
        Some("INE269A01021"),
        Some("SONATSOFTW"),
        "Sonata Software Ltd",
    );
    assert_eq!(tier, MarketCapTier::Small);
    assert_eq!(sector, Some("Technology"));

    // CEAT
    let (sector, tier) = resolve_security_classification(None, Some("CEATLTD"), "CEAT Limited");
    assert_eq!(tier, MarketCapTier::Small);
    assert_eq!(sector, Some("Consumer Cyclical"));

    // Karur Vysya Bank
    let (sector, tier) = resolve_security_classification(None, None, "Karur Vysya Bank");
    assert_eq!(tier, MarketCapTier::Small);
    assert_eq!(sector, Some("Financial Services"));
}

#[test]
fn test_unmapped_equity_fallback_to_other() {
    // Foreign or unclassified equity not in master
    let (sector, tier) =
        resolve_security_classification(None, None, "Random Startup Tech Private Limited");
    assert_eq!(tier, MarketCapTier::Other);
    assert_eq!(sector, None);
    assert_eq!(tier.as_str(), "other");

    assert_eq!(
        classify_stock_market_cap(None, None, "Unknown Unlisted Entity"),
        MarketCapTier::Other
    );
    assert_eq!(
        classify_stock_sector(None, None, "Unknown Unlisted Entity"),
        "Other"
    );
}

#[test]
fn test_sebi_top_equities_dataset_integrity() {
    assert!(
        SEBI_TOP_EQUITIES.len() >= 100,
        "Static catalog must contain at least 100 top equities"
    );

    let mut isins = std::collections::HashSet::new();
    for eq in SEBI_TOP_EQUITIES {
        assert!(
            !eq.isin.is_empty(),
            "ISIN must not be empty for {}",
            eq.name
        );
        assert!(
            !eq.symbol.is_empty(),
            "Symbol must not be empty for {}",
            eq.name
        );
        assert!(
            !eq.name.is_empty(),
            "Name must not be empty for {}",
            eq.symbol
        );
        assert!(
            !eq.sector.is_empty(),
            "Sector must not be empty for {}",
            eq.name
        );
        assert!(
            isins.insert(eq.isin),
            "Duplicate ISIN found in SEBI_TOP_EQUITIES: {}",
            eq.isin
        );
    }
}
