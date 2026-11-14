#![allow(
    missing_docs,
    clippy::unwrap_used,
    clippy::panic,
    clippy::assert_is_empty,
    clippy::undocumented_unsafe_blocks
)]

//! Hermetic REST API Gateway Contract Parity Tests.
//!
//! Validates:
//! - Health check 200
//! - User registration & login with JWT generation
//! - Auth protection (401 without token)
//! - Portfolio creation and summary retrieval with camelCase wire parity
//! - Fund overlap endpoint with stock intersection
//! - Tax simulate-sell blocking locked ELSS units with 400 UNITS_LOCKED
//! - Multi-member profile transactional cascading deletion
//!
//! Zero network ports or docker required; executes entirely in-memory.

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

use portfolio_api::{
    AppState, create_app, get_stock_market_cap, get_stock_sector, resolve_holdings,
};
use portfolio_db::InMemoryDatabase;
use portfolio_db::repositories::{FamilyRepository, PortfolioRepository, TransactionRepository};

fn setup_test_app() -> (axum::Router, Arc<InMemoryDatabase>, String) {
    let db = Arc::new(InMemoryDatabase::new());
    let jwt_secret = "hermetic_test_secret_for_parity_verification_12345".to_string();
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

#[tokio::test]
async fn test_health_check_returns_ok_and_timestamp() {
    let (app, _, _) = setup_test_app();

    let request = Request::builder()
        .uri("/api/health")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let json = parse_json(response.into_body()).await;
    assert_eq!(json["status"], "ok");
    assert!(json["timestamp"].is_string());
}

#[tokio::test]
async fn test_user_registration_login_and_me_lifecycle() {
    let (app, _, _) = setup_test_app();

    // 1. Register new user
    let reg_payload = json!({
        "email": "aarav.sharma@example.com",
        "password": "SecurePassword123!"
    });

    let reg_req = Request::builder()
        .uri("/api/auth/register")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(reg_payload.to_string()))
        .unwrap();

    let reg_res = app.clone().oneshot(reg_req).await.unwrap();
    assert_eq!(reg_res.status(), StatusCode::CREATED);

    let reg_json = parse_json(reg_res.into_body()).await;
    assert_eq!(reg_json["email"], "aarav.sharma@example.com");
    assert!(reg_json["id"].is_string());
    assert!(reg_json["token"].is_string());
    let token = reg_json["token"].as_str().unwrap().to_string();

    // 2. Prevent duplicate registration with same email
    let dup_req = Request::builder()
        .uri("/api/auth/register")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(reg_payload.to_string()))
        .unwrap();

    let dup_res = app.clone().oneshot(dup_req).await.unwrap();
    assert_eq!(dup_res.status(), StatusCode::BAD_REQUEST);
    let dup_json = parse_json(dup_res.into_body()).await;
    assert_eq!(dup_json["code"], "USER_ALREADY_EXISTS");

    // 3. Login with valid credentials
    let login_payload = json!({
        "email": "aarav.sharma@example.com",
        "password": "SecurePassword123!"
    });
    let login_req = Request::builder()
        .uri("/api/auth/login")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(login_payload.to_string()))
        .unwrap();

    let login_res = app.clone().oneshot(login_req).await.unwrap();
    assert_eq!(login_res.status(), StatusCode::OK);
    let login_json = parse_json(login_res.into_body()).await;
    assert_eq!(login_json["email"], "aarav.sharma@example.com");
    assert!(login_json["token"].is_string());

    // 4. Login with invalid password fails with 401
    let bad_login = json!({
        "email": "aarav.sharma@example.com",
        "password": "WrongPassword999!"
    });
    let bad_req = Request::builder()
        .uri("/api/auth/login")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(bad_login.to_string()))
        .unwrap();

    let bad_res = app.clone().oneshot(bad_req).await.unwrap();
    assert_eq!(bad_res.status(), StatusCode::UNAUTHORIZED);
    let bad_json = parse_json(bad_res.into_body()).await;
    assert_eq!(bad_json["code"], "AUTH_INVALID_CREDENTIALS");

    // 5. Query /api/auth/me with Bearer token
    let me_req = Request::builder()
        .uri("/api/auth/me")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let me_res = app.oneshot(me_req).await.unwrap();
    assert_eq!(me_res.status(), StatusCode::OK);
    let me_json = parse_json(me_res.into_body()).await;
    assert_eq!(me_json["email"], "aarav.sharma@example.com");
}

#[tokio::test]
async fn test_auth_protection_returns_401_without_or_invalid_token() {
    let (app, _, _) = setup_test_app();

    // 1. No Authorization header -> 401
    let req1 = Request::builder()
        .uri("/api/portfolio")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res1 = app.clone().oneshot(req1).await.unwrap();
    assert_eq!(res1.status(), StatusCode::UNAUTHORIZED);
    let json1 = parse_json(res1.into_body()).await;
    assert_eq!(json1["code"], "AUTH_UNAUTHORIZED");
    assert_eq!(json1["error"], "Unauthorized");

    // 2. Corrupt or fake Bearer token -> 401
    let req2 = Request::builder()
        .uri("/api/portfolio")
        .method("GET")
        .header(header::AUTHORIZATION, "Bearer invalid.fake.token")
        .body(Body::empty())
        .unwrap();

    let res2 = app.oneshot(req2).await.unwrap();
    assert_eq!(res2.status(), StatusCode::UNAUTHORIZED);
    let json2 = parse_json(res2.into_body()).await;
    assert_eq!(json2["code"], "AUTH_UNAUTHORIZED");
}

