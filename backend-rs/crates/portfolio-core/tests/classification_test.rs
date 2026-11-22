//! Unit tests for asset classification engine and category metadata.

use portfolio_core::classification::{AssetCategory, classify_asset};

#[test]
fn test_classify_asset_categories() {
    assert_eq!(
        classify_asset("GOLD", "Nippon India ETF Gold BeES"),
        AssetCategory::Gold
    );
    assert_eq!(
        classify_asset("MUTUAL_FUND", "Sovereign Gold Bond 2026"),
        AssetCategory::Gold
    );
    assert_eq!(
        classify_asset("CASH", "Liquid Overnight Fund"),
        AssetCategory::Cash
    );
    assert_eq!(
        classify_asset("MUTUAL_FUND", "HDFC Arbitrage Fund Direct Growth"),
        AssetCategory::Arbitrage
    );
    assert_eq!(
        classify_asset("DEBT", "SBI Corporate Bond Fund"),
        AssetCategory::Debt
    );
    assert_eq!(
        classify_asset("MUTUAL_FUND", "ICICI Prudential Gilt Fund"),
        AssetCategory::Debt
    );
    assert_eq!(
        classify_asset("HYBRID", "Kotak Balanced Advantage Fund"),
        AssetCategory::Hybrid
    );
    assert_eq!(
        classify_asset("EQUITY", "Parag Parikh Flexi Cap Fund"),
        AssetCategory::Equity
    );
    assert_eq!(
        classify_asset("MUTUAL_FUND", "UTI Nifty 50 Index Fund Direct Growth"),
        AssetCategory::Equity
    );
    assert_eq!(
        classify_asset("UNKNOWN", "Unlisted Private Stock"),
        AssetCategory::Other
    );
}

#[test]
fn test_asset_category_display_and_color() {
    assert_eq!(AssetCategory::Equity.display_name(), "Equity");
    assert_eq!(AssetCategory::Equity.color(), "#3b82f6");
    assert_eq!(AssetCategory::Gold.display_name(), "Gold");
    assert_eq!(AssetCategory::Gold.color(), "#f59e0b");
}
