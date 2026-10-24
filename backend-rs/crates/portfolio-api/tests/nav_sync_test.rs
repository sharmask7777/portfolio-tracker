use std::sync::Arc;

use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Json, Router};
use chrono::NaiveDate;
use portfolio_api::services::{InMemoryRateLimiter, NavSyncService};
use portfolio_api::state::AppState;
use portfolio_db::InMemoryDatabase;
use rust_decimal::Decimal;
use serde_json::json;

#[tokio::test]
async fn test_rate_limiter_allows_first_call_and_blocks_subsequent_calls_same_day() {
    let limiter = InMemoryRateLimiter::new();
    let today = NaiveDate::from_ymd_opt(2026, 10, 24).unwrap();
    assert!(limiter.try_acquire("122639", today).await);
    assert!(!limiter.try_acquire("122639", today).await); // second call throttled
    let tomorrow = NaiveDate::from_ymd_opt(2026, 10, 25).unwrap();
    assert!(limiter.try_acquire("122639", tomorrow).await); // new day allowed
}

#[tokio::test]
async fn test_rate_limiter_independent_for_different_schemes() {
    let limiter = InMemoryRateLimiter::new();
    let today = NaiveDate::from_ymd_opt(2026, 10, 24).unwrap();

    assert!(limiter.try_acquire("122639", today).await);
    assert!(limiter.try_acquire("118989", today).await); // different scheme allowed
    assert!(!limiter.try_acquire("122639", today).await); // original scheme throttled
    assert!(!limiter.try_acquire("118989", today).await); // second scheme throttled
}

#[tokio::test]
async fn test_nav_sync_service_try_acquire_daily_sync_with_in_memory_state() {
    let db = Arc::new(InMemoryDatabase::new());
    let state = AppState::new(db, "test-secret");
    let today = NaiveDate::from_ymd_opt(2026, 10, 24).unwrap();

    assert!(NavSyncService::try_acquire_daily_sync(&state, "122639", today).await);
    assert!(!NavSyncService::try_acquire_daily_sync(&state, "122639", today).await);

    let tomorrow = NaiveDate::from_ymd_opt(2026, 10, 25).unwrap();
    assert!(NavSyncService::try_acquire_daily_sync(&state, "122639", tomorrow).await);
}

#[tokio::test]
async fn test_check_and_trigger_lazy_sync_validation_and_throttling() {
    let db = Arc::new(InMemoryDatabase::new());
    let state = AppState::new(db, "test-secret");

    // Missing or empty AMFI code should cleanly skip
    assert!(!NavSyncService::check_and_trigger_lazy_sync(&state, "").await);
    assert!(!NavSyncService::check_and_trigger_lazy_sync(&state, "   ").await);

    // Non-numeric identifiers (e.g. stock tickers or ISIN) should cleanly skip
    assert!(!NavSyncService::check_and_trigger_lazy_sync(&state, "RELIANCE").await);
    assert!(!NavSyncService::check_and_trigger_lazy_sync(&state, "INF179K01BE2").await);

    // Valid numeric AMFI code acquires lock and triggers fetch
    assert!(NavSyncService::check_and_trigger_lazy_sync(&state, "122639").await);
    // Subsequent call on same day is throttled
    assert!(!NavSyncService::check_and_trigger_lazy_sync(&state, "122639").await);
}

#[tokio::test]
async fn test_spawn_lazy_nav_fetch_fails_gracefully_without_panicking() {
    let db = Arc::new(InMemoryDatabase::new());
    let state = AppState::new(db, "test-secret");

    // Spawn task against invalid address / port (fire-and-forget)
    // Should complete cleanly, log a warning, and not panic
    let handle = NavSyncService::spawn_lazy_nav_fetch(state, "999999".to_string());
    let res = handle.await;
    assert!(res.is_ok(), "Task must join successfully without panicking");
}

#[tokio::test]
async fn test_fetch_and_upsert_latest_nav_hermetic_mock_server() {
    // Spin up an in-process local mock server returning valid MFAPI JSON
    let mock_app = Router::new().route(
        "/mf/{scheme_code}/latest",
        get(|| async {
            Json(json!({
                "status": "SUCCESS",
                "meta": {
                    "scheme_code": 122639,
                    "scheme_name": "Parag Parikh Flexi Cap Fund"
                },
                "data": [
                    {
                        "date": "24-10-2026",
                        "nav": "89.4520"
                    }
                ]
            }))
            .into_response()
        }),
    );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind ephemeral port");
    let port = listener.local_addr().unwrap().port();
    let base_url = format!("http://127.0.0.1:{port}");

    tokio::spawn(async move {
        axum::serve(listener, mock_app).await.ok();
    });

    let db = Arc::new(InMemoryDatabase::new());
    let state = AppState::new(Arc::clone(&db), "test-secret");

    let result =
        NavSyncService::fetch_and_upsert_latest_nav(&state, "122639", Some(&base_url)).await;
    assert!(
        result.is_ok(),
        "Fetch and upsert should succeed: {:?}",
        result
    );

    let expected_date = NaiveDate::from_ymd_opt(2026, 10, 24).unwrap();
    let stored = db.get_nav("122639", expected_date);
    assert!(stored.is_some(), "Stored NAV must be found in database");
    assert_eq!(
        stored.unwrap().nav,
        Decimal::from_str_exact("89.4520").unwrap()
    );
}
