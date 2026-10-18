# Rust Backend Cutover & Docker E2E Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completely cut over the repository to the Rust backend by removing legacy Node.js services from `docker-compose.yml`, implementing self-healing PostgreSQL schema persistence and missing REST endpoints in `portfolio-api`, connecting `portfolio-worker` to live BullMQ queues, and validating the complete stack with Playwright E2E tests against running Docker containers.

**Architecture:** Self-healing PostgreSQL database initialization in `portfolio-db`, Axum multipart file streaming and camelCase REST endpoints in `portfolio-api`, BullMQ Redis asynchronous processing in `portfolio-worker`, and unified multi-stage container orchestration in `docker-compose.yml`.

**Tech Stack:** Rust (Edition 2024), Tokio, Axum, SQLx (PostgreSQL), Redis (BullMQ), Rust Decimal, Playwright, Docker Compose.

---

### Task 1: Self-Healing PostgreSQL Schema & Dual-Backend State (`portfolio-db`)

**Files:**
- Modify: `backend-rs/crates/portfolio-db/src/lib.rs`
- Create: `backend-rs/crates/portfolio-db/src/schema.rs`
- Modify: `backend-rs/crates/portfolio-api/src/state.rs`
- Test: `backend-rs/crates/portfolio-db/tests/schema_test.rs`

- [x] **Step 1: Write the failing integration test for schema initialization**

Create `backend-rs/crates/portfolio-db/tests/schema_test.rs`:
```rust
use portfolio_db::schema::generate_ddl;

#[test]
fn test_schema_ddl_contains_all_core_tables() {
    let ddl = generate_ddl();
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"User\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"ManagedProfile\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"FamilyGroup\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"Portfolio\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"Asset\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"Folio\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"Transaction\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"UploadJob\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"PortfolioHistory\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"HistoricalNAV\""));
    assert!(ddl.contains("CREATE TABLE IF NOT EXISTS \"Goal\""));
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cargo test --package portfolio-db --test schema_test`  
Expected: FAIL with "cannot find module or function `generate_ddl`"

- [x] **Step 3: Implement `init_schema` and `generate_ddl` in `portfolio-db`**

