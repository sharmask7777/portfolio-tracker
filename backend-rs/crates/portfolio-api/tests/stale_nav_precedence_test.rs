use std::sync::Arc;

use chrono::NaiveDate;
use portfolio_api::resolve_nav_with_date_priority;
use portfolio_api::routes::portfolio::fetch_latest_nav;
use portfolio_api::state::AppState;
use portfolio_core::types::Nav;
use portfolio_db::InMemoryDatabase;
use portfolio_db::entities::AssetEntity;
use rust_decimal::Decimal;
use uuid::Uuid;

#[test]
fn test_transaction_nav_overrides_older_historical_nav() {
    let hist_date = NaiveDate::from_ymd_opt(2026, 8, 5).unwrap();
    let hist_nav = Nav::new(Decimal::new(9283, 2)); // 92.83
    let tx_date = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
    let tx_nav = Nav::new(Decimal::new(8855, 2)); // 88.55
    let resolved =
        resolve_nav_with_date_priority(Some((hist_date, hist_nav)), Some((tx_date, tx_nav)));
    assert_eq!(resolved, tx_nav);
}

#[test]
fn test_historical_nav_newer_than_transaction_takes_precedence() {
    let hist_date = NaiveDate::from_ymd_opt(2026, 10, 24).unwrap();
    let hist_nav = Nav::new(Decimal::new(9510, 2)); // 95.10
    let tx_date = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
    let tx_nav = Nav::new(Decimal::new(8855, 2)); // 88.55
    let resolved =
        resolve_nav_with_date_priority(Some((hist_date, hist_nav)), Some((tx_date, tx_nav)));
    assert_eq!(resolved, hist_nav);
}

#[test]
fn test_historical_nav_same_date_as_transaction_takes_precedence() {
    let date = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
    let hist_nav = Nav::new(Decimal::new(8900, 2));
    let tx_nav = Nav::new(Decimal::new(8855, 2));
    let resolved = resolve_nav_with_date_priority(Some((date, hist_nav)), Some((date, tx_nav)));
    assert_eq!(resolved, hist_nav);
}

#[test]
fn test_only_historical_nav_present_returns_historical() {
    let hist_date = NaiveDate::from_ymd_opt(2026, 8, 5).unwrap();
    let hist_nav = Nav::new(Decimal::new(9283, 2));
    let resolved = resolve_nav_with_date_priority(Some((hist_date, hist_nav)), None);
    assert_eq!(resolved, hist_nav);
}

#[test]
fn test_only_fallback_nav_present_returns_fallback() {
    let tx_date = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
    let tx_nav = Nav::new(Decimal::new(8855, 2));
    let resolved = resolve_nav_with_date_priority(None, Some((tx_date, tx_nav)));
    assert_eq!(resolved, tx_nav);
}

#[test]
fn test_neither_present_returns_zero() {
    let resolved = resolve_nav_with_date_priority(None, None);
    assert_eq!(resolved, Nav::ZERO);
}

#[tokio::test]
async fn test_fetch_latest_nav_triggers_lazy_sync_and_enforces_transaction_priority() {
    unsafe {
        std::env::set_var("MFAPI_BASE_URL", "http://127.0.0.1:1");
    }

    let db = Arc::new(InMemoryDatabase::new());
    let state = AppState::new(Arc::clone(&db), "test-secret");

    let asset = AssetEntity {
        id: Uuid::new_v4(),
        symbol: Some("PPFAS".to_string()),
        name: "Parag Parikh Flexi Cap Fund".to_string(),
        asset_type: "MUTUAL_FUND".to_string(),
        isin: Some("INF879O01018".to_string()),
        amfi_code: Some("122639".to_string()),
        exit_load_metadata: None,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    // Stale NAV stored in database from 2026-08-05
    let stale_date = NaiveDate::from_ymd_opt(2026, 8, 5).unwrap();
    let stale_nav = Decimal::new(9283, 2);
    db.store_nav("122639", stale_date, stale_nav);

    // Fallback transaction from 2026-10-12
    let tx_date = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
    let tx_nav = Nav::new(Decimal::new(8855, 2));

    // fetch_latest_nav should trigger lazy sync and return tx_nav (88.55) because tx_date > stale_date
    let resolved = fetch_latest_nav(&state, Some(&asset), Some((tx_date, tx_nav))).await;
    assert_eq!(resolved, tx_nav);

    // Verify lazy sync was triggered by checking the rate limiter
    let today = chrono::Utc::now().date_naive();
    let limiter = state.nav_rate_limiter.read().await;
    assert!(
        limiter.contains(&("122639".to_string(), today)),
        "Lazy sync rate limiter entry should be recorded for today"
    );

    // Storing a fresh historical NAV newer than tx_date should take precedence
    let fresh_date = NaiveDate::from_ymd_opt(2026, 10, 24).unwrap();
    let fresh_nav = Decimal::new(9510, 2);
    db.store_nav("122639", fresh_date, fresh_nav);

    let resolved_fresh = fetch_latest_nav(&state, Some(&asset), Some((tx_date, tx_nav))).await;
    assert_eq!(resolved_fresh, Nav::new(fresh_nav));
}
