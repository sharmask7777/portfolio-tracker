#![allow(clippy::expect_used)]
#![allow(
    missing_docs,
    clippy::unwrap_used,
    clippy::panic,
    clippy::undocumented_unsafe_blocks
)]

//! Hermetic Goal CRUD & Server-Side Projection Contract Tests.

use std::str::FromStr;
use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode, header};
use chrono::{Duration, Utc};
use http_body_util::BodyExt;
use rust_decimal::Decimal;
use serde_json::{Value, json};
use tower::ServiceExt;
use uuid::Uuid;

use portfolio_api::{AppState, create_app};
use portfolio_db::InMemoryDatabase;
use portfolio_db::repositories::{PortfolioRepository, TransactionRepository};

fn setup_test_app() -> (axum::Router, Arc<InMemoryDatabase>, String) {
    let db = Arc::new(InMemoryDatabase::new());
    let jwt_secret = "hermetic_goals_test_secret_1234567890".to_string();
    let state = AppState::new(db.clone(), jwt_secret.clone());
    let app = create_app(state);
    (app, db, jwt_secret)
}

async fn parse_json(body: Body) -> Value {
    let bytes = body
        .collect()
        .await
        .expect("body collection should succeed")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("response body must be valid JSON")
}

async fn register_user_and_token(app: &axum::Router, email: &str) -> (Uuid, String) {
    let req = Request::builder()
        .uri("/api/auth/register")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "email": email,
                "password": "StrongPassword123!"
            })
            .to_string(),
        ))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = parse_json(res.into_body()).await;
    let user_id = Uuid::parse_str(body["user"]["id"].as_str().unwrap()).unwrap();
    let token = body["token"].as_str().unwrap().to_string();
    (user_id, token)
}

async fn seed_portfolio_with_value(db: &InMemoryDatabase, user_id: Uuid, value_inr: &str) -> Uuid {
    let portfolio = db
        .create_portfolio(user_id, "Goal Test Portfolio", None)
        .await
        .unwrap();
    let asset = db.create_asset(
        "MUTUAL_FUND",
        "Test Equity Fund",
        Some("INF000000001"),
        None,
        None,
        None,
    );
    let folio = db
        .create_folio(portfolio.id, asset.id, "12345/01", None, None)
        .unwrap();

    let nav = Decimal::from_str("100").unwrap();
    let amount = Decimal::from_str(value_inr).unwrap();
    let units = amount / nav;
    let tx_date = Utc::now().date_naive() - Duration::days(30);

    db.create_transaction(
        folio.id, tx_date, "PURCHASE", amount, units, nav, units, None,
    )
    .await
    .unwrap();

    portfolio.id
}

