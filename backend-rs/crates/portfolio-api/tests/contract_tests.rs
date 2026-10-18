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

use portfolio_api::{AppState, create_app};
use portfolio_db::InMemoryDatabase;
use portfolio_db::repositories::{PortfolioRepository, TransactionRepository};

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
    assert_eq!(json["overlapPercentage"], "27.5");

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
    assert_eq!(sym_json["overlapPercentage"], "27.5");
}

#[tokio::test]
async fn test_tax_simulate_sell_blocks_locked_elss_units_with_400() {
    let (app, db, _) = setup_test_app();

    let user = db.create_user("investor.elss@example.com", "pwd");
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
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(reg_sim_payload.to_string()))
        .unwrap();

    let reg_sim_res = app.oneshot(reg_sim_req).await.unwrap();
    assert_eq!(reg_sim_res.status(), StatusCode::OK);
    let reg_sim_json = parse_json(reg_sim_res.into_body()).await;
    assert_eq!(reg_sim_json["unitsToSell"], "50");
    assert_eq!(reg_sim_json["estimatedValue"], "7500"); // 50 * 150 = 7500
    assert_eq!(reg_sim_json["totalGain"], "2500"); // 7500 - 5000 = 2500
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
    let (app, _, _) = setup_test_app();

    let random_id = Uuid::new_v4();
    let req = Request::builder()
        .uri(format!("/api/portfolio/{random_id}/summary"))
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
    let json = parse_json(res.into_body()).await;
    assert_eq!(json["code"], "PORTFOLIO_NOT_FOUND");
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
