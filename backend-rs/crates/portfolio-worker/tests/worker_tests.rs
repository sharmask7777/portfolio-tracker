//! Hermetic integration tests for portfolio-worker.
//!
//! Validates:
//! 1. CAS statement upload job processing (PENDING -> PROCESSING -> COMPLETED, DB entities created, temp file cleaned up).
//! 2. CAS upload job failure handling (missing file -> FAILED with descriptive error message).
//! 3. CAS upload job malformed JSON handling (guaranteed temp file cleanup on failure).
//! 4. NAV refresh job processing (valid AMFI code, date resolution, and invalid code validation).
//! 5. Portfolio historical valuation timeline recalculation.
//! 6. In-memory queue operations and FIFO ordering.
//! 7. Wire serialization parity (camelCase formatting for BullMQ interoperability).
//! 8. BullMQ Redis queue key generation conventions.

use std::io::Write;
use std::path::Path;
use std::str::FromStr;

use chrono::NaiveDate;
use portfolio_db::InMemoryDatabase;
use portfolio_db::entities::UploadJobStatus;
use portfolio_db::repositories::{PortfolioRepository, TransactionRepository};
use portfolio_worker::WorkerError;
use portfolio_worker::jobs::{
    HistoryRefreshJobData, NavRefreshJobData, ProcessPdfUploadJobData, normalize_tx_type,
    parse_cas_date, process_history_refresh_job, process_nav_refresh_job, process_pdf_job,
    validate_file_path,
};
use portfolio_worker::queue::{InMemoryJobQueue, JobQueue, RedisBullQueue};
use rust_decimal::Decimal;
use tempfile::NamedTempFile;
use uuid::Uuid;

fn dec(s: &str) -> Decimal {
    Decimal::from_str(s).expect("valid decimal string")
}

