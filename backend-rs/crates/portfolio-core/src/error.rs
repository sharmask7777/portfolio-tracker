//! Error definitions for portfolio core operations.

use rust_decimal::Decimal;
use thiserror::Error;

use crate::types::Units;

/// Errors that can occur during portfolio calculations and validations.
#[derive(Debug, Error, PartialEq, Eq, Clone)]
pub enum PortfolioError {
    #[error("Insufficient units: available {available}, requested {requested}")]
    InsufficientUnits { available: Units, requested: Units },

    #[error("Units locked: available {available}, locked {locked}")]
    UnitsLocked { available: Units, locked: Units },

    #[error("XIRR failed to converge after {iterations} iterations with last guess {last_guess}")]
    XirrConvergenceFailure {
        iterations: usize,
        last_guess: Decimal,
    },

    #[error("Invalid transaction: {reason}")]
    InvalidTransaction { reason: String },

    #[error("Invalid PAN: {0}")]
    InvalidPan(String),

    #[error("Invalid folio number: {0}")]
    InvalidFolio(String),

    #[error("Invalid ISIN: {0}")]
    InvalidIsin(String),

    #[error("Negative amount: {0}")]
    NegativeAmount(Decimal),

    #[error("Division by zero")]
    DivisionByZero,

    #[error("Empty portfolio")]
    EmptyPortfolio,

    #[error("Parse error: {0}")]
    ParseError(String),
}
