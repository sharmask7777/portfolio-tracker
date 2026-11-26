#![allow(missing_docs, clippy::unwrap_used, clippy::panic)]

//! Live database integration test for `cas_ingest_repo` functions.
//!
//! When `DATABASE_URL` is set (e.g. in local Docker dev or CI test runners),
//! verifies that all SQL queries in `cas_ingest_repo` execute cleanly against
//! real PostgreSQL without syntax errors, missing columns, or type coercion failures.

use std::env;

use chrono::NaiveDate;
use rust_decimal::Decimal;
use uuid::Uuid;

use portfolio_db::init_schema;
use portfolio_db::repositories::*;

#[tokio::test]
async fn test_cas_ingest_repo_against_real_postgres() {
    let database_url = match env::var("DATABASE_URL") {
        Ok(url) if !url.trim().is_empty() => url,
        _ => {
            eprintln!("ℹ️ Skipping live database test: DATABASE_URL is not set");
            return;
        }
    };

    let pool = match sqlx::PgPool::connect(&database_url).await {
        Ok(p) => p,
        Err(e) => {
            eprintln!("ℹ️ Skipping live database test (could not connect to DATABASE_URL): {e}");
            return;
        }
    };

    // Ensure schema is fully initialized
    init_schema(&pool)
        .await
        .expect("init_schema must succeed against PostgreSQL");

    let test_user_id = Uuid::new_v4();
    let email = format!("live-test-{}@example.com", test_user_id);

    // Seed test user
    sqlx::query(
        r#"
        INSERT INTO "User" (id, email, password, "createdAt", "updatedAt")
        VALUES ($1, $2, 'dummyhashforlivetest', NOW(), NOW())
        "#,
    )
    .bind(test_user_id.to_string())
    .bind(&email)
    .execute(&pool)
    .await
    .expect("test user insert must succeed");

    // 1. Profile upsert
    let profile_id = upsert_postgres_profile(
        &pool,
        test_user_id,
        "ABCDE1234F",
        "Aarav Sharma",
        Decimal::new(30, 2),
    )
    .await
    .expect("upsert_postgres_profile must succeed");

    // 2. Portfolio upsert
    let portfolio_id =
        upsert_postgres_portfolio(&pool, test_user_id, profile_id, "Test Live Portfolio")
            .await
            .expect("upsert_postgres_portfolio must succeed");

    // 3. Asset upsert
    let asset_id = upsert_postgres_asset(
        &pool,
        "HDFC Top 100 Fund Direct Plan Growth",
        Some("INF179K01BE2"),
        Some("100033"),
    )
    .await
    .expect("upsert_postgres_asset must succeed");

    // 4. Folio upsert
    let folio_id = upsert_postgres_folio(
        &pool,
        portfolio_id,
        asset_id,
        "12345/LIVE",
        Some("HDFC Mutual Fund"),
        Some("ABCDE1234F"),
    )
    .await
    .expect("upsert_postgres_folio must succeed");

    // 5. Transaction insertion
    let ext_id = format!("live-tx-{}", Uuid::new_v4());
    insert_postgres_transaction(
        &pool,
        folio_id,
        NaiveDate::from_ymd_opt(2023, 1, 15).expect("valid date"),
        "PURCHASE",
        Decimal::new(10000, 0),
        Decimal::new(100, 0),
        Decimal::new(100, 0),
        Decimal::new(100, 0),
        &ext_id,
    )
    .await
    .expect("insert_postgres_transaction must succeed");

    // 6. Portfolio exists check and transaction retrieval
    let exists = check_portfolio_exists(&pool, portfolio_id)
        .await
        .expect("check_portfolio_exists must succeed");
    assert!(exists);

    let txs = fetch_portfolio_transactions(&pool, portfolio_id)
        .await
        .expect("fetch_portfolio_transactions must succeed");
    assert_eq!(txs.len(), 1);
    assert_eq!(txs[0].external_id.as_deref(), Some(ext_id.as_str()));

    // 7. PortfolioHistory upsert (regression check for column 'updatedAt')
    let history_id = Uuid::new_v4();
    upsert_portfolio_history(
        &pool,
        history_id,
        portfolio_id,
        NaiveDate::from_ymd_opt(2023, 1, 15).expect("valid date"),
        Decimal::new(10000, 0),
        Decimal::new(10000, 0),
    )
    .await
    .expect(
        "upsert_portfolio_history must execute without column or type errors against PostgreSQL",
    );

    // 8. Verify clean-slate purge_folio_transactions against real PostgreSQL
    purge_folio_transactions(&pool, folio_id)
        .await
        .expect("purge_folio_transactions must succeed against PostgreSQL");
    let txs_after_purge = fetch_portfolio_transactions(&pool, portfolio_id)
        .await
        .expect("fetch_portfolio_transactions must succeed");
    assert_eq!(
        txs_after_purge.len(),
        0,
        "All transactions for purged folio must be cleared"
    );

    // 9. Verify self-healing transaction deduplication migration in init_schema
    // Insert two identical clone transactions with raw SQL
    let tx_clone_1 = Uuid::new_v4();
    let tx_clone_2 = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO "Transaction" (id, date, type, amount, units, nav, balance, "folioId", "externalId", "createdAt", "updatedAt")
        VALUES ($1, '2023-01-15 00:00:00', 'PURCHASE', 10000.0, 100.0, 100.0, 100.0, $3, $4, NOW(), NOW()),
               ($2, '2023-01-15 00:00:00', 'PURCHASE', 10000.0, 100.0, 100.0, 100.0, $3, $5, NOW(), NOW())
        "#,
    )
    .bind(tx_clone_1.to_string())
    .bind(tx_clone_2.to_string())
    .bind(folio_id.to_string())
    .bind(format!("dup-ext-1-{tx_clone_1}"))
    .bind(format!("dup-ext-2-{tx_clone_2}"))
    .execute(&pool)
    .await
    .expect("seeding clone transactions must succeed");

    let txs_before_migration = fetch_portfolio_transactions(&pool, portfolio_id)
        .await
        .expect("fetch must succeed");
    assert_eq!(
        txs_before_migration.len(),
        2,
        "Both clones exist before migration"
    );

    // Reset migration record in _SchemaMigrations to simulate first-time migration trigger on startup
    sqlx::query(r#"DELETE FROM "_SchemaMigrations" WHERE id = 'dedup_legacy_transactions_v2'"#)
        .execute(&pool)
        .await
        .expect("clearing migration record must succeed");

    // Run init_schema: self-healing deduplication migration runs and deletes the duplicate clone
    init_schema(&pool)
        .await
        .expect("init_schema must succeed and run self-healing deduplication");

    let txs_after_migration = fetch_portfolio_transactions(&pool, portfolio_id)
        .await
        .expect("fetch must succeed");
    assert_eq!(
        txs_after_migration.len(),
        1,
        "Deduplication migration must cleanly keep exactly 1 canonical record"
    );

    // 10. Verify self-healing folio merge migration in init_schema
    // Insert a twin folio with space and check digit '/ 0'
    let twin_folio_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO "Folio" (id, number, amc, pan, "portfolioId", "assetId", "createdAt", "updatedAt")
        VALUES ($1, '12345 / 0', 'HDFC Mutual Fund', 'ABCDE1234F', $2, $3, NOW(), NOW())
        "#,
    )
    .bind(twin_folio_id.to_string())
    .bind(portfolio_id.to_string())
    .bind(asset_id.to_string())
    .execute(&pool)
    .await
    .expect("seeding twin folio must succeed");

    // Insert an identical transaction into twin folio
    let twin_tx_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO "Transaction" (id, date, type, amount, units, nav, balance, "folioId", "externalId", "createdAt", "updatedAt")
        VALUES ($1, '2023-01-15 00:00:00', 'PURCHASE', 10000.0, 100.0, 100.0, 100.0, $2, $3, NOW(), NOW())
        "#,
    )
    .bind(twin_tx_id.to_string())
    .bind(twin_folio_id.to_string())
    .bind(format!("twin-tx-{twin_tx_id}"))
    .execute(&pool)
    .await
    .expect("seeding twin transaction must succeed");

    // Reset migration record
    sqlx::query(
        r#"DELETE FROM "_SchemaMigrations" WHERE id = 'reconcile_and_merge_duplicate_folios_v3'"#,
    )
    .execute(&pool)
    .await
    .expect("clearing folio migration record must succeed");

    // Run init_schema: self-healing migration merges twin folios and deduplicates transactions
    init_schema(&pool)
        .await
        .expect("init_schema must succeed and run self-healing folio merge");

    // Verify twin folio was deleted and transactions were merged without duplicates
    let folios_after = sqlx::query_scalar::<_, i64>(
        r#"SELECT count(*) FROM "Folio" WHERE "portfolioId" = $1 AND "assetId" = $2"#,
    )
    .bind(portfolio_id.to_string())
    .bind(asset_id.to_string())
    .fetch_one(&pool)
    .await
    .expect("count folios must succeed");
    assert_eq!(folios_after, 1, "Twin folio must be cleanly merged away");

    let txs_after_merge = fetch_portfolio_transactions(&pool, portfolio_id)
        .await
        .expect("fetch must succeed");
    assert_eq!(
        txs_after_merge.len(),
        1,
        "Merged transaction ledger must have zero duplicate transactions"
    );
}