#[tokio::test]
async fn test_cas_upload_job_processing_success() {
    let db = InMemoryDatabase::new();
    let queue = InMemoryJobQueue::<ProcessPdfUploadJobData>::new();

    // 1. Setup synthetic user (privacy compliant)
    let user = db.create_user("aarav.sharma@example.com", "hashed_secret");
    let job_id = Uuid::new_v4();

    // 2. Create synthetic CAS JSON file with multi-PAN schemes
    let mut temp_file = NamedTempFile::new().expect("Failed to create temp file");

    let cas_json = r#"{
        "investor_info": {
            "name": "Aarav Sharma",
            "pan": "ABCDE1234F",
            "email": "aarav.sharma@example.com"
        },
        "folios": [
            {
                "folio": "12345/NIPPON",
                "amc": "Nippon India Mutual Fund",
                "pan": "ABCDE1234F",
                "schemes": [
                    {
                        "scheme": "Nippon India Small Cap Fund Direct Growth",
                        "isin": "INF204K01UN4",
                        "amfi": "119551",
                        "pan": "ABCDE1234F",
                        "close": 150.0,
                        "valuation": { "nav": 120.0, "cost": 15500.0 },
                        "transactions": [
                            {
                                "date": "2023-01-15",
                                "type": "PURCHASE",
                                "units": 100.0,
                                "amount": 10000.0,
                                "nav": 100.0,
                                "balance": 100.0
                            },
                            {
                                "date": "2023-02-15",
                                "type": "PURCHASE_SIP",
                                "units": 50.0,
                                "amount": 5500.0,
                                "nav": 110.0,
                                "balance": 150.0
                            }
                        ]
                    }
                ]
            },
            {
                "folio": "67890/HDFC",
                "amc": "HDFC Mutual Fund",
                "pan": "ALPAC1001A",
                "schemes": [
                    {
                        "scheme": "HDFC Top 100 Fund Direct Plan Growth",
                        "isin": "INF179K01BE2",
                        "amfi": "100033",
                        "pan": "ALPAC1001A",
                        "close": 200.0,
                        "valuation": { "nav": 100.0, "cost": 20000.0 },
                        "transactions": [
                            {
                                "date": "2023-03-01",
                                "type": "PURCHASE",
                                "units": 200.0,
                                "amount": 20000.0,
                                "nav": 100.0,
                                "balance": 200.0
                            }
                        ]
                    }
                ]
            }
        ]
    }"#;

    temp_file
        .write_all(cas_json.as_bytes())
        .expect("Failed to write CAS JSON");
    // Persist file path so it stays on disk until worker unlinks it
    let (_file, path_buf) = temp_file.keep().expect("Failed to persist temp file");
    let file_path = path_buf.to_str().expect("valid path").to_string();

    // 3. Register initial UploadJob in DB
    let initial_job = db.create_upload_job(job_id, user.id, &file_path);
    assert_eq!(initial_job.status, UploadJobStatus::Pending);
    assert!(initial_job.started_at.is_none());
    assert!(initial_job.completed_at.is_none());

    // 4. Enqueue job
    let job_data = ProcessPdfUploadJobData::new(user.id, &file_path, job_id);
    let enqueued_id = queue.enqueue(job_data.clone()).await.expect("enqueue job");
    assert!(!enqueued_id.is_empty());

    // 5. Dequeue and process job
    let dequeued = queue
        .dequeue()
        .await
        .expect("dequeue job")
        .expect("job exists");
    assert_eq!(dequeued.job_id, job_id);

    process_pdf_job(&dequeued, &db)
        .await
        .expect("Process CAS job should succeed");

    // 6. Verify UploadJob transitions: COMPLETED with timestamps
    let finished_job = db
        .get_upload_job(job_id)
        .expect("UploadJob must exist in DB");
    assert_eq!(finished_job.status, UploadJobStatus::Completed);
    assert!(finished_job.started_at.is_some(), "started_at must be set");
    assert!(
        finished_job.completed_at.is_some(),
        "completed_at must be set"
    );
    assert!(finished_job.message.is_none(), "no error message expected");

    // 7. Verify temporary file was cleaned up by the worker
    assert!(
        !Path::new(&file_path).exists(),
        "Worker must clean up temporary uploaded file after completion"
    );

    // 8. Verify Multi-PAN Isolation & Ingested Entities
    // Self profile (ABCDE1234F)
    let profile_self = db
        .find_profile_by_pan(user.id, "ABCDE1234F")
        .expect("Self profile must exist");
    assert_eq!(profile_self.pan, "ABCDE1234F");

    let port_self = db
        .find_portfolio_by_profile(user.id, profile_self.id)
        .expect("Self portfolio must exist");

    let asset1 = db
        .find_asset_by_isin("INF204K01UN4")
        .expect("Nippon asset must exist");
    assert_eq!(asset1.amfi_code.as_deref(), Some("119551"));

    let folio1 = db
        .find_folio(port_self.id, asset1.id, "12345/NIPPON")
        .expect("Folio 1 must exist");
    let txs1 = db.list_by_folio(folio1.id).await.expect("folio 1 txs");
    assert_eq!(txs1.len(), 2);
    assert_eq!(txs1[0].tx_type, "PURCHASE");
    assert_eq!(txs1[0].units, dec("100.0"));
    assert_eq!(txs1[1].tx_type, "PURCHASE_SIP");
    assert_eq!(txs1[1].units, dec("50.0"));

    // Family Member profile (ALPAC1001A)
    let profile_member = db
        .find_profile_by_pan(user.id, "ALPAC1001A")
        .expect("Family member profile must exist");
    assert_eq!(profile_member.pan, "ALPAC1001A");

    let port_member = db
        .find_portfolio_by_profile(user.id, profile_member.id)
        .expect("Family portfolio must exist");
    assert_ne!(port_self.id, port_member.id);

    let asset2 = db
        .find_asset_by_isin("INF179K01BE2")
        .expect("HDFC asset must exist");
    let folio2 = db
        .find_folio(port_member.id, asset2.id, "67890/HDFC")
        .expect("Folio 2 must exist");
    let txs2 = db.list_by_folio(folio2.id).await.expect("folio 2 txs");
    assert_eq!(txs2.len(), 1);
    assert_eq!(txs2[0].units, dec("200.0"));

    // 9. Verify Chained History Refresh: Both touched portfolios must have historical valuations
    let valuations_self = db.list_historical_valuations(port_self.id);
    assert!(
        !valuations_self.is_empty(),
        "Self portfolio must have historical valuation timeline calculated"
    );
    let valuations_member = db.list_historical_valuations(port_member.id);
    assert!(
        !valuations_member.is_empty(),
        "Family member portfolio must have historical valuation timeline calculated"
    );
}

