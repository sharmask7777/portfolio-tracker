//! Holdings route DTOs and types.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

pub use crate::routes::portfolio::{FolioSummary, SummaryMetrics};

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(rename_all = "camelCase")]
pub struct HoldingsSummaryResponse {
    pub folios: Vec<FolioSummary>,
    pub metrics: SummaryMetrics,
}
