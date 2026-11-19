#![allow(
    missing_docs,
    clippy::unwrap_used,
    clippy::panic,
    clippy::undocumented_unsafe_blocks
)]

use std::sync::Arc;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use chrono::Utc;
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

use portfolio_api::{AppState, PairingSession, create_app};
use portfolio_db::InMemoryDatabase;

fn setup_test_app() -> (axum::Router, Arc<InMemoryDatabase>, AppState, String) {
    let db = Arc::new(InMemoryDatabase::new());
    let jwt_secret = "test_pairing_jwt_secret_123456789".to_string();
    let state = AppState::new(Arc::clone(&db), jwt_secret.clone());
    let app = create_app(state.clone());
    (app, db, state, jwt_secret)
}

async fn parse_json(body: Body) -> Value {
    let bytes = body
        .collect()
        .await
        .expect("body collection should succeed")
        .to_bytes();
    serde_json::from_slice(&bytes).expect("response body must be valid JSON")
}

async fn get_authenticated_token(app: &axum::Router) -> String {
    let register_payload = json!({
        "email": "pairing_user@example.com",
        "password": "Password123!"
    });

    let request = Request::builder()
        .uri("/api/auth/register")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&register_payload).unwrap()))
        .unwrap();

    let response = app.clone().oneshot(request).await.unwrap();
    assert_eq!(response.status(), StatusCode::CREATED);

    let json = parse_json(response.into_body()).await;
    json["token"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn test_pair_init_unauthorized_requires_jwt() {
    let (app, _, _, _) = setup_test_app();

    // 1. Without Authorization header on /api/v1/auth/pair/init
    let req_v1 = Request::builder()
        .uri("/api/v1/auth/pair/init")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::empty())
        .unwrap();

    let res_v1 = app.clone().oneshot(req_v1).await.unwrap();
    assert_eq!(res_v1.status(), StatusCode::UNAUTHORIZED);

    // 2. Without Authorization header on /api/auth/pair/init
    let req_legacy = Request::builder()
        .uri("/api/auth/pair/init")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::empty())
        .unwrap();

    let res_legacy = app.oneshot(req_legacy).await.unwrap();
    assert_eq!(res_legacy.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_pair_init_generates_secret_with_expiry() {
    let (app, _, _, _) = setup_test_app();
    let token = get_authenticated_token(&app).await;

    let req = Request::builder()
        .uri("/api/v1/auth/pair/init")
        .method("POST")
        .header("authorization", format!("Bearer {token}"))
        .header("content-type", "application/json")
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let json = parse_json(res.into_body()).await;
    let pairing_secret = json["pairingSecret"].as_str().unwrap();
    assert!(pairing_secret.starts_with("pair_"));
    assert!(pairing_secret.len() > 10);

    let expires_at_str = json["expiresAt"].as_str().unwrap();
    let expires_at = chrono::DateTime::parse_from_rfc3339(expires_at_str).unwrap();
    let now = Utc::now();
    assert!(expires_at > now);
    let diff_secs = (expires_at.with_timezone(&Utc) - now).num_seconds();
    // Expiration should be within 4 to 6 minutes (around 300 seconds)
    assert!((240..=360).contains(&diff_secs));
}

#[tokio::test]
async fn test_pair_claim_success_and_verifies_device_jwt() {
    let (app, _, _, _) = setup_test_app();
    let token = get_authenticated_token(&app).await;

    // 1. Initialize pairing secret
    let req_init = Request::builder()
        .uri("/api/v1/auth/pair/init")
        .method("POST")
        .header("authorization", format!("Bearer {token}"))
        .header("content-type", "application/json")
        .body(Body::empty())
        .unwrap();

    let res_init = app.clone().oneshot(req_init).await.unwrap();
    assert_eq!(res_init.status(), StatusCode::OK);
    let init_json = parse_json(res_init.into_body()).await;
    let pairing_secret = init_json["pairingSecret"].as_str().unwrap();

    // 2. Claim secret from mobile app
    let claim_payload = json!({
        "pairingSecret": pairing_secret,
        "deviceName": "iPhone 15 Pro"
    });

    let req_claim = Request::builder()
        .uri("/api/v1/auth/pair/claim")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&claim_payload).unwrap()))
        .unwrap();

    let res_claim = app.clone().oneshot(req_claim).await.unwrap();
    assert_eq!(res_claim.status(), StatusCode::OK);

    let claim_json = parse_json(res_claim.into_body()).await;
    let device_token = claim_json["token"].as_str().unwrap();
    assert_ne!(device_token, "");
    assert_eq!(claim_json["user"]["email"], "pairing_user@example.com");
    assert!(claim_json["user"]["id"].is_string());

    // 3. Verify the device JWT can access protected routes (/api/auth/me)
    let req_me = Request::builder()
        .uri("/api/auth/me")
        .method("GET")
        .header("authorization", format!("Bearer {device_token}"))
        .body(Body::empty())
        .unwrap();

    let res_me = app.oneshot(req_me).await.unwrap();
    assert_eq!(res_me.status(), StatusCode::OK);
    let me_json = parse_json(res_me.into_body()).await;
    assert_eq!(me_json["email"], "pairing_user@example.com");
}