#[tokio::test]
async fn test_cas_upload_job_failure_missing_file() {
    let db = InMemoryDatabase::new();
    let user = db.create_user("neha.patel@example.com", "pwd");
    let job_id = Uuid::new_v4();
    let missing_path = "/tmp/non_existent_cas_upload_statement_9999.json";

    // Register job in DB
    db.create_upload_job(job_id, user.id, missing_path);

    let job_data = ProcessPdfUploadJobData::new(user.id, missing_path, job_id);

    // Process job with non-existent file
    let result = process_pdf_job(&job_data, &db).await;

    // Verify error returned is FileNotFound
    assert!(matches!(result, Err(WorkerError::FileNotFound(_))));

    // Verify UploadJob status in DB is FAILED with error message
    let failed_job = db.get_upload_job(job_id).expect("Job must exist");
    assert_eq!(failed_job.status, UploadJobStatus::Failed);
    assert!(failed_job.started_at.is_some());
    assert!(failed_job.completed_at.is_some());
    assert!(
        failed_job
            .message
            .as_deref()
            .unwrap_or("")
            .contains("File not found at path"),
        "Message should report missing file"
    );
}

#[tokio::test]
async fn test_cas_upload_job_failure_malformed_json_cleans_up_file() {
    let db = InMemoryDatabase::new();
    let user = db.create_user("investor.malformed@example.com", "pwd");
    let job_id = Uuid::new_v4();

    // Create a temp file with invalid JSON
    let mut temp_file = NamedTempFile::new().expect("temp file");
    temp_file
        .write_all(b"{ invalid_json_syntax: true,")
        .expect("write");
    let (_file, path_buf) = temp_file.keep().expect("keep");
    let file_path = path_buf.to_str().expect("path").to_string();

    db.create_upload_job(job_id, user.id, &file_path);
    let job_data = ProcessPdfUploadJobData::new(user.id, &file_path, job_id);

    let result = process_pdf_job(&job_data, &db).await;
    assert!(matches!(result, Err(WorkerError::ParseError(_))));

    // Verify status is FAILED
    let job = db.get_upload_job(job_id).expect("job");
    assert_eq!(job.status, UploadJobStatus::Failed);

    // Verify temporary file is cleaned up even on parse error
    assert!(
        !Path::new(&file_path).exists(),
        "Temporary file must be cleaned up even if parsing fails"
    );
}

#[tokio::test]
async fn test_nav_refresh_job_processing() {
    let db = InMemoryDatabase::new();

    // 1. Valid AMFI code with explicit date and NAV
    let test_date = NaiveDate::from_ymd_opt(2024, 6, 15).unwrap();
    let job_data = NavRefreshJobData::new("122639")
        .with_date(test_date)
        .with_nav(dec("145.7500"));

    let record = process_nav_refresh_job(&job_data, &db)
        .await
        .expect("NAV refresh should succeed");
    assert_eq!(record.amfi_code, "122639");
    assert_eq!(record.date, test_date);
    assert_eq!(record.nav, dec("145.7500"));

    // Verify stored in DB
    let found = db.get_nav("122639", test_date).expect("nav found in db");
    assert_eq!(found.nav, dec("145.7500"));

    // 2. Refresh with default date and default NAV
    let job_default = NavRefreshJobData::new("120716");
    let rec_default = process_nav_refresh_job(&job_default, &db)
        .await
        .expect("Default NAV refresh should succeed");
    assert_eq!(rec_default.amfi_code, "120716");
    assert_eq!(rec_default.nav, dec("100.00"));

    // 3. Validation: Non-numeric AMFI code must fail
    let invalid_job = NavRefreshJobData::new("AMFI_INVALID_ABC");
    let err_invalid = process_nav_refresh_job(&invalid_job, &db).await;
    assert!(matches!(err_invalid, Err(WorkerError::InvalidAmfiCode(_))));

    // 4. Validation: Empty AMFI code must fail
    let empty_job = NavRefreshJobData::new("   ");
    let err_empty = process_nav_refresh_job(&empty_job, &db).await;
    assert!(matches!(err_empty, Err(WorkerError::InvalidAmfiCode(_))));
}

