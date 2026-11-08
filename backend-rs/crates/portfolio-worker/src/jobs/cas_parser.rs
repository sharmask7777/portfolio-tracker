//! Background worker job for parsing and ingesting CAS PDF / JSON statements.
//!
//! ## Worker Pipeline Architecture:
//! - **BullMQ Queue Integration**: Ingests jobs from `bull:pdfUploadQueue:*` or in-memory job queue.
//! - **Sandboxing & Path Validation**: Enforces strict filesystem sandboxing ensuring input files reside
//!   exclusively within `uploads/` or system temp directories, rejecting any directory traversal (`..`).
//! - **Python Fallback Engine**: Executes Python `casparser` utility for parsing encrypted/raw CAMS & KFintech
//!   PDF statements, converting output to structured JSON.
//! - **Multi-PAN Isolation**: Intelligently inspects PAN tags across Scheme -> Folio -> Investor hierarchies,
//!   automatically partitioning folios across family members and distinct managed profiles.
//! - **Historical Timeline Recalculation**: Post ingestion, schedules `HistoryRefreshJobData` to reconstruct
//!   point-in-time daily valuation and invested timelines.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use chrono::NaiveDate;
use portfolio_db::InMemoryDatabase;
use portfolio_db::entities::{AssetEntity, FolioEntity, ManagedProfileEntity, PortfolioEntity};
use portfolio_db::repositories::{FamilyRepository, PortfolioRepository, TransactionRepository};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::error::WorkerError;
use crate::jobs::{
    HistoryRefreshJobData, ProcessPdfUploadJobData, process_history_refresh_job_with_pool,
};

/// In-memory CAS Statement models mapping casparser JSON output.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasStatement {
    /// Primary investor personal identifying information.
    #[serde(default)]
    pub investor_info: Option<CasInvestorInfo>,
    /// Alternate alias for investor info emitted by some parser versions.
    #[serde(default)]
    pub investor: Option<CasInvestorInfo>,
    /// Collection of mutual fund folios contained in the statement.
    #[serde(default)]
    pub folios: Vec<CasFolio>,
}

/// Investor demographic and tax identification details parsed from CAS statements.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasInvestorInfo {
    /// Investor legal name.
    #[serde(default)]
    pub name: Option<String>,
    /// Contact email address.
    #[serde(default)]
    pub email: Option<String>,
    /// Tax identifier (Permanent Account Number).
    #[serde(default)]
    pub pan: Option<String>,
    /// Uppercase PAN alias.
    #[serde(default, rename = "PAN")]
    pub pan_upper: Option<String>,
    /// Contact mobile number.
    #[serde(default)]
    pub mobile: Option<String>,
    /// Registered correspondence address.
    #[serde(default)]
    pub address: Option<String>,
}

/// Mutual fund folio container grouping multiple schemes under an AMC.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasFolio {
    /// Folio account number.
    #[serde(default)]
    pub folio: String,
    /// Asset Management Company name (e.g. "HDFC Mutual Fund").
    #[serde(default)]
    pub amc: Option<String>,
    /// Folio-level PAN identifier.
    #[serde(default)]
    pub pan: Option<String>,
    /// Uppercase PAN alias.
    #[serde(default, rename = "PAN")]
    pub pan_upper: Option<String>,
    /// Schemes held within this folio account.
    #[serde(default)]
    pub schemes: Vec<CasScheme>,
}

/// Mutual fund scheme holding record containing valuation and transaction ledger.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasScheme {
    /// Scheme name string.
    #[serde(default)]
    pub scheme: Option<String>,
    /// Alternate name field.
    #[serde(default)]
    pub name: Option<String>,
    /// Scheme ISIN identifier (e.g. "INF209K01165").
    #[serde(default)]
    pub isin: Option<String>,
    /// AMFI code identifier (e.g. "120716").
    #[serde(default)]
    pub amfi: Option<String>,
    /// Scheme-level PAN override (used for multi-PAN folios).
    #[serde(default)]
    pub pan: Option<String>,
    /// Uppercase PAN alias.
    #[serde(default, rename = "PAN")]
    pub pan_upper: Option<String>,
    /// Closing unit balance as of statement date.
    #[serde(default)]
    pub close: Option<Decimal>,
    /// Closing market valuation summary.
    #[serde(default)]
    pub valuation: Option<CasValuation>,
    /// Chronological ledger of historical transactions.
    #[serde(default)]
    pub transactions: Vec<CasTransaction>,
}

/// Scheme market valuation snapshot as reported in CAS statement.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasValuation {
    /// Valuation as-of date string.
    #[serde(default)]
    pub date: Option<String>,
    /// NAV price as of statement date.
    #[serde(default)]
    pub nav: Option<Decimal>,
    /// Total historical acquisition cost.
    #[serde(default)]
    pub cost: Option<Decimal>,
    /// Total current market valuation.
    #[serde(default)]
    pub value: Option<Decimal>,
}

