//! Background Queue Workers (`portfolio-worker`) for Portfolio Tracker.
//!
//! Provides background job processors for:
//! - CAS PDF / JSON upload processing and multi-PAN transaction ingestion
//! - Mutual fund NAV daily refresh
//! - Portfolio historical valuation timeline calculation
//! - Pluggable queue abstractions (`JobQueue`, `InMemoryJobQueue`, `RedisBullQueue`)

pub mod error;
pub mod jobs;
pub mod queue;

pub use error::WorkerError;
pub use jobs::*;
pub use queue::*;
