use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Metadata header in MFAPI responses (`https://api.mfapi.in/mf/{scheme_code}/latest`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct MfApiMeta {
    #[serde(default)]
    pub scheme_code: Option<i64>,
    #[serde(default)]
    pub scheme_name: Option<String>,
    #[serde(default)]
    pub isin_growth: Option<String>,
    #[serde(default)]
    pub isin_div_reinvestment: Option<String>,
    #[serde(default)]
    pub fund_house: Option<String>,
    #[serde(default)]
    pub scheme_type: Option<String>,
    #[serde(default)]
    pub scheme_category: Option<String>,
}

/// A single historical or latest NAV record from MFAPI.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MfApiNavRecord {
    pub date: String,
    pub nav: Decimal,
}

/// Root response payload returned by MFAPI (`https://api.mfapi.in/mf/{scheme_code}/latest`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MfApiLatestResponse {
    #[serde(default)]
    pub meta: Option<MfApiMeta>,
    #[serde(default)]
    pub data: Vec<MfApiNavRecord>,
    pub status: String,
}

/// Parses an MFAPI date formatted as "DD-MM-YYYY" into a `chrono::NaiveDate`.
///
/// Returns `None` if the input is malformed or invalid.
pub fn parse_mfapi_date(s: &str) -> Option<NaiveDate> {
    NaiveDate::parse_from_str(s.trim(), "%d-%m-%Y").ok()
}
