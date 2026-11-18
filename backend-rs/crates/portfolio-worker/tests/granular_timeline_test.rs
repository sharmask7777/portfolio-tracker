//! Integration tests verifying granular historical valuation timeline reconstruction and gap handling.

use std::str::FromStr;

use chrono::NaiveDate;
use portfolio_db::InMemoryDatabase;
use portfolio_db::repositories::{PortfolioRepository, TransactionRepository};
use portfolio_worker::jobs::{HistoryRefreshJobData, process_history_refresh_job};
use rust_decimal::Decimal;

fn dec(s: &str) -> Decimal {
    Decimal::from_str(s).expect("valid decimal string")
}

#[tokio::test]
async fn test_multi_year_gap_marked_to_market_smoothly() {
    let db = InMemoryDatabase::new();
    let user = db.create_user("investor.gap@example.com", "hash");
    let portfolio = db
        .create_portfolio(user.id, "Multi Year Gap Test Portfolio", None)
        .await
        .expect("portfolio created");

    let amfi_code = "120716"; // UTI Nifty 50 Index Fund
    let asset = db.create_asset(
        "MUTUAL_FUND",
        "UTI Nifty 50 Index Fund - Direct Plan",
        Some("INF789K01UT1"),
        Some(amfi_code),
        None,
        None,
    );

    let folio = db
        .create_folio(portfolio.id, asset.id, "FOLIO-UTI-1", None, None)
        .expect("folio");

    let t_start = NaiveDate::from_ymd_opt(2023, 2, 27).expect("valid start date");
    let t_gap_mid = NaiveDate::from_ymd_opt(2023, 12, 29).expect("valid mid date"); // Friday
    let t_end = NaiveDate::from_ymd_opt(2024, 11, 18).expect("valid end date");

    // 1. Initial purchase on 2023-02-27 @ NAV 118.24
    db.create_transaction(
        folio.id,
        t_start,
        "PURCHASE",
        dec("118240.00"),
        dec("1000.0000"),
        dec("118.2400"),
        dec("1000.0000"),
        Some("TX-GAP-1"),
    )
    .await
    .expect("tx1");

    // Store intermediate NAV on 2023-12-29 @ NAV 140.00 (Friday)
    db.store_nav(amfi_code, t_gap_mid, dec("140.00"));

    // 2. Second purchase on 2024-11-18 @ NAV 162.18
    db.store_nav(amfi_code, t_end, dec("162.18"));
    db.create_transaction(
        folio.id,
        t_end,
        "PURCHASE",
        dec("162180.00"),
        dec("1000.0000"),
        dec("162.1800"),
        dec("2000.0000"),
        Some("TX-GAP-2"),
    )
    .await
    .expect("tx2");

    let job_data = HistoryRefreshJobData::new(portfolio.id);
    let records = process_history_refresh_job(&job_data, &db)
        .await
        .expect("history refresh should succeed");

    // Assert that intermediate checkpoints exist during the gap
    let mid_rec = records
        .iter()
        .find(|r| r.date == t_gap_mid)
        .expect("should have recorded checkpoint on Friday 2023-12-29");

    // On 2023-12-29, holding had 1000 units marked to 140.00 = 140,000 (NOT frozen at 118,240!)
    assert_eq!(mid_rec.cost, dec("118240.00"));
    assert_eq!(mid_rec.value, dec("140000.000000"));

    // On 2024-11-18 after second trade: 2000 units * 162.18 = 324,360
    let end_rec = records
        .iter()
        .find(|r| r.date == t_end)
        .expect("should have recorded checkpoint on 2024-11-18");
    assert_eq!(end_rec.cost, dec("280420.00"));
    assert_eq!(end_rec.value, dec("324360.000000"));
}
