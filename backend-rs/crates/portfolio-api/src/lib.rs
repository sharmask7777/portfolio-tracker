//! HTTP REST API Gateway for Portfolio Tracker.
//!
//! Provides camelCase JSON endpoints with JWT authentication,
//! hermetic contract parity, and integration with `portfolio-core` and `portfolio-db`.

#![forbid(unsafe_code)]
#![allow(missing_docs)]

pub mod errors;
pub mod middleware;
pub mod routes;
pub mod services;
pub mod state;

pub use errors::{ApiError, AuthError, ErrorResponse};
pub use middleware::{AuthUser, Claims, create_jwt, hash_password, verify_jwt, verify_password};
pub use routes::portfolio::{
    fetch_latest_and_previous_nav, fetch_latest_nav, get_stock_sector, resolve_holdings,
    resolve_nav_and_previous_with_date_priority, resolve_nav_with_date_priority,
};
pub use services::{InMemoryRateLimiter, NavSyncService};
pub use state::{AppState, DbBackend, create_app};
