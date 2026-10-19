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
    pub user: MeResponse,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

    if let Some(pool) = state.pool() {
        let existing =
            sqlx::query_scalar::<_, i64>(r#"SELECT count(*) FROM "User" WHERE email = $1"#)
                .bind(&email)
                .fetch_one(pool)
                .await
                .map_err(portfolio_db::error::DbError::from)?;

        if existing > 0 {
            return Err(ApiError::Auth(AuthError::UserAlreadyExists));
        }

        let id = Uuid::new_v4();
        let password_hash = hash_password(&payload.password)?;
        let now = chrono::Utc::now();

        sqlx::query(
            r#"
            INSERT INTO "User" (id, email, password, "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $4)
            "#,
        )
        .bind(id.to_string())
        .bind(&email)
        .bind(&password_hash)
        .bind(now)
        .execute(pool)
        .await
        .map_err(portfolio_db::error::DbError::from)?;

        let token = create_jwt(id, &email, &state.jwt_secret)?;

        Ok((
            StatusCode::CREATED,
            Json(AuthResponse {
                id,
                email: email.clone(),
                token,
                user: MeResponse { id, email },
            }),
        ))
    } else {
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
                email: user.email.clone(),
                token,
                user: MeResponse {
                    id: user.id,
                    email: user.email,
                },
            }),
        ))
    }
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

    if let Some(pool) = state.pool() {
        #[derive(sqlx::FromRow)]
        struct UserRow {
            id: String,
            email: String,
            password: String,
        }

        let user = sqlx::query_as::<_, UserRow>(
            r#"SELECT id, email, password FROM "User" WHERE email = $1"#,
        )
        .bind(&email)
        .fetch_optional(pool)
        .await
        .map_err(portfolio_db::error::DbError::from)?
        .ok_or(ApiError::Auth(AuthError::InvalidCredentials))?;

        let is_valid = if user.password.starts_with("$2") {
            verify_password(&payload.password, &user.password)?
        } else {
            user.password == payload.password
        };

        if !is_valid {
            return Err(ApiError::Auth(AuthError::InvalidCredentials));
        }

        let user_id = Uuid::parse_str(&user.id).unwrap_or_else(|_| Uuid::new_v4());
        let token = create_jwt(user_id, &user.email, &state.jwt_secret)?;

        Ok(Json(AuthResponse {
            id: user_id,
            email: user.email.clone(),
            token,
            user: MeResponse {
                id: user_id,
                email: user.email,
            },
        }))
    } else {
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
            email: user.email.clone(),
            token,
            user: MeResponse {
                id: user.id,
                email: user.email,
            },
        }))
    }
}

pub async fn me(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<MeResponse>, ApiError> {
    if let Some(pool) = state.pool() {
        #[derive(sqlx::FromRow)]
        struct UserRow {
            id: String,
            email: String,
        }

        if let Ok(Some(u)) =
            sqlx::query_as::<_, UserRow>(r#"SELECT id, email FROM "User" WHERE id = $1"#)
                .bind(auth_user.user_id.to_string())
                .fetch_optional(pool)
                .await
        {
            let id = Uuid::parse_str(&u.id).unwrap_or(auth_user.user_id);
            return Ok(Json(MeResponse { id, email: u.email }));
        }
    }

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