/// Individual transaction record in CAS statement ledger.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CasTransaction {
    /// Transaction transaction date string.
    pub date: String,
    /// Transaction type descriptor (e.g. "PURCHASE", "REDEMPTION", "SWITCH_IN").
    #[serde(rename = "type")]
    pub tx_type: String,
    /// Transacted units (if applicable).
    #[serde(default)]
    pub units: Option<Decimal>,
    /// Transacted monetary amount in INR.
    #[serde(default)]
    pub amount: Option<Decimal>,
    /// Transaction unit price / NAV.
    #[serde(default)]
    pub nav: Option<Decimal>,
    /// Post-transaction cumulative balance.
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
    // 4. Try DD/MM/YYYY (e.g. 15/01/2024)
    if let Ok(d) = NaiveDate::parse_from_str(s, "%d/%m/%Y") {
        return Ok(d);
    }
    // 5. Try YYYY/MM/DD
    if let Ok(d) = NaiveDate::parse_from_str(s, "%Y/%m/%d") {
        return Ok(d);
    }
    // 6. Try ISO with timestamp (YYYY-MM-DDTHH:MM:SS)
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
///
/// Checks SWITCH_IN before PURCHASE and SWITCH_OUT before REDEMPTION to avoid
/// misclassifying "SWITCH IN - PURCHASE" or "SWITCH OUT - REDEMPTION" strings.
pub fn normalize_tx_type(raw_type: &str) -> &'static str {
    let upper = raw_type.trim().to_uppercase();
    if upper.contains("SWITCH_IN") || upper.contains("SWITCH IN") {
        "SWITCH_IN"
    } else if upper.contains("SWITCH_OUT") || upper.contains("SWITCH OUT") {
        "SWITCH_OUT"
    } else if upper.contains("SIP") {
        "PURCHASE_SIP"
    } else if upper.contains("REVERSAL") {
        "REVERSAL"
    } else if upper.contains("REDEMPTION") || upper.contains("SELL") {
        "REDEMPTION"
    } else if upper.contains("PURCHASE") || upper.contains("BUY") {
        "PURCHASE"
    } else if upper.contains("REINVEST") {
        "DIVIDEND_REINVESTMENT"
    } else if upper.contains("DIVIDEND") {
        "DIVIDEND_PAYOUT"
    } else if upper.contains("STAMP")
        || upper.contains("DUTY")
        || upper.contains("TAX")
        || upper.contains("STT")
        || upper.contains("FEE")
        || upper.contains("CHARGE")
    {
        "STAMP_DUTY_TAX"
    } else if upper.contains("MISC") {
        "MISC"
    } else {
        "OTHER"
    }
}

/// Validates an upload file path against path traversal attacks and allowable directories.
///
/// Ensures:
/// 1. Path does not contain `..` (path traversal).
/// 2. Path resides within allowable directories (`uploads/` or system temp directories).
pub fn validate_file_path(path_str: &str) -> Result<PathBuf, WorkerError> {
    let p = Path::new(path_str);

    // 1. Reject path traversal
    if path_str.contains("..")
        || p.components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
    {
        return Err(WorkerError::ValidationError(format!(
            "Path traversal detected in file path: '{path_str}'"
        )));
    }

    // 2. Allowable directory check
    let temp_dir = std::env::temp_dir();
    let is_in_temp = p.starts_with(&temp_dir)
        || p.starts_with("/tmp")
        || p.starts_with("/private/tmp")
        || p.starts_with("/var/tmp")
        || p.starts_with("/private/var/tmp");

    let is_in_uploads = p.starts_with("uploads")
        || p.starts_with("./uploads")
        || p.components().any(|c| c.as_os_str() == "uploads");

    if !is_in_temp && !is_in_uploads {
        return Err(WorkerError::ValidationError(format!(
            "Path '{path_str}' is not in an allowed directory (uploads/ or temp directory)"
        )));
    }

    Ok(p.to_path_buf())
}

