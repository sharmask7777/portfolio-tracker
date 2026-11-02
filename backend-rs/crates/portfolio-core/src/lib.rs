//! Zero-I/O deterministic financial calculations for Portfolio Tracker.

#![forbid(unsafe_code)]

/// Central domain error types.
pub mod error;
/// Holdings consolidation, FIFO lot matching, and portfolio registry.
pub mod holdings;
/// Financial statement and CAS transaction parser.
pub mod parser;
/// Performance metrics, absolute returns, and numerical XIRR root-finding.
pub mod performance;
/// Statutory Indian capital gains tax engine and tax harvesting.
pub mod tax;
/// Strongly-typed domain primitives (Money, Units, Nav, Pan, Isin, FolioNumber).
pub mod types;
/// Portfolio X-Ray analysis, asset allocation, and multi-fund overlap.
pub mod xray;

pub use error::PortfolioError;
pub use holdings::*;
pub use performance::*;
pub use tax::*;
pub use types::*;
pub use xray::*;
