//! Application state and router assembly.

use std::sync::Arc;

use axum::Router;
use portfolio_db::InMemoryDatabase;
use tower_http::cors::CorsLayer;

use crate::routes::{auth, family, health, portfolio, tax};

/// Shared application state injected into Axum route handlers.
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<InMemoryDatabase>,
    pub jwt_secret: String,
}

impl AppState {
    pub fn new(db: Arc<InMemoryDatabase>, jwt_secret: impl Into<String>) -> Self {
        Self {
            db,
            jwt_secret: jwt_secret.into(),
        }
    }
}

/// Assembles the complete Axum REST API gateway with all routes, middleware, and state.
pub fn create_app(state: AppState) -> Router {
    Router::new()
        .nest("/api/health", health::routes())
        .nest("/health", health::routes())
        .nest("/api/auth", auth::routes())
        .nest("/api/portfolio", portfolio::routes())
        .nest("/api/tax", tax::routes())
        .nest("/api/family", family::routes())
        .layer(CorsLayer::permissive())
        .with_state(state)
}
