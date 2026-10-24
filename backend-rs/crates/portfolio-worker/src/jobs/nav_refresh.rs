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

async fn fetch_mfapi_nav(url: &str) -> Option<(chrono::NaiveDate, Decimal)> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .ok()?;
    let resp = client.get(url).send().await.ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let payload = resp
        .json::<portfolio_db::market_data::MfApiLatestResponse>()
        .await
        .ok()?;
    let record = payload.data.first()?;
    let parsed_date = portfolio_db::market_data::parse_mfapi_date(&record.date)?;
    if record.nav <= Decimal::ZERO {
        return None;
    }
    Some((parsed_date, record.nav))
}

/// Core handler for processing NAV refresh jobs.
///
/// Lifecycle:
/// 1. Validates the AMFI code format (must be non-empty digits).
/// 2. If explicit NAV provided in `job_data`, stores it with specified or current UTC date.
/// 3. If NAV is None, attempts to fetch latest live NAV from MFAPI (`https://api.mfapi.in/mf/{amfi_code}/latest`).
/// 4. If HTTP fetch fails or returns invalid data, falls back gracefully to existing DB NAV or default 100.00.
/// 5. Stores updated NAV record in database.
pub async fn process_nav_refresh_job(
    job_data: &NavRefreshJobData,
    db: &InMemoryDatabase,
) -> Result<HistoricalNavEntity, WorkerError> {
    let code = validate_amfi_code(&job_data.amfi_code)?;

    let (date, nav_value) = if let Some(n) = job_data.nav {
        let date = job_data
            .as_of_date
            .unwrap_or_else(|| Utc::now().date_naive());
        (date, n)
    } else {
        // Attempt live fetch from MFAPI
        let base_url =
            std::env::var("MFAPI_BASE_URL").unwrap_or_else(|_| "https://api.mfapi.in".to_string());
        let url = format!("{}/mf/{code}/latest", base_url.trim_end_matches('/'));

        if let Some((d, n)) = fetch_mfapi_nav(&url).await {
            let date = job_data.as_of_date.unwrap_or(d);
            (date, n)
        } else {
            // Fallback gracefully to existing DB nav or default 100.00
            let date = job_data
                .as_of_date
                .unwrap_or_else(|| Utc::now().date_naive());
            let nav = if let Some(existing) = db.get_nav(code, date) {
                existing.nav
            } else {
                Decimal::new(10000, 2) // Default 100.00
            };
            (date, nav)
        }
    };

    let record = db.store_nav(code, date, nav_value);
    Ok(record)
}

/// Helper handler for processing NAV refresh jobs with optional PostgreSQL pool.
///
/// When `pool` is provided, upserts the record into the PostgreSQL `HistoricalNAV` table.
pub async fn process_nav_refresh_job_with_pool(
    job_data: &NavRefreshJobData,
    db: &InMemoryDatabase,
    pool: Option<&sqlx::PgPool>,
) -> Result<HistoricalNavEntity, WorkerError> {
    let record = process_nav_refresh_job(job_data, db).await?;

    if let Some(pool) = pool {
        sqlx::query(
            r#"
            INSERT INTO "HistoricalNAV" (id, "amfiCode", date, nav, "createdAt")
            VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())
            ON CONFLICT ("amfiCode", date) DO UPDATE SET nav = EXCLUDED.nav;
            "#,
        )
        .bind(&record.amfi_code)
        .bind(record.date)
        .bind(record.nav)
        .execute(pool)
        .await
        .map_err(|e| WorkerError::Db(portfolio_db::DbError::Sqlx(e)))?;
    }

    Ok(record)
}