#[tokio::test]
async fn test_history_refresh_job_processing() {
    let db = InMemoryDatabase::new();
    let user = db.create_user("valuation.user@example.com", "pwd");

    let portfolio = db
        .create_portfolio(user.id, "Wealth Accumulator", None)
        .await
        .expect("portfolio");

    let asset = db.create_asset(
        "MUTUAL_FUND",
        "UTI Nifty 50 Index Fund",
        Some("INF789FB1X41"),
        Some("120716"),
        None,
        None,
    );

    let folio = db
        .create_folio(portfolio.id, asset.id, "FOLIO-VAL-1", None, None)
        .expect("folio");

    // Checkpoint 1: 2023-01-10: Buy 100 units @ 100 = 10,000
    db.create_transaction(
        folio.id,
        NaiveDate::from_ymd_opt(2023, 1, 10).unwrap(),
        "PURCHASE",
        dec("10000.00"),
        dec("100.0000"),
        dec("100.0000"),
        dec("100.0000"),
        Some("TX-V1"),
    )
    .await
    .expect("tx1");

    // Checkpoint 2: 2023-06-15: Buy 50 units @ 120 = 6,000 (total units: 150, total cost: 16000)
    db.create_transaction(
        folio.id,
        NaiveDate::from_ymd_opt(2023, 6, 15).unwrap(),
        "PURCHASE_SIP",
        dec("6000.00"),
        dec("50.0000"),
        dec("120.0000"),
        dec("150.0000"),
        Some("TX-V2"),
    )
    .await
    .expect("tx2");

    // Process history refresh job
    let job_data = HistoryRefreshJobData::new(portfolio.id);
    let records = process_history_refresh_job(&job_data, &db)
        .await
        .expect("history refresh should succeed");

    assert!(records.len() >= 2, "Should have at least 2 checkpoints");

    // Verify Checkpoint 1
    let cp1 = &records[0];
    assert_eq!(cp1.date, NaiveDate::from_ymd_opt(2023, 1, 10).unwrap());
    assert_eq!(cp1.cost, dec("10000.00"));
    assert_eq!(cp1.value, dec("10000.000000"));

    // Verify Checkpoint 2
    let cp2 = &records[1];
    assert_eq!(cp2.date, NaiveDate::from_ymd_opt(2023, 6, 15).unwrap());
    assert_eq!(cp2.cost, dec("16000.00"));
    // 150 units * 120 NAV = 18,000
    assert_eq!(cp2.value, dec("18000.000000"));

    // Verify non-existent portfolio returns error
    let bad_portfolio_id = Uuid::new_v4();
    let bad_job = HistoryRefreshJobData::new(bad_portfolio_id);
    let bad_res = process_history_refresh_job(&bad_job, &db).await;
    assert!(matches!(bad_res, Err(WorkerError::PortfolioNotFound(_))));
}