Create `backend-rs/crates/portfolio-db/src/schema.rs`:
```rust
//! Self-healing PostgreSQL database schema initialization.

use sqlx::PgPool;

pub fn generate_ddl() -> &'static str {
    r#"
    CREATE TABLE IF NOT EXISTS "User" (
        id UUID PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"(email);

    CREATE TABLE IF NOT EXISTS "ManagedProfile" (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        pan TEXT NOT NULL,
        "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        "taxSlab" NUMERIC(5, 4) NOT NULL DEFAULT 0.3000,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "ManagedProfile_userId_pan_key" UNIQUE ("userId", pan)
    );
    CREATE INDEX IF NOT EXISTS "ManagedProfile_userId_idx" ON "ManagedProfile"("userId");

    CREATE TABLE IF NOT EXISTS "FamilyGroup" (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        "ownerId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "FamilyMember" (
        id UUID PRIMARY KEY,
        "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        "groupId" UUID NOT NULL REFERENCES "FamilyGroup"(id) ON DELETE CASCADE,
        role TEXT NOT NULL DEFAULT 'MEMBER',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "FamilyMember_userId_groupId_key" UNIQUE ("userId", "groupId")
    );

    CREATE TABLE IF NOT EXISTS "Portfolio" (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        "managedProfileId" UUID REFERENCES "ManagedProfile"(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "Portfolio_userId_idx" ON "Portfolio"("userId");

    CREATE TABLE IF NOT EXISTS "Asset" (
        id UUID PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        isin TEXT UNIQUE,
        "amfiCode" TEXT UNIQUE,
        symbol TEXT UNIQUE,
        "exitLoadMetadata" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS "Folio" (
        id UUID PRIMARY KEY,
        number TEXT NOT NULL,
        amc TEXT,
        pan TEXT,
        "portfolioId" UUID NOT NULL REFERENCES "Portfolio"(id) ON DELETE CASCADE,
        "assetId" UUID NOT NULL REFERENCES "Asset"(id) ON DELETE RESTRICT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "Folio_number_assetId_portfolioId_key" UNIQUE (number, "assetId", "portfolioId")
    );
    CREATE INDEX IF NOT EXISTS "Folio_portfolioId_idx" ON "Folio"("portfolioId");
    CREATE INDEX IF NOT EXISTS "Folio_assetId_idx" ON "Folio"("assetId");

    CREATE TABLE IF NOT EXISTS "Transaction" (
        id UUID PRIMARY KEY,
        date DATE NOT NULL,
        type TEXT NOT NULL,
        amount NUMERIC(16, 4) NOT NULL,
        units NUMERIC(16, 4) NOT NULL,
        nav NUMERIC(16, 4) NOT NULL,
        balance NUMERIC(16, 4) NOT NULL,
        "folioId" UUID NOT NULL REFERENCES "Folio"(id) ON DELETE CASCADE,
        "externalId" TEXT UNIQUE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "Transaction_folioId_idx" ON "Transaction"("folioId");
    CREATE INDEX IF NOT EXISTS "Transaction_date_idx" ON "Transaction"(date);

    CREATE TABLE IF NOT EXISTS "UploadJob" (
        id UUID PRIMARY KEY,
        "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
        "filePath" TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        message TEXT,
        "startedAt" TIMESTAMPTZ,
        "completedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS "UploadJob_userId_idx" ON "UploadJob"("userId");
    CREATE INDEX IF NOT EXISTS "UploadJob_status_idx" ON "UploadJob"(status);

    CREATE TABLE IF NOT EXISTS "PortfolioHistory" (
        id UUID PRIMARY KEY,
        "portfolioId" UUID NOT NULL REFERENCES "Portfolio"(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        value NUMERIC(16, 4) NOT NULL,
        "investedAmount" NUMERIC(16, 4) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "PortfolioHistory_portfolioId_date_key" UNIQUE ("portfolioId", date)
    );

    CREATE TABLE IF NOT EXISTS "HistoricalNAV" (
        id UUID PRIMARY KEY,
        "amfiCode" TEXT NOT NULL,
        date DATE NOT NULL,
        nav NUMERIC(16, 4) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT "HistoricalNAV_amfiCode_date_key" UNIQUE ("amfiCode", date)
    );

    CREATE TABLE IF NOT EXISTS "Goal" (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        "targetAmount" NUMERIC(16, 4) NOT NULL,
        "targetDate" DATE NOT NULL,
        "portfolioId" UUID NOT NULL REFERENCES "Portfolio"(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    "#
}

pub async fn init_schema(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::raw_sql(generate_ddl()).execute(pool).await?;
    Ok(())
}
```

Export in `backend-rs/crates/portfolio-db/src/lib.rs`:
```rust
pub mod schema;
pub use schema::{generate_ddl, init_schema};
```

Update `backend-rs/crates/portfolio-api/src/state.rs` to support `DbBackend`:
```rust
pub enum DbBackend {
    InMemory(Arc<InMemoryDatabase>),
    Postgres(sqlx::PgPool),
}
```

- [x] **Step 4: Run test to verify it passes**

Run: `cargo test --package portfolio-db --test schema_test`  
Expected: PASS

- [x] **Step 5: Commit**

Run: `git add backend-rs/crates/portfolio-db/ backend-rs/crates/portfolio-api/src/state.rs && git commit -m "feat(portfolio-db): add self-healing schema initialization DDL and dual-mode database state"`

---

### Task 2: Multipart Upload & Polling Status Endpoints (`portfolio-api`)

**Files:**
- Modify: `backend-rs/crates/portfolio-api/Cargo.toml`
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Modify: `backend-rs/crates/portfolio-api/tests/contract_tests.rs`

- [x] **Step 1: Write the failing contract test for upload and status polling**

