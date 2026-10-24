//! Database persistence layer for Portfolio Tracker.
//!
//! Provides SQLx database models, repository traits, PostgreSQL implementations,
//! and an in-memory test database mock for fast hermetic unit and integration testing.

pub mod entities;
pub mod error;
pub mod market_data;
pub mod repositories;
pub mod schema;
pub mod test_mocks;

pub use entities::*;
pub use error::DbError;
pub use market_data::*;
pub use repositories::*;
pub use schema::{generate_ddl, init_schema};
pub use test_mocks::InMemoryDatabase;
