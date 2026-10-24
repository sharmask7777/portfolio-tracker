//! Job data models and handlers for background queue processing.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub mod cas_parser;
pub mod history_refresh;
pub mod nav_refresh;

pub use cas_parser::{normalize_tx_type, parse_cas_date, process_pdf_job, validate_file_path};
pub use history_refresh::process_history_refresh_job;
pub use nav_refresh::{process_nav_refresh_job, process_nav_refresh_job_with_pool};

/// Payload for processing uploaded CAS PDF / JSON statements.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessPdfUploadJobData {
    pub user_id: Uuid,
    pub file_path: String,
    pub password: Option<String>,
    pub job_id: Uuid,
}

impl ProcessPdfUploadJobData {
    pub fn new(user_id: Uuid, file_path: impl Into<String>, job_id: Uuid) -> Self {
        Self {
            user_id,
            file_path: file_path.into(),
            password: None,
            job_id,
        }
    }

    pub fn with_password(mut self, password: impl Into<String>) -> Self {
        self.password = Some(password.into());
        self
    }
}

/// Payload for refreshing Mutual Fund Net Asset Values (NAV).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NavRefreshJobData {
    pub amfi_code: String,
    pub as_of_date: Option<NaiveDate>,
    #[serde(default)]
    pub nav: Option<Decimal>,
}

impl NavRefreshJobData {
    pub fn new(amfi_code: impl Into<String>) -> Self {
        Self {
            amfi_code: amfi_code.into(),
            as_of_date: None,
            nav: None,
        }
    }

    pub fn with_date(mut self, date: NaiveDate) -> Self {
        self.as_of_date = Some(date);
        self
    }

    pub fn with_nav(mut self, nav: Decimal) -> Self {
        self.nav = Some(nav);
        self
    }
}

/// Payload for recalculating historical valuation timeline for a portfolio.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRefreshJobData {
    pub portfolio_id: Uuid,
}

impl HistoryRefreshJobData {
    pub fn new(portfolio_id: Uuid) -> Self {
        Self { portfolio_id }
    }
}