#[tokio::test]
async fn test_pair_claim_single_use_enforcement() {
    let (app, _, _, _) = setup_test_app();
    let token = get_authenticated_token(&app).await;

    // 1. Initialize pairing secret
    let req_init = Request::builder()
        .uri("/api/v1/auth/pair/init")
        .method("POST")
        .header("authorization", format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let res_init = app.clone().oneshot(req_init).await.unwrap();
    assert_eq!(res_init.status(), StatusCode::OK);
    let init_json = parse_json(res_init.into_body()).await;
    let pairing_secret = init_json["pairingSecret"].as_str().unwrap();

    let claim_payload = json!({
        "pairingSecret": pairing_secret,
        "deviceName": "Google Pixel 8"
    });

    // 2. First claim: succeeds
    let req_claim1 = Request::builder()
        .uri("/api/v1/auth/pair/claim")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&claim_payload).unwrap()))
        .unwrap();

    let res_claim1 = app.clone().oneshot(req_claim1).await.unwrap();
    assert_eq!(res_claim1.status(), StatusCode::OK);

    // 3. Second claim with same secret: must fail (single-use redemption)
    let req_claim2 = Request::builder()
        .uri("/api/v1/auth/pair/claim")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&claim_payload).unwrap()))
        .unwrap();

    let res_claim2 = app.oneshot(req_claim2).await.unwrap();
    assert_eq!(res_claim2.status(), StatusCode::UNAUTHORIZED);

    let err_json = parse_json(res_claim2.into_body()).await;
    assert_eq!(err_json["code"], "AUTH_INVALID_PAIRING_SECRET");
}

#[tokio::test]
async fn test_pair_claim_invalid_secret_returns_unauthorized() {
    let (app, _, _, _) = setup_test_app();

    let claim_payload = json!({
        "pairingSecret": "pair_non_existent_secret_12345",
        "deviceName": "iPad Pro"
    });

    let req = Request::builder()
        .uri("/api/v1/auth/pair/claim")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&claim_payload).unwrap()))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    let err_json = parse_json(res.into_body()).await;
    assert_eq!(err_json["code"], "AUTH_INVALID_PAIRING_SECRET");
}

#[tokio::test]
async fn test_pair_claim_expired_secret_returns_unauthorized() {
    let (app, _, state, _) = setup_test_app();
    let _token = get_authenticated_token(&app).await;

    // Create a user and manually insert an expired pairing session
    let expired_secret = "pair_expired_test_secret_99999".to_string();
    let expired_session = PairingSession {
        user_id: uuid::Uuid::new_v4(),
        email: "pairing_user@example.com".to_string(),
        expires_at: Utc::now() - chrono::Duration::seconds(30), // Expired 30 seconds ago
    };

    state
        .pairing_sessions
        .write()
        .await
        .insert(expired_secret.clone(), expired_session);

    let claim_payload = json!({
        "pairingSecret": expired_secret,
        "deviceName": "MacBook Test Runner"
    });

    let req = Request::builder()
        .uri("/api/v1/auth/pair/claim")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&claim_payload).unwrap()))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);

    let err_json = parse_json(res.into_body()).await;
    assert!(
        err_json["code"] == "AUTH_PAIRING_SECRET_EXPIRED"
            || err_json["code"] == "AUTH_INVALID_PAIRING_SECRET"
    );
}

#[tokio::test]
async fn test_pair_claim_validation_bad_request() {
    let (app, _, _, _) = setup_test_app();

    // 1. Empty pairing secret
    let empty_secret_payload = json!({
        "pairingSecret": "",
        "deviceName": "Test Device"
    });

    let req1 = Request::builder()
        .uri("/api/v1/auth/pair/claim")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&empty_secret_payload).unwrap(),
        ))
        .unwrap();

    let res1 = app.clone().oneshot(req1).await.unwrap();
    assert_eq!(res1.status(), StatusCode::BAD_REQUEST);

    // 2. Empty device name
    let empty_device_payload = json!({
        "pairingSecret": "pair_valid_looking_secret",
        "deviceName": "   "
    });

    let req2 = Request::builder()
        .uri("/api/v1/auth/pair/claim")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(
            serde_json::to_vec(&empty_device_payload).unwrap(),
        ))
        .unwrap();

    let res2 = app.oneshot(req2).await.unwrap();
    assert_eq!(res2.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_legacy_and_v1_pairing_path_parity() {
    let (app, _, _, _) = setup_test_app();
    let token = get_authenticated_token(&app).await;

    // Call /api/auth/pair/init (legacy unversioned prefix)
    let req_init = Request::builder()
        .uri("/api/auth/pair/init")
        .method("POST")
        .header("authorization", format!("Bearer {token}"))
        .body(Body::empty())
        .unwrap();

    let res_init = app.clone().oneshot(req_init).await.unwrap();
    assert_eq!(res_init.status(), StatusCode::OK);
    let init_json = parse_json(res_init.into_body()).await;
    let secret = init_json["pairingSecret"].as_str().unwrap();

    // Claim via /api/auth/pair/claim (legacy unversioned prefix)
    let claim_payload = json!({
        "pairingSecret": secret,
        "deviceName": "Legacy Test Device"
    });

    let req_claim = Request::builder()
        .uri("/api/auth/pair/claim")
        .method("POST")
        .header("content-type", "application/json")
        .body(Body::from(serde_json::to_vec(&claim_payload).unwrap()))
        .unwrap();

    let res_claim = app.oneshot(req_claim).await.unwrap();
    assert_eq!(res_claim.status(), StatusCode::OK);
    let claim_json = parse_json(res_claim.into_body()).await;
    assert_eq!(claim_json["user"]["email"], "pairing_user@example.com");
}
