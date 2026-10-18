//! Background worker job for parsing and ingesting CAS PDF / JSON statements.

use std::path::Path;

use chrono::NaiveDate;
use portfolio_db::InMemoryDatabase;
use portfolio_db::entities::{AssetEntity, FolioEntity, ManagedProfileEntity, PortfolioEntity};
use portfolio_db::repositories::{FamilyRepository, PortfolioRepository, TransactionRepository};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::error::WorkerError;
use crate::jobs::ProcessPdfUploadJobData;

/// In-memory CAS Statement models mapping casparser JSON output.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasStatement {
    #[serde(default)]
    pub investor_info: Option<CasInvestorInfo>,
    #[serde(default)]
    pub investor: Option<CasInvestorInfo>,
    #[serde(default)]
    pub folios: Vec<CasFolio>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasInvestorInfo {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub pan: Option<String>,
    #[serde(default, rename = "PAN")]
    pub pan_upper: Option<String>,
    #[serde(default)]
    pub mobile: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasFolio {
    #[serde(default)]
    pub folio: String,
    #[serde(default)]
    pub amc: Option<String>,
    #[serde(default)]
    pub pan: Option<String>,
    #[serde(default, rename = "PAN")]
    pub pan_upper: Option<String>,
    #[serde(default)]
    pub schemes: Vec<CasScheme>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasScheme {
    #[serde(default)]
    pub scheme: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub isin: Option<String>,
    #[serde(default)]
    pub amfi: Option<String>,
    #[serde(default)]
    pub pan: Option<String>,
    #[serde(default, rename = "PAN")]
    pub pan_upper: Option<String>,
    #[serde(default)]
    pub close: Option<Decimal>,
    #[serde(default)]
    pub valuation: Option<CasValuation>,
    #[serde(default)]
    pub transactions: Vec<CasTransaction>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasValuation {
    #[serde(default)]
    pub date: Option<String>,
    #[serde(default)]
    pub nav: Option<Decimal>,
    #[serde(default)]
    pub cost: Option<Decimal>,
    #[serde(default)]
    pub value: Option<Decimal>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasTransaction {
    pub date: String,
    #[serde(rename = "type")]
    pub tx_type: String,
    #[serde(default)]
    pub units: Option<Decimal>,
    #[serde(default)]
    pub amount: Option<Decimal>,
    #[serde(default)]
    pub nav: Option<Decimal>,
    #[serde(default)]
    pub balance: Option<Decimal>,
}

/// Parses a date string supporting common CAS statement formats.
pub fn parse_cas_date(date_str: &str) -> Result<NaiveDate, WorkerError> {
    let s = date_str.trim();

    // 1. Try ISO YYYY-MM-DD
    if let Ok(d) = NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        return Ok(d);
    }
    // 2. Try DD-Mon-YYYY (e.g. 15-Jan-2024 or 15-JAN-2024)
    if let Ok(d) = NaiveDate::parse_from_str(s, "%d-%b-%Y") {
        return Ok(d);
    }
    // 3. Try DD-MM-YYYY
    if let Ok(d) = NaiveDate::parse_from_str(s, "%d-%m-%Y") {
        return Ok(d);
    }
    // 4. Try YYYY/MM/DD
    if let Ok(d) = NaiveDate::parse_from_str(s, "%Y/%m/%d") {
        return Ok(d);
    }
    // 5. Try ISO with timestamp (YYYY-MM-DDTHH:MM:SS)
    if s.len() >= 10
        && let Ok(d) = NaiveDate::parse_from_str(&s[..10], "%Y-%m-%d")
    {
        return Ok(d);
    }

    Err(WorkerError::ParseError(format!(
        "Unrecognized transaction date format: '{s}'"
    )))
}

/// Normalizes raw CAS transaction type string into standard canonical transaction type.
pub fn normalize_tx_type(raw_type: &str) -> &'static str {
    let upper = raw_type.trim().to_uppercase();
    if upper.contains("SIP") {
        "PURCHASE_SIP"
    } else if upper.contains("PURCHASE") || upper.contains("BUY") {
        "PURCHASE"
    } else if upper.contains("REDEMPTION") || upper.contains("SELL") {
        "REDEMPTION"
    } else if upper.contains("SWITCH_IN") || upper.contains("SWITCH IN") {
        "SWITCH_IN"
    } else if upper.contains("SWITCH_OUT") || upper.contains("SWITCH OUT") {
        "SWITCH_OUT"
    } else if upper.contains("REINVEST") {
        "DIVIDEND_REINVESTMENT"
    } else if upper.contains("DIVIDEND") {
        "DIVIDEND_PAYOUT"
    } else {
        "PURCHASE"
    }
}

/// Core background worker handler for processing CAS PDF / JSON uploads.
///
/// Lifecycle:
/// 1. Transitions `UploadJob` status: `PENDING` -> `PROCESSING` (updates `started_at`).
/// 2. Verifies file exists at `file_path`. If not found, sets `status = FAILED`, sets `message`,
///    and returns `Err(WorkerError::FileNotFound)`.
/// 3. Parses statement transactions.
/// 4. Ingests assets, folios, and transactions into database with multi-PAN isolation.
/// 5. Transitions `UploadJob` status to `COMPLETED` (updates `completed_at`).
/// 6. Cleans up temporary file.
pub async fn process_pdf_job(
    job_data: &ProcessPdfUploadJobData,
    db: &InMemoryDatabase,
) -> Result<(), WorkerError> {
    // Ensure upload job entity exists in database
    if db.get_upload_job(job_data.job_id).is_none() {
        db.create_upload_job(job_data.job_id, job_data.user_id, &job_data.file_path);
    }

    // Step 1: Transition status to PROCESSING (started_at set)
    let _ = db.set_upload_job_processing(job_data.job_id);

    let file_path = Path::new(&job_data.file_path);

    // Step 2: Verify file exists
    if !file_path.exists() {
        let err_msg = format!("File not found at path: {}", job_data.file_path);
        let _ = db.set_upload_job_failed(job_data.job_id, &err_msg);
        return Err(WorkerError::FileNotFound(job_data.file_path.clone()));
    }

    // Process with guaranteed cleanup in case of success or error
    let process_result = process_cas_file_internal(job_data, db, file_path).await;

    // Step 6: Temporary file cleanup
    if file_path.exists() {
        let _ = std::fs::remove_file(file_path);
    }

    match process_result {
        Ok(()) => {
            // Step 5: Transition to COMPLETED
            let _ = db.set_upload_job_completed(job_data.job_id);
            Ok(())
        }
        Err(err) => {
            // Failure transition
            let _ = db.set_upload_job_failed(job_data.job_id, &err.to_string());
            Err(err)
        }
    }
}

async fn process_cas_file_internal(
    job_data: &ProcessPdfUploadJobData,
    db: &InMemoryDatabase,
    file_path: &Path,
) -> Result<(), WorkerError> {
    // Read file content
    let raw_content = std::fs::read_to_string(file_path)?;

    // Step 3: Parse statement JSON
    let statement: CasStatement = serde_json::from_str(&raw_content)
        .map_err(|e| WorkerError::ParseError(format!("Failed to parse CAS statement JSON: {e}")))?;

    // Determine default investor PAN
    let investor_pan = statement
        .investor_info
        .as_ref()
        .and_then(|i| i.pan.as_deref().or(i.pan_upper.as_deref()))
        .or_else(|| {
            statement
                .investor
                .as_ref()
                .and_then(|i| i.pan.as_deref().or(i.pan_upper.as_deref()))
        })
        .unwrap_or("ABCDE1234F");

    // Step 4: Ingest assets, folios, and transactions
    for folio_data in &statement.folios {
        for scheme_data in &folio_data.schemes {
            // Multi-PAN Splitting logic:
            // scheme PAN -> folio PAN -> investor PAN -> fallback
            let scheme_pan = scheme_data
                .pan
                .as_deref()
                .or(scheme_data.pan_upper.as_deref())
                .or(folio_data.pan.as_deref())
                .or(folio_data.pan_upper.as_deref())
                .unwrap_or(investor_pan)
                .trim()
                .to_uppercase();

            // 1. Managed Profile for this PAN
            let profile: ManagedProfileEntity =
                if let Some(existing) = db.find_profile_by_pan(job_data.user_id, &scheme_pan) {
                    existing
                } else {
                    db.create_managed_profile(
                        job_data.user_id,
                        &format!("{scheme_pan} Profile"),
                        &scheme_pan,
                        Decimal::new(30, 2), // Default 30% tax slab
                    )
                    .await?
                };

            // 2. Portfolio for this Profile
            let portfolio: PortfolioEntity = if let Some(existing) =
                db.find_portfolio_by_profile(job_data.user_id, profile.id)
            {
                existing
            } else {
                db.create_portfolio(
                    job_data.user_id,
                    &format!("{} Portfolio", profile.name),
                    Some(profile.id),
                )
                .await?
            };

            // 3. Asset
            let fund_name = scheme_data
                .scheme
                .as_deref()
                .or(scheme_data.name.as_deref())
                .unwrap_or("Mutual Fund");

            let isin = scheme_data.isin.as_deref();
            let amfi_code = scheme_data.amfi.as_deref();

            let asset: AssetEntity = if let Some(isin_str) = isin {
                if let Some(existing) = db.find_asset_by_isin(isin_str) {
                    existing
                } else {
                    db.create_asset("MUTUAL_FUND", fund_name, isin, amfi_code, None, None)
                }
            } else if let Some(amfi_str) = amfi_code {
                if let Some(existing) = db.find_asset_by_amfi_code(amfi_str) {
                    existing
                } else {
                    db.create_asset("MUTUAL_FUND", fund_name, isin, amfi_code, None, None)
                }
            } else if let Some(existing) = db.find_asset_by_name(fund_name) {
                existing
            } else {
                db.create_asset("MUTUAL_FUND", fund_name, isin, amfi_code, None, None)
            };

            // 4. Folio
            let folio_number = if folio_data.folio.trim().is_empty() {
                "DEFAULT-FOLIO"
            } else {
                folio_data.folio.trim()
            };

            let folio: FolioEntity =
                if let Some(existing) = db.find_folio(portfolio.id, asset.id, folio_number) {
                    existing
                } else {
                    db.create_folio(
                        portfolio.id,
                        asset.id,
                        folio_number,
                        folio_data.amc.as_deref(),
                        Some(&scheme_pan),
                    )?
                };

            // 5. Transactions
            for tx in &scheme_data.transactions {
                let date = parse_cas_date(&tx.date)?;
                let tx_type = normalize_tx_type(&tx.tx_type);

                let units = tx.units.unwrap_or(Decimal::ZERO).abs();
                let nav = tx.nav.unwrap_or(Decimal::ZERO).abs();
                let amount = if let Some(amt) = tx.amount {
                    amt.abs()
                } else if !units.is_zero() && !nav.is_zero() {
                    units * nav
                } else {
                    Decimal::ZERO
                };
                let balance = tx.balance.unwrap_or(Decimal::ZERO).abs();

                // Generate deterministic external_id for idempotency
                let external_id = format!(
                    "{}-{}-{}-{}-{}-{}-{}",
                    portfolio.id,
                    folio.number,
                    isin.unwrap_or("UNKNOWN"),
                    date,
                    tx_type,
                    amount,
                    units
                );

                if db.find_transaction_by_external_id(&external_id).is_none() {
                    db.create_transaction(
                        folio.id,
                        date,
                        tx_type,
                        amount,
                        units,
                        nav,
                        balance,
                        Some(&external_id),
                    )
                    .await?;
                }
            }
        }
    }

    Ok(())
}