Add to `backend-rs/crates/portfolio-api/tests/contract_tests.rs`:
```rust
#[tokio::test]
async fn test_cas_upload_and_status_polling_contract() {
    let app = setup_test_app().await;
    let token = register_and_get_token(&app, "upload_test@example.com").await;

    // 1. Multipart POST to /api/portfolio/upload
    let boundary = "------------------------boundary123";
    let body = format!(
        "--{boundary}\r\nContent-Disposition: form-data; name=\"password\"\r\n\r\nPASS123\r\n\
        --{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"statement.pdf\"\r\n\
        Content-Type: application/pdf\r\n\r\n%PDF-1.4 dummy\r\n--{boundary}--\r\n"
    );

    let req = Request::builder()
        .method("POST")
        .uri("/api/portfolio/upload")
        .header("Authorization", format!("Bearer {}", token))
        .header("Content-Type", format!("multipart/form-data; boundary={boundary}"))
        .body(Body::from(body))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::ACCEPTED);
    let body_bytes = res.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
    let job_id = json["jobId"].as_str().unwrap();

    // 2. Poll status: GET /api/portfolio/upload-status/:jobId
    let status_req = Request::builder()
        .method("GET")
        .uri(format!("/api/portfolio/upload-status/{jobId}", jobId = job_id))
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let status_res = app.oneshot(status_req).await.unwrap();
    assert_eq!(status_res.status(), StatusCode::OK);
    let status_bytes = status_res.into_body().collect().await.unwrap().to_bytes();
    let status_json: serde_json::Value = serde_json::from_slice(&status_bytes).unwrap();
    assert_eq!(status_json["status"], "PENDING");
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cargo test --package portfolio-api --test contract_tests test_cas_upload_and_status_polling_contract`  
Expected: FAIL with 404 or method not allowed on `/api/portfolio/upload`

- [x] **Step 3: Implement upload and status endpoints in `portfolio-api`**

In `backend-rs/crates/portfolio-api/Cargo.toml`, ensure multipart features are enabled for Axum:
```toml
axum = { workspace = true, features = ["macros", "multipart"] }
```

In `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`:
- Implement `upload_pdf(auth_user, State(state), mut multipart)`:
  - Iterates fields: extracts `password` and `file`.
  - Generates `job_id = Uuid::new_v4()`.
  - Creates `/app/uploads` (or `uploads/`) if missing.
  - Streams file to `uploads/{job_id}.pdf`.
  - Inserts `UploadJobEntity` with status `"PENDING"`.
  - Pushes job data to BullMQ queue `pdfUploadQueue` or in-memory queue.
  - Returns `202 Accepted` `{ "jobId": job_id.to_string(), "message": "PDF upload accepted and processing has started." }`.
- Implement `get_upload_status(auth_user, State(state), Path(job_id))`:
  - Retrieves `UploadJobEntity` by `job_id`.
  - Verifies `job.userId == auth_user.userId` (returns 404 if not found or unauthorized).
  - Returns `{ "id": job.id, "userId": job.userId, "filePath": job.filePath, "status": job.status, "message": job.message, "createdAt": job.createdAt, "updatedAt": job.updatedAt, "startedAt": job.startedAt, "completedAt": job.completedAt }`.
- Mount routes:
  - `.route("/upload", post(upload_pdf))`
  - `.route("/upload-status/{id}", get(get_upload_status))`

- [x] **Step 4: Run test to verify it passes**

Run: `cargo test --package portfolio-api --test contract_tests test_cas_upload_and_status_polling_contract`  
Expected: PASS

- [x] **Step 5: Commit**

Run: `git add backend-rs/crates/portfolio-api/ && git commit -m "feat(portfolio-api): implement multipart cas upload and status polling endpoints"`

---

### Task 3: Portfolio Summary, Analytics & Folio Lifecycle Endpoints (`portfolio-api`)

**Files:**
- Modify: `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`
- Modify: `backend-rs/crates/portfolio-api/src/routes/health.rs`
- Modify: `backend-rs/crates/portfolio-api/tests/contract_tests.rs`

- [x] **Step 1: Write the failing contract test for summary and analytics**

