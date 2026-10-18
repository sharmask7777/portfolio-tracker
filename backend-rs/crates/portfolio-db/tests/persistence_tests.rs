//! Hermetic integration tests for portfolio-db persistence layer.
//!
//! Validates:
//! 1. Portfolio creation, lookup, and listing.
//! 2. Transaction insertion and chronological listing by folio and portfolio.
//! 3. Multi-member profile creation and cascading deletion (with strict isolation).
//! 4. Conversion of database entities to portfolio-core domain models with FIFO and financial parity.
//! 5. Entity JSON serialization/deserialization with camelCase formatting.

use std::str::FromStr;

use chrono::NaiveDate;
use rust_decimal::Decimal;
use uuid::Uuid;

use portfolio_core::holdings::{consolidate_by_scheme, process_fifo_lots};
use portfolio_core::performance::xirr::{CashFlow, calculate_xirr};
use portfolio_core::types::{Money, Nav, Units};
use portfolio_db::entities::*;
use portfolio_db::error::DbError;
use portfolio_db::repositories::{FamilyRepository, PortfolioRepository, TransactionRepository};
use portfolio_db::test_mocks::InMemoryDatabase;

fn dec(s: &str) -> Decimal {
    Decimal::from_str(s).expect("valid decimal string")
}

#[tokio::test]
async fn test_portfolio_creation_lookup_and_listing() {
    let db = InMemoryDatabase::new();

    // Create synthetic test users
    let user1 = db.create_user("aarav.sharma@example.com", "hashed_pwd_1");
    let user2 = db.create_user("neha.patel@example.com", "hashed_pwd_2");

    // Create portfolios for User 1
    let p1 = db
        .create_portfolio(user1.id, "Retirement Fund", None)
        .await
        .expect("Failed to create portfolio 1");
    let p2 = db
        .create_portfolio(user1.id, "Emergency Corpus", None)
        .await
        .expect("Failed to create portfolio 2");

    // Create portfolio for User 2
    let p3 = db
        .create_portfolio(user2.id, "Kids Education", None)
        .await
        .expect("Failed to create portfolio 3");

    // Lookup
    let found_p1 = db
        .get_portfolio(p1.id)
        .await
        .expect("DB error")
        .expect("p1 not found");
    assert_eq!(found_p1.id, p1.id);
    assert_eq!(found_p1.name, "Retirement Fund");
    assert_eq!(found_p1.user_id, user1.id);

    let not_found = db.get_portfolio(Uuid::new_v4()).await.expect("DB error");
    assert!(not_found.is_none());

    // Listing for user 1
    let user1_portfolios = db
        .list_user_portfolios(user1.id)
        .await
        .expect("Failed to list portfolios");
    assert_eq!(user1_portfolios.len(), 2);
    assert_eq!(user1_portfolios[0].id, p1.id);
    assert_eq!(user1_portfolios[1].id, p2.id);

    // Listing for user 2
    let user2_portfolios = db
        .list_user_portfolios(user2.id)
        .await
        .expect("Failed to list portfolios");
    assert_eq!(user2_portfolios.len(), 1);
    assert_eq!(user2_portfolios[0].id, p3.id);

    // Delete portfolio p2
    db.delete_portfolio(p2.id)
        .await
        .expect("Failed to delete portfolio");
    let after_delete = db
        .list_user_portfolios(user1.id)
        .await
        .expect("Failed to list portfolios");
    assert_eq!(after_delete.len(), 1);
    assert_eq!(after_delete[0].id, p1.id);
}