#[tokio::test]
async fn test_portfolio_creation_and_summary_with_camel_case_parity() {
    let (app, db, _) = setup_test_app();

    // 1. Create a user and auth token
    let user = db.create_user("neha.patel@example.com", "hash_pw");
    let token = portfolio_api::create_jwt(
        user.id,
        &user.email,
        "hermetic_test_secret_for_parity_verification_12345",
    )
    .unwrap();

    // 2. Create portfolio via POST /api/portfolio
    let create_payload = json!({
        "name": "Retirement Fund 2040"
    });
    let create_req = Request::builder()
        .uri("/api/portfolio")
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(create_payload.to_string()))
        .unwrap();

    let create_res = app.clone().oneshot(create_req).await.unwrap();
    assert_eq!(create_res.status(), StatusCode::CREATED);
    let create_json = parse_json(create_res.into_body()).await;
    assert_eq!(create_json["name"], "Retirement Fund 2040");
    assert_eq!(create_json["userId"], user.id.to_string());
    let portfolio_id = Uuid::parse_str(create_json["id"].as_str().unwrap()).unwrap();

    // 3. Seed asset, folio, and transactions in DB
    let asset = db.create_asset(
        "MUTUAL_FUND",
        "HDFC Top 100 Fund",
        Some("INF179K01BE2"),
        Some("118989"),
        None,
        None,
    );
    let folio = db
        .create_folio(
            portfolio_id,
            asset.id,
            "FOLIO-12345",
            Some("HDFC AMC"),
            Some("ALPAC1001A"),
        )
        .unwrap();

    let d1 = Utc::now().date_naive() - Duration::days(300);
    let d2 = Utc::now().date_naive() - Duration::days(100);

    // Buy 100 units @ 100 = 10,000
    db.create_transaction(
        folio.id,
        d1,
        "PURCHASE",
        Decimal::from_str("10000").unwrap(),
        Decimal::from_str("100").unwrap(),
        Decimal::from_str("100").unwrap(),
        Decimal::from_str("100").unwrap(),
        Some("TX-1"),
    )
    .await
    .unwrap();

    // Buy 50 units @ 120 = 6,000
    db.create_transaction(
        folio.id,
        d2,
        "PURCHASE",
        Decimal::from_str("6000").unwrap(),
        Decimal::from_str("50").unwrap(),
        Decimal::from_str("120").unwrap(),
        Decimal::from_str("150").unwrap(),
        Some("TX-2"),
    )
    .await
    .unwrap();

    // 4. Query summary: GET /api/portfolio/{id}/summary
    let summary_req = Request::builder()
        .uri(format!("/api/portfolio/{portfolio_id}/summary"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let summary_res = app.oneshot(summary_req).await.unwrap();
    assert_eq!(summary_res.status(), StatusCode::OK);
    let summary_json = parse_json(summary_res.into_body()).await;

    // Verify camelCase JSON keys
    assert_eq!(summary_json["portfolioId"], portfolio_id.to_string());
    assert_eq!(summary_json["name"], "Retirement Fund 2040");

    // Total units = 150, current price = latest NAV (120)
    // Invested = 10,000 + 6,000 = 16,000
    // Current value = 150 * 120 = 18,000
    // Total gain = 2,000
    assert_eq!(summary_json["investedAmount"], "16000");
    assert_eq!(summary_json["currentValue"], "18000");
    assert_eq!(summary_json["totalGain"], "2000");
    assert_eq!(summary_json["absoluteReturn"], "0.125"); // 2000 / 16000 = 0.125

    let folios_arr = summary_json["folios"].as_array().unwrap();
    assert_eq!(folios_arr.len(), 1);
    let f0 = &folios_arr[0];
    assert_eq!(f0["schemeName"], "HDFC Top 100 Fund");
    assert_eq!(f0["units"], "150");
    assert_eq!(f0["investedAmount"], "16000");
    assert_eq!(f0["currentValue"], "18000");
}

#[tokio::test]
async fn test_fund_overlap_calculation_endpoint() {
    let (app, _, _) = setup_test_app();

    // Request overlap between HDFC Top 100 and SBI Large Cap
    let req = Request::builder()
        .uri("/api/portfolio/overlap?isinA=INF179K01BE2&isinB=INF209K01157")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let json = parse_json(res.into_body()).await;

    assert_eq!(json["fundA"], "HDFC Top 100 Fund");
    assert_eq!(json["fundB"], "SBI Large Cap Fund");
    // Expected intersection:
    // HDFC Bank: min(9.8, 8.5) = 8.5
    // ICICI Bank: min(8.2, 5.5) = 5.5
    // Reliance: min(7.5, 9.0) = 7.5
    // Infosys: min(6.0, 7.0) = 6.0
    // Total = 8.5 + 5.5 + 7.5 + 6.0 = 27.5
    assert_eq!(json["overlapPercentage"], 27.5);

    let common = json["commonStocks"].as_array().unwrap();
    assert_eq!(common.len(), 4);

    // Verify symmetry: order B then A produces identical overlap percentage
    let sym_req = Request::builder()
        .uri("/api/portfolio/overlap?isinA=INF209K01157&isinB=INF179K01BE2")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let sym_res = app.oneshot(sym_req).await.unwrap();
    assert_eq!(sym_res.status(), StatusCode::OK);
    let sym_json = parse_json(sym_res.into_body()).await;
    assert_eq!(sym_json["overlapPercentage"], 27.5);
}

#[tokio::test]
async fn test_tax_simulate_sell_blocks_locked_elss_units_with_400() {
    let (app, db, jwt_secret) = setup_test_app();

    let user = db.create_user("investor.elss@example.com", "pwd");
    let token = portfolio_api::create_jwt(user.id, &user.email, &jwt_secret).unwrap();
    let portfolio = db
        .create_portfolio(user.id, "Tax Saver Portfolio", None)
        .await
        .unwrap();

    // 1. ELSS Asset
    let elss_asset = db.create_asset(
        "MUTUAL_FUND",
        "Mirae Asset ELSS Tax Saver Fund",
        Some("INF769K01DP4"),
        None,
        None,
        None,
    );

    let elss_folio = db
        .create_folio(
            portfolio.id,
            elss_asset.id,
            "ELSS-FOLIO-01",
            Some("Mirae AMC"),
            Some("ABCDE1234F"),
        )
        .unwrap();

    // Purchase made 1 year ago (under 3-year statutory ELSS lock-in!)
    let purchase_date = Utc::now().date_naive() - Duration::days(365);
    db.create_transaction(
        elss_folio.id,
        purchase_date,
        "PURCHASE",
        Decimal::from_str("50000").unwrap(),
        Decimal::from_str("500").unwrap(),
        Decimal::from_str("100").unwrap(),
        Decimal::from_str("500").unwrap(),
        Some("ELSS-TX-1"),
    )
    .await
    .unwrap();

    // 2. Attempt to simulate sell 100 units: Must be rejected with 400 UNITS_LOCKED
    let sim_payload = json!({
        "folioId": elss_folio.id,
        "units": "100",
        "currentPrice": "150"
    });

    let sim_req = Request::builder()
        .uri("/api/tax/simulate-sell")
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(sim_payload.to_string()))
        .unwrap();

    let sim_res = app.clone().oneshot(sim_req).await.unwrap();
    assert_eq!(sim_res.status(), StatusCode::BAD_REQUEST);

    let sim_json = parse_json(sim_res.into_body()).await;
    assert_eq!(sim_json["code"], "UNITS_LOCKED");
    assert!(
        sim_json["error"]
            .as_str()
            .unwrap()
            .contains("Cannot redeem locked ELSS units")
    );
    assert_eq!(sim_json["details"]["locked"], "500.0000");
    assert_eq!(sim_json["details"]["available"], "0.0000");

    // 3. Unlocked non-ELSS asset allows simulation
    let regular_asset = db.create_asset(
        "MUTUAL_FUND",
        "Nippon India Large Cap Fund",
        None,
        None,
        None,
        None,
    );
    let reg_folio = db
        .create_folio(
            portfolio.id,
            regular_asset.id,
            "REG-FOLIO-01",
            None,
            Some("ABCDE1234F"),
        )
        .unwrap();

    db.create_transaction(
        reg_folio.id,
        purchase_date,
        "PURCHASE",
        Decimal::from_str("20000").unwrap(),
        Decimal::from_str("200").unwrap(),
        Decimal::from_str("100").unwrap(),
        Decimal::from_str("200").unwrap(),
        Some("REG-TX-1"),
    )
    .await
    .unwrap();

    let reg_sim_payload = json!({
        "folioId": reg_folio.id,
        "units": "50",
        "currentPrice": "150"
    });
    let reg_sim_req = Request::builder()
        .uri("/api/tax/simulate-sell")
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(reg_sim_payload.to_string()))
        .unwrap();

    let reg_sim_res = app.oneshot(reg_sim_req).await.unwrap();
    assert_eq!(reg_sim_res.status(), StatusCode::OK);
    let reg_sim_json = parse_json(reg_sim_res.into_body()).await;
    assert_eq!(reg_sim_json["unitsToSell"], 50.0);
    assert_eq!(reg_sim_json["estimatedValue"], 7500.0); // 50 * 150 = 7500
    assert_eq!(reg_sim_json["totalGain"], 2500.0); // 7500 - 5000 = 2500
    assert!(reg_sim_json["taxBreakdown"].is_object());
    assert_eq!(reg_sim_json["taxBreakdown"]["ltcg"]["amount"], 2500.0);
    assert_eq!(reg_sim_json["taxBreakdown"]["ltcg"]["tax"], 312.5); // 2500 * 12.5% = 312.50
    assert_eq!(reg_sim_json["taxBreakdown"]["ltcg"]["cess"], 12.5); // 312.50 * 4% = 12.50
    assert_eq!(reg_sim_json["taxBreakdown"]["totalTax"], 325.0); // 312.50 + 12.50 = 325.00
    assert_eq!(reg_sim_json["exitLoad"], 0.0);
}

#[tokio::test]
async fn test_multi_member_profile_cascading_deletion() {
    let (app, db, jwt_secret) = setup_test_app();

    // 1. Create user and auth token
    let user = db.create_user("family.head@example.com", "hash_pw");
    let token = portfolio_api::create_jwt(user.id, &user.email, &jwt_secret).unwrap();

    // 2. Create managed profile via POST /api/family/profiles
    let profile_payload = json!({
        "name": "Priya Sharma",
        "pan": "ABCDE1234F",
        "taxSlab": "0.30"
    });
    let prof_req = Request::builder()
        .uri("/api/family/profiles")
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(profile_payload.to_string()))
        .unwrap();

    let prof_res = app.clone().oneshot(prof_req).await.unwrap();
    assert_eq!(prof_res.status(), StatusCode::CREATED);
    let prof_json = parse_json(prof_res.into_body()).await;
    assert_eq!(prof_json["name"], "Priya Sharma");
    assert_eq!(prof_json["pan"], "ABCDE1234F");
    let profile_id = Uuid::parse_str(prof_json["id"].as_str().unwrap()).unwrap();

    // 3. Create portfolio under this profile
    let port_payload = json!({
        "name": "Priya Equity Portfolio",
        "managedProfileId": profile_id
    });
    let port_req = Request::builder()
        .uri("/api/portfolio")
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(port_payload.to_string()))
        .unwrap();

    let port_res = app.clone().oneshot(port_req).await.unwrap();
    assert_eq!(port_res.status(), StatusCode::CREATED);
    let port_json = parse_json(port_res.into_body()).await;
    let portfolio_id = Uuid::parse_str(port_json["id"].as_str().unwrap()).unwrap();

    // Seed asset, folio, and transaction under this portfolio
    let asset = db.create_asset("MUTUAL_FUND", "Bluechip Equity", None, None, None, None);
    let folio = db
        .create_folio(
            portfolio_id,
            asset.id,
            "FOLIO-999",
            None,
            Some("ABCDE1234F"),
        )
        .unwrap();
    db.create_transaction(
        folio.id,
        Utc::now().date_naive(),
        "PURCHASE",
        Decimal::from_str("10000").unwrap(),
        Decimal::from_str("100").unwrap(),
        Decimal::from_str("100").unwrap(),
        Decimal::from_str("100").unwrap(),
        None,
    )
    .await
    .unwrap();

    // Verify data exists
    assert!(db.get_portfolio(portfolio_id).await.unwrap().is_some());
    assert!(!db.list_folios_by_portfolio(portfolio_id).is_empty());

    // 4. Delete profile via DELETE /api/family/profiles/{profile_id}
    let del_req = Request::builder()
        .uri(format!("/api/family/profiles/{profile_id}"))
        .method("DELETE")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let del_res = app.clone().oneshot(del_req).await.unwrap();
    assert_eq!(del_res.status(), StatusCode::OK);
    let del_json = parse_json(del_res.into_body()).await;
    assert_eq!(del_json["status"], "success");
    assert_eq!(del_json["id"], profile_id.to_string());

    // 5. Verify cascading deletion integrity
    // Portfolio is deleted
    assert!(db.get_portfolio(portfolio_id).await.unwrap().is_none());
    // Folios under portfolio are deleted
    assert!(db.list_folios_by_portfolio(portfolio_id).is_empty());
    // Transactions under folios are deleted
    assert!(db.list_by_folio(folio.id).await.unwrap().is_empty());

    // 6. Deleting again returns 404 Not Found
    let del_again_req = Request::builder()
        .uri(format!("/api/family/profiles/{profile_id}"))
        .method("DELETE")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let del_again_res = app.oneshot(del_again_req).await.unwrap();
    assert_eq!(del_again_res.status(), StatusCode::NOT_FOUND);
    let not_found_json = parse_json(del_again_res.into_body()).await;
    assert_eq!(not_found_json["code"], "PROFILE_NOT_FOUND");
}

