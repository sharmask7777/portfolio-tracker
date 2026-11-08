//! Repository traits and SQLx database implementations.
//!
//! Provides abstract interfaces and production PostgreSQL implementations for:
//! - Portfolios ([`PortfolioRepository`], [`SqlxPortfolioRepo`])
//! - Transactions ([`TransactionRepository`], [`SqlxTransactionRepo`])
//! - Family profiles ([`FamilyRepository`], [`SqlxFamilyRepo`])
//! - Disclosed fund holdings ([`FundHoldingsRepository`], [`SqlxFundHoldingsRepo`])

pub mod cas_ingest_repo;
pub mod family_repo;
pub mod fund_holdings_repo;
pub mod portfolio_repo;
pub mod transaction_repo;

pub use cas_ingest_repo::*;
pub use family_repo::{FamilyRepository, SqlxFamilyRepo};
pub use fund_holdings_repo::{FundHoldingsRepository, SqlxFundHoldingsRepo};
pub use portfolio_repo::{PortfolioRepository, SqlxPortfolioRepo};
pub use transaction_repo::{SqlxTransactionRepo, TransactionRepository};
