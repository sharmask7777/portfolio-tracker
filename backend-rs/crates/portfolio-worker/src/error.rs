//! Worker error definitions for Portfolio Tracker background processing.

use portfolio_db::DbError;
use thiserror::Error;
use uuid::Uuid;

#[derive(Debug, Error)]
pub enum WorkerError {
    #[error("Upload file not found at path: {0}")]
    FileNotFound(String),

    #[error("Path validation error: {0}")]
    ValidationError(String),

    #[error("Failed to parse CAS statement: {0}")]
    ParseError(String),

    #[error("Database error: {0}")]
    Db(#[from] DbError),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Redis error: {0}")]
    Redis(String),

    #[error("Invalid AMFI code '{0}'. Must be a non-empty numeric code.")]
    InvalidAmfiCode(String),

    #[error("Portfolio not found: {0}")]
    PortfolioNotFound(Uuid),

    #[error("Upload job not found: {0}")]
    JobNotFound(Uuid),

    #[error("Internal worker error: {0}")]
    Internal(String),
}

impl From<redis::RedisError> for WorkerError {
    fn from(err: redis::RedisError) -> Self {
        WorkerError::Redis(err.to_string())
    }
}
