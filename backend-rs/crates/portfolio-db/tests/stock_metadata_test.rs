#![allow(clippy::unwrap_used, clippy::panic)]

//! Tests for the StockMetadata repository and PostgreSQL persistence layer.

use chrono::{NaiveDate, Utc};
use portfolio_db::entities::StockMetadataEntity;
use portfolio_db::repositories::stock_metadata_repo::StockMetadataRepository;
use portfolio_db::test_mocks::InMemoryDatabase;

#[tokio::test]
async fn test_in_memory_stock_metadata_repo_crud() {
    let db = InMemoryDatabase::new();

    // Verify initial pre-seeded data exists from static catalog
    let pre_seeded = db.find_by_isin("INE040A01034").await.expect("query error");
    assert!(
        pre_seeded.is_some(),
        "HDFC Bank should be pre-seeded in InMemoryDatabase"
    );
    let hdfc = pre_seeded.unwrap();
    assert_eq!(hdfc.symbol, "HDFCBANK");
    assert_eq!(hdfc.market_cap_tier, "large");

    // Upsert a custom / dynamic stock metadata record
    let custom_stock = StockMetadataEntity {
        isin: "INE999X01099".to_string(),
        symbol: "CUSTOMSTOCK".to_string(),
        name: "Custom Emerging Tech Ltd".to_string(),
        sector: "Technology".to_string(),
        market_cap_tier: "small".to_string(),
        market_cap_rank: Some(350),
        market_cap_cr: Some(2500.5),
        as_of_date: NaiveDate::from_ymd_opt(2026, 6, 30).unwrap(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    db.upsert_batch(std::slice::from_ref(&custom_stock))
        .await
        .expect("upsert failed");

    // Find by ISIN
    let found = db
        .find_by_isin("INE999X01099")
        .await
        .expect("query failed")
        .expect("should find custom stock");
    assert_eq!(found.symbol, "CUSTOMSTOCK");
    assert_eq!(found.market_cap_tier, "small");

    // Find by Symbol
    let found_sym = db
        .find_by_symbol("CUSTOMSTOCK")
        .await
        .expect("query failed")
        .expect("should find by symbol");
    assert_eq!(found_sym.isin, "INE999X01099");

    // Get all as map
    let all_map = db.get_all_as_map().await.expect("get all failed");
    assert!(all_map.contains_key("INE999X01099"));
    assert!(all_map.contains_key("INE040A01034"));
}
