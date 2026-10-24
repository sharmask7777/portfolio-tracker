//! Rate-limited lazy mutual fund NAV synchronization service.
//!
//! Provides atomic 24-hour rate limiting (via Redis mutex `SET nav_sync:{amfiCode}:{date} 1 NX EX 86400`
//! with an in-memory `RwLock<HashSet>` fallback) and asynchronous background fetching from `api.mfapi.in`.

use std::collections::HashSet;
use std::sync::Arc;

use chrono::NaiveDate;
use tokio::sync::RwLock;

use crate::state::AppState;

/// Thread-safe in-memory rate limiter tracking sync events per (AMFI code, date).
///
/// Used for hermetic unit testing and offline fallback when Redis is unavailable.
#[derive(Clone, Debug, Default)]
pub struct InMemoryRateLimiter {
    entries: Arc<RwLock<HashSet<(String, NaiveDate)>>>,
}

impl InMemoryRateLimiter {
    /// Creates a new empty in-memory rate limiter.
    pub fn new() -> Self {
        Self {
            entries: Arc::new(RwLock::new(HashSet::new())),
        }
    }

    /// Wraps an existing shared entries set.
    pub fn from_shared(entries: Arc<RwLock<HashSet<(String, NaiveDate)>>>) -> Self {
        Self { entries }
    }

    /// Attempts to acquire the rate-limit token for an AMFI code on a specific date.
    ///
    /// Returns `true` if acquired (first call for this AMFI code on this date),
    /// or `false` if already acquired (throttled).
    pub async fn try_acquire(&self, amfi_code: &str, date: NaiveDate) -> bool {
        let mut set = self.entries.write().await;
        set.insert((amfi_code.to_string(), date))
    }

    /// Returns the underlying shared set reference.
    pub fn inner(&self) -> Arc<RwLock<HashSet<(String, NaiveDate)>>> {
        Arc::clone(&self.entries)
    }
}

/// Service handling mutual fund NAV freshness checks, atomic rate limiting,
/// and background lazy fetching.
pub struct NavSyncService;

impl NavSyncService {
    /// Attempts to atomically acquire the daily sync lock for `amfi_code` on `date`.
    ///
    /// If Redis is configured and reachable, executes `SET nav_sync:{amfi_code}:{date} 1 NX EX 86400`.
    /// If Redis is not configured or fails, falls back to `state.nav_rate_limiter`.
    pub async fn try_acquire_daily_sync(
        state: &AppState,
        amfi_code: &str,
        date: NaiveDate,
    ) -> bool {
        if let Some(client) = &state.redis {
            match client.get_multiplexed_async_connection().await {
                Ok(mut conn) => {
                    let key = format!("nav_sync:{amfi_code}:{date}");
                    let res: Result<Option<String>, _> = redis::cmd("SET")
                        .arg(&key)
                        .arg("1")
                        .arg("NX")
                        .arg("EX")
                        .arg(86400)
                        .query_async(&mut conn)
                        .await;
                    match res {
                        Ok(Some(_)) => return true,
                        Ok(None) => return false,
                        Err(e) => {
                            tracing::warn!(
                                amfi_code = %amfi_code,
                                error = %e,
                                "Redis rate-limit query failed; falling back to in-memory limiter"
                            );
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!(
                        amfi_code = %amfi_code,
                        error = %e,
                        "Failed to connect to Redis; falling back to in-memory limiter"
                    );
                }
            }
        }

        // In-memory fallback
        let mut set = state.nav_rate_limiter.write().await;
        set.insert((amfi_code.to_string(), date))
    }

    /// Directly acquires daily sync token against an active Redis multiplexed connection.
    pub async fn try_acquire_with_redis(
        conn: &mut redis::aio::MultiplexedConnection,
        amfi_code: &str,
        date: NaiveDate,
    ) -> Result<bool, redis::RedisError> {
        let key = format!("nav_sync:{amfi_code}:{date}");
        let res: Option<String> = redis::cmd("SET")
            .arg(&key)
            .arg("1")
            .arg("NX")
            .arg("EX")
            .arg(86400)
            .query_async(conn)
            .await?;
        Ok(res.is_some())
    }

    /// Fetches latest NAV from MFAPI and upserts into `HistoricalNAV` and `state.db`.
    pub async fn fetch_and_upsert_latest_nav(
        state: &AppState,
        amfi_code: &str,
        base_url: Option<&str>,
    ) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
        let base = base_url.unwrap_or("https://api.mfapi.in");
        let url = format!("{base}/mf/{amfi_code}/latest");

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(3))
            .build()?;

        let resp = client.get(&url).send().await?;
        if !resp.status().is_success() {
            return Err(format!("MFAPI returned HTTP {}", resp.status()).into());
        }

        let payload: portfolio_db::market_data::MfApiLatestResponse = resp.json().await?;
        let Some(record) = payload.data.first() else {
            return Err("MFAPI returned empty NAV data array".into());
        };

        let Some(nav_date) = portfolio_db::market_data::parse_mfapi_date(&record.date) else {
            return Err(
                format!("Failed to parse date '{}' from MFAPI response", record.date).into(),
            );
        };

        if let Some(pool) = state.pool() {
            sqlx::query(
                r#"
                INSERT INTO "HistoricalNAV" (id, "amfiCode", date, nav, "createdAt")
                VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())
                ON CONFLICT ("amfiCode", date) DO UPDATE SET nav = EXCLUDED.nav;
                "#,
            )
            .bind(amfi_code)
            .bind(nav_date)
            .bind(record.nav)
            .execute(pool)
            .await?;
        }

        // Always store into in-memory database mock for hermetic testing and offline mode
        state.db.store_nav(amfi_code, nav_date, record.nav);

        Ok(true)
    }

    /// Spawns an asynchronous background task to fetch the latest NAV from MFAPI and upsert into the database.
    ///
    /// Executes fire-and-forget; errors are logged at `tracing::warn` without panicking or bubbling up.
    pub fn spawn_lazy_nav_fetch(state: AppState, amfi_code: String) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            let base_url = std::env::var("MFAPI_BASE_URL").ok();
            if let Err(e) =
                Self::fetch_and_upsert_latest_nav(&state, &amfi_code, base_url.as_deref()).await
            {
                tracing::warn!(
                    amfi_code = %amfi_code,
                    error = %e,
                    "Background lazy NAV sync failed"
                );
            }
        })
    }

    /// Validates `amfi_code`, acquires daily sync rate limit, and spawns background fetch if fresh.
    ///
    /// Returns `true` if sync was triggered, or `false` if skipped or throttled.
    pub async fn check_and_trigger_lazy_sync(state: &AppState, amfi_code: &str) -> bool {
        let clean_code = amfi_code.trim();
        // Skip non-numeric or empty AMFI codes (e.g. stocks, unlisted assets, malformed data)
        if clean_code.is_empty() || !clean_code.chars().all(|c| c.is_ascii_digit()) {
            return false;
        }

        let today = chrono::Utc::now().date_naive();
        if Self::try_acquire_daily_sync(state, clean_code, today).await {
            Self::spawn_lazy_nav_fetch(state.clone(), clean_code.to_string());
            true
        } else {
            false
        }
    }
}
