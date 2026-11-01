//! Database error definitions for portfolio database operations.

use thiserror::Error;
use uuid::Uuid;

/// Enumeration of all database and repository error conditions.
#[derive(Debug, Error)]
pub enum DbError {
    /// Low-level SQLx database execution error (connection failures, syntax errors, pool timeouts).
    #[error("Database error: {0}")]
    Sqlx(#[from] sqlx::Error),

    /// Generic entity not found error with descriptive message.
    #[error("Entity not found: {0}")]
    NotFound(String),

    /// A specified user was not found by UUID.
    #[error("User not found: {0}")]
    UserNotFound(Uuid),

    /// A specified managed profile was not found by UUID.
    #[error("Profile not found: {0}")]
    ProfileNotFound(Uuid),

    /// A specified portfolio was not found by UUID.
    #[error("Portfolio not found: {0}")]
    PortfolioNotFound(Uuid),

    /// A specified folio was not found by UUID.
    #[error("Folio not found: {0}")]
    FolioNotFound(Uuid),

    /// A specified asset was not found by UUID.
    #[error("Asset not found: {0}")]
    AssetNotFound(Uuid),

    /// A specified transaction was not found by UUID.
    #[error("Transaction not found: {0}")]
    TransactionNotFound(Uuid),

    /// A specified statement upload job was not found by UUID.
    #[error("Upload job not found: {0}")]
    UploadJobNotFound(Uuid),

    /// A database constraint violation occurred (e.g. unique constraint or foreign key).
    #[error("Constraint violation: {0}")]
    ConstraintViolation(String),

    /// Domain calculation or validation error originating from `portfolio_core`.
    #[error("Core domain error: {0}")]
    CoreError(#[from] portfolio_core::error::PortfolioError),

    /// Internal error condition or malformed data representation.
    #[error("Internal error: {0}")]
    Internal(String),
}