#[tokio::test]
async fn test_root_health_check_returns_ok() {
    let (app, _, _) = setup_test_app();

    let request = Request::builder()
        .uri("/health")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let response = app.oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let json = parse_json(response.into_body()).await;
    assert_eq!(json["status"], "ok");
}

#[tokio::test]
async fn test_tax_harvesting_opportunities_endpoint() {
    let (app, db, jwt_secret) = setup_test_app();

    let user = db.create_user("harvest.tester@example.com", "pwd");
    let token = portfolio_api::create_jwt(user.id, &user.email, &jwt_secret).unwrap();

    let portfolio = db
        .create_portfolio(user.id, "Harvest Portfolio", None)
        .await
        .unwrap();

    let asset = db.create_asset(
        "MUTUAL_FUND",
        "Axis Bluechip Equity Fund",
        Some("INF846K01164"),
        None,
        None,
        None,
    );

    let folio = db
        .create_folio(portfolio.id, asset.id, "FOLIO-HARVEST", None, None)
        .unwrap();

    // Buy 100 units 400 days ago (long term) @ 100 = 10,000
    let buy_date = Utc::now().date_naive() - Duration::days(400);
    db.create_transaction(
        folio.id,
        buy_date,
        "PURCHASE",
        Decimal::from_str("10000").unwrap(),
        Decimal::from_str("100").unwrap(),
        Decimal::from_str("100").unwrap(),
        Decimal::from_str("100").unwrap(),
        None,
    )
    .await
    .unwrap();

    // Latest NAV is 150 (gain = 50 * 100 = 5,000)
    db.create_transaction(
        folio.id,
        Utc::now().date_naive() - Duration::days(1),
        "PURCHASE",
        Decimal::from_str("150").unwrap(),
        Decimal::from_str("1").unwrap(),
        Decimal::from_str("150").unwrap(),
        Decimal::from_str("101").unwrap(),
        None,
    )
    .await
    .unwrap();

    let req = Request::builder()
        .uri("/api/tax/harvesting")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let json = parse_json(res.into_body()).await;

    assert!(json["remainingExemption"].is_string() || json["remainingExemption"].is_number());
    assert!(json["opportunities"].is_array());
}

#[tokio::test]
async fn test_portfolio_summary_not_found_returns_404() {
    let (app, db, jwt_secret) = setup_test_app();

    let user = db.create_user("notfound.tester@example.com", "pwd");
    let token = portfolio_api::create_jwt(user.id, &user.email, &jwt_secret).unwrap();

    let random_id = Uuid::new_v4();
    let req = Request::builder()
        .uri(format!("/api/portfolio/{random_id}/summary"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
    let json = parse_json(res.into_body()).await;
    assert_eq!(json["code"], "PORTFOLIO_NOT_FOUND");
}

#[tokio::test]
async fn test_portfolio_summary_forbidden_for_other_user() {
    let (app, db, jwt_secret) = setup_test_app();

    // User A owns the portfolio
    let user_a = db.create_user("owner.user@example.com", "pwd");
    let portfolio = db
        .create_portfolio(user_a.id, "Owner Portfolio", None)
        .await
        .unwrap();

    // User B attempts to access User A's portfolio summary
    let user_b = db.create_user("attacker.user@example.com", "pwd");
    let token_b = portfolio_api::create_jwt(user_b.id, &user_b.email, &jwt_secret).unwrap();

    let req = Request::builder()
        .uri(format!("/api/portfolio/{}/summary", portfolio.id))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token_b}"))
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
    let json = parse_json(res.into_body()).await;
    assert_eq!(json["code"], "AUTH_FORBIDDEN");
    assert_eq!(json["error"], "Forbidden");
}

#[tokio::test]
async fn test_tax_simulate_sell_forbidden_for_other_user() {
    let (app, db, jwt_secret) = setup_test_app();

    // User A owns the portfolio and folio
    let user_a = db.create_user("tax.owner@example.com", "pwd");
    let portfolio = db
        .create_portfolio(user_a.id, "Owner Tax Portfolio", None)
        .await
        .unwrap();
    let asset = db.create_asset("MUTUAL_FUND", "Some Fund", None, None, None, None);
    let folio = db
        .create_folio(portfolio.id, asset.id, "FOLIO-A", None, None)
        .unwrap();

    // User B attempts to simulate sell User A's folio
    let user_b = db.create_user("tax.other@example.com", "pwd");
    let token_b = portfolio_api::create_jwt(user_b.id, &user_b.email, &jwt_secret).unwrap();

    let sim_payload = json!({
        "folioId": folio.id,
        "units": "50",
        "currentPrice": "100"
    });
    let sim_req = Request::builder()
        .uri("/api/tax/simulate-sell")
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token_b}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(sim_payload.to_string()))
        .unwrap();

    let sim_res = app.oneshot(sim_req).await.unwrap();
    assert_eq!(sim_res.status(), StatusCode::FORBIDDEN);
    let sim_json = parse_json(sim_res.into_body()).await;
    assert_eq!(sim_json["code"], "AUTH_FORBIDDEN");
    assert_eq!(sim_json["error"], "Forbidden");
}

#[tokio::test]
async fn test_route_aliases_harvesting_opportunities_and_delete_profile() {
    let (app, db, jwt_secret) = setup_test_app();

    let user = db.create_user("alias.tester@example.com", "pwd");
    let token = portfolio_api::create_jwt(user.id, &user.email, &jwt_secret).unwrap();

    // 1. Verify GET /api/tax/harvesting-opportunities (alias of /harvesting)
    let harvest_req = Request::builder()
        .uri("/api/tax/harvesting-opportunities")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let harvest_res = app.clone().oneshot(harvest_req).await.unwrap();
    assert_eq!(harvest_res.status(), StatusCode::OK);
    let harvest_json = parse_json(harvest_res.into_body()).await;
    assert!(harvest_json["opportunities"].is_array());

    // 2. Verify DELETE /api/family/profile/{id} (singular alias of /profiles/{id})
    let profile = db
        .create_managed_profile(
            user.id,
            "Singular Member",
            "XYZPA1234F",
            Decimal::from_str("0.30").unwrap(),
        )
        .await
        .unwrap();

    let del_req = Request::builder()
        .uri(format!("/api/family/profile/{}", profile.id))
        .method("DELETE")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let del_res = app.oneshot(del_req).await.unwrap();
    assert_eq!(del_res.status(), StatusCode::OK);
    let del_json = parse_json(del_res.into_body()).await;
    assert_eq!(del_json["status"], "success");
    assert_eq!(del_json["id"], profile.id.to_string());
}

#[tokio::test]
async fn test_jwt_claims_id_alias_support() {
    let (app, db, jwt_secret) = setup_test_app();

    let user = db.create_user("jwt.alias@example.com", "pwd");

    // Mint a token with "id" instead of "sub" in the payload
    let now = Utc::now().timestamp() as usize;
    let custom_claims = json!({
        "id": user.id.to_string(),
        "email": user.email,
        "iat": now,
        "exp": now + 3600,
    });
    let token = jsonwebtoken::encode(
        &jsonwebtoken::Header::default(),
        &custom_claims,
        &jsonwebtoken::EncodingKey::from_secret(jwt_secret.as_bytes()),
    )
    .unwrap();

    // Verify /api/auth/me accepts this token and resolves user
    let me_req = Request::builder()
        .uri("/api/auth/me")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let me_res = app.oneshot(me_req).await.unwrap();
    assert_eq!(me_res.status(), StatusCode::OK);
    let me_json = parse_json(me_res.into_body()).await;
    assert_eq!(me_json["email"], "jwt.alias@example.com");
    assert_eq!(me_json["id"], user.id.to_string());
}

#[tokio::test]
async fn test_duplicate_pan_profile_creation_rejected() {
    let (app, db, jwt_secret) = setup_test_app();

    let user = db.create_user("pan.test@example.com", "pwd");
    let token = portfolio_api::create_jwt(user.id, &user.email, &jwt_secret).unwrap();

    let payload = json!({
        "name": "Member One",
        "pan": "ABCDE1234F"
    });

    let req1 = Request::builder()
        .uri("/api/family/profiles")
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let res1 = app.clone().oneshot(req1).await.unwrap();
    assert_eq!(res1.status(), StatusCode::CREATED);

    // Same PAN for same user must be rejected
    let req2 = Request::builder()
        .uri("/api/family/profiles")
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let res2 = app.oneshot(req2).await.unwrap();
    assert_eq!(res2.status(), StatusCode::BAD_REQUEST);
    let json2 = parse_json(res2.into_body()).await;
    assert_eq!(json2["code"], "CONSTRAINT_VIOLATION");
}

