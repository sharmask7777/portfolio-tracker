//! Market data structures for fetching NAV time series from external APIs (e.g. MFAPI).

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Metadata header in MFAPI responses (`https://api.mfapi.in/mf/{scheme_code}/latest`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct MfApiMeta {
    /// Numerical scheme code assigned by AMFI / MFAPI.
    #[serde(default)]
    pub scheme_code: Option<i64>,
    /// Statutory mutual fund scheme name.
    #[serde(default)]
    pub scheme_name: Option<String>,
    /// ISIN for the Growth option of the scheme.
    #[serde(default)]
    pub isin_growth: Option<String>,
    /// ISIN for the Dividend Reinvestment / IDCW option of the scheme.
    #[serde(default)]
    pub isin_div_reinvestment: Option<String>,
    /// Asset Management Company / Fund House name.
    #[serde(default)]
    pub fund_house: Option<String>,
    /// Broad scheme type (e.g. "Open Ended Schemes").
    #[serde(default)]
    pub scheme_type: Option<String>,
    /// Detailed scheme category (e.g. "Equity Scheme - Mid Cap Fund").
    #[serde(default)]
    pub scheme_category: Option<String>,
}

/// A single historical or latest NAV record from MFAPI.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MfApiNavRecord {
    /// Date of the NAV record formatted as "DD-MM-YYYY".
    pub date: String,
    /// Net Asset Value per unit on this date.
    pub nav: Decimal,
}

/// Root response payload returned by MFAPI (`https://api.mfapi.in/mf/{scheme_code}/latest`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MfApiLatestResponse {
    /// Optional metadata header describing scheme parameters.
    #[serde(default)]
    pub meta: Option<MfApiMeta>,
    /// Array of NAV records returned for the query.
    #[serde(default)]
    pub data: Vec<MfApiNavRecord>,
    /// Status response string (e.g. "SUCCESS").
    pub status: String,
}

/// Parses an MFAPI date formatted as "DD-MM-YYYY" into a `chrono::NaiveDate`.
///
/// Returns `None` if the input string is malformed or represents an invalid calendar date.
pub fn parse_mfapi_date(date_string: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(date_string.trim(), "%d-%m-%Y").ok()
}
