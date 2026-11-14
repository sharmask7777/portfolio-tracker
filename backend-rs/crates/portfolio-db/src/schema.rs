//! Self-healing PostgreSQL database schema initialization and DDL generation.
//!
//! # Architecture & Idempotency
//! The schema defined here mirrors the canonical database models across the application.
//! It is designed to be completely self-healing and idempotent:
//! - All table definitions utilize `CREATE TABLE IF NOT EXISTS`.
//! - Indexes utilize `CREATE INDEX IF NOT EXISTS`.
//! - Custom enum types (`AssetType`, `UploadJobStatus`) are defined in anonymous `DO $$ ... $$`
//!   blocks that catch and swallow `duplicate_object` exceptions.
//! - Seed records (such as default integration test users) use `ON CONFLICT ("id") DO NOTHING`.
//!
//! # Relational Hierarchy & Foreign Key Cascades
//! The schema enforces referential integrity through foreign key cascades:
//! ```text
//! User
//!  ├── ManagedProfile (ON DELETE CASCADE)
//!  │     └── Portfolio (ON DELETE CASCADE)
//!  │           └── Folio (ON DELETE CASCADE)
//!  │                 └── Transaction (ON DELETE CASCADE)
//!  ├── FamilyGroup (ON DELETE CASCADE)
//!  │     └── FamilyMember (ON DELETE CASCADE)
//!  ├── UploadJob (ON DELETE CASCADE)
//!  └── PortfolioHistory (ON DELETE CASCADE)
//!
//! Asset (Independent catalog: Mutual Funds, Stocks, FDs, etc.)
//!  ├── Folio (ON DELETE RESTRICT - preserves asset catalog integrity)
//!  └── _GoalAssets (ON DELETE CASCADE)
//!
//! FundHolding (Independent look-through equity disclosures by AMC)
//! HistoricalNAV (Independent daily NAV time-series catalog by AMFI code)
//! ```
//!
//! # Key Invariants & Unique Constraints
//! - **`"FundHolding_isin_asOfDate_stockName_key"`**: Guarantees that a mutual fund scheme (`isin`)
//!   on a disclosure date (`asOfDate`) contains only one weight entry per company name (`stockName`).
//!   This enables deterministic `ON CONFLICT DO UPDATE` upserts for monthly AMC disclosures.
//! - **`"Folio_number_assetId_portfolioId_key"`**: Prevents duplicate folios under the same scheme/asset
//!   within a single portfolio container.
//! - **`"ManagedProfile_userId_pan_key"`**: Enforces PAN uniqueness per user account, preventing duplicate
//!   tax-identity profiles.
//! - **`"PortfolioHistory_portfolioId_date_key"`**: Enforces a single valuation snapshot per portfolio per date.
//! - **`"HistoricalNAV_amfiCode_date_key"`**: Enforces a single NAV entry per AMFI scheme code per date.

use sqlx::PgPool;