#[tokio::test]
async fn test_in_memory_job_queue_operations() {
    let queue = InMemoryJobQueue::<NavRefreshJobData>::new();
    assert!(queue.is_empty().await);
    assert_eq!(queue.len().await, 0);

    let job1 = NavRefreshJobData::new("120716");
    let job2 = NavRefreshJobData::new("122639");

    let id1 = queue.enqueue(job1.clone()).await.expect("enqueue 1");
    let id2 = queue.enqueue(job2.clone()).await.expect("enqueue 2");

    assert!(!id1.is_empty());
    assert!(!id2.is_empty());
    assert_ne!(id1, id2);
    assert_eq!(queue.len().await, 2);

    // Verify FIFO ordering
    let dequeued1 = queue.dequeue().await.expect("dequeue 1").expect("some");
    assert_eq!(dequeued1.amfi_code, "120716");

    let dequeued2 = queue.dequeue().await.expect("dequeue 2").expect("some");
    assert_eq!(dequeued2.amfi_code, "122639");

    // Queue empty now
    let dequeued3 = queue.dequeue().await.expect("dequeue 3");
    assert!(dequeued3.is_none());
    assert!(queue.is_empty().await);

    // Test clear
    queue
        .enqueue(NavRefreshJobData::new("100001"))
        .await
        .unwrap();
    assert_eq!(queue.len().await, 1);
    queue.clear().await;
    assert!(queue.is_empty().await);
}

#[test]
fn test_job_models_serialization_wire_parity() {
    let user_id = Uuid::new_v4();
    let job_id = Uuid::new_v4();

    // 1. ProcessPdfUploadJobData: camelCase wire parity with BullMQ
    let pdf_job = ProcessPdfUploadJobData::new(user_id, "/tmp/test.pdf", job_id)
        .with_password("statement_pwd");
    let json = serde_json::to_string(&pdf_job).expect("serialize pdf job");
    assert!(json.contains("\"userId\""));
    assert!(json.contains("\"filePath\""));
    assert!(json.contains("\"password\""));
    assert!(json.contains("\"jobId\""));

    let deserialized: ProcessPdfUploadJobData =
        serde_json::from_str(&json).expect("deserialize pdf job");
    assert_eq!(deserialized, pdf_job);

    // 2. NavRefreshJobData
    let date = NaiveDate::from_ymd_opt(2024, 1, 1).unwrap();
    let nav_job = NavRefreshJobData::new("122639")
        .with_date(date)
        .with_nav(dec("150.00"));
    let nav_json = serde_json::to_string(&nav_job).expect("serialize nav job");
    assert!(nav_json.contains("\"amfiCode\""));
    assert!(nav_json.contains("\"asOfDate\""));
    assert!(nav_json.contains("\"nav\""));

    let deserialized_nav: NavRefreshJobData =
        serde_json::from_str(&nav_json).expect("deserialize nav job");
    assert_eq!(deserialized_nav, nav_job);

    // 3. HistoryRefreshJobData
    let port_id = Uuid::new_v4();
    let hist_job = HistoryRefreshJobData::new(port_id);
    let hist_json = serde_json::to_string(&hist_job).expect("serialize hist job");
    assert!(hist_json.contains("\"portfolioId\""));

    let deserialized_hist: HistoryRefreshJobData =
        serde_json::from_str(&hist_json).expect("deserialize hist job");
    assert_eq!(deserialized_hist, hist_job);
}

#[test]
fn test_redis_bull_queue_key_generation() {
    let client = redis::Client::open("redis://127.0.0.1:6379").expect("valid client");
    let queue = RedisBullQueue::new(client, "pdfUploadQueue");

    assert_eq!(queue.queue_name(), "pdfUploadQueue");
    assert_eq!(queue.wait_key(), "bull:pdfUploadQueue:wait");
    assert_eq!(queue.id_key(), "bull:pdfUploadQueue:id");
    assert_eq!(queue.job_key("101"), "bull:pdfUploadQueue:101");
}

