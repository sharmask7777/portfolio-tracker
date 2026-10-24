//! Application state and router assembly.

use std::collections::HashSet;
use std::sync::Arc;

use axum::Router;
use portfolio_db::InMemoryDatabase;
use tokio::sync::RwLock;
use tower_http::cors::CorsLayer;

use crate::routes::{auth, family, health, portfolio, tax};

/// Database backend variant powering the API service (in-memory or live PostgreSQL).
#[derive(Clone, Debug)]
pub enum DbBackend {
    InMemory(Arc<InMemoryDatabase>),
    Postgres(sqlx::PgPool),
}

/// Shared application state injected into Axum route handlers.
#[derive(Clone)]
pub struct AppState {
    pub backend: DbBackend,
    pub db: Arc<InMemoryDatabase>,
    pub jwt_secret: String,
    pub redis: Option<redis::Client>,
    pub nav_rate_limiter: Arc<RwLock<HashSet<(String, chrono::NaiveDate)>>>,
}

impl AppState {
    /// Constructs state with an in-memory database mock (default for unit and contract testing).
    pub fn new(db: Arc<InMemoryDatabase>, jwt_secret: impl Into<String>) -> Self {
        Self {
            backend: DbBackend::InMemory(Arc::clone(&db)),
            db,
            jwt_secret: jwt_secret.into(),
            redis: None,
            nav_rate_limiter: Arc::new(RwLock::new(HashSet::new())),
        }
    }

    /// Constructs state with an explicit database backend (in-memory or live PostgreSQL).
    pub fn with_backend(backend: DbBackend, jwt_secret: impl Into<String>) -> Self {
        let db = match &backend {
            DbBackend::InMemory(mem) => Arc::clone(mem),
            DbBackend::Postgres(_) => Arc::new(InMemoryDatabase::new()),
        };
        Self {
            backend,
            db,
            jwt_secret: jwt_secret.into(),
            redis: None,
            nav_rate_limiter: Arc::new(RwLock::new(HashSet::new())),
        }
    }

    /// Constructs state backed by a live PostgreSQL connection pool.
    pub fn with_postgres(pool: sqlx::PgPool, jwt_secret: impl Into<String>) -> Self {
        Self::with_backend(DbBackend::Postgres(pool), jwt_secret)
    }

    /// Attaches an optional Redis client.
    pub fn with_redis(mut self, redis: Option<redis::Client>) -> Self {
        self.redis = redis;
        self
    }

    /// Attaches an explicit in-memory rate limiter set (useful for hermetic tests).
    pub fn with_nav_rate_limiter(
        mut self,
        limiter: Arc<RwLock<HashSet<(String, chrono::NaiveDate)>>>,
    ) -> Self {
        self.nav_rate_limiter = limiter;
        self
    }

    /// Returns a reference to the in-memory database mock (or fallback instance).
    pub fn db(&self) -> Arc<InMemoryDatabase> {
        Arc::clone(&self.db)
    }

    /// Returns a clone of the in-memory NAV rate limiter shared set.
    pub fn nav_rate_limiter(&self) -> Arc<RwLock<HashSet<(String, chrono::NaiveDate)>>> {
        Arc::clone(&self.nav_rate_limiter)
    }

    /// Returns an optional reference to the live PostgreSQL connection pool if configured.
    pub fn pool(&self) -> Option<&sqlx::PgPool> {
        match &self.backend {
            DbBackend::Postgres(pool) => Some(pool),
            DbBackend::InMemory(_) => None,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_in_memory_backend() {
        let db = Arc::new(InMemoryDatabase::new());
        let state = AppState::new(Arc::clone(&db), "test-secret");
        assert!(matches!(state.backend, DbBackend::InMemory(_)));
        assert!(state.pool().is_none());
        assert_eq!(state.jwt_secret, "test-secret");
    }

    #[test]
    fn test_app_state_with_backend_in_memory() {
        let db = Arc::new(InMemoryDatabase::new());
        let state = AppState::with_backend(DbBackend::InMemory(Arc::clone(&db)), "test-secret");
        assert!(state.pool().is_none());
        assert_eq!(state.jwt_secret, "test-secret");
    }
}