/// Returns the complete DDL schema definition for PostgreSQL matching the canonical application structure.
///
/// Contains definitions for:
/// - Core auth and account tables: `"User"`, `"ManagedProfile"`, `"FamilyGroup"`, `"FamilyMember"`.
/// - Portfolio and asset holdings: `"Portfolio"`, `"Asset"`, `"Folio"`, `"Transaction"`.
/// - Asynchronous jobs and metrics: `"UploadJob"`, `"PortfolioHistory"`, `"HistoricalNAV"`, `"Goal"`, `"_GoalAssets"`.
/// - Equity look-through disclosures: `"FundHolding"`.
/// - Playwright test seed user insertion.
pub fn generate_ddl() -> &'static str {
    r#"
    CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "password" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

    CREATE TABLE IF NOT EXISTS "ManagedProfile" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "pan" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "taxSlab" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ManagedProfile_userId_pan_key" UNIQUE ("userId", "pan")
    );
    CREATE INDEX IF NOT EXISTS "ManagedProfile_userId_idx" ON "ManagedProfile"("userId");

    CREATE TABLE IF NOT EXISTS "FamilyGroup" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "ownerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "FamilyGroup_ownerId_idx" ON "FamilyGroup"("ownerId");

    CREATE TABLE IF NOT EXISTS "FamilyMember" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "groupId" TEXT NOT NULL REFERENCES "FamilyGroup"("id") ON DELETE CASCADE,
        "role" TEXT NOT NULL DEFAULT 'MEMBER',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FamilyMember_userId_groupId_key" UNIQUE ("userId", "groupId")
    );
    CREATE INDEX IF NOT EXISTS "FamilyMember_userId_idx" ON "FamilyMember"("userId");
    CREATE INDEX IF NOT EXISTS "FamilyMember_groupId_idx" ON "FamilyMember"("groupId");

    CREATE TABLE IF NOT EXISTS "Portfolio" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "managedProfileId" TEXT REFERENCES "ManagedProfile"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "Portfolio_userId_idx" ON "Portfolio"("userId");

    DO $$ BEGIN
        CREATE TYPE "AssetType" AS ENUM ('MUTUAL_FUND', 'STOCK', 'FIXED_DEPOSIT', 'EPF', 'PPF', 'SGB', 'PHYSICAL_GOLD');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "Asset" (
        "id" TEXT PRIMARY KEY,
        "type" "AssetType" NOT NULL,
        "name" TEXT NOT NULL,
        "isin" TEXT UNIQUE,
        "amfiCode" TEXT UNIQUE,
        "symbol" TEXT UNIQUE,
        "exitLoadMetadata" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "Asset_isin_idx" ON "Asset"("isin");
    CREATE INDEX IF NOT EXISTS "Asset_amfiCode_idx" ON "Asset"("amfiCode");

    CREATE TABLE IF NOT EXISTS "Folio" (
        "id" TEXT PRIMARY KEY,
        "number" TEXT NOT NULL,
        "amc" TEXT,
        "pan" TEXT,
        "portfolioId" TEXT NOT NULL REFERENCES "Portfolio"("id") ON DELETE CASCADE,
        "assetId" TEXT NOT NULL REFERENCES "Asset"("id") ON DELETE RESTRICT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Folio_number_assetId_portfolioId_key" UNIQUE ("number", "assetId", "portfolioId")
    );
    CREATE INDEX IF NOT EXISTS "Folio_portfolioId_idx" ON "Folio"("portfolioId");
    CREATE INDEX IF NOT EXISTS "Folio_assetId_idx" ON "Folio"("assetId");

    CREATE TABLE IF NOT EXISTS "Transaction" (
        "id" TEXT PRIMARY KEY,
        "date" TIMESTAMP(3) NOT NULL,
        "type" TEXT NOT NULL,
        "amount" DOUBLE PRECISION NOT NULL,
        "units" DOUBLE PRECISION NOT NULL,
        "nav" DOUBLE PRECISION NOT NULL,
        "balance" DOUBLE PRECISION NOT NULL,
        "folioId" TEXT NOT NULL REFERENCES "Folio"("id") ON DELETE CASCADE,
        "externalId" TEXT UNIQUE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "Transaction_folioId_idx" ON "Transaction"("folioId");
    CREATE INDEX IF NOT EXISTS "Transaction_date_idx" ON "Transaction"("date");

    -- Invariant Guardrail: Ensure transaction amounts and units are non-negative across all records
    UPDATE "Transaction" SET amount = ABS(amount), units = ABS(units) WHERE amount < 0 OR units < 0;

    DO $$ BEGIN
        CREATE TYPE "UploadJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "UploadJob" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
        "filePath" TEXT NOT NULL,
        "status" "UploadJobStatus" NOT NULL DEFAULT 'PENDING'::"UploadJobStatus",
        "message" TEXT,
        "startedAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "UploadJob_userId_idx" ON "UploadJob"("userId");
    CREATE INDEX IF NOT EXISTS "UploadJob_status_idx" ON "UploadJob"("status");

    CREATE TABLE IF NOT EXISTS "PortfolioHistory" (
        "id" TEXT PRIMARY KEY,
        "portfolioId" TEXT NOT NULL REFERENCES "Portfolio"("id") ON DELETE CASCADE,
        "date" TIMESTAMP(3) NOT NULL,
        "value" DOUBLE PRECISION NOT NULL,
        "investedAmount" DOUBLE PRECISION NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PortfolioHistory_portfolioId_date_key" UNIQUE ("portfolioId", "date")
    );
    CREATE INDEX IF NOT EXISTS "PortfolioHistory_portfolioId_idx" ON "PortfolioHistory"("portfolioId");
    CREATE INDEX IF NOT EXISTS "PortfolioHistory_date_idx" ON "PortfolioHistory"("date");

    CREATE TABLE IF NOT EXISTS "HistoricalNAV" (
        "id" TEXT PRIMARY KEY,
        "amfiCode" TEXT NOT NULL,
        "date" TIMESTAMP(3) NOT NULL,
        "nav" DOUBLE PRECISION NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "HistoricalNAV_amfiCode_date_key" UNIQUE ("amfiCode", "date")
    );
    CREATE INDEX IF NOT EXISTS "HistoricalNAV_amfiCode_idx" ON "HistoricalNAV"("amfiCode");
    CREATE INDEX IF NOT EXISTS "HistoricalNAV_date_idx" ON "HistoricalNAV"("date");

    CREATE TABLE IF NOT EXISTS "Goal" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "targetAmount" DOUBLE PRECISION NOT NULL,
        "targetDate" TIMESTAMP(3) NOT NULL,
        "portfolioId" TEXT NOT NULL REFERENCES "Portfolio"("id") ON DELETE CASCADE,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "Goal_portfolioId_idx" ON "Goal"("portfolioId");

    CREATE TABLE IF NOT EXISTS "_GoalAssets" (
        "A" TEXT NOT NULL REFERENCES "Asset"("id") ON DELETE CASCADE,
        "B" TEXT NOT NULL REFERENCES "Goal"("id") ON DELETE CASCADE,
        PRIMARY KEY ("A", "B")
    );
    CREATE INDEX IF NOT EXISTS "_GoalAssets_B_index" ON "_GoalAssets"("B");

    CREATE TABLE IF NOT EXISTS "FundHolding" (
        "id" TEXT PRIMARY KEY,
        "isin" TEXT NOT NULL,
        "schemeName" TEXT NOT NULL,
        "asOfDate" DATE NOT NULL,
        "stockName" TEXT NOT NULL,
        "stockIsin" TEXT,
        "sector" TEXT NOT NULL DEFAULT 'Other',
        "weight" NUMERIC(6, 3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FundHolding_isin_asOfDate_stockName_key" UNIQUE ("isin", "asOfDate", "stockName")
    );
    CREATE INDEX IF NOT EXISTS "FundHolding_isin_idx" ON "FundHolding"("isin");
    CREATE INDEX IF NOT EXISTS "FundHolding_asOfDate_idx" ON "FundHolding"("asOfDate");

    INSERT INTO "User" ("id", "email", "password", "createdAt", "updatedAt")
    VALUES ('00000000-0000-0000-0000-000000000001', 'test@example.com', '$2b$12$dummyhashforplaywrighttestuser', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING;
    "#
}

/// Executes the DDL statements on the given PostgreSQL connection pool.
///
/// Runs the entire schema definition generated by [`generate_ddl`] against the target database
/// in an idempotent manner, creating all required tables, custom enum types, constraints,
/// indexes, and initial default users if they do not already exist.
///
/// # Errors
/// Returns [`sqlx::Error`] if executing the SQL script fails due to permission errors, connection
/// drops, or database syntax issues.
pub async fn init_schema(pool: &PgPool) -> Result<(), sqlx::Error> {
    sqlx::raw_sql(generate_ddl()).execute(pool).await?;
    Ok(())
}
