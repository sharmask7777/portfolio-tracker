//! Database error definitions.

use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlx(#[from] sqlx::Error),

    #[error("Entity not found: {0}")]
    NotFound(String),

    #[error("User not found: {0}")]
    UserNotFound(Uuid),

    #[error("Profile not found: {0}")]
    ProfileNotFound(Uuid),

    #[error("Portfolio not found: {0}")]
    PortfolioNotFound(Uuid),

    #[error("Folio not found: {0}")]
    FolioNotFound(Uuid),

    #[error("Asset not found: {0}")]
    AssetNotFound(Uuid),

    #[error("Transaction not found: {0}")]
    TransactionNotFound(Uuid),

    #[error("Constraint violation: {0}")]
    ConstraintViolation(String),

    #[error("Core domain error: {0}")]
    CoreError(#[from] portfolio_core::error::PortfolioError),

    #[error("Internal error: {0}")]
    Internal(String),
}
