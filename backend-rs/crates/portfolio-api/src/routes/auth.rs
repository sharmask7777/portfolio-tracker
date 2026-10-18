//! Authentication routes: registration, login, and profile lookup.

use axum::extract::State;
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{ApiError, AuthError};
use crate::middleware::{AuthUser, create_jwt, hash_password, verify_password};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    pub id: Uuid,
    pub email: String,
    pub token: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeResponse {
    pub id: Uuid,
    pub email: String,
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(StatusCode, Json<AuthResponse>), ApiError> {
    let email = payload.email.trim().to_lowercase();
    if email.is_empty() || payload.password.is_empty() {
        return Err(ApiError::BadRequest(
            "Email and password are required".to_string(),
        ));
    }

    if state.db.get_user_by_email(&email).is_some() {
        return Err(ApiError::Auth(AuthError::UserAlreadyExists));
    }

    let password_hash = hash_password(&payload.password)?;
    let user = state.db.create_user(&email, &password_hash);
    let token = create_jwt(user.id, &user.email, &state.jwt_secret)?;

    Ok((
        StatusCode::CREATED,
        Json(AuthResponse {
            id: user.id,
            email: user.email,
            token,
        }),
    ))
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, ApiError> {
    let email = payload.email.trim().to_lowercase();
    if email.is_empty() || payload.password.is_empty() {
        return Err(ApiError::BadRequest(
            "Email and password are required".to_string(),
        ));
    }

    let user = state
        .db
        .get_user_by_email(&email)
        .ok_or(ApiError::Auth(AuthError::InvalidCredentials))?;

    let is_valid = verify_password(&payload.password, &user.password_hash)?;
    if !is_valid {
        return Err(ApiError::Auth(AuthError::InvalidCredentials));
    }

    let token = create_jwt(user.id, &user.email, &state.jwt_secret)?;

    Ok(Json(AuthResponse {
        id: user.id,
        email: user.email,
        token,
    }))
}

pub async fn me(auth_user: AuthUser) -> Result<Json<MeResponse>, ApiError> {
    Ok(Json(MeResponse {
        id: auth_user.user_id,
        email: auth_user.email,
    }))
}

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
        .route("/me", get(me))
}