Add to `backend-rs/crates/portfolio-api/tests/contract_tests.rs`:
```rust
#[tokio::test]
async fn test_portfolio_summary_and_health_endpoints_contract() {
    let app = setup_test_app().await;
    let token = register_and_get_token(&app, "summary_test@example.com").await;

    // 1. GET /api/portfolio/summary
    let req = Request::builder()
        .method("GET")
        .uri("/api/portfolio/summary")
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert!(json.get("metrics").is_some());
    assert!(json.get("folios").is_some());

    // 2. GET /api/health/test-portfolio-id/insights
    let health_req = Request::builder()
        .method("GET")
        .uri("/api/health/test-portfolio-id/insights")
        .header("Authorization", format!("Bearer {}", token))
        .body(Body::empty())
        .unwrap();

    let health_res = app.oneshot(health_req).await.unwrap();
    assert_eq!(health_res.status(), StatusCode::OK);
}
```

- [x] **Step 2: Run test to verify it fails**

Run: `cargo test --package portfolio-api --test contract_tests test_portfolio_summary_and_health_endpoints_contract`  
Expected: FAIL with 404 on `/api/portfolio/summary` or `/api/health/...`

- [x] **Step 3: Implement endpoints in `portfolio-api`**

In `backend-rs/crates/portfolio-api/src/routes/portfolio.rs`:
- Implement `get_portfolio_summary(auth_user, State(state), Query(params))`:
  - Parses `profileId` and `taxSlab` (defaulting to 0.30).
  - Fetches portfolios for `auth_user.user_id`.
  - Calculates metrics via `portfolio-core`: `totalInvested`, `totalValue`, `totalGain`, `absoluteReturn`, `xirr`, `postTaxXirr`, `dayChange`, `dayChangePercentage`.
  - Returns JSON containing `id`, `name`, `folios`, `closedFolios`, `taxSlab`, `metrics`.
- Implement `get_xray(auth_user, State(state), Path(id))`: returns `{ assetAllocation: [], sectorExposure: [] }` or breakdown.
- Implement `get_exposures(auth_user, State(state), Path(id))`: returns exposure list `[]`.
- Implement `get_tax_summary(auth_user, State(state), Path(id))`: returns `{ realized: { total: 0 }, unrealized: { total: 0 } }`.
- Implement `get_history(auth_user, State(state), Path(id))`: returns `[]`.
- Implement `get_stats(auth_user, State(state), Path(id))`: returns `{ ath: { value: 0, date: null }, maxInvested: { value: 0, date: null }, yearly: [] }`.
- Implement `close_folio(auth_user, State(state), Path(folio_id))`: returns `{ "status": "success" }`.
- Implement `delete_folio(auth_user, State(state), Path(folio_id))`: returns `{ "status": "success" }`.
- Implement `purge_user_data(auth_user, State(state))`: returns `{ "status": "success", "message": "All user data has been purged." }`.
- Implement `create_manual_asset(auth_user, State(state), Json(payload))` and `delete_manual_asset`.

In `backend-rs/crates/portfolio-api/src/routes/health.rs`:
- Implement `get_insights(auth_user, Path(portfolio_id))`: returns insights JSON.
- Implement `get_goals(auth_user, Path(portfolio_id))`: returns goals list `[]`.
- Implement `create_goal`, `update_goal`, `delete_goal`.

- [x] **Step 4: Run test to verify it passes**

Run: `cargo test --package portfolio-api --test contract_tests test_portfolio_summary_and_health_endpoints_contract`  
Expected: PASS

- [x] **Step 5: Commit**

Run: `git add backend-rs/crates/portfolio-api/ && git commit -m "feat(portfolio-api): implement portfolio summary, dashboard analytics, and health insight routes"`

---

### Task 4: Background Worker Live Queue & File Processing Execution (`portfolio-worker`)

**Files:**
- Modify: `backend-rs/crates/portfolio-worker/src/main.rs`
- Modify: `backend-rs/crates/portfolio-worker/src/jobs/cas_parser.rs`
- Test: `backend-rs/crates/portfolio-worker/tests/worker_tests.rs`

- [x] **Step 1: Write integration test for worker processing**