#[tokio::test]
async fn test_goal_persistent_crud_and_server_projections() {
    let (app, db, _) = setup_test_app();
    let (user_id, token) = register_user_and_token(&app, "goals_owner@example.com").await;

    // Seed portfolio with ₹1,00,000 live value
    let port_id = seed_portfolio_with_value(&db, user_id, "100000").await;

    let target_date = (Utc::now().date_naive() + Duration::days(365 * 5))
        .format("%Y-%m-%d")
        .to_string();

    // 1. Create a Behind goal (current ₹50,000 via 50% allocation, 0 SIP, target ₹5,00,000)
    let create_req = Request::builder()
        .uri(format!("/api/health/{port_id}/goals"))
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "name": "Home Downpayment",
                "targetAmount": 500000,
                "targetDate": target_date,
                "monthlySip": 0,
                "priority": "HIGH",
                "allocatedPercentage": 50
            })
            .to_string(),
        ))
        .unwrap();

    let create_res = app.clone().oneshot(create_req).await.unwrap();
    assert_eq!(create_res.status(), StatusCode::OK);
    let created = parse_json(create_res.into_body()).await;
    let goal_id = created["id"].as_str().unwrap().to_string();

    assert_eq!(created["name"], "Home Downpayment");
    assert_eq!(created["priority"], "HIGH");
    assert_eq!(created["allocatedPercentage"], 50.0);
    assert_eq!(created["metrics"]["currentValue"], 50000.0);
    assert_eq!(created["metrics"]["progressPercentage"], 10.0);
    assert_eq!(created["metrics"]["status"], "Behind");
    assert!(created["metrics"]["projectedValue"].as_f64().unwrap() > 50000.0);
    assert!(created["metrics"]["shortfall"].as_f64().unwrap() > 0.0);
    assert_eq!(created["metrics"]["surplus"], 0.0);
    assert!(created["metrics"]["requiredMonthlySip"].as_f64().unwrap() > 0.0);

    // 2. Verify persistence via GET
    let list_req = Request::builder()
        .uri(format!("/api/health/{port_id}/goals"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let list_res = app.clone().oneshot(list_req).await.unwrap();
    assert_eq!(list_res.status(), StatusCode::OK);
    let listed = parse_json(list_res.into_body()).await;
    assert_eq!(listed.as_array().unwrap().len(), 1);
    assert_eq!(listed[0]["id"], goal_id);

    // 3. Update goal to Achieved (100% of ₹1,00,000 >= ₹80,000 target)
    let update_req = Request::builder()
        .uri(format!("/api/health/{port_id}/goals/{goal_id}"))
        .method("PUT")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "targetAmount": 80000,
                "allocatedPercentage": 100
            })
            .to_string(),
        ))
        .unwrap();
    let update_res = app.clone().oneshot(update_req).await.unwrap();
    assert_eq!(update_res.status(), StatusCode::OK);
    let updated = parse_json(update_res.into_body()).await;
    assert_eq!(updated["metrics"]["currentValue"], 100000.0);
    assert_eq!(updated["metrics"]["progressPercentage"], 100.0);
    assert_eq!(updated["metrics"]["shortfall"], 0.0);
    assert!(updated["metrics"]["surplus"].as_f64().unwrap() > 0.0);
    assert_eq!(updated["metrics"]["requiredMonthlySip"], 0.0);
    assert_eq!(updated["metrics"]["status"], "Achieved");

    // 4. Delete goal and verify removal
    let del_req = Request::builder()
        .uri(format!("/api/health/{port_id}/goals/{goal_id}"))
        .method("DELETE")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let del_res = app.clone().oneshot(del_req).await.unwrap();
    assert_eq!(del_res.status(), StatusCode::OK);

    let list_after_req = Request::builder()
        .uri(format!("/api/health/{port_id}/goals"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let list_after_res = app.clone().oneshot(list_after_req).await.unwrap();
    assert_eq!(list_after_res.status(), StatusCode::OK);
    let listed_after = parse_json(list_after_res.into_body()).await;
    assert_eq!(listed_after.as_array().unwrap().len(), 0);
}

#[tokio::test]
async fn test_goal_status_tiers_on_track_and_needs_attention() {
    let (app, db, _) = setup_test_app();
    let (user_id, token) = register_user_and_token(&app, "goals_tiers@example.com").await;
    let port_id = seed_portfolio_with_value(&db, user_id, "100000").await;
    let target_date = (Utc::now().date_naive() + Duration::days(365 * 5))
        .format("%Y-%m-%d")
        .to_string();

    // 5-year compounding at 12% monthly on ₹1,00,000 is ~₹1,81,670.
    // Target ₹2,00,000 with 0 SIP -> projected ~₹1,81,670 >= 80% (₹1,60,000) -> Needs Attention.
    let needs_attn_req = Request::builder()
        .uri(format!("/api/health/{port_id}/goals"))
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "name": "Car Upgrade",
                "targetAmount": 200000,
                "targetDate": target_date,
                "monthlySip": 0,
                "allocatedPercentage": 100
            })
            .to_string(),
        ))
        .unwrap();
    let needs_attn_res = app.clone().oneshot(needs_attn_req).await.unwrap();
    assert_eq!(needs_attn_res.status(), StatusCode::OK);
    let needs_attn = parse_json(needs_attn_res.into_body()).await;
    assert_eq!(needs_attn["metrics"]["status"], "Needs Attention");

    // With monthlySip 5000, projected value far exceeds ₹2,00,000 -> On Track.
    let on_track_req = Request::builder()
        .uri(format!("/api/health/{port_id}/goals"))
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "name": "Travel Corpus",
                "targetAmount": 200000,
                "targetDate": target_date,
                "monthlySip": 5000,
                "allocatedPercentage": 100
            })
            .to_string(),
        ))
        .unwrap();
    let on_track_res = app.clone().oneshot(on_track_req).await.unwrap();
    assert_eq!(on_track_res.status(), StatusCode::OK);
    let on_track = parse_json(on_track_res.into_body()).await;
    assert_eq!(on_track["metrics"]["status"], "On Track");
    assert_eq!(on_track["metrics"]["shortfall"], 0.0);
    assert!(on_track["metrics"]["surplus"].as_f64().unwrap() > 0.0);
}

#[tokio::test]
async fn test_goal_ownership_enforced_across_users() {
    let (app, db, _) = setup_test_app();
    let (owner_id, _) = register_user_and_token(&app, "owner_iso@example.com").await;
    let (_, attacker_token) = register_user_and_token(&app, "attacker_iso@example.com").await;

    let owner_port_id = seed_portfolio_with_value(&db, owner_id, "50000").await;

    let get_req = Request::builder()
        .uri(format!("/api/health/{owner_port_id}/goals"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {attacker_token}"))
        .body(Body::empty())
        .unwrap();
    let get_res = app.clone().oneshot(get_req).await.unwrap();
    assert_eq!(get_res.status(), StatusCode::FORBIDDEN);

    let post_req = Request::builder()
        .uri(format!("/api/health/{owner_port_id}/goals"))
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {attacker_token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "name": "Unauthorized Goal",
                "targetAmount": 100000
            })
            .to_string(),
        ))
        .unwrap();
    let post_res = app.clone().oneshot(post_req).await.unwrap();
    assert_eq!(post_res.status(), StatusCode::FORBIDDEN);
}