#[tokio::test]
async fn test_transaction_insertion_and_chronological_listing() {
    let db = InMemoryDatabase::new();
    let user = db.create_user("aarav.sharma@example.com", "hashed_pwd");
    let portfolio = db
        .create_portfolio(user.id, "Wealth Builder", None)
        .await
        .expect("Failed to create portfolio");

    // Create 2 assets
    let asset1 = db.create_asset(
        "MUTUAL_FUND",
        "Parag Parikh Flexi Cap Fund",
        Some("INF879O01019"),
        Some("122639"),
        None,
        Some(r#"{"exitLoad": "1% for redemption within 365 days"}"#.to_string()),
    );
    let asset2 = db.create_asset("STOCK", "HDFC Bank Ltd", None, None, Some("HDFCBANK"), None);

    // Create 2 folios under the portfolio
    let folio1 = db
        .create_folio(
            portfolio.id,
            asset1.id,
            "12345/MF",
            Some("PPFAS"),
            Some("ABCDE1234F"),
        )
        .expect("Failed to create folio 1");
    let folio2 = db
        .create_folio(
            portfolio.id,
            asset2.id,
            "67890/EQ",
            Some("Zerodha"),
            Some("ABCDE1234F"),
        )
        .expect("Failed to create folio 2");

    // Insert transactions OUT OF CHRONOLOGICAL ORDER to verify sorting
    // Folio 1 - tx 2 (June 2023)
    let t_june = db
        .create_transaction(
            folio1.id,
            NaiveDate::from_ymd_opt(2023, 6, 15).unwrap(),
            "PURCHASE_SIP",
            dec("5000.00"),
            dec("100.0000"),
            dec("50.0000"),
            dec("300.0000"),
            Some("SIP-JUN-01"),
        )
        .await
        .expect("Failed to insert tx");

    // Folio 1 - tx 1 (Jan 2023)
    let t_jan = db
        .create_transaction(
            folio1.id,
            NaiveDate::from_ymd_opt(2023, 1, 10).unwrap(),
            "PURCHASE",
            dec("9000.00"),
            dec("200.0000"),
            dec("45.0000"),
            dec("200.0000"),
            Some("LUMP-JAN-01"),
        )
        .await
        .expect("Failed to insert tx");

    // Folio 1 - tx 3 (Nov 2023)
    let t_nov = db
        .create_transaction(
            folio1.id,
            NaiveDate::from_ymd_opt(2023, 11, 20).unwrap(),
            "REDEMPTION",
            dec("3000.00"),
            dec("50.0000"),
            dec("60.0000"),
            dec("250.0000"),
            Some("RED-NOV-01"),
        )
        .await
        .expect("Failed to insert tx");

    // Folio 2 - tx on March 2023
    let t_mar = db
        .create_transaction(
            folio2.id,
            NaiveDate::from_ymd_opt(2023, 3, 5).unwrap(),
            "BUY",
            dec("15000.00"),
            dec("10.0000"),
            dec("1500.0000"),
            dec("10.0000"),
            Some("EQ-MAR-01"),
        )
        .await
        .expect("Failed to insert tx");

    // 1. Check list_by_folio: must be ordered chronologically
    let f1_txs = db
        .list_by_folio(folio1.id)
        .await
        .expect("Failed to list folio txs");
    assert_eq!(f1_txs.len(), 3);
    assert_eq!(f1_txs[0].id, t_jan.id);
    assert_eq!(f1_txs[1].id, t_june.id);
    assert_eq!(f1_txs[2].id, t_nov.id);

    // 2. Check list_by_portfolio: aggregates transactions across all folios in chronological order
    let port_txs = db
        .list_by_portfolio(portfolio.id)
        .await
        .expect("Failed to list portfolio txs");
    assert_eq!(port_txs.len(), 4);
    assert_eq!(
        port_txs[0].id, t_jan.id,
        "Jan 2023 should be first across portfolio"
    );
    assert_eq!(
        port_txs[1].id, t_mar.id,
        "Mar 2023 (folio 2) should be second"
    );
    assert_eq!(
        port_txs[2].id, t_june.id,
        "June 2023 (folio 1) should be third"
    );
    assert_eq!(
        port_txs[3].id, t_nov.id,
        "Nov 2023 (folio 1) should be fourth"
    );

    // 3. Test duplicate externalId constraint
    let dup_err = db
        .create_transaction(
            folio1.id,
            NaiveDate::from_ymd_opt(2023, 12, 1).unwrap(),
            "PURCHASE",
            dec("1000.00"),
            dec("20.0000"),
            dec("50.0000"),
            dec("270.0000"),
            Some("SIP-JUN-01"), // already used
        )
        .await;

    assert!(matches!(dup_err, Err(DbError::ConstraintViolation(_))));
}

#[tokio::test]
async fn test_multi_member_profile_creation_and_cascading_deletion() {
    let db = InMemoryDatabase::new();
    let user = db.create_user("aarav.sharma@example.com", "pwd");

    // Create 2 managed profiles for family members
    let profile_self = db
        .create_managed_profile(user.id, "Aarav Sharma (Self)", "ABCDE1234F", dec("0.30"))
        .await
        .expect("Failed to create profile 1");
    let profile_spouse = db
        .create_managed_profile(user.id, "Priya Sharma (Spouse)", "ALPAC1001A", dec("0.20"))
        .await
        .expect("Failed to create profile 2");

    // Duplicate PAN for the same user should fail
    let dup_pan = db
        .create_managed_profile(
            user.id,
            "Aarav Duplicate",
            "ABCDE1234F", // already registered
            dec("0.30"),
        )
        .await;
    assert!(matches!(dup_pan, Err(DbError::ConstraintViolation(_))));

    // Listing profiles
    let profiles = db
        .list_profiles(user.id)
        .await
        .expect("Failed to list profiles");
    assert_eq!(profiles.len(), 2);

    // Create portfolios for both profiles
    let port_self = db
        .create_portfolio(user.id, "Aarav Main", Some(profile_self.id))
        .await
        .expect("Failed to create portfolio");
    let port_spouse = db
        .create_portfolio(user.id, "Priya Main", Some(profile_spouse.id))
        .await
        .expect("Failed to create portfolio");

    // Create assets and folios under both portfolios
    let asset = db.create_asset("MUTUAL_FUND", "Nifty 50 Index", None, None, None, None);
    let folio_self = db
        .create_folio(
            port_self.id,
            asset.id,
            "FOLIO-SELF-1",
            None,
            Some("ABCDE1234F"),
        )
        .expect("folio self");
    let folio_spouse = db
        .create_folio(
            port_spouse.id,
            asset.id,
            "FOLIO-SPOUSE-1",
            None,
            Some("ALPAC1001A"),
        )
        .expect("folio spouse");

    // Insert transactions
    db.create_transaction(
        folio_self.id,
        NaiveDate::from_ymd_opt(2023, 1, 1).unwrap(),
        "PURCHASE",
        dec("10000.00"),
        dec("100.0000"),
        dec("100.0000"),
        dec("100.0000"),
        None,
    )
    .await
    .expect("tx self");

    let spouse_tx = db
        .create_transaction(
            folio_spouse.id,
            NaiveDate::from_ymd_opt(2023, 1, 1).unwrap(),
            "PURCHASE",
            dec("20000.00"),
            dec("200.0000"),
            dec("100.0000"),
            dec("200.0000"),
            None,
        )
        .await
        .expect("tx spouse");

    // CASCADE DELETE Profile 1 (Self)
    let deleted = db
        .delete_managed_profile(user.id, profile_self.id)
        .await
        .expect("Failed to delete profile self");
    assert_eq!(deleted.id, profile_self.id);

    // Profile 1 is gone
    let remaining_profiles = db
        .list_profiles(user.id)
        .await
        .expect("Failed to list profiles");
    assert_eq!(remaining_profiles.len(), 1);
    assert_eq!(remaining_profiles[0].id, profile_spouse.id);

    // Portfolios of Profile 1 are gone
    let port_self_check = db.get_portfolio(port_self.id).await.expect("get portfolio");
    assert!(port_self_check.is_none());

    // Folios of Profile 1 are gone
    let folios_self = db.list_folios_by_portfolio(port_self.id);
    assert!(folios_self.is_empty());

    // Transactions of Profile 1 are gone
    let txs_self = db.list_by_portfolio(port_self.id).await.expect("list txs");
    assert!(txs_self.is_empty());

    // CRITICAL ISOLATION CHECK: Profile 2 (Spouse) is 100% UNTOUCHED
    let port_spouse_check = db
        .get_portfolio(port_spouse.id)
        .await
        .expect("get portfolio")
        .expect("spouse portfolio must exist");
    assert_eq!(port_spouse_check.id, port_spouse.id);

    let folios_spouse = db.list_folios_by_portfolio(port_spouse.id);
    assert_eq!(folios_spouse.len(), 1);
    assert_eq!(folios_spouse[0].id, folio_spouse.id);

    let txs_spouse = db
        .list_by_portfolio(port_spouse.id)
        .await
        .expect("spouse txs");
    assert_eq!(txs_spouse.len(), 1);
    assert_eq!(txs_spouse[0].id, spouse_tx.id);
}

#[tokio::test]
async fn test_entity_conversion_to_portfolio_core_and_financial_parity() {
    let db = InMemoryDatabase::new();
    let user = db.create_user("investor@example.com", "secret");

    let profile = db
        .create_managed_profile(user.id, "Primary Investor", "ABCDE1234F", dec("0.30"))
        .await
        .expect("create profile");

    let portfolio = db
        .create_portfolio(user.id, "Equity Growth", Some(profile.id))
        .await
        .expect("create portfolio");

    let asset = db.create_asset(
        "MUTUAL_FUND",
        "UTI Nifty 50 Index Fund Direct Growth",
        Some("INF789FB1X41"),
        Some("120716"),
        None,
        None,
    );

    let folio = db
        .create_folio(
            portfolio.id,
            asset.id,
            "1234567/89",
            Some("UTI Mutual Fund"),
            Some("ABCDE1234F"),
        )
        .expect("create folio");

    // Transaction 1: Buy 100 units @ 100 = 10,000 on 2022-01-15
    let tx1_entity = db
        .create_transaction(
            folio.id,
            NaiveDate::from_ymd_opt(2022, 1, 15).unwrap(),
            "BUY",
            dec("10000.00"),
            dec("100.0000"),
            dec("100.0000"),
            dec("100.0000"),
            Some("TX-001"),
        )
        .await
        .expect("create tx1");

    // Transaction 2: Buy 50 units @ 120 = 6,000 on 2022-06-15
    let tx2_entity = db
        .create_transaction(
            folio.id,
            NaiveDate::from_ymd_opt(2022, 6, 15).unwrap(),
            "BUY",
            dec("6000.00"),
            dec("50.0000"),
            dec("120.0000"),
            dec("150.0000"),
            Some("TX-002"),
        )
        .await
        .expect("create tx2");

    // Transaction 3: Partial sell 40 units @ 150 = 6,000 on 2023-01-15
    let tx3_entity = db
        .create_transaction(
            folio.id,
            NaiveDate::from_ymd_opt(2023, 1, 15).unwrap(),
            "REDEMPTION",
            dec("6000.00"),
            dec("40.0000"),
            dec("150.0000"),
            dec("110.0000"),
            Some("TX-003"),
        )
        .await
        .expect("create tx3");

    // Convert entities to portfolio-core domain models
    let core_tx1 = tx1_entity
        .to_core_transaction()
        .expect("tx1 conversion failed");
    let core_tx2 = tx2_entity
        .to_core_transaction()
        .expect("tx2 conversion failed");
    let core_tx3 = tx3_entity
        .to_core_transaction()
        .expect("tx3 conversion failed");

    let core_txs = vec![core_tx1, core_tx2, core_tx3];

    let core_folio = folio
        .to_core_folio(&asset, core_txs.clone())
        .expect("folio conversion failed");
    let core_portfolio = portfolio.to_core_portfolio(vec![core_folio.clone()]);
    let core_profile = profile
        .to_core_profile(vec![core_portfolio.clone()])
        .expect("profile conversion failed");

    // Verify profile PAN and fields
    assert_eq!(core_profile.pan.as_str(), "ABCDE1234F");
    assert_eq!(core_profile.tax_slab, dec("0.30"));

    // Verify financial calculation parity via portfolio-core FIFO engine
    let (active_lots, lot_depletions) = process_fifo_lots(&core_txs);

    // FIFO verification:
    // Lot 1: 100 units bought @ 100, depleted by 40 units -> 60 remaining units
    // Lot 2: 50 units bought @ 120 -> 50 remaining units
    // Total remaining units = 110.0000
    assert_eq!(active_lots.len(), 2);
    assert_eq!(active_lots[0].remaining_units, Units::new(dec("60.0000")));
    assert_eq!(active_lots[1].remaining_units, Units::new(dec("50.0000")));

    let total_remaining_units: Units = active_lots.iter().map(|l| l.remaining_units).sum();
    assert_eq!(total_remaining_units, Units::new(dec("110.0000")));

    // Remaining invested cost: (60 * 100) + (50 * 120) = 6000 + 6000 = 12000
    let total_cost: Money = active_lots
        .iter()
        .map(|l| l.remaining_units * l.purchase_nav)
        .sum();
    assert_eq!(total_cost, Money::new(dec("12000.00")));

    // Realized gain on redemption: 40 units redeemed @ 150 from Lot 1 (cost 100)
    // Realized gain = 40 * (150 - 100) = 2000.00
    assert_eq!(lot_depletions.len(), 1);
    assert_eq!(lot_depletions[0].realized_gain, Money::new(dec("2000.00")));

    // Verify Scheme Consolidation in portfolio-core
    let consolidated =
        consolidate_by_scheme(std::slice::from_ref(&core_folio), Nav::new(dec("150.0000")));
    assert_eq!(consolidated.len(), 1);
    assert_eq!(consolidated[0].total_units, Units::new(dec("110.0000")));
    assert_eq!(
        consolidated[0].total_invested_amount,
        Money::new(dec("12000.00"))
    );

    // Verify XIRR parity calculation
    // Cashflows:
    // 2022-01-15: -10000
    // 2022-06-15: -6000
    // 2023-01-15: +6000 (redemption cashflow)
    // 2023-06-15: +17600 (terminal value: 110 units @ 160.00)
    let cashflows = vec![
        CashFlow::new(
            NaiveDate::from_ymd_opt(2022, 1, 15).unwrap(),
            dec("-10000.00"),
        ),
        CashFlow::new(
            NaiveDate::from_ymd_opt(2022, 6, 15).unwrap(),
            dec("-6000.00"),
        ),
        CashFlow::new(
            NaiveDate::from_ymd_opt(2023, 1, 15).unwrap(),
            dec("6000.00"),
        ),
        CashFlow::new(
            NaiveDate::from_ymd_opt(2023, 6, 15).unwrap(),
            dec("17600.00"),
        ),
    ];
    let xirr_result = calculate_xirr(&cashflows).expect("XIRR calculation should converge");
    assert!(
        xirr_result > dec("0.20"),
        "Expected positive annualized return > 20%, got {xirr_result}"
    );
}

#[test]
fn test_entity_serde_roundtrip() {
    let now = chrono::Utc::now();
    let user = UserEntity {
        id: Uuid::new_v4(),
        email: "neha@example.com".to_string(),
        password_hash: "hash123".to_string(),
        created_at: now,
        updated_at: now,
    };
    let json = serde_json::to_string(&user).expect("serialize user");
    assert!(json.contains("\"passwordHash\""));
    assert!(json.contains("\"createdAt\""));
    let deserialized: UserEntity = serde_json::from_str(&json).expect("deserialize user");
    assert_eq!(deserialized, user);

    let profile = ManagedProfileEntity {
        id: Uuid::new_v4(),
        user_id: user.id,
        name: "Neha Patel".to_string(),
        pan: "ABCDE1234F".to_string(),
        tax_slab: dec("0.30"),
        created_at: now,
        updated_at: now,
    };
    let json_profile = serde_json::to_string(&profile).expect("serialize profile");
    assert!(json_profile.contains("\"userId\""));
    assert!(json_profile.contains("\"taxSlab\""));
    let deserialized_profile: ManagedProfileEntity =
        serde_json::from_str(&json_profile).expect("deserialize profile");
    assert_eq!(deserialized_profile, profile);

    let tx = TransactionEntity {
        id: Uuid::new_v4(),
        folio_id: Uuid::new_v4(),
        date: NaiveDate::from_ymd_opt(2024, 1, 1).unwrap(),
        tx_type: "BUY".to_string(),
        amount: dec("1000.00"),
        units: dec("10.0000"),
        nav: dec("100.0000"),
        balance: dec("10.0000"),
        external_id: Some("EXT-123".to_string()),
        created_at: now,
        updated_at: now,
    };
    let json_tx = serde_json::to_string(&tx).expect("serialize tx");
    assert!(json_tx.contains("\"folioId\""));
    assert!(json_tx.contains("\"txType\""));
    assert!(json_tx.contains("\"externalId\""));
    let deserialized_tx: TransactionEntity =
        serde_json::from_str(&json_tx).expect("deserialize tx");
    assert_eq!(deserialized_tx, tx);

    let asset = AssetEntity {
        id: Uuid::new_v4(),
        asset_type: "MUTUAL_FUND".to_string(),
        name: "Parag Parikh Flexi Cap Fund".to_string(),
        isin: Some("INF879O01019".to_string()),
        amfi_code: Some("122639".to_string()),
        symbol: None,
        exit_load_metadata: Some(
            r#"{"exitLoad": "1% for redemption within 365 days"}"#.to_string(),
        ),
        created_at: now,
        updated_at: now,
    };
    let json_asset = serde_json::to_string(&asset).expect("serialize asset");
    assert!(json_asset.contains("\"exitLoadMetadata\""));
    assert!(json_asset.contains("\"assetType\""));
    assert!(json_asset.contains("\"amfiCode\""));
    let deserialized_asset: AssetEntity =
        serde_json::from_str(&json_asset).expect("deserialize asset");
    assert_eq!(deserialized_asset, asset);

    // Test deserializing when exitLoadMetadata is omitted (verifying #[serde(default)])
    let json_no_exit_load = r#"{
        "id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
        "assetType": "STOCK",
        "name": "HDFC Bank Ltd",
        "isin": null,
        "amfiCode": null,
        "symbol": "HDFCBANK",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
    }"#;
    let asset_default: AssetEntity =
        serde_json::from_str(json_no_exit_load).expect("deserialize without exit load");
    assert_eq!(asset_default.exit_load_metadata, None);
}