/// Core background worker handler for processing CAS PDF / JSON uploads.
///
/// Lifecycle:
/// 1. Transitions `UploadJob` status: `PENDING` -> `PROCESSING` (updates `started_at`).
/// 2. Sandboxes and validates `file_path` against path traversal and allowable directories.
/// 3. Verifies file exists at `file_path`. If not found, sets `status = FAILED`, sets `message`,
///    and returns `Err(WorkerError::FileNotFound)`.
/// 4. Parses statement transactions.
/// 5. Ingests assets, folios, and transactions into database with multi-PAN isolation.
/// 6. Recalculates historical valuation timeline for all touched portfolios.
/// 7. Transitions `UploadJob` status to `COMPLETED` (updates `completed_at`).
/// 8. Cleans up temporary file (only if it passed validation and exists).
///
/// Helper handler for processing CAS PDF / JSON upload jobs with optional PostgreSQL persistence.
pub async fn process_pdf_job_with_pool(
    job_data: &ProcessPdfUploadJobData,
    db: &InMemoryDatabase,
    pool: Option<&sqlx::PgPool>,
) -> Result<(), WorkerError> {
    // Ensure upload job entity exists in database
    if db.get_upload_job(job_data.job_id).is_none() {
        db.create_upload_job(job_data.job_id, job_data.user_id, &job_data.file_path);
    }

    // Step 1: Transition status to PROCESSING (started_at set)
    let _ = db.set_upload_job_processing(job_data.job_id);

    // Step 2: Validate file path (sandboxing)
    let validated_path = match validate_file_path(&job_data.file_path) {
        Ok(path) => path,
        Err(err) => {
            let _ = db.set_upload_job_failed(job_data.job_id, &err.to_string());
            return Err(err);
        }
    };

    // Step 3: Verify file exists
    if !validated_path.exists() {
        let err_msg = format!("File not found at path: {}", job_data.file_path);
        let _ = db.set_upload_job_failed(job_data.job_id, &err_msg);
        return Err(WorkerError::FileNotFound(job_data.file_path.clone()));
    }

    // Process with guaranteed cleanup only if path passed validation and exists
    let process_result = process_cas_file_internal(job_data, db, pool, &validated_path).await;

    // Step 8: Safe cleanup: only unlink if validated and exists
    if validated_path.exists() {
        let _ = std::fs::remove_file(&validated_path);
    }

    match process_result {
        Ok(()) => {
            // Step 7: Transition to COMPLETED
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

/// Core handler for processing CAS PDF / JSON upload jobs.
///
/// Lifecycle:
/// 1. Transitions `UploadJob` status to `PROCESSING` (updates `started_at`).
/// 2. Validates that the input file path resides safely within `uploads/` or temp dirs.
/// 3. Verifies file presence on disk.
/// 4. Executes Python `casparser` script if input is PDF, or parses raw JSON.
/// 5. Ingests assets, folios, and transactions into database with multi-PAN isolation.
/// 6. Recalculates historical valuation timeline for all touched portfolios.
/// 7. Transitions `UploadJob` status to `COMPLETED` (updates `completed_at`).
/// 8. Cleans up temporary file (only if it passed validation and exists).
pub async fn process_pdf_job(
    job_data: &ProcessPdfUploadJobData,
    db: &InMemoryDatabase,
) -> Result<(), WorkerError> {
    process_pdf_job_with_pool(job_data, db, None).await
}

async fn process_cas_file_internal(
    job_data: &ProcessPdfUploadJobData,
    db: &InMemoryDatabase,
    pool: Option<&sqlx::PgPool>,
    file_path: &Path,
) -> Result<(), WorkerError> {
    let bytes = std::fs::read(file_path)?;
    let is_pdf = bytes.starts_with(b"%PDF");

    let raw_content = if is_pdf {
        let python = std::env::var("PYTHON_PATH").unwrap_or_else(|_| "python3".to_string());
        let script_path = std::env::var("PARSE_CAS_SCRIPT").unwrap_or_else(|_| {
            if Path::new("/app/scripts/parse_cas.py").exists() {
                "/app/scripts/parse_cas.py".to_string()
            } else if Path::new("scripts/parse_cas.py").exists() {
                "scripts/parse_cas.py".to_string()
            } else if Path::new("backend-rs/scripts/parse_cas.py").exists() {
                "backend-rs/scripts/parse_cas.py".to_string()
            } else if Path::new("../scripts/parse_cas.py").exists() {
                "../scripts/parse_cas.py".to_string()
            } else if Path::new("../../scripts/parse_cas.py").exists() {
                "../../scripts/parse_cas.py".to_string()
            } else {
                "backend-rs/scripts/parse_cas.py".to_string()
            }
        });

        let mut cmd = std::process::Command::new(&python);
        cmd.arg(&script_path).arg(file_path);
        if let Some(ref pw) = job_data.password {
            cmd.arg(pw);
        }

        let output = cmd.output().map_err(|e| {
            WorkerError::ParseError(format!("Failed to execute casparser script: {e}"))
        })?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(WorkerError::ParseError(format!(
                "casparser extraction failed: {stderr}"
            )));
        }

        String::from_utf8(output.stdout).map_err(|e| {
            WorkerError::ParseError(format!("Invalid UTF-8 from casparser output: {e}"))
        })?
    } else {
        String::from_utf8(bytes)
            .map_err(|e| WorkerError::ParseError(format!("Invalid UTF-8 in CAS JSON file: {e}")))?
    };

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

    let mut touched_portfolios = HashSet::new();
    let mut touched_pg_portfolios = HashSet::new();

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

            let profile_name = format!("{scheme_pan} Profile");

            // 1. Managed Profile for this PAN
            let profile: ManagedProfileEntity =
                if let Some(existing) = db.find_profile_by_pan(job_data.user_id, &scheme_pan) {
                    existing
                } else {
                    db.create_managed_profile(
                        job_data.user_id,
                        &profile_name,
                        &scheme_pan,
                        Decimal::new(30, 2), // Default 30% tax slab
                    )
                    .await?
                };

            let pg_profile_id = if let Some(pool) = pool {
                Some(
                    portfolio_db::repositories::upsert_postgres_profile(
                        pool,
                        job_data.user_id,
                        &scheme_pan,
                        &profile_name,
                        Decimal::new(30, 2),
                    )
                    .await
                    .map_err(WorkerError::Db)?,
                )
            } else {
                None
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
            touched_portfolios.insert(portfolio.id);

            let pg_portfolio_id = if let (Some(pool), Some(prof_id)) = (pool, pg_profile_id) {
                let pid = portfolio_db::repositories::upsert_postgres_portfolio(
                    pool,
                    job_data.user_id,
                    prof_id,
                    &format!("{profile_name} Portfolio"),
                )
                .await
                .map_err(WorkerError::Db)?;
                touched_pg_portfolios.insert(pid);
                Some(pid)
            } else {
                None
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

            let pg_asset_id = if let Some(pool) = pool {
                Some(
                    portfolio_db::repositories::upsert_postgres_asset(
                        pool, fund_name, isin, amfi_code,
                    )
                    .await
                    .map_err(WorkerError::Db)?,
                )
            } else {
                None
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

            let pg_folio_id = if let (Some(pool), Some(p_id), Some(a_id)) =
                (pool, pg_portfolio_id, pg_asset_id)
            {
                Some(
                    portfolio_db::repositories::upsert_postgres_folio(
                        pool,
                        p_id,
                        a_id,
                        folio_number,
                        folio_data.amc.as_deref(),
                        Some(&scheme_pan),
                    )
                    .await
                    .map_err(WorkerError::Db)?,
                )
            } else {
                None
            };

            // Reconcile existing folio: clear any synthetic MANUAL_CLOSE or ANCHOR markers
            // so the incoming authoritative statement transactions and balances take precedence.
            db.reconcile_folio_transactions(folio.id);
            if let (Some(pool), Some(f_id)) = (pool, pg_folio_id) {
                portfolio_db::repositories::reconcile_postgres_folio(pool, f_id)
                    .await
                    .map_err(WorkerError::Db)?;
            }

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

                // Filter out non-financial notes/remarks with 0 units and 0 amount
                if units.is_zero() && amount.is_zero() {
                    continue;
                }

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

                if db.find_transaction_by_external_id(&external_id).is_none()
                    && !db.has_duplicate_transaction(folio.id, date, amount, units)
                {
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

                if let (Some(pool), Some(f_id), Some(p_id)) = (pool, pg_folio_id, pg_portfolio_id) {
                    let pg_ext_id = format!(
                        "{}-{}-{}-{}-{}-{}-{}",
                        p_id,
                        folio.number,
                        isin.unwrap_or("UNKNOWN"),
                        date,
                        tx_type,
                        amount,
                        units
                    );
                    portfolio_db::repositories::insert_postgres_transaction(
                        pool, f_id, date, tx_type, amount, units, nav, balance, &pg_ext_id,
                    )
                    .await
                    .map_err(WorkerError::Db)?;
                }
            }
        }
    }

    // Step 6: Recalculate historical valuation timeline for all touched portfolios
    let mut touched_vec: Vec<uuid::Uuid> = touched_portfolios.into_iter().collect();
    touched_vec.sort();
    for portfolio_id in touched_vec {
        let refresh_data = HistoryRefreshJobData::new(portfolio_id);
        process_history_refresh_job_with_pool(&refresh_data, db, None).await?;
    }

    if let Some(pool) = pool {
        let mut touched_pg_vec: Vec<uuid::Uuid> = touched_pg_portfolios.into_iter().collect();
        touched_pg_vec.sort();
        for pg_port_id in touched_pg_vec {
            let refresh_data = HistoryRefreshJobData::new(pg_port_id);
            process_history_refresh_job_with_pool(&refresh_data, db, Some(pool)).await?;
        }
    }

    Ok(())
}
