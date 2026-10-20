//! Centralized API error handling and JSON error responses.

use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use portfolio_core::PortfolioError;
use portfolio_db::DbError;
use serde::{Deserialize, Serialize};

/// Structured JSON error payload returned across all API endpoints.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

/// Authentication and authorization errors.
#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Unauthorized")]
    MissingToken,

    #[error("Unauthorized")]
    InvalidToken,

    #[error("Invalid credentials")]
    InvalidCredentials,

    #[error("User already exists")]
    UserAlreadyExists,

    #[error("User not found")]
    UserNotFound,

    #[error("Password hashing failed: {0}")]
    Bcrypt(String),

    #[error("JWT error: {0}")]
    Jwt(String),
}

/// Centralized API errors covering domain logic, persistence, and auth.
#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("{0}")]
    Portfolio(#[from] PortfolioError),

    #[error("{0}")]
    Db(#[from] DbError),

    #[error("{0}")]
    Auth(#[from] AuthError),

    #[error("Cannot redeem locked ELSS units. Available: {available}, Locked: {locked}")]
    UnitsLocked {
        available: portfolio_core::types::Units,
        locked: portfolio_core::types::Units,
    },

    #[error("Bad request: {0}")]
    BadRequest(String),

    #[error("Validation failed: {0}")]
    ValidationFailed(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Forbidden")]
    Forbidden,

    #[error("Internal server error: {0}")]
    Internal(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_msg, code, details) = match self {
            ApiError::UnitsLocked { available, locked } => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Cannot redeem locked ELSS units. Available: {available}, Locked: {locked}"
                ),
                "UNITS_LOCKED".to_string(),
                Some(serde_json::json!({
                    "available": available.to_string(),
                    "locked": locked.to_string(),
                })),
            ),
            ApiError::Portfolio(PortfolioError::UnitsLocked { available, locked }) => (
                StatusCode::BAD_REQUEST,
                format!(
                    "Cannot redeem locked ELSS units. Available: {available}, Locked: {locked}"
                ),
                "UNITS_LOCKED".to_string(),
                Some(serde_json::json!({
                    "available": available.to_string(),
                    "locked": locked.to_string(),
                })),
            ),
            ApiError::Portfolio(PortfolioError::InsufficientUnits {
                available,
                requested,
            }) => (
                StatusCode::BAD_REQUEST,
                format!("Insufficient units. Available: {available}, Requested: {requested}"),
                "INSUFFICIENT_UNITS".to_string(),
                None,
            ),
            ApiError::Portfolio(e) => (
                StatusCode::BAD_REQUEST,
                e.to_string(),
                "PORTFOLIO_ERROR".to_string(),
                None,
            ),
            ApiError::Db(DbError::PortfolioNotFound(id)) => (
                StatusCode::NOT_FOUND,
                format!("Portfolio '{id}' not found"),
                "PORTFOLIO_NOT_FOUND".to_string(),
                None,
            ),
            ApiError::Db(DbError::ProfileNotFound(id)) => (
                StatusCode::NOT_FOUND,
                format!("Profile '{id}' not found"),
                "PROFILE_NOT_FOUND".to_string(),
                None,
            ),
            ApiError::Db(DbError::FolioNotFound(id)) => (
                StatusCode::NOT_FOUND,
                format!("Folio '{id}' not found"),
                "FOLIO_NOT_FOUND".to_string(),
                None,
            ),
            ApiError::Db(DbError::AssetNotFound(id)) => (
                StatusCode::NOT_FOUND,
                format!("Asset '{id}' not found"),
                "ASSET_NOT_FOUND".to_string(),
                None,
            ),
            ApiError::Db(DbError::ConstraintViolation(msg)) => (
                StatusCode::BAD_REQUEST,
                msg,
                "CONSTRAINT_VIOLATION".to_string(),
                None,
            ),
            ApiError::Db(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                e.to_string(),
                "DATABASE_ERROR".to_string(),
                None,
            ),
            ApiError::Auth(AuthError::MissingToken | AuthError::InvalidToken) => (
                StatusCode::UNAUTHORIZED,
                "Unauthorized".to_string(),
                "AUTH_UNAUTHORIZED".to_string(),
                None,
            ),
            ApiError::Auth(AuthError::InvalidCredentials) => (
                StatusCode::UNAUTHORIZED,
                "Invalid credentials".to_string(),
                "AUTH_INVALID_CREDENTIALS".to_string(),
                None,
            ),
            ApiError::Auth(AuthError::UserAlreadyExists) => (
                StatusCode::BAD_REQUEST,
                "User already exists".to_string(),
                "USER_ALREADY_EXISTS".to_string(),
                None,
            ),
            ApiError::Auth(AuthError::UserNotFound) => (
                StatusCode::NOT_FOUND,
                "User not found".to_string(),
                "USER_NOT_FOUND".to_string(),
                None,
            ),
            ApiError::Auth(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                e.to_string(),
                "AUTH_ERROR".to_string(),
                None,
            ),
            ApiError::BadRequest(msg) => (
                StatusCode::BAD_REQUEST,
                msg,
                "BAD_REQUEST".to_string(),
                None,
            ),
            ApiError::ValidationFailed(msg) => (
                StatusCode::BAD_REQUEST,
                msg,
                "VALIDATION_FAILED".to_string(),
                None,
            ),

            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg, "NOT_FOUND".to_string(), None),
            ApiError::Forbidden => (
                StatusCode::FORBIDDEN,
                "Forbidden".to_string(),
                "AUTH_FORBIDDEN".to_string(),
                None,
            ),
            ApiError::Internal(msg) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                msg,
                "INTERNAL_SERVER_ERROR".to_string(),
                None,
            ),
        };

        let body = Json(ErrorResponse {
            error: error_msg,
            code,
            details,
        });

        (status, body).into_response()
    }
}
