#![allow(
    missing_docs,
    clippy::unwrap_used,
    clippy::panic,
    clippy::undocumented_unsafe_blocks
)]

//! Test suite for Net Asset Value (NAV) resolution, date precedence,
//! previous trading day discovery, and day change calculations.
//!
//! Validates:
//! - Date priority between historical database records and fallback transaction NAVs
//! - Sunday / weekend / holiday bridging: day change always measures against the last available date
//! - Fallback transaction date overrides when newer than historical records
//! - Correct calculation of dayChange and dayChangePercentage on both folio and portfolio level

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use chrono::NaiveDate;
use http_body_util::BodyExt;
use portfolio_api::routes::portfolio::{
    fetch_latest_nav, resolve_nav_and_previous_with_date_priority, resolve_nav_with_date_priority,
};
use portfolio_api::{AppState, create_app, create_jwt};
use portfolio_core::types::Nav;
use portfolio_db::InMemoryDatabase;
use portfolio_db::entities::AssetEntity;
use portfolio_db::repositories::{PortfolioRepository, TransactionRepository};
use rust_decimal::Decimal;
use tower::ServiceExt;
use uuid::Uuid;

// ============================================================================
// 1. Pure Unit Tests: Date Priority & NAV Resolution
// ============================================================================

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

#[test]
fn test_resolve_nav_and_previous_two_historical_dates_sunday_scenario() {
    // Friday NAV (latest available)
    let friday_date = NaiveDate::from_ymd_opt(2026, 10, 30).unwrap();
    let friday_nav = Nav::new(Decimal::new(892332, 4)); // 89.2332

    // Thursday NAV (previous trading day)
    let thursday_date = NaiveDate::from_ymd_opt(2026, 10, 29).unwrap();
    let thursday_nav = Nav::new(Decimal::new(889623, 4)); // 88.9623

    let records = vec![(friday_date, friday_nav), (thursday_date, thursday_nav)];

    // On a Sunday (or non-trading day), latest is Friday, previous is Thursday
    let (latest, previous) = resolve_nav_and_previous_with_date_priority(&records, None);

    assert_eq!(latest, friday_nav);
    assert_eq!(previous, Some(thursday_nav));

    // Calculate day change per unit
    let diff = latest.to_decimal() - previous.unwrap().to_decimal();
    assert_eq!(diff, Decimal::new(2709, 4)); // 0.2709
    let pct = (diff / previous.unwrap().to_decimal()) * Decimal::from(100);
    assert!(pct > Decimal::ZERO);
}

#[test]
fn test_resolve_nav_and_previous_single_historical_record_has_no_previous() {
    let date = NaiveDate::from_ymd_opt(2026, 10, 30).unwrap();
    let nav = Nav::new(Decimal::new(100, 0));
    let records = vec![(date, nav)];

    let (latest, previous) = resolve_nav_and_previous_with_date_priority(&records, None);
    assert_eq!(latest, nav);
    assert_eq!(previous, None);
}

#[test]
fn test_resolve_nav_and_previous_newer_transaction_makes_latest_history_the_previous() {
    let hist_date = NaiveDate::from_ymd_opt(2026, 10, 30).unwrap();
    let hist_nav = Nav::new(Decimal::new(100, 0));
    let records = vec![(hist_date, hist_nav)];

    let tx_date = NaiveDate::from_ymd_opt(2026, 10, 31).unwrap();
    let tx_nav = Nav::new(Decimal::new(102, 0));

    let (latest, previous) =
        resolve_nav_and_previous_with_date_priority(&records, Some((tx_date, tx_nav)));
    assert_eq!(latest, tx_nav);
    assert_eq!(previous, Some(hist_nav));
}

// ============================================================================
// 2. Integration Tests: Lazy Sync Trigger & Summary Day Change Wire Parity
// ============================================================================

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
    {
        let limiter = state.nav_rate_limiter.read().await;
        assert!(
            limiter.contains(&("122639".to_string(), today)),
            "Lazy sync rate limiter entry should be recorded for today"
        );
    }

    // Storing a fresh historical NAV newer than tx_date should take precedence
    let fresh_date = NaiveDate::from_ymd_opt(2026, 10, 24).unwrap();
    let fresh_nav = Decimal::new(9510, 2);
    db.store_nav("122639", fresh_date, fresh_nav);

    let resolved_fresh = fetch_latest_nav(&state, Some(&asset), Some((tx_date, tx_nav))).await;
    assert_eq!(resolved_fresh, Nav::new(fresh_nav));
}

#[tokio::test]
async fn test_get_portfolio_summary_computes_day_change_accurately() {
    let db = Arc::new(InMemoryDatabase::new());
    let jwt_secret = "test-secret-12345".to_string();
    let state = AppState::new(Arc::clone(&db), jwt_secret.clone());
    let app = create_app(state);

    let user = db.create_user("investor@example.com", "hash");
    let token = create_jwt(user.id, &user.email, &jwt_secret).unwrap();

    let portfolio = db
        .create_portfolio(user.id, "Retirement Portfolio", None)
        .await
        .unwrap();

    let asset = db.create_asset(
        "MUTUAL_FUND",
        "Parag Parikh Flexi Cap Fund",
        Some("INF879O01027"),
        Some("122639"),
        Some("PPFAS"),
        None,
    );

    let folio = db
        .create_folio(
            portfolio.id,
            asset.id,
            "FOLIO-101",
            Some("PPFAS"),
            Some("ABCDE1234F"),
        )
        .unwrap();

    // Purchase 100 units at NAV 80 on 2026-01-01
    db.create_transaction(
        folio.id,
        NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
        "PURCHASE",
        Decimal::new(8000, 0),
        Decimal::new(100, 0),
        Decimal::new(80, 0),
        Decimal::new(100, 0),
        None,
    )
    .await
    .unwrap();

    // Store historical market NAVs:
    // Thursday (previous date): 88.0
    // Friday (latest date): 90.0
    let thurs_date = NaiveDate::from_ymd_opt(2026, 10, 29).unwrap();
    let fri_date = NaiveDate::from_ymd_opt(2026, 10, 30).unwrap();
    db.store_nav("122639", thurs_date, Decimal::new(88, 0));
    db.store_nav("122639", fri_date, Decimal::new(90, 0));

    let req = Request::builder()
        .uri("/api/portfolio/summary")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();

    // Folio metrics
    let folios = json["folios"].as_array().expect("folios array");
    assert_eq!(folios.len(), 1);
    let folio_metrics = &folios[0]["metrics"];
    assert_eq!(folio_metrics["currentPrice"], 90.0);
    // 100 units * (90 - 88) = 200.0
    assert_eq!(folio_metrics["dayChange"], 200.0);
    // (90 - 88) / 88 * 100 = 2.2727...
    let dcp = folio_metrics["dayChangePercentage"].as_f64().unwrap();
    assert!((dcp - 2.2727).abs() < 0.01);

    // Summary metrics
    let summary_metrics = &json["metrics"];
    assert_eq!(summary_metrics["totalValue"], 9000.0);
    assert_eq!(summary_metrics["dayChange"], 200.0);
    let sum_dcp = summary_metrics["dayChangePercentage"].as_f64().unwrap();
    assert!((sum_dcp - 2.2727).abs() < 0.01);
}
