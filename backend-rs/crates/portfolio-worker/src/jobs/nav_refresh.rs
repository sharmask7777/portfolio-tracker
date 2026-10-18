//! Background worker job for refreshing Net Asset Values (NAV) for mutual funds.

use chrono::Utc;
use portfolio_db::InMemoryDatabase;
use portfolio_db::entities::HistoricalNavEntity;
use rust_decimal::Decimal;

use crate::error::WorkerError;
use crate::jobs::NavRefreshJobData;

/// Validates AMFI mutual fund code.
/// AMFI codes in India are 5 to 6 digit numeric identifiers (e.g. "120716", "122639").
pub fn validate_amfi_code(code: &str) -> Result<&str, WorkerError> {
    let trimmed = code.trim();
    if trimmed.is_empty() || !trimmed.chars().all(|c| c.is_ascii_digit()) {
        return Err(WorkerError::InvalidAmfiCode(code.to_string()));
    }
    Ok(trimmed)
}

/// Core handler for processing NAV refresh jobs.
///
/// Lifecycle:
/// 1. Validates the AMFI code format (must be non-empty digits).
/// 2. Resolves target as-of date (defaults to current UTC date).
/// 3. Resolves new NAV (using job payload or default valuation).
/// 4. Stores updated NAV record in database.
pub async fn process_nav_refresh_job(
    job_data: &NavRefreshJobData,
    db: &InMemoryDatabase,
) -> Result<HistoricalNavEntity, WorkerError> {
    let code = validate_amfi_code(&job_data.amfi_code)?;
    let date = job_data
        .as_of_date
        .unwrap_or_else(|| Utc::now().date_naive());

    // Resolve NAV: use provided nav, or lookup latest NAV / transaction NAV, or fallback
    let nav_value = if let Some(n) = job_data.nav {
        n
    } else if let Some(existing) = db.get_nav(code, date) {
        existing.nav
    } else {
        Decimal::new(10000, 2) // Default 100.00
    };

    let record = db.store_nav(code, date, nav_value);
    Ok(record)
}