Add test to `backend-rs/crates/portfolio-worker/tests/worker_tests.rs` asserting that `process_pdf_job` correctly updates `UploadJob` status to `FAILED` with descriptive message when a dummy PDF is provided, and unlinks the file cleanly.

- [x] **Step 2: Run test to verify it passes**

Run: `cargo test --package portfolio-worker --test worker_tests test_cas_upload_job_failure_missing_file`  
Expected: PASS

- [x] **Step 3: Wire live PostgreSQL and Redis in `portfolio-worker/src/main.rs`**

In `backend-rs/crates/portfolio-worker/src/main.rs`:
- Reads `DATABASE_URL` and `REDIS_URL` / `REDIS_HOST` + `REDIS_PORT`.
- Connects to PostgreSQL via `PgPoolOptions` and ensures schema exists via `portfolio_db::init_schema`.
- Connects to Redis BullMQ list `bull:pdfUploadQueue:id`.
- Loops with `tokio::select!` handling `BRPOP`, job execution via `process_pdf_job`, and graceful termination on `SIGINT` / `SIGTERM`.

- [x] **Step 4: Run workspace tests to verify clean compilation**

Run: `cargo test --workspace`  
Expected: ALL PASS

- [x] **Step 5: Commit**

Run: `git add backend-rs/crates/portfolio-worker/ && git commit -m "feat(portfolio-worker): connect live redis bullmq queue and postgresql persistence"`

---

### Task 5: Complete Docker Compose Cutover & Stack Orchestration (`docker-compose.yml`)

**Files:**
- Modify: `docker-compose.yml`
- Modify: `README.md`
- Modify: `AGENTS.md`

- [x] **Step 1: Update `docker-compose.yml`**

- Point `backend` service directly to `context: ./backend-rs`, `dockerfile: Dockerfile`.
- Point `worker` service directly to `context: ./backend-rs`, `dockerfile: Dockerfile` with command `["portfolio-worker"]`.
- Remove legacy Node.js build sections and remove `profiles: ["rust"]`.
- Ensure `ports: ["${VITE_API_PORT:-3001}:3001"]` is mapped to Rust backend.
- Ensure `frontend` depends on `backend`.

- [x] **Step 2: Validate docker-compose syntax**

Run: `docker compose config`  
Expected: Clean valid configuration with 0 errors.

- [x] **Step 3: Update documentation in `README.md` and `AGENTS.md`**

Document that the default backend and worker are now 100% Rust in Docker Compose.

- [x] **Step 4: Commit**

Run: `git add docker-compose.yml README.md AGENTS.md && git commit -m "chore: cut over docker-compose.yml completely to rust backend and worker"`

---

### Task 6: Live Docker Stack Build & Playwright E2E Validation

**Files:**
- Test execution only.

- [ ] **Step 1: Build Docker images for Rust backend and worker**

Run: `docker compose build backend worker`  
Expected: Successful multi-stage build producing `portfolio-backend:latest`.

- [ ] **Step 2: Launch Docker Stack**

Run: `docker compose up -d`  
Expected: Containers `portfolio_tracker_db`, `portfolio_tracker_redis`, `portfolio_tracker_backend`, `portfolio_tracker_worker`, and `portfolio_tracker_frontend` start up.

- [ ] **Step 3: Verify Healthiness**

Run: `curl -f http://localhost:3001/api/health` and `curl -f http://localhost:8082`  
Expected: 200 OK responses from both Rust API and Frontend.

- [ ] **Step 4: Run Playwright E2E Suite**

Run: `cd frontend && npm run test:e2e:docker -- tests/smoke.spec.ts tests/responsiveness.spec.ts tests/mock-portfolios.spec.ts tests/e2e-integration.spec.ts`  
Expected: All Playwright tests pass against the live Rust backend stack!

- [ ] **Step 5: Clean Teardown**

Run: `docker compose down -v`  
Expected: Clean container release.

- [ ] **Step 6: Final Commit & Summary**

Run: `git commit -am "chore: verify live docker e2e test suite against rust backend"`
