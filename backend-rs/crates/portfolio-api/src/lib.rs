//! HTTP REST API Gateway for Portfolio Tracker.
//!
//! Provides camelCase JSON endpoints with JWT authentication,
//! hermetic contract parity, and integration with `portfolio-core` and `portfolio-db`.

pub mod errors;
pub mod middleware;
pub mod routes;
pub mod services;
pub mod state;

pub use errors::{ApiError, AuthError, ErrorResponse};
pub use middleware::{AuthUser, Claims, create_jwt, hash_password, verify_jwt, verify_password};
pub use services::{InMemoryRateLimiter, NavSyncService};
pub use state::{AppState, DbBackend, create_app};
