# Lazy NAV Updating on UX Load Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automatic, rate-limited lazy updating of mutual fund Net Asset Values (NAVs) when the user loads the dashboard UX (at most once every 24 hours per scheme), eliminating stale portfolio valuations.

**Architecture:** 
1. When the UX requests portfolio summaries (`/api/portfolio/summary`), `portfolio-api` identifies active mutual fund holdings and checks their freshness.
2. An atomic 24-hour rate limit mutex (`nav_sync:{amfiCode}:{YYYY-MM-DD}`) via Redis (with an in-memory concurrent map fallback) ensures each scheme is refreshed at most once a day.
3. A background task in `portfolio-api` (and job in `portfolio-worker`) fetches the latest NAV from `https://api.mfapi.in/mf/{amfiCode}/latest` and upserts into PostgreSQL `HistoricalNAV`.
4. `fetch_latest_nav` in `portfolio-api` is enhanced with date-precedence logic so fresh transaction NAVs are never overridden by older historical NAV records.

**Tech Stack:** Rust 2024, Tokio, Axum, SQLx (PostgreSQL), Redis, Reqwest (Rustls), Serde.

**Spec:** [docs/domain/market_data_pipeline.md](file:///Users/shaleensharma/workplace/gemini_ws/portfolio-tracker/docs/domain/market_data_pipeline.md)

## Global Constraints
- Zero Real Data Commitment: Synthetic test data only (no real PANs, names, folios, or real statement files).
- Zero-I/O in `portfolio-core`: All external network/DB calls remain strictly in `portfolio-api`, `portfolio-worker`, and `portfolio-db`. Domain calculations in `portfolio-core` remain pure.
- Hermetic Testing: Tests must execute cleanly with cargo test and in-memory mocks without requiring live internet connections.
- Precision Invariants: Financial amounts $\Delta \le ₹0.01$, Units $\Delta \le 0.0001$, Returns $\Delta \le 10^{-6}$.

## Review Focus
1. External API Outage: If `api.mfapi.in` returns 5xx or times out, the API must fail open gracefully, log a warning, and preserve existing NAVs without blocking the user request.
2. Concurrent UX Requests: If a user rapidly reloads or switches family member profiles, the Redis mutex must prevent duplicate parallel HTTP requests to `api.mfapi.in` for the same AMFI code.
3. Weekend / Market Holiday NAV: On weekends or non-trading holidays, MFAPI returns Friday's date; the rate limiter must still throttle to once per day and not loop continuously.
4. Missing / Invalid AMFI Code: Folios with missing, malformed, or non-mutual-fund assets (stocks, unlisted assets) must be skipped cleanly without errors.
5. In-Memory Fallback: When Redis is disabled or offline, an in-memory `DashMap` or `RwLock<HashSet>` must enforce the 24-hour throttling hermetically.

---

### Task 1: Add `reqwest` & Define MFAPI Response Types in `portfolio-db` or Shared Module

**Files:**
- Modify: `backend-rs/Cargo.toml:17-32`
- Modify: `backend-rs/crates/portfolio-api/Cargo.toml:6-26`
- Modify: `backend-rs/crates/portfolio-worker/Cargo.toml:6-22`
- Create: `backend-rs/crates/portfolio-db/src/market_data.rs`
- Modify: `backend-rs/crates/portfolio-db/src/lib.rs`
- Test: `backend-rs/crates/portfolio-db/tests/market_data_test.rs`

**Interfaces:**
- Produces: `MfApiLatestResponse`, `MfApiNavRecord`, `parse_mfapi_date(s: &str) -> Option<NaiveDate>`
- Consumes: `serde`, `chrono::NaiveDate`, `rust_decimal::Decimal`

- [ ] **Step 1: Write failing unit test for MFAPI response deserialization**

```rust
// backend-rs/crates/portfolio-db/tests/market_data_test.rs
use portfolio_db::market_data::{MfApiLatestResponse, parse_mfapi_date};
use rust_decimal::Decimal;

#[test]
fn test_deserialize_mfapi_latest_response() {
    let json_data = r#"{"meta":{"scheme_code":122639,"scheme_name":"Parag Parikh Flexi Cap Fund"},"data":[{"date":"23-10-2026","nav":"88.96950"}],"status":"SUCCESS"}"#;
    let resp: MfApiLatestResponse = serde_json::from_str(json_data).expect("valid mfapi payload");
    assert_eq!(resp.status, "SUCCESS");
    assert_eq!(resp.data.len(), 1);
    assert_eq!(resp.data[0].nav, Decimal::from_str_exact("88.96950").unwrap());
    assert_eq!(parse_mfapi_date(&resp.data[0].date).unwrap().to_string(), "2026-10-23");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --package portfolio-db --test market_data_test`
Expected: FAIL (types not found)

- [ ] **Step 3: Implement `market_data.rs` and add `reqwest` dependency**

Add `reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }` to workspace `Cargo.toml`.
In `backend-rs/crates/portfolio-db/src/market_data.rs`, implement `MfApiLatestResponse`, `MfApiNavRecord`, and `parse_mfapi_date` (parsing `"DD-MM-YYYY"` format).

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --package portfolio-db --test market_data_test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-rs/Cargo.toml backend-rs/crates/portfolio-api/Cargo.toml backend-rs/crates/portfolio-worker/Cargo.toml backend-rs/crates/portfolio-db/src/market_data.rs backend-rs/crates/portfolio-db/src/lib.rs backend-rs/crates/portfolio-db/tests/market_data_test.rs
git commit -m "feat(portfolio-db): add MFAPI payload models and date parser"
```

---

### Task 2: Implement 24-Hour Lazy Sync Rate Limiter & Fetcher in `portfolio-api`

**Files:**
- Create: `backend-rs/crates/portfolio-api/src/services/nav_sync.rs`
- Modify: `backend-rs/crates/portfolio-api/src/services/mod.rs`
- Modify: `backend-rs/crates/portfolio-api/src/state.rs`
- Test: `backend-rs/crates/portfolio-api/tests/nav_sync_test.rs`

**Interfaces:**
- Consumes: `AppState`, `amfi_code: &str`, `pool: PgPool`, `redis: Option<redis::aio::MultiplexedConnection>`
- Produces: `NavSyncService::check_and_trigger_lazy_sync(&state, amfi_code: &str) -> bool`

- [ ] **Step 1: Write unit tests for atomic 24-hour rate limiting**

```rust
// backend-rs/crates/portfolio-api/tests/nav_sync_test.rs
#[tokio::test]
async fn test_rate_limiter_allows_first_call_and_blocks_subsequent_calls_same_day() {
    let limiter = InMemoryRateLimiter::new();
    let today = chrono::NaiveDate::from_ymd_opt(2026, 10, 24).unwrap();
    assert!(limiter.try_acquire("122639", today).await);
    assert!(!limiter.try_acquire("122639", today).await); // second call throttled
    let tomorrow = chrono::NaiveDate::from_ymd_opt(2026, 10, 25).unwrap();
    assert!(limiter.try_acquire("122639", tomorrow).await); // new day allowed
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --package portfolio-api --test nav_sync_test`
Expected: FAIL

- [ ] **Step 3: Implement `NavSyncService` with Redis `SET NX EX 86400` and in-memory fallback**

Implement `try_acquire_daily_sync(amfi_code, date)` and `spawn_lazy_nav_fetch(state, amfi_code)`.
The fetcher queries `https://api.mfapi.in/mf/{amfi_code}/latest` with a 3-second timeout, parses the NAV and date, and executes:
```sql
INSERT INTO "HistoricalNAV" (id, "amfiCode", date, nav, "createdAt")
VALUES (gen_random_uuid()::text, $1, $2, $3, NOW())
ON CONFLICT ("amfiCode", date) DO UPDATE SET nav = EXCLUDED.nav;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --package portfolio-api --test nav_sync_test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-rs/crates/portfolio-api/src/services/nav_sync.rs backend-rs/crates/portfolio-api/src/services/mod.rs backend-rs/crates/portfolio-api/src/state.rs backend-rs/crates/portfolio-api/tests/nav_sync_test.rs
git commit -m "feat(portfolio-api): add 24-hour rate-limited lazy NAV sync service"
```

---

### Task 3: Hook Lazy Sync into `/api/portfolio/summary` & Fix Date Precedence in `fetch_latest_nav`

**Files:**
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs:417-450`
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs:560-580`
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs:880-890`
- Test: `backend-rs/crates/portfolio-api/tests/stale_nav_precedence_test.rs`

**Interfaces:**
- Consumes: `fetch_latest_nav`, `NavSyncService`, `fallback_tx_date: Option<NaiveDate>`
- Produces: Correct real-time valuation, prioritizing newer transaction NAVs over older historical data and kicking off background refresh.

- [ ] **Step 1: Write test verifying newer transaction NAV overrides stale historical NAV**

```rust
// backend-rs/crates/portfolio-api/tests/stale_nav_precedence_test.rs
#[test]
fn test_transaction_nav_overrides_older_historical_nav() {
    let hist_date = NaiveDate::from_ymd_opt(2026, 8, 5).unwrap();
    let hist_nav = Nav::new(Decimal::new(9283, 2));
    let tx_date = NaiveDate::from_ymd_opt(2026, 10, 12).unwrap();
    let tx_nav = Nav::new(Decimal::new(8855, 2));
    let resolved = resolve_nav_with_date_priority(Some((hist_date, hist_nav)), Some((tx_date, tx_nav)));
    assert_eq!(resolved, tx_nav);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --package portfolio-api --test stale_nav_precedence_test`
Expected: FAIL

- [ ] **Step 3: Update `fetch_latest_nav` to check date priority and trigger lazy sync**

In `fetch_latest_nav`, select `(date, nav)` from `HistoricalNAV`. If historical date is older than today or older than latest transaction date, trigger `check_and_trigger_lazy_sync(&state, amfi_code)` and return the fresher NAV.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --package portfolio-api --test stale_nav_precedence_test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-rs/crates/portfolio-api/src/routes/portfolio.rs backend-rs/crates/portfolio-api/tests/stale_nav_precedence_test.rs
git commit -m "fix(portfolio-api): enforce transaction date precedence over stale historical NAVs and trigger lazy sync"
```

---

### Task 4: Upgrade `portfolio-worker` NAV Refresh Job to Live MFAPI Fetching

**Files:**
- Modify: `backend-rs/crates/portfolio-worker/src/jobs/nav_refresh.rs:20-49`
- Modify: `backend-rs/crates/portfolio-worker/src/main.rs:80-120`
- Test: `backend-rs/crates/portfolio-worker/tests/worker_tests.rs`

**Interfaces:**
- Consumes: `NavRefreshJobData`, `reqwest::Client`, `PgPool`
- Produces: Reliable background processing of `navRefreshQueue` jobs.

- [ ] **Step 1: Write test for worker NAV refresh with mocked HTTP response**

```rust
// backend-rs/crates/portfolio-worker/tests/worker_tests.rs
#[tokio::test]
async fn test_process_nav_refresh_job_with_mfapi_payload() { ... }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test --package portfolio-worker --test worker_tests test_process_nav_refresh_job`
Expected: Verify behavior against live or mock data.

- [ ] **Step 3: Implement live fetch in `portfolio-worker/src/jobs/nav_refresh.rs`**

Add real `reqwest` HTTP call to `api.mfapi.in` with fallback to `InMemoryDatabase` or `PgPool`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test --package portfolio-worker --test worker_tests`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend-rs/crates/portfolio-worker/src/jobs/nav_refresh.rs backend-rs/crates/portfolio-worker/src/main.rs backend-rs/crates/portfolio-worker/tests/worker_tests.rs
git commit -m "feat(portfolio-worker): implement live MFAPI fetching for background NAV refresh jobs"
```

---

### Task 5: End-to-End Verification & Workspace Quality Checks

- [ ] **Step 1: Run full workspace test suite**

Run: `cargo test --workspace`
Expected: PASS (all tests green)

- [ ] **Step 2: Run numerical parity suite**

Run: `cargo run --package portfolio-parity`
Expected: 10/10 scenarios passed (100% numerical parity)

- [ ] **Step 3: Run Clippy and formatting checks**

Run: `cargo clippy --workspace --all-targets -- -D warnings && cargo fmt --check`
Expected: 0 warnings, clean formatting.

- [ ] **Step 4: Commit and update PR**

```bash
git push origin fix/post-tax-xirr-and-tax-compliance
```