#[tokio::test]
async fn test_cas_upload_and_status_polling_contract() {
    let (app, db, jwt_secret) = setup_test_app();

    let user = db.create_user("upload.contract@example.com", "pwd");
    let token = portfolio_api::create_jwt(user.id, &user.email, &jwt_secret).unwrap();

    // 1. Multipart POST to /api/portfolio/upload
    let boundary = "------------------------boundary123";
    let body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"password\"\r\n\r\nPASS123\r\n\
        --{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"statement.pdf\"\r\n\
        Content-Type: application/pdf\r\n\r\n%PDF-1.4 dummy\r\n--{boundary}--\r\n"
    );

    let req = Request::builder()
        .method("POST")
        .uri("/api/portfolio/upload")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(
            header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={boundary}"),
        )
        .body(Body::from(body))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::ACCEPTED);
    let json = parse_json(res.into_body()).await;
    let job_id = json["jobId"]
        .as_str()
        .expect("jobId must be present in response");
    assert_eq!(
        json["message"],
        "PDF upload accepted and processing has started."
    );

    // 2. Poll status: GET /api/portfolio/upload-status/{jobId}
    let status_req = Request::builder()
        .method("GET")
        .uri(format!("/api/portfolio/upload-status/{job_id}"))
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let status_res = app.clone().oneshot(status_req).await.unwrap();
    assert_eq!(status_res.status(), StatusCode::OK);
    let status_json = parse_json(status_res.into_body()).await;
    assert_eq!(status_json["status"], "PENDING");
    assert_eq!(status_json["id"], job_id);
    assert_eq!(status_json["userId"], user.id.to_string());

    // 3. Unauthorized access from another user returns 404 NOT_FOUND
    let user_b = db.create_user("other.user@example.com", "pwd");
    let token_b = portfolio_api::create_jwt(user_b.id, &user_b.email, &jwt_secret).unwrap();
    let unauth_req = Request::builder()
        .method("GET")
        .uri(format!("/api/portfolio/upload-status/{job_id}"))
        .header(header::AUTHORIZATION, format!("Bearer {token_b}"))
        .body(Body::empty())
        .unwrap();

    let unauth_res = app.clone().oneshot(unauth_req).await.unwrap();
    assert_eq!(unauth_res.status(), StatusCode::NOT_FOUND);
    let unauth_json = parse_json(unauth_res.into_body()).await;
    assert_eq!(unauth_json["code"], "NOT_FOUND");
    assert_eq!(unauth_json["error"], "Job not found");

    // 4. Missing file upload returns 400 VALIDATION_FAILED
    let empty_boundary = "------------------------emptyboundary";
    let empty_body = format!(
        "--{empty_boundary}\r\nContent-Disposition: form-data; name=\"password\"\r\n\r\nPASS123\r\n\
        --{empty_boundary}--\r\n"
    );

    let empty_req = Request::builder()
        .method("POST")
        .uri("/api/portfolio/upload")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(
            header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={empty_boundary}"),
        )
        .body(Body::from(empty_body))
        .unwrap();

    let empty_res = app.oneshot(empty_req).await.unwrap();
    assert_eq!(empty_res.status(), StatusCode::BAD_REQUEST);
    let empty_json = parse_json(empty_res.into_body()).await;
    assert_eq!(empty_json["code"], "VALIDATION_FAILED");
    assert_eq!(empty_json["error"], "No file uploaded");
}

