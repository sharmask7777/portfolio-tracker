//! Error definitions for portfolio core operations.

use rust_decimal::Decimal;
use thiserror::Error;

use crate::types::Units;

/// Errors that can occur during portfolio calculations and validations.
#[derive(Debug, Error, PartialEq, Eq, Clone)]
pub enum PortfolioError {
    /// Insufficient available units for a redemption or sale operation.
    #[error("Insufficient units: available {available}, requested {requested}")]
    InsufficientUnits {
        /// Units currently available in the holding.
        available: Units,
        /// Units requested for redemption or sale.
        requested: Units,
    },

    /// Requested units are locked under statutory restrictions (e.g., 3-year ELSS lock-in).
    #[error("Units locked: available {available}, locked {locked}")]
    UnitsLocked {
        /// Units currently available in the holding.
        available: Units,
        /// Units currently locked and ineligible for withdrawal.
        locked: Units,
    },

    /// Numerical XIRR root-finding solver failed to converge within maximum iterations.
    #[error("XIRR failed to converge after {iterations} iterations with last guess {last_guess}")]
    XirrConvergenceFailure {
        /// Number of solver iterations completed before termination.
        iterations: usize,
        /// Final root-finding rate approximation before divergence or timeout.
        last_guess: Decimal,
    },

    /// Transaction record is malformed, contradictory, or contains invalid dates/amounts.
    #[error("Invalid transaction: {reason}")]
    InvalidTransaction {
        /// Explanation of why the transaction was determined to be invalid.
        reason: String,
    },

    /// Permanent Account Number (PAN) does not match statutory alphanumeric pattern.
    #[error("Invalid PAN: {0}")]
    InvalidPan(String),

    /// Folio number contains illegal characters or failed format validation.
    #[error("Invalid folio number: {0}")]
    InvalidFolio(String),

    /// International Securities Identification Number (ISIN) is invalid.
    #[error("Invalid ISIN: {0}")]
    InvalidIsin(String),

    /// Negative monetary amount supplied to an operation expecting non-negative value.
    #[error("Negative amount: {0}")]
    NegativeAmount(Decimal),

    /// Division by zero encountered during financial ratio or weight calculation.
    #[error("Division by zero")]
    DivisionByZero,

    /// Portfolio contains zero folios, transactions, or valuation data.
    #[error("Empty portfolio")]
    EmptyPortfolio,

    /// Investor profile identifier was not found in the portfolio set.
    #[error("Profile not found: {0}")]
    ProfileNotFound(String),

    /// Statement or data payload failed to parse into valid transactions or folios.
    #[error("Parse error: {0}")]
    ParseError(String),

    /// Statutory tax invariant violation detected (e.g. quarterly mismatch, negative exemption).
    #[error("Tax invariant error: {0}")]
    TaxInvariant(#[from] crate::tax::TaxInvariantError),
}