#[tokio::test]
async fn test_multi_asset_portfolio_valuation_independent() {
    let db = InMemoryDatabase::new();
    let user = db.create_user("multi.asset@example.com", "pwd");

    let portfolio = db
        .create_portfolio(user.id, "Multi Asset Balanced", None)
        .await
        .expect("portfolio");

    // Asset A: Large Cap equity fund (NAV ~100)
    let asset_a = db.create_asset(
        "MUTUAL_FUND",
        "Nifty 50 Index Fund",
        Some("INF789FB1X41"),
        Some("120716"),
        None,
        None,
    );
    let folio_a = db
        .create_folio(portfolio.id, asset_a.id, "FOLIO-A", None, None)
        .expect("folio a");

    // Asset B: Liquid / Overnight fund (NAV ~10)
    let asset_b = db.create_asset(
        "MUTUAL_FUND",
        "Liquid Cash Fund",
        Some("INF200K01VA1"),
        Some("119551"),
        None,
        None,
    );
    let folio_b = db
        .create_folio(portfolio.id, asset_b.id, "FOLIO-B", None, None)
        .expect("folio b");

    let date1 = NaiveDate::from_ymd_opt(2023, 1, 15).unwrap();

    // Folio A: Buy 100 units @ 100 NAV = 10,000 cost, 10,000 value
    db.create_transaction(
        folio_a.id,
        date1,
        "PURCHASE",
        dec("10000.00"),
        dec("100.0000"),
        dec("100.0000"),
        dec("100.0000"),
        Some("TX-A1"),
    )
    .await
    .expect("tx a1");

    // Folio B: Buy 1,000 units @ 10 NAV = 10,000 cost, 10,000 value
    db.create_transaction(
        folio_b.id,
        date1,
        "PURCHASE",
        dec("10000.00"),
        dec("1000.0000"),
        dec("10.0000"),
        dec("1000.0000"),
        Some("TX-B1"),
    )
    .await
    .expect("tx b1");

    let job_data = HistoryRefreshJobData::new(portfolio.id);
    let records = process_history_refresh_job(&job_data, &db)
        .await
        .expect("multi asset history refresh should succeed");

    assert!(!records.is_empty());
    let checkpoint = &records[0];
    assert_eq!(checkpoint.date, date1);
    // Verified: Value must be (100 * 100) + (1000 * 10) = 10,000 + 10,000 = 20,000
    // NOT lumped into 1,100 * 10 = 11,000
    assert_eq!(checkpoint.value, dec("20000.00"));
    assert_eq!(checkpoint.cost, dec("20000.00"));

    // Checkpoint 2: Folio A sells 50 units (partial redemption) @ 120 NAV on 2023-04-01
    // Remaining in Folio A: 50 units @ 120 NAV = 6,000 value, 5,000 cost basis (FIFO)
    // Folio B remains: 1,000 units @ 10 NAV = 10,000 value, 10,000 cost basis
    // Total value = 6,000 + 10,000 = 16,000; Total cost = 5,000 + 10,000 = 15,000
    let date2 = NaiveDate::from_ymd_opt(2023, 4, 1).unwrap();
    db.create_transaction(
        folio_a.id,
        date2,
        "REDEMPTION",
        dec("6000.00"),
        dec("50.0000"),
        dec("120.0000"),
        dec("50.0000"),
        Some("TX-A2-SELL"),
    )
    .await
    .expect("tx a2 sell");

    let records2 = process_history_refresh_job(&job_data, &db)
        .await
        .expect("refresh after redemption");

    let cp2 = records2
        .iter()
        .find(|r| r.date == date2)
        .expect("date2 record");
    assert_eq!(cp2.value, dec("16000.00"));
    assert_eq!(cp2.cost, dec("15000.00"));
}