#[tokio::test]
async fn test_portfolio_cascading_deletion_of_folios_and_transactions() {
    let db = InMemoryDatabase::new();
    let user = db.create_user("aarav.cascading@example.com", "hashed_pwd");
    let portfolio = db
        .create_portfolio(user.id, "Cascading Test Portfolio", None)
        .await
        .expect("create portfolio");

    let asset1 = db.create_asset(
        "MUTUAL_FUND",
        "Parag Parikh Flexi Cap Fund",
        Some("INF879O01019"),
        Some("122639"),
        None,
        Some("1% within 365 days".to_string()),
    );
    let asset2 = db.create_asset("STOCK", "TCS Ltd", None, None, Some("TCS"), None);

    let folio1 = db
        .create_folio(portfolio.id, asset1.id, "FOLIO-1", None, Some("ABCDE1234F"))
        .expect("create folio 1");
    let folio2 = db
        .create_folio(portfolio.id, asset2.id, "FOLIO-2", None, Some("ABCDE1234F"))
        .expect("create folio 2");

    let tx1 = db
        .create_transaction(
            folio1.id,
            NaiveDate::from_ymd_opt(2023, 1, 1).unwrap(),
            "BUY",
            dec("10000.00"),
            dec("100.0000"),
            dec("100.0000"),
            dec("100.0000"),
            Some("TX-F1-1"),
        )
        .await
        .expect("create tx1");
    let tx2 = db
        .create_transaction(
            folio2.id,
            NaiveDate::from_ymd_opt(2023, 2, 1).unwrap(),
            "BUY",
            dec("5000.00"),
            dec("50.0000"),
            dec("100.0000"),
            dec("50.0000"),
            Some("TX-F2-1"),
        )
        .await
        .expect("create tx2");

    // Verify entities exist prior to deletion
    assert!(db.get_portfolio(portfolio.id).await.unwrap().is_some());
    assert!(db.get_folio(folio1.id).is_some());
    assert!(db.get_folio(folio2.id).is_some());
    let f1_txs = db.list_by_folio(folio1.id).await.unwrap();
    assert_eq!(f1_txs.len(), 1);
    assert_eq!(f1_txs[0].id, tx1.id);
    let f2_txs = db.list_by_folio(folio2.id).await.unwrap();
    assert_eq!(f2_txs.len(), 1);
    assert_eq!(f2_txs[0].id, tx2.id);

    // Perform portfolio deletion
    db.delete_portfolio(portfolio.id)
        .await
        .expect("delete portfolio");

    // Verify cascading deletion: portfolio, folios, and transactions all wiped
    assert!(db.get_portfolio(portfolio.id).await.unwrap().is_none());
    assert!(db.get_folio(folio1.id).is_none());
    assert!(db.get_folio(folio2.id).is_none());
    assert!(db.list_folios_by_portfolio(portfolio.id).is_empty());
    assert!(db.list_by_folio(folio1.id).await.unwrap().is_empty());
    assert!(db.list_by_folio(folio2.id).await.unwrap().is_empty());
    assert!(db.list_by_portfolio(portfolio.id).await.unwrap().is_empty());
}