#[tokio::test]
async fn test_portfolio_summary_and_health_endpoints_contract() {
    let (app, db, _jwt_secret) = setup_test_app();

    // 1. Register user & get token
    let reg_payload = json!({
        "email": "summary_test@example.com",
        "password": "SecurePassword123!"
    });
    let reg_req = Request::builder()
        .uri("/api/auth/register")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(reg_payload.to_string()))
        .unwrap();

    let reg_res = app.clone().oneshot(reg_req).await.unwrap();
    assert_eq!(reg_res.status(), StatusCode::CREATED);
    let reg_json = parse_json(reg_res.into_body()).await;
    let token = reg_json["token"].as_str().unwrap().to_string();
    let user_id = Uuid::parse_str(reg_json["id"].as_str().unwrap()).unwrap();

    // Create user portfolio
    let portfolio = db
        .create_portfolio(user_id, "Main Portfolio", None)
        .await
        .unwrap();
    let port_id = portfolio.id.to_string();

    // Active equity asset
    let asset_eq = db.create_asset(
        "MUTUAL_FUND",
        "Parag Parikh Flexi Cap Fund",
        Some("INF879O01019"),
        Some("122639"),
        Some("PPFAS_EQUITY"),
        None,
    );
    let folio_eq = db
        .create_folio(
            portfolio.id,
            asset_eq.id,
            "12345678",
            Some("PPFAS"),
            Some("ABCDE1234F"),
        )
        .unwrap();
    db.create_transaction(
        folio_eq.id,
        chrono::NaiveDate::from_ymd_opt(2023, 1, 15).unwrap(),
        "PURCHASE",
        Decimal::from(10000),
        Decimal::from(100),
        Decimal::from(100),
        Decimal::from(100),
        None,
    )
    .await
    .unwrap();

    // Closed liquid asset (fully redeemed: balance = 0)
    let asset_liq = db.create_asset(
        "MUTUAL_FUND",
        "Axis Liquid Fund - Growth",
        Some("INF846K01CX4"),
        Some("112090"),
        Some("AXIS_LIQUID"),
        None,
    );
    let folio_liq = db
        .create_folio(
            portfolio.id,
            asset_liq.id,
            "87654321",
            Some("AXIS"),
            Some("ABCDE1234F"),
        )
        .unwrap();
    db.create_transaction(
        folio_liq.id,
        chrono::NaiveDate::from_ymd_opt(2023, 2, 1).unwrap(),
        "PURCHASE",
        Decimal::from(50000),
        Decimal::from(50),
        Decimal::from(1000),
        Decimal::from(50),
        None,
    )
    .await
    .unwrap();
    db.create_transaction(
        folio_liq.id,
        chrono::NaiveDate::from_ymd_opt(2023, 6, 1).unwrap(),
        "REDEMPTION",
        Decimal::from(-55000),
        Decimal::from(-50),
        Decimal::from(1100),
        Decimal::ZERO,
        None,
    )
    .await
    .unwrap();

    // 2. Call GET /api/portfolio/summary. Assert 200 OK and JSON has metrics, active folios, closedFolios.
    let sum_req = Request::builder()
        .uri("/api/portfolio/summary")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let sum_res = app.clone().oneshot(sum_req).await.unwrap();
    assert_eq!(sum_res.status(), StatusCode::OK);
    let sum_json = parse_json(sum_res.into_body()).await;
    assert!(sum_json.get("metrics").is_some());
    assert!(sum_json["metrics"]["totalInvested"].is_number());
    assert!(sum_json["metrics"]["totalValue"].is_number());
    assert!(sum_json["metrics"]["xirr"].is_number());

    // Assert active folio isolation
    let folios = sum_json["folios"].as_array().expect("folios must be array");
    assert_eq!(folios.len(), 1, "Should have exactly 1 active folio");
    assert_eq!(folios[0]["units"], 100.0);
    assert_eq!(folios[0]["metrics"]["currentValue"], 10000.0);

    // Assert closed folio clean zeroing
    let closed = sum_json["closedFolios"]
        .as_array()
        .expect("closedFolios must be array");
    assert_eq!(closed.len(), 1, "Should have exactly 1 closed folio");
    assert_eq!(closed[0]["units"], 0.0, "Closed folio must show 0.0 units");
    assert_eq!(
        closed[0]["metrics"]["currentValue"], 0.0,
        "Closed folio currentValue must be 0.0"
    );
    assert_eq!(
        closed[0]["metrics"]["investedAmount"], 0.0,
        "Closed folio investedAmount must be 0.0"
    );
    assert_eq!(
        closed[0]["metrics"]["totalGain"], 0.0,
        "Closed folio totalGain must be 0.0"
    );

    // 3. Call GET /api/portfolio/summary?profileId=some-id. Assert 200 OK.
    let prof_sum_req = Request::builder()
        .uri("/api/portfolio/summary?profileId=some-id")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let prof_sum_res = app.clone().oneshot(prof_sum_req).await.unwrap();
    assert_eq!(prof_sum_res.status(), StatusCode::OK);

    // 4. Call GET /api/portfolio/{port_id}/xray. Assert 200 OK with assetAllocation.
    let xray_req = Request::builder()
        .uri(format!("/api/portfolio/{port_id}/xray"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let xray_res = app.clone().oneshot(xray_req).await.unwrap();
    assert_eq!(xray_res.status(), StatusCode::OK);
    let xray_json = parse_json(xray_res.into_body()).await;
    assert!(xray_json.get("assetAllocation").is_some());
    assert!(xray_json["assetAllocation"]["equity"]["percentage"].is_number());

    // 5. Call GET /api/portfolio/{port_id}/exposures. Assert 200 OK with non-empty stock exposures.
    let exp_req = Request::builder()
        .uri(format!("/api/portfolio/{port_id}/exposures"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let exp_res = app.clone().oneshot(exp_req).await.unwrap();
    assert_eq!(exp_res.status(), StatusCode::OK);
    let exp_json = parse_json(exp_res.into_body()).await;
    let exposures = exp_json
        .as_array()
        .expect("exposures response must be an array");
    assert!(
        !exposures.is_empty(),
        "Active equity folio must produce identified stock exposures"
    );
    for exp in exposures {
        assert!(exp["name"].is_string());
        assert!(exp["sector"].is_string());
        assert!(exp["percentage"].is_number());
        assert!(exp["percentage"].as_f64().unwrap() > 0.0);
        assert!(exp["absoluteValue"].is_number());
        assert!(exp["absoluteValue"].as_f64().unwrap() > 0.0);
        assert!(exp["contributions"].is_array());
    }

    // 6. Call GET /api/portfolio/{port_id}/tax-summary. Assert 200 OK with realized details containing sellDate.
    let tax_req = Request::builder()
        .uri(format!("/api/portfolio/{port_id}/tax-summary"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let tax_res = app.clone().oneshot(tax_req).await.unwrap();
    assert_eq!(tax_res.status(), StatusCode::OK);
    let tax_json = parse_json(tax_res.into_body()).await;
    assert!(tax_json.get("realized").is_some());
    assert!(tax_json.get("unrealized").is_some());
    let details = tax_json["realized"]["details"]
        .as_array()
        .expect("realized.details must be array");
    assert!(
        !details.is_empty(),
        "Redeemed liquid folio must produce realized tax trade lots"
    );
    let detail0 = &details[0];
    assert_eq!(detail0["sellDate"], "2023-06-01");
    assert_eq!(detail0["buyDate"], "2023-02-01");
    assert_eq!(detail0["units"], 50.0);
    assert_eq!(detail0["grossConsideration"], 55000.0);
    assert_eq!(detail0["costOfAcquisition"], 50000.0);
    assert_eq!(detail0["gain"], 5000.0);
    assert!(detail0["taxType"].is_string());

    // 7. Call GET /api/portfolio/{port_id}/history. Assert 200 OK with array.
    let hist_req = Request::builder()
        .uri(format!("/api/portfolio/{port_id}/history"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let hist_res = app.clone().oneshot(hist_req).await.unwrap();
    assert_eq!(hist_res.status(), StatusCode::OK);
    let hist_json = parse_json(hist_res.into_body()).await;
    assert!(hist_json.is_array());

    // 8. Call GET /api/portfolio/{port_id}/stats. Assert 200 OK with ath and maxInvested.
    let stats_req = Request::builder()
        .uri(format!("/api/portfolio/{port_id}/stats"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let stats_res = app.clone().oneshot(stats_req).await.unwrap();
    assert_eq!(stats_res.status(), StatusCode::OK);
    let stats_json = parse_json(stats_res.into_body()).await;
    assert!(stats_json.get("ath").is_some());
    assert!(stats_json["ath"]["value"].is_number());
    assert!(stats_json.get("maxInvested").is_some());
    assert!(stats_json["maxInvested"]["value"].is_number());
    assert!(stats_json.get("yearly").is_some());
    assert!(stats_json["yearly"].is_array());

    // 9. Call POST /api/portfolio/manual-asset with { "type": "FIXED_DEPOSIT", "name": "FD 1", "units": "10000" }. Assert 200 OK.
    let asset_payload = json!({
        "type": "FIXED_DEPOSIT",
        "name": "FD 1",
        "units": "10000"
    });
    let asset_req = Request::builder()
        .uri("/api/portfolio/manual-asset")
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(asset_payload.to_string()))
        .unwrap();

    let asset_res = app.clone().oneshot(asset_req).await.unwrap();
    assert_eq!(asset_res.status(), StatusCode::OK);
    let asset_json = parse_json(asset_res.into_body()).await;
    assert_eq!(asset_json["status"], "success");
    assert!(asset_json.get("assetId").is_some());

    // 10. Call DELETE /api/portfolio/purge. Assert 200 OK with status success.
    let purge_req = Request::builder()
        .uri("/api/portfolio/purge")
        .method("DELETE")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let purge_res = app.clone().oneshot(purge_req).await.unwrap();
    assert_eq!(purge_res.status(), StatusCode::OK);
    let purge_json = parse_json(purge_res.into_body()).await;
    assert_eq!(purge_json["status"], "success");

    // 11. Call GET /api/health/{port_id}/insights. Assert 200 OK and non-empty smart insights.
    let insights_req = Request::builder()
        .uri(format!("/api/health/{port_id}/insights"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let insights_res = app.clone().oneshot(insights_req).await.unwrap();
    assert_eq!(insights_res.status(), StatusCode::OK);
    let insights_json = parse_json(insights_res.into_body()).await;
    let insights_arr = insights_json
        .as_array()
        .expect("insights response must be an array");
    assert!(
        !insights_arr.is_empty(),
        "Portfolio health endpoint must return smart insights"
    );
    for ins in insights_arr {
        assert!(ins["type"].is_string());
        assert!(ins["severity"].is_string());
        assert!(ins["message"].is_string());
        assert!(ins["recommendation"].is_string());
    }

    // 12. Call GET /api/health/test-id/goals. Assert 200 OK and array response.
    let goals_req = Request::builder()
        .uri("/api/health/test-id/goals")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let goals_res = app.clone().oneshot(goals_req).await.unwrap();
    assert_eq!(goals_res.status(), StatusCode::OK);
    let goals_json = parse_json(goals_res.into_body()).await;
    assert!(goals_json.is_array());

    // 13. Call POST /api/health/test-id/goals with string targetAmount. Assert 200 OK.
    let goal_create_req = Request::builder()
        .uri("/api/health/test-id/goals")
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "name": "Retirement Fund",
                "targetAmount": "500000"
            })
            .to_string(),
        ))
        .unwrap();

    let goal_create_res = app.clone().oneshot(goal_create_req).await.unwrap();
    assert_eq!(goal_create_res.status(), StatusCode::OK);
    let goal_create_json = parse_json(goal_create_res.into_body()).await;
    let goal_id = goal_create_json["id"].as_str().unwrap();

    // 14. Call PUT /api/health/test-id/goals/{goalId} with string targetAmount. Assert 200 OK.
    let goal_update_req = Request::builder()
        .uri(format!("/api/health/test-id/goals/{goal_id}"))
        .method("PUT")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({
                "name": "Updated Retirement Fund",
                "targetAmount": "600000"
            })
            .to_string(),
        ))
        .unwrap();

    let goal_update_res = app.clone().oneshot(goal_update_req).await.unwrap();
    assert_eq!(goal_update_res.status(), StatusCode::OK);

    // 15. Call DELETE /api/health/test-id/goals/{goalId}. Assert 200 OK.
    let goal_del_req = Request::builder()
        .uri(format!("/api/health/test-id/goals/{goal_id}"))
        .method("DELETE")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let goal_del_res = app.oneshot(goal_del_req).await.unwrap();
    assert_eq!(goal_del_res.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_resolve_holdings_differentiated_categories() {
    let (_, us_holdings) = resolve_holdings("US001", "ICICI Prudential NASDAQ 100 Index Fund");
    assert!(
        us_holdings
            .iter()
            .any(|h| h.name == "Apple Inc." || h.name == "Microsoft Corp.")
    );
    assert!(!us_holdings.iter().any(|h| h.name == "HDFC Bank Ltd."));

    let (_, next50_holdings) = resolve_holdings("NEXT50", "UTI Nifty Next 50 Index Fund");
    assert!(
        next50_holdings
            .iter()
            .any(|h| h.name == "Bharat Electronics Ltd." || h.name == "Trent Ltd.")
    );
    assert!(!next50_holdings.iter().any(|h| h.name == "HDFC Bank Ltd."));

    let (_, arb_holdings) = resolve_holdings("ARB01", "Edelweiss Arbitrage Fund");
    let (_, nifty_holdings) = resolve_holdings("NIFTY01", "UTI Nifty 50 Index Fund");
    // Weights must not be identical 9.0% across all funds
    let arb_hdfc = arb_holdings.iter().find(|h| h.name.contains("HDFC Bank"));
    let nifty_hdfc = nifty_holdings.iter().find(|h| h.name.contains("HDFC Bank"));
    if let (Some(a), Some(n)) = (arb_hdfc, nifty_hdfc) {
        assert_ne!(a.weight, n.weight);
    }

    // Mirae Asset large cap vs US equity ETF discrimination
    let (mirae_lc_name, mirae_lc_holdings) =
        resolve_holdings("INF769K01DP4", "Mirae Asset Large Cap Fund");
    assert_eq!(mirae_lc_name, "Mirae Asset Large Cap Fund");
    assert!(mirae_lc_holdings.iter().any(|h| h.name == "HDFC Bank Ltd."));

    let (mirae_us_name, mirae_us_holdings) =
        resolve_holdings("MIRAE_FANG", "Mirae Asset NYSE FANG+ ETF Fund of Fund");
    assert_ne!(mirae_us_name, "Mirae Asset Large Cap Fund");
    assert!(mirae_us_holdings.iter().any(|h| h.name == "Apple Inc."));
    assert!(!mirae_us_holdings.iter().any(|h| h.name == "HDFC Bank Ltd."));

    // Sector mapping assertions
    assert_eq!(
        get_stock_sector("Tata Consultancy Services Ltd."),
        "Technology"
    );
    assert_eq!(get_stock_sector("TCS Ltd."), "Technology");
    assert_eq!(get_stock_sector("REC Ltd."), "Financial Services");
    assert_eq!(get_stock_sector("REC Limited"), "Financial Services");
    // Direct/recovery should NOT falsely match "rec"
    assert_ne!(
        get_stock_sector("Direct Marketing Ltd."),
        "Financial Services"
    );

    // Distinct US index funds test: NASDAQ 100 vs S&P 500 vs Total Stock Market
    let (_, nasdaq_holdings) = resolve_holdings(
        "US_NAS",
        "ICICI Prudential NASDAQ 100 Index Fund - Direct Plan - Growth",
    );
    let (_, sp500_holdings) = resolve_holdings(
        "US_SP500",
        "Motilal Oswal S and P 500 Index Fund - Direct Plan Growth (Non Demat)",
    );
    let (_, tsm_holdings) = resolve_holdings(
        "US_TSM",
        "Navi Total Stock Market US Specific Equity Passive Fund of Fund - Direct Plan - Growth",
    );

    // Berkshire Hathaway must NOT be in NASDAQ 100, but present in S&P 500 and Total Stock Market
    assert!(!nasdaq_holdings.iter().any(|h| h.name.contains("Berkshire")));
    assert!(sp500_holdings.iter().any(|h| h.name.contains("Berkshire")));
    assert!(tsm_holdings.iter().any(|h| h.name.contains("Berkshire")));

    // Tesla must have distinct percentages across all three
    let nasdaq_tsla = nasdaq_holdings
        .iter()
        .find(|h| h.name == "Tesla Inc.")
        .map(|h| h.weight)
        .unwrap();
    let sp500_tsla = sp500_holdings
        .iter()
        .find(|h| h.name == "Tesla Inc.")
        .map(|h| h.weight)
        .unwrap();
    let tsm_tsla = tsm_holdings
        .iter()
        .find(|h| h.name == "Tesla Inc.")
        .map(|h| h.weight)
        .unwrap();
    assert_ne!(
        nasdaq_tsla, sp500_tsla,
        "Tesla weight must differ between NASDAQ 100 and S&P 500"
    );
    assert_ne!(
        sp500_tsla, tsm_tsla,
        "Tesla weight must differ between S&P 500 and Total Stock Market"
    );
    assert_ne!(
        nasdaq_tsla, tsm_tsla,
        "Tesla weight must differ between NASDAQ 100 and Total Stock Market"
    );

    // Berkshire Hathaway must have distinct percentages between S&P 500 and Total Stock Market
    let sp500_brk = sp500_holdings
        .iter()
        .find(|h| h.name.contains("Berkshire"))
        .map(|h| h.weight)
        .unwrap();
    let tsm_brk = tsm_holdings
        .iter()
        .find(|h| h.name.contains("Berkshire"))
        .map(|h| h.weight)
        .unwrap();
    assert_ne!(
        sp500_brk, tsm_brk,
        "Berkshire Hathaway weight must differ between S&P 500 and Total Stock Market"
    );

    // Distinct Arbitrage Funds: Edelweiss vs Invesco vs Parag Parikh
    let (_, edel_holdings) = resolve_holdings(
        "ARB_EDEL",
        "Edelweiss Arbitrage Fund - Direct Plan Growth (Non Demat)",
    );
    let (_, inv_holdings) = resolve_holdings(
        "ARB_INV",
        "Invesco India Arbitrage Fund - Direct Plan Growth (Non Demat)",
    );
    let (_, pp_arb_holdings) =
        resolve_holdings("ARB_PP", "Parag Parikh Arbitrage Fund - Direct Plan Growth");
    let (_, pp_flexi_holdings) = resolve_holdings(
        "INF879O01018",
        "Parag Parikh Flexi Cap Fund - Direct Plan Growth",
    );

    let edel_hdfc = edel_holdings
        .iter()
        .find(|h| h.name.contains("HDFC Bank"))
        .map(|h| h.weight)
        .unwrap();
    let inv_hdfc = inv_holdings
        .iter()
        .find(|h| h.name.contains("HDFC Bank"))
        .map(|h| h.weight)
        .unwrap();
    let pp_arb_hdfc = pp_arb_holdings
        .iter()
        .find(|h| h.name.contains("HDFC Bank"))
        .map(|h| h.weight)
        .unwrap();
    let pp_flexi_hdfc = pp_flexi_holdings
        .iter()
        .find(|h| h.name.contains("HDFC Bank"))
        .map(|h| h.weight)
        .unwrap();

    assert_ne!(
        edel_hdfc, inv_hdfc,
        "HDFC Bank weight must differ between Edelweiss and Invesco Arbitrage"
    );
    assert_ne!(
        edel_hdfc, pp_arb_hdfc,
        "HDFC Bank weight must differ between Edelweiss and Parag Parikh Arbitrage"
    );
    assert_ne!(
        inv_hdfc, pp_arb_hdfc,
        "HDFC Bank weight must differ between Invesco and Parag Parikh Arbitrage"
    );
    assert_ne!(
        pp_arb_hdfc, pp_flexi_hdfc,
        "HDFC Bank weight must differ between Parag Parikh Arbitrage and Flexi Cap"
    );
}

#[tokio::test]
async fn test_exposures_exclude_arbitrage_query_param() {
    let db = std::sync::Arc::new(portfolio_db::InMemoryDatabase::new());
    let state = AppState::new(db.clone(), "test-jwt-secret");
    let app = create_app(state);

    // Register user
    let reg_payload = serde_json::json!({
        "email": "arbitrage_test@example.com",
        "name": "Arbitrage Tester",
        "password": "SecurePassword123!"
    });
    let reg_req = Request::builder()
        .uri("/api/auth/register")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(reg_payload.to_string()))
        .unwrap();

    let reg_res = app.clone().oneshot(reg_req).await.unwrap();
    assert_eq!(reg_res.status(), StatusCode::CREATED);
    let reg_json = parse_json(reg_res.into_body()).await;
    let token = reg_json["token"].as_str().unwrap().to_string();
    let user_id = Uuid::parse_str(reg_json["id"].as_str().unwrap()).unwrap();

    // Create user portfolio
    let portfolio = db
        .create_portfolio(user_id, "Arbitrage Test Portfolio", None)
        .await
        .unwrap();
    let port_id = portfolio.id.to_string();

    // 1. Active equity fund: Parag Parikh Flexi Cap Fund
    let asset_eq = db.create_asset(
        "MUTUAL_FUND",
        "Parag Parikh Flexi Cap Fund",
        Some("INF879O01019"),
        Some("122639"),
        Some("PPFAS_EQUITY"),
        None,
    );
    let folio_eq = db
        .create_folio(
            portfolio.id,
            asset_eq.id,
            "11112222",
            Some("PPFAS"),
            Some("ABCDE1234F"),
        )
        .unwrap();
    db.create_transaction(
        folio_eq.id,
        chrono::NaiveDate::from_ymd_opt(2023, 1, 15).unwrap(),
        "PURCHASE",
        Decimal::from(10000),
        Decimal::from(100),
        Decimal::from(100),
        Decimal::from(100),
        None,
    )
    .await
    .unwrap();

    // 2. Active arbitrage fund: Edelweiss Arbitrage Fund
    let asset_arb = db.create_asset(
        "MUTUAL_FUND",
        "Edelweiss Arbitrage Fund",
        Some("INF843K01017"),
        Some("131800"),
        Some("EDELWEISS_ARB"),
        None,
    );
    let folio_arb = db
        .create_folio(
            portfolio.id,
            asset_arb.id,
            "33334444",
            Some("EDELWEISS"),
            Some("ABCDE1234F"),
        )
        .unwrap();
    db.create_transaction(
        folio_arb.id,
        chrono::NaiveDate::from_ymd_opt(2023, 1, 15).unwrap(),
        "PURCHASE",
        Decimal::from(10000),
        Decimal::from(100),
        Decimal::from(100),
        Decimal::from(100),
        None,
    )
    .await
    .unwrap();

    // Case 1: excludeArbitrage=false (or omitted)
    let req_all = Request::builder()
        .uri(format!(
            "/api/portfolio/{port_id}/exposures?excludeArbitrage=false"
        ))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let res_all = app.clone().oneshot(req_all).await.unwrap();
    assert_eq!(res_all.status(), StatusCode::OK);
    let json_all = parse_json(res_all.into_body()).await;
    let exposures_all = json_all.as_array().unwrap();

    let has_tata_motors_all = exposures_all
        .iter()
        .any(|e| e["name"].as_str().unwrap_or("").contains("Tata Motors"));
    assert!(
        has_tata_motors_all,
        "Exposures without exclusion must include stocks from Arbitrage fund (e.g. Tata Motors Ltd.)"
    );

    // Case 2: excludeArbitrage=true
    let req_excluded = Request::builder()
        .uri(format!(
            "/api/portfolio/{port_id}/exposures?excludeArbitrage=true"
        ))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let res_excluded = app.clone().oneshot(req_excluded).await.unwrap();
    assert_eq!(res_excluded.status(), StatusCode::OK);
    let json_excluded = parse_json(res_excluded.into_body()).await;
    let exposures_excluded = json_excluded.as_array().unwrap();

    let has_tata_motors_excluded = exposures_excluded
        .iter()
        .any(|e| e["name"].as_str().unwrap_or("").contains("Tata Motors"));
    assert!(
        !has_tata_motors_excluded,
        "Exposures with excludeArbitrage=true must NOT include stocks solely from Arbitrage fund"
    );

    // Also check HDFC Bank contributions do not contain the Arbitrage fund
    let hdfc_excluded = exposures_excluded
        .iter()
        .find(|e| e["name"].as_str().unwrap_or("").contains("HDFC Bank"))
        .expect("HDFC Bank must be present from Parag Parikh");
    let contributions = hdfc_excluded["contributions"].as_array().unwrap();
    assert!(
        !contributions.iter().any(|c| c["schemeName"]
            .as_str()
            .unwrap_or("")
            .to_lowercase()
            .contains("arbitrage")),
        "Contributions must not contain Arbitrage fund when excluded"
    );

    // Case 3: snake_case exclude_arbitrage=true should also work
    let req_snake = Request::builder()
        .uri(format!(
            "/api/portfolio/{port_id}/exposures?exclude_arbitrage=true"
        ))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let res_snake = app.clone().oneshot(req_snake).await.unwrap();
    assert_eq!(res_snake.status(), StatusCode::OK);
    let json_snake = parse_json(res_snake.into_body()).await;
    let exposures_snake = json_snake.as_array().unwrap();
    let has_tata_motors_snake = exposures_snake
        .iter()
        .any(|e| e["name"].as_str().unwrap_or("").contains("Tata Motors"));
    assert!(
        !has_tata_motors_snake,
        "Exposures with exclude_arbitrage=true must NOT include stocks solely from Arbitrage fund"
    );
}

#[tokio::test]
async fn test_ingest_fund_holdings_success() {
    let (app, _, _) = setup_test_app();

    let payload = json!({
        "isin": "INF209K01157",
        "schemeName": "Aditya Birla Sun Life Frontline Equity Fund",
        "asOfDate": "2024-03-31",
        "holdings": [
            {
                "stockName": "HDFC Bank Ltd",
                "stockIsin": "INE040A01034",
                "sector": "Financial Services",
                "weight": "0.0925"
            },
            {
                "stockName": "Reliance Industries Ltd",
                "stockIsin": "INE002A01018",
                "sector": "Energy",
                "weight": "0.0810"
            }
        ]
    });

    let req = Request::builder()
        .uri("/api/fund-holdings/ingest")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let json = parse_json(res.into_body()).await;
    assert_eq!(json["isin"], "INF209K01157");
    assert_eq!(json["count"], 2);
    assert_eq!(json["asOfDate"], "2024-03-31");
    assert_eq!(json["status"], "success");
}

#[tokio::test]
async fn test_ingest_fund_holdings_validation_failure() {
    let (app, _, _) = setup_test_app();

    // Empty ISIN
    let empty_isin_payload = json!({
        "isin": "",
        "schemeName": "Test Fund",
        "asOfDate": "2024-03-31",
        "holdings": [
            {
                "stockName": "HDFC Bank Ltd",
                "weight": "0.05"
            }
        ]
    });

    let req1 = Request::builder()
        .uri("/api/fund-holdings/ingest")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(empty_isin_payload.to_string()))
        .unwrap();

    let res1 = app.clone().oneshot(req1).await.unwrap();
    assert_eq!(res1.status(), StatusCode::BAD_REQUEST);

    // Empty holdings array
    let empty_holdings_payload = json!({
        "isin": "INF209K01157",
        "schemeName": "Test Fund",
        "asOfDate": "2024-03-31",
        "holdings": []
    });

    let req2 = Request::builder()
        .uri("/api/fund-holdings/ingest")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(empty_holdings_payload.to_string()))
        .unwrap();

    let res2 = app.clone().oneshot(req2).await.unwrap();
    assert_eq!(res2.status(), StatusCode::BAD_REQUEST);

    // Zero weight
    let zero_weight_payload = json!({
        "isin": "INF209K01157",
        "schemeName": "Test Fund",
        "asOfDate": "2024-03-31",
        "holdings": [
            {
                "stockName": "HDFC Bank Ltd",
                "weight": "0.0"
            }
        ]
    });

    let req3 = Request::builder()
        .uri("/api/fund-holdings/ingest")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(zero_weight_payload.to_string()))
        .unwrap();

    let res3 = app.clone().oneshot(req3).await.unwrap();
    assert_eq!(res3.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_get_fund_holdings_by_isin() {
    let (app, _, _) = setup_test_app();

    let payload = json!({
        "isin": "INF209K01157",
        "schemeName": "Aditya Birla Sun Life Frontline Equity Fund",
        "asOfDate": "2024-03-31",
        "holdings": [
            {
                "stockName": "HDFC Bank Ltd",
                "stockIsin": "INE040A01034",
                "sector": "Financial Services",
                "weight": "0.0925"
            },
            {
                "stockName": "Reliance Industries Ltd",
                "stockIsin": "INE002A01018",
                "sector": "Energy",
                "weight": "0.0810"
            }
        ]
    });

    let ingest_req = Request::builder()
        .uri("/api/fund-holdings/ingest")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(payload.to_string()))
        .unwrap();

    let ingest_res = app.clone().oneshot(ingest_req).await.unwrap();
    assert_eq!(ingest_res.status(), StatusCode::OK);

    let get_req = Request::builder()
        .uri("/api/fund-holdings/INF209K01157")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let get_res = app.oneshot(get_req).await.unwrap();
    assert_eq!(get_res.status(), StatusCode::OK);

    let holdings = parse_json(get_res.into_body()).await;
    let list = holdings.as_array().expect("expected array of holdings");
    assert_eq!(list.len(), 2);
    assert_eq!(list[0]["stockName"], "HDFC Bank Ltd");
    assert_eq!(list[0]["stockIsin"], "INE040A01034");
    assert_eq!(list[0]["sector"], "Financial Services");
    assert!((list[0]["weight"].as_f64().unwrap() - 0.0925).abs() < 1e-6);

    assert_eq!(list[1]["stockName"], "Reliance Industries Ltd");
    assert_eq!(list[1]["stockIsin"], "INE002A01018");
    assert_eq!(list[1]["sector"], "Energy");
    assert!((list[1]["weight"].as_f64().unwrap() - 0.0810).abs() < 1e-6);
}

#[tokio::test]
async fn test_get_fund_holdings_empty_when_not_found() {
    let (app, _, _) = setup_test_app();

    let req = Request::builder()
        .uri("/api/fund-holdings/INF999999999")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let json = parse_json(res.into_body()).await;
    let list = json.as_array().expect("expected array");
    assert!(list.is_empty());
}

#[tokio::test]
async fn test_dynamic_exposure_uses_db_holdings_when_available() {
    let (app, db, _) = setup_test_app();

    // Register user
    let reg_payload = serde_json::json!({
        "email": "dynamic_exposure_test@example.com",
        "name": "Dynamic Exposure Tester",
        "password": "SecurePassword123!"
    });
    let reg_req = Request::builder()
        .uri("/api/auth/register")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(reg_payload.to_string()))
        .unwrap();

    let reg_res = app.clone().oneshot(reg_req).await.unwrap();
    assert_eq!(reg_res.status(), StatusCode::CREATED);
    let reg_json = parse_json(reg_res.into_body()).await;
    let token = reg_json["token"].as_str().unwrap().to_string();
    let user_id = Uuid::parse_str(reg_json["id"].as_str().unwrap()).unwrap();

    // Create user portfolio
    let portfolio = db
        .create_portfolio(user_id, "Dynamic Exposure Portfolio", None)
        .await
        .unwrap();
    let port_id = portfolio.id.to_string();

    // 1. Folio with ISIN INF209K01157 (100,000 INR)
    let asset_sbi = db.create_asset(
        "MUTUAL_FUND",
        "SBI Large Cap Fund",
        Some("INF209K01157"),
        Some("119598"),
        Some("SBI_LC"),
        None,
    );
    let folio_sbi = db
        .create_folio(
            portfolio.id,
            asset_sbi.id,
            "10001000",
            Some("SBI_MF"),
            Some("ABCDE1234F"),
        )
        .unwrap();
    db.create_transaction(
        folio_sbi.id,
        chrono::NaiveDate::from_ymd_opt(2023, 1, 15).unwrap(),
        "PURCHASE",
        Decimal::from(100000),
        Decimal::from(1000),
        Decimal::from(100),
        Decimal::from(1000),
        None,
    )
    .await
    .unwrap();

    // 2. Un-ingested fund folio: UTI Nifty 50 Index Fund (50,000 INR)
    let asset_uti = db.create_asset(
        "MUTUAL_FUND",
        "UTI Nifty 50 Index Fund",
        Some("INF789F01058"),
        Some("120716"),
        Some("UTI_NIFTY50"),
        None,
    );
    let folio_uti = db
        .create_folio(
            portfolio.id,
            asset_uti.id,
            "20002000",
            Some("UTI_MF"),
            Some("ABCDE1234F"),
        )
        .unwrap();
    db.create_transaction(
        folio_uti.id,
        chrono::NaiveDate::from_ymd_opt(2023, 1, 15).unwrap(),
        "PURCHASE",
        Decimal::from(50000),
        Decimal::from(500),
        Decimal::from(100),
        Decimal::from(500),
        None,
    )
    .await
    .unwrap();

    // Step A: Prior to disclosure ingestion, GET /api/portfolio/{id}/exposures resolves via resolve_holdings heuristic.
    let get_exp_req_before = Request::builder()
        .uri(format!("/api/portfolio/{port_id}/exposures"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let get_exp_res_before = app.clone().oneshot(get_exp_req_before).await.unwrap();
    assert_eq!(get_exp_res_before.status(), StatusCode::OK);
    let exp_before = parse_json(get_exp_res_before.into_body()).await;
    let list_before = exp_before.as_array().expect("expected array");

    // "Synthetic Cloud Technologies Ltd." must NOT be present before ingestion
    assert!(
        !list_before.iter().any(|e| e["name"]
            .as_str()
            .unwrap_or("")
            .contains("Synthetic Cloud Technologies")),
        "Synthetic stock should not exist prior to ingestion"
    );
    // UTI Nifty 50 resolved via heuristic should contain common large cap stocks (e.g. Reliance or HDFC)
    assert!(
        list_before.iter().any(|e| e["name"]
            .as_str()
            .unwrap_or("")
            .contains("Reliance Industries")),
        "Heuristic exposures must contain fallback holdings"
    );

    // Step B: Ingest disclosure for INF209K01157 with custom synthetic stock
    let ingest_payload = json!({
        "isin": "INF209K01157",
        "schemeName": "SBI Large Cap Fund",
        "asOfDate": "2024-03-31",
        "holdings": [
            {
                "stockName": "Synthetic Cloud Technologies Ltd.",
                "stockIsin": "INE999X01099",
                "sector": "Technology",
                "weight": "15.0"
            },
            {
                "stockName": "Synthetic Green Power Ltd.",
                "stockIsin": "INE888Y01088",
                "sector": "Energy",
                "weight": "10.0"
            }
        ]
    });
    let ingest_req = Request::builder()
        .uri("/api/fund-holdings/ingest")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(ingest_payload.to_string()))
        .unwrap();
    let ingest_res = app.clone().oneshot(ingest_req).await.unwrap();
    assert_eq!(ingest_res.status(), StatusCode::OK);

    // Step C: After ingestion, GET /api/portfolio/{id}/exposures dynamically resolves "Synthetic Cloud Technologies Ltd."
    let get_exp_req_after = Request::builder()
        .uri(format!("/api/portfolio/{port_id}/exposures"))
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let get_exp_res_after = app.clone().oneshot(get_exp_req_after).await.unwrap();
    assert_eq!(get_exp_res_after.status(), StatusCode::OK);
    let exp_after = parse_json(get_exp_res_after.into_body()).await;
    let list_after = exp_after.as_array().expect("expected array");

    let cloud_tech = list_after
        .iter()
        .find(|e| {
            e["name"]
                .as_str()
                .unwrap_or("")
                .contains("Synthetic Cloud Technologies")
        })
        .expect("Synthetic Cloud Technologies Ltd. must be present in dynamic exposures");

    assert_eq!(cloud_tech["name"], "Synthetic Cloud Technologies Ltd.");
    assert_eq!(cloud_tech["sector"], "Technology");
    // Folio val = 100,000 INR; weight = 15.0% -> absolute_value = 15,000.0
    let abs_val = cloud_tech["absoluteValue"].as_f64().unwrap();
    assert!(
        (abs_val - 15000.0).abs() < 1e-2,
        "Expected absoluteValue ~15000.0, got {abs_val}"
    );

    // Check contributions
    let contribs = cloud_tech["contributions"].as_array().unwrap();
    assert_eq!(contribs.len(), 1);
    assert_eq!(contribs[0]["schemeName"], "SBI Large Cap Fund");
    assert!((contribs[0]["weight"].as_f64().unwrap() - 15.0).abs() < 1e-4);
    assert!((contribs[0]["value"].as_f64().unwrap() - 15000.0).abs() < 1e-2);

    // Step D: Un-ingested fund (UTI Nifty 50) continues to resolve seamlessly via resolve_holdings heuristic!
    let uti_stock = list_after.iter().find(|e| {
        e["contributions"]
            .as_array()
            .map(|c| {
                c.iter()
                    .any(|item| item["schemeName"].as_str().unwrap_or("").contains("UTI"))
            })
            .unwrap_or(false)
    });
    assert!(
        uti_stock.is_some(),
        "Un-ingested fund (UTI Nifty 50) must continue resolving via resolve_holdings fallback"
    );
}

#[tokio::test]
async fn test_portfolio_summary_reality_check_metrics_and_query_validation() {
    let (app, db, _) = setup_test_app();

    // 1. Register and login
    let reg_payload = json!({
        "email": "reality.check@example.com",
        "password": "SecurePassword123!"
    });
    let reg_req = Request::builder()
        .uri("/api/auth/register")
        .method("POST")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(reg_payload.to_string()))
        .unwrap();
    let reg_res = app.clone().oneshot(reg_req).await.unwrap();
    let reg_json = parse_json(reg_res.into_body()).await;
    let token = reg_json["token"].as_str().unwrap().to_string();
    let user_id = Uuid::parse_str(reg_json["id"].as_str().unwrap()).unwrap();

    // 2. Insert portfolio, asset, folio, transactions
    let port = db
        .create_portfolio(user_id, "Reality Check Portfolio", None)
        .await
        .unwrap();
    let asset = db.create_asset(
        "MUTUAL_FUND",
        "Nifty 50 Index Fund",
        Some("INF000000001"),
        None,
        None,
        None,
    );
    let folio = db
        .create_folio(
            port.id,
            asset.id,
            "FOLIO-REALITY-01",
            Some("HDFC AMC"),
            None,
        )
        .unwrap();

    let d1 = Utc::now().date_naive() - Duration::days(400);
    let d2 = Utc::now().date_naive() - Duration::days(100);
    db.create_transaction(
        folio.id,
        d1,
        "PURCHASE",
        Decimal::from(10000),
        Decimal::from(100),
        Decimal::from(100),
        Decimal::from(100),
        None,
    )
    .await
    .unwrap();
    db.create_transaction(
        folio.id,
        d2,
        "PURCHASE",
        Decimal::from(6000),
        Decimal::from(50),
        Decimal::from(120),
        Decimal::from(150),
        None,
    )
    .await
    .unwrap();

    // 3. Test validation error for negative cpiInflationRate
    let bad_cpi_req = Request::builder()
        .uri("/api/portfolio/summary?cpiInflationRate=-0.05")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let bad_cpi_res = app.clone().oneshot(bad_cpi_req).await.unwrap();
    assert_eq!(bad_cpi_res.status(), StatusCode::BAD_REQUEST);
    let bad_cpi_json = parse_json(bad_cpi_res.into_body()).await;
    assert_eq!(bad_cpi_json["code"], "INVALID_INFLATION_RATE");
    assert!(bad_cpi_json.get("details").is_some());
    assert_eq!(bad_cpi_json["details"]["recovery"], "fix_and_retry");
    assert_eq!(bad_cpi_json["details"]["sideEffects"], "none");

    // 4. Test validation error for marginalTaxBracket > 0.50
    let bad_tax_req = Request::builder()
        .uri("/api/portfolio/summary?marginalTaxBracket=0.75")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let bad_tax_res = app.clone().oneshot(bad_tax_req).await.unwrap();
    assert_eq!(bad_tax_res.status(), StatusCode::BAD_REQUEST);
    let bad_tax_json = parse_json(bad_tax_res.into_body()).await;
    assert_eq!(bad_tax_json["code"], "INVALID_TAX_BRACKET");
    assert!(bad_tax_json.get("details").is_some());

    // 5. Test valid request with camelCase parameters
    let valid_req = Request::builder()
        .uri("/api/portfolio/summary?cpiInflationRate=0.06&marginalTaxBracket=0.30")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let valid_res = app.clone().oneshot(valid_req).await.unwrap();
    assert_eq!(valid_res.status(), StatusCode::OK);
    let valid_json = parse_json(valid_res.into_body()).await;
    let metrics = &valid_json["metrics"];
    assert!(metrics["totalInvested"].is_number());
    assert!(metrics["totalValue"].is_number());
    assert!(metrics["postTaxTotalValue"].is_number());
    assert!(metrics.get("realPostTaxXirr").is_some());
    assert!(metrics.get("drags").is_some());

    let drags = &metrics["drags"];
    assert!(drags["debtDrag"].is_number());
    assert!(drags["equityDrag"].is_number());
    assert!(drags["cessAndOtherDrag"].is_number());
    assert!(drags["inflationDrag"].is_number());

    // 6. Test backward-compatible Serde alias parameters
    let alias_req = Request::builder()
        .uri("/api/portfolio/summary?cpi_inflation_rate=0.06&tax_slab=0.30")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let alias_res = app.clone().oneshot(alias_req).await.unwrap();
    assert_eq!(alias_res.status(), StatusCode::OK);

    // 7. Test Tax Harvesting Endpoint returns typed HarvestTicketResponse
    let harvest_req = Request::builder()
        .uri("/api/tax/harvesting")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();
    let harvest_res = app.clone().oneshot(harvest_req).await.unwrap();
    assert_eq!(harvest_res.status(), StatusCode::OK);
    let harvest_json = parse_json(harvest_res.into_body()).await;
    assert!(harvest_json["realizedLtcgFy"].is_number());
    assert!(harvest_json["remainingExemption"].is_number());
    assert!(harvest_json["totalPotentialHarvest"].is_number());
    assert!(harvest_json["estimatedTaxSavings"].is_number());
    assert!(harvest_json["opportunities"].is_array());
    assert!(harvest_json["unrealizedSummary"].is_object());
    assert!(harvest_json["unrealizedSummary"]["lots"].is_array());
}

#[tokio::test]
async fn test_security_master_and_market_cap_resolution() {
    // Large caps
    assert_eq!(get_stock_market_cap("Reliance Industries Limited"), "large");
    assert_eq!(get_stock_market_cap("HDFC Bank Ltd."), "large");
    assert_eq!(get_stock_market_cap("TCS"), "large");

    // Mid caps
    assert_eq!(
        get_stock_market_cap("The Indian Hotels Company Limited"),
        "mid"
    );
    assert_eq!(get_stock_market_cap("Cummins India Limited"), "mid");
    assert_eq!(get_stock_market_cap("Federal Bank Limited"), "mid");

    // Small caps
    assert_eq!(get_stock_market_cap("Sonata Software Limited"), "small");
    assert_eq!(get_stock_market_cap("CEAT Limited"), "small");

    // Unmapped / foreign / other
    assert_eq!(
        get_stock_market_cap("Some Random Unknown Startup Co."),
        "other"
    );
    assert_eq!(get_stock_sector("Some Random Unknown Startup Co."), "Other");
}

#[tokio::test]
async fn test_stock_metadata_api_ingestion_and_query() {
    let (app, db, jwt_secret) = setup_test_app();
    let user = db.get_user_by_email("test@example.com").unwrap();
    let token = portfolio_api::create_jwt(user.id, &user.email, &jwt_secret).unwrap();

    // Ingest dynamic stock metadata
    let payload = json!({
        "stocks": [
            {
                "isin": "INE123XYZ01",
                "symbol": "DYNAMICSTOCK",
                "name": "Dynamic Stock Ingested Ltd",
                "sector": "Industrials",
                "marketCapTier": "small",
                "marketCapRank": 450,
                "marketCapCr": 1200.0,
                "asOfDate": "2026-06-30"
            }
        ]
    });

    let ingest_req = Request::builder()
        .uri("/api/stock-metadata")
        .method("POST")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
        .unwrap();

    let ingest_res = app.clone().oneshot(ingest_req).await.unwrap();
    assert_eq!(ingest_res.status(), StatusCode::OK);
    let ingest_json = parse_json(ingest_res.into_body()).await;
    assert_eq!(ingest_json["count"], 1);
    assert_eq!(ingest_json["status"], "ok");

    // Query ingested metadata by ISIN
    let get_req = Request::builder()
        .uri("/api/stock-metadata/INE123XYZ01")
        .method("GET")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let get_res = app.clone().oneshot(get_req).await.unwrap();
    assert_eq!(get_res.status(), StatusCode::OK);
    let get_json = parse_json(get_res.into_body()).await;
    assert_eq!(get_json["symbol"], "DYNAMICSTOCK");
    assert_eq!(get_json["marketCapTier"], "small");
}