#[tokio::test]
async fn test_path_sandboxing_and_safe_cleanup() {
    let db = InMemoryDatabase::new();
    let user = db.create_user("security.sandbox@example.com", "pwd");

    // 1. Path traversal with .. must be rejected with ValidationError without touching filesystem
    let traversal_job_id = Uuid::new_v4();
    let traversal_path = "uploads/../../etc/passwd";
    db.create_upload_job(traversal_job_id, user.id, traversal_path);
    let job_data1 = ProcessPdfUploadJobData::new(user.id, traversal_path, traversal_job_id);
    let res1 = process_pdf_job(&job_data1, &db).await;
    assert!(matches!(res1, Err(WorkerError::ValidationError(_))));
    let failed_job1 = db.get_upload_job(traversal_job_id).unwrap();
    assert_eq!(failed_job1.status, UploadJobStatus::Failed);

    // 2. Disallowed directory outside uploads/ or temp dir must be rejected with ValidationError
    let disallowed_job_id = Uuid::new_v4();
    let disallowed_path = "/etc/hosts";
    db.create_upload_job(disallowed_job_id, user.id, disallowed_path);
    let job_data2 = ProcessPdfUploadJobData::new(user.id, disallowed_path, disallowed_job_id);
    let res2 = process_pdf_job(&job_data2, &db).await;
    assert!(matches!(res2, Err(WorkerError::ValidationError(_))));
    let failed_job2 = db.get_upload_job(disallowed_job_id).unwrap();
    assert_eq!(failed_job2.status, UploadJobStatus::Failed);

    // 3. validate_file_path unit assertions
    assert!(validate_file_path("/tmp/test.pdf").is_ok());
    assert!(validate_file_path("uploads/statement.pdf").is_ok());
    assert!(validate_file_path("./uploads/statement.pdf").is_ok());
    assert!(validate_file_path("/tmp/../etc/passwd").is_err());
    assert!(validate_file_path("uploads/../../etc/shadow").is_err());
    assert!(validate_file_path("/etc/shadow").is_err());
}

#[test]
fn test_date_parsing_and_tx_type_normalization() {
    // 1. DD/MM/YYYY date format
    let parsed_slash = parse_cas_date("15/01/2024").expect("valid DD/MM/YYYY");
    assert_eq!(parsed_slash, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());

    // Existing formats
    let parsed_iso = parse_cas_date("2024-01-15").expect("valid ISO");
    assert_eq!(parsed_iso, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());

    let parsed_dash = parse_cas_date("15-Jan-2024").expect("valid DD-Mon-YYYY");
    assert_eq!(parsed_dash, NaiveDate::from_ymd_opt(2024, 1, 15).unwrap());

    // 2. Transaction type priority: SWITCH_IN before PURCHASE, SWITCH_OUT before REDEMPTION
    assert_eq!(normalize_tx_type("SWITCH IN - PURCHASE"), "SWITCH_IN");
    assert_eq!(normalize_tx_type("SWITCH IN"), "SWITCH_IN");
    assert_eq!(normalize_tx_type("SWITCH_IN"), "SWITCH_IN");
    assert_eq!(normalize_tx_type("PURCHASE"), "PURCHASE");
    assert_eq!(normalize_tx_type("BUY"), "PURCHASE");

    assert_eq!(normalize_tx_type("SWITCH OUT - REDEMPTION"), "SWITCH_OUT");
    assert_eq!(normalize_tx_type("SWITCH OUT"), "SWITCH_OUT");
    assert_eq!(normalize_tx_type("SWITCH_OUT"), "SWITCH_OUT");
    assert_eq!(normalize_tx_type("REDEMPTION"), "REDEMPTION");
    assert_eq!(normalize_tx_type("SELL"), "REDEMPTION");
}

#[tokio::test]
async fn test_cas_upload_job_dummy_pdf_failure_and_cleanup() {
    let db = InMemoryDatabase::new();
    let user = db.create_user("pdf.failure@example.com", "secret");
    let job_id = Uuid::new_v4();

    // Create a temporary file with %PDF header but invalid/empty CAS contents
    let mut temp_file = NamedTempFile::new().expect("create temp file");
    temp_file
        .write_all(b"%PDF-1.4 dummy corrupt content")
        .expect("write dummy pdf");
    let temp_path = temp_file.path().to_path_buf();

    db.create_upload_job(job_id, user.id, &temp_path.to_string_lossy());

    let job_data =
        ProcessPdfUploadJobData::new(user.id, temp_path.to_string_lossy().to_string(), job_id);
    let result = process_pdf_job(&job_data, &db).await;

    // Should fail with ParseError because dummy content cannot be parsed
    assert!(result.is_err());
    let failed_job = db.get_upload_job(job_id).expect("job exists");
    assert_eq!(failed_job.status, UploadJobStatus::Failed);
    assert!(failed_job.message.is_some());

    // Verify temp file is cleanly removed
    assert!(!temp_path.exists());
}
