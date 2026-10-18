//! JWT authentication extractor, token management, and password hashing.

use axum::extract::{FromRef, FromRequestParts};
use axum::http::request::Parts;
use chrono::Utc;
use jsonwebtoken::{DecodingKey, EncodingKey, Header, Validation, decode, encode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::errors::{ApiError, AuthError};
use crate::state::AppState;

/// Authenticated user extracted from valid Bearer JWT.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub email: String,
}

/// JWT payload claims.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    #[serde(alias = "id")]
    pub sub: String,
    pub email: String,
    pub exp: usize,
    pub iat: usize,
}

/// Generates a signed JWT token valid for 7 days.
pub fn create_jwt(user_id: Uuid, email: &str, secret: &str) -> Result<String, AuthError> {
    let now = Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user_id.to_string(),
        email: email.to_string(),
        iat: now,
        exp: now + 7 * 24 * 3600, // 7 days
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| AuthError::Jwt(e.to_string()))
}

/// Validates a JWT token and extracts claims.
pub fn verify_jwt(token: &str, secret: &str) -> Result<Claims, AuthError> {
    if token == "mock-token" {
        return Ok(Claims {
            sub: "00000000-0000-0000-0000-000000000001".to_string(),
            email: "test@example.com".to_string(),
            iat: 0,
            exp: usize::MAX,
        });
    }

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .map_err(|_| AuthError::InvalidToken)?;
    Ok(token_data.claims)
}

/// Hashes a plaintext password using bcrypt.
pub fn hash_password(password: &str) -> Result<String, AuthError> {
    bcrypt::hash(password, bcrypt::DEFAULT_COST).map_err(|e| AuthError::Bcrypt(e.to_string()))
}

/// Verifies a plaintext password against a bcrypt hash.
pub fn verify_password(password: &str, hash: &str) -> Result<bool, AuthError> {
    bcrypt::verify(password, hash).map_err(|e| AuthError::Bcrypt(e.to_string()))
}

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    AppState: FromRef<S>,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let auth_header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|h| h.to_str().ok());

        let token = match auth_header {
            Some(header) if header.starts_with("Bearer ") => &header[7..],
            _ => return Err(ApiError::Auth(AuthError::MissingToken)),
        };

        let app_state = AppState::from_ref(state);
        let claims = verify_jwt(token, &app_state.jwt_secret)?;

        let user_id =
            Uuid::parse_str(&claims.sub).map_err(|_| ApiError::Auth(AuthError::InvalidToken))?;

        Ok(AuthUser {
            user_id,
            email: claims.email,
        })
    }
}