#[tokio::test]
async fn test_upsert_postgres_folio_deduplicates_whitespace_and_check_digits() {
    let database_url = match env::var("DATABASE_URL") {
        Ok(url) if !url.trim().is_empty() => url,
        _ => {
            eprintln!("ℹ️ Skipping live database test: DATABASE_URL is not set");
            return;
        }
    };

    let pool = match sqlx::PgPool::connect(&database_url).await {
        Ok(p) => p,
        Err(e) => {
            eprintln!("ℹ️ Skipping live database test (could not connect to DATABASE_URL): {e}");
            return;
        }
    };

    let test_user_id = Uuid::new_v4();
    let email = format!("folio-test-{}@example.com", test_user_id);

    sqlx::query(
        r#"
        INSERT INTO "User" (id, email, password, "createdAt", "updatedAt")
        VALUES ($1, $2, 'dummyhashforlivetest', NOW(), NOW())
        "#,
    )
    .bind(test_user_id.to_string())
    .bind(&email)
    .execute(&pool)
    .await
    .expect("test user insert must succeed");

    let profile_id = upsert_postgres_profile(
        &pool,
        test_user_id,
        "ALPAC1001A",
        "Aarav Sharma",
        Decimal::new(30, 2),
    )
    .await
    .expect("upsert_postgres_profile must succeed");

    let portfolio_id =
        upsert_postgres_portfolio(&pool, test_user_id, profile_id, "Folio Dedup Portfolio")
            .await
            .expect("upsert_postgres_portfolio must succeed");

    let asset_id = upsert_postgres_asset(
        &pool,
        "UTI Nifty 50 Index Fund Direct Growth",
        Some("INF789FB1X41"),
        Some("120716"),
    )
    .await
    .expect("upsert_postgres_asset must succeed");

    // Upload 1: Registrar format with space and / 0 check digit
    let folio_id_1 = upsert_postgres_folio(
        &pool,
        portfolio_id,
        asset_id,
        "577329058171 / 0",
        Some("UTI Mutual Fund"),
        Some("ALPAC1001A"),
    )
    .await
    .expect("first folio upsert must succeed");

    // Upload 2: Registrar format without / 0
    let folio_id_2 = upsert_postgres_folio(
        &pool,
        portfolio_id,
        asset_id,
        "577329058171",
        Some("UTI Mutual Fund"),
        Some("ALPAC1001A"),
    )
    .await
    .expect("second folio upsert must succeed");

    assert_eq!(
        folio_id_1, folio_id_2,
        "upsert_postgres_folio MUST return the exact same UUID when folio differs only by '/ 0'"
    );

    // Upload 3: Slash with space before vs slash without space before
    let asset2_id = upsert_postgres_asset(
        &pool,
        "ICICI Prudential Equity & Debt Fund",
        Some("INF109K011B1"),
        Some("100035"),
    )
    .await
    .expect("upsert_postgres_asset must succeed");

    let folio_sub_1 = upsert_postgres_folio(
        &pool,
        portfolio_id,
        asset2_id,
        "14751338 / 05",
        Some("ICICI Prudential Mutual Fund"),
        Some("ALPAC1001A"),
    )
    .await
    .expect("first sub-account upsert must succeed");

    let folio_sub_2 = upsert_postgres_folio(
        &pool,
        portfolio_id,
        asset2_id,
        "14751338/ 05",
        Some("ICICI Prudential Mutual Fund"),
        Some("ALPAC1001A"),
    )
    .await
    .expect("second sub-account upsert must succeed");

    assert_eq!(
        folio_sub_1, folio_sub_2,
        "upsert_postgres_folio MUST return the exact same UUID when folio differs only by whitespace around '/'"
    );
}
