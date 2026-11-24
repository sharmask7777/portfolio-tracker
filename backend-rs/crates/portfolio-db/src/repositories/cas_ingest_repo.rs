//! PostgreSQL persistence helpers for CAS statement ingestion and history refresh.
//!
//! Provides SQLx execution functions for idempotently storing profiles, portfolios,
//! assets, folios, transactions, and valuation history snapshots in PostgreSQL.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::entities::TransactionEntity;
use crate::error::DbError;

/// Upserts a managed profile for a specific user and PAN.
///
/// If a profile already exists for the (`userId`, `pan`) pair, returns its existing UUID.
/// Otherwise, inserts a new profile and returns the newly generated UUID.
pub async fn upsert_postgres_profile(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    pan: &str,
    name: &str,
    tax_slab: Decimal,
) -> Result<Uuid, DbError> {
    let existing = sqlx::query_scalar::<_, String>(
        r#"
        SELECT id FROM "ManagedProfile"
        WHERE "userId" = $1 AND pan = $2
        LIMIT 1
        "#,
    )
    .bind(user_id.to_string())
    .bind(pan)
    .fetch_optional(pool)
    .await?;

    if let Some(parsed) = existing.and_then(|s| Uuid::parse_str(&s).ok()) {
        return Ok(parsed);
    }

    let new_id = Uuid::new_v4();
    let slab_f64 = tax_slab.to_string().parse::<f64>().unwrap_or(0.3);

    let profile_id_str = sqlx::query_scalar::<_, String>(
        r#"
        INSERT INTO "ManagedProfile" (id, name, pan, "userId", "taxSlab", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT ("userId", pan) DO UPDATE SET "updatedAt" = NOW()
        RETURNING id
        "#,
    )
    .bind(new_id.to_string())
    .bind(name)
    .bind(pan)
    .bind(user_id.to_string())
    .bind(slab_f64)
    .fetch_one(pool)
    .await?;

    Uuid::parse_str(&profile_id_str)
        .map_err(|e| DbError::Internal(format!("Invalid profile UUID: {e}")))
}

/// Upserts a portfolio linked to a user and managed profile.
///
/// If a portfolio already exists for (`userId`, `managedProfileId`), returns its existing UUID.
/// Otherwise, inserts a new portfolio and returns the newly generated UUID.
pub async fn upsert_postgres_portfolio(
    pool: &sqlx::PgPool,
    user_id: Uuid,
    profile_id: Uuid,
    name: &str,
) -> Result<Uuid, DbError> {
    let existing = sqlx::query_scalar::<_, String>(
        r#"
        SELECT id FROM "Portfolio"
        WHERE "userId" = $1 AND "managedProfileId" = $2
        LIMIT 1
        "#,
    )
    .bind(user_id.to_string())
    .bind(profile_id.to_string())
    .fetch_optional(pool)
    .await?;

    if let Some(parsed) = existing.and_then(|s| Uuid::parse_str(&s).ok()) {
        return Ok(parsed);
    }

    let new_id = Uuid::new_v4();
    let port_id_str = sqlx::query_scalar::<_, String>(
        r#"
        INSERT INTO "Portfolio" (id, name, "userId", "managedProfileId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id
        "#,
    )
    .bind(new_id.to_string())
    .bind(name)
    .bind(user_id.to_string())
    .bind(profile_id.to_string())
    .fetch_one(pool)
    .await?;

    Uuid::parse_str(&port_id_str)
        .map_err(|e| DbError::Internal(format!("Invalid portfolio UUID: {e}")))
}

/// Upserts a mutual fund asset by ISIN, AMFI code, or scheme name.
///
/// Deduplicates existing assets based on ISIN first, then AMFI code, then exact name.
pub async fn upsert_postgres_asset(
    pool: &sqlx::PgPool,
    name: &str,
    isin: Option<&str>,
    amfi: Option<&str>,
) -> Result<Uuid, DbError> {
    if let Some(isin_str) = isin {
        let existing =
            sqlx::query_scalar::<_, String>(r#"SELECT id FROM "Asset" WHERE isin = $1 LIMIT 1"#)
                .bind(isin_str)
                .fetch_optional(pool)
                .await?;

        if let Some(parsed) = existing.and_then(|s| Uuid::parse_str(&s).ok()) {
            return Ok(parsed);
        }
    }

    if let Some(amfi_str) = amfi {
        let existing = sqlx::query_scalar::<_, String>(
            r#"SELECT id FROM "Asset" WHERE "amfiCode" = $1 LIMIT 1"#,
        )
        .bind(amfi_str)
        .fetch_optional(pool)
        .await?;

        if let Some(parsed) = existing.and_then(|s| Uuid::parse_str(&s).ok()) {
            return Ok(parsed);
        }
    }

    let existing_name =
        sqlx::query_scalar::<_, String>(r#"SELECT id FROM "Asset" WHERE name = $1 LIMIT 1"#)
            .bind(name)
            .fetch_optional(pool)
            .await?;

    if let Some(parsed) = existing_name.and_then(|s| Uuid::parse_str(&s).ok()) {
        return Ok(parsed);
    }

    let new_id = Uuid::new_v4();
    let inserted = if let Some(isin_str) = isin {
        sqlx::query_scalar::<_, String>(
            r#"
            INSERT INTO "Asset" (id, type, name, isin, "amfiCode", "createdAt", "updatedAt")
            VALUES ($1, 'MUTUAL_FUND', $2, $3, $4, NOW(), NOW())
            ON CONFLICT (isin) DO UPDATE SET name = EXCLUDED.name, "amfiCode" = COALESCE(EXCLUDED."amfiCode", "Asset"."amfiCode"), "updatedAt" = NOW()
            RETURNING id
            "#,
        )
        .bind(new_id.to_string())
        .bind(name)
        .bind(isin_str)
        .bind(amfi)
        .fetch_one(pool)
        .await
    } else if let Some(amfi_str) = amfi {
        sqlx::query_scalar::<_, String>(
            r#"
            INSERT INTO "Asset" (id, type, name, isin, "amfiCode", "createdAt", "updatedAt")
            VALUES ($1, 'MUTUAL_FUND', $2, NULL, $3, NOW(), NOW())
            ON CONFLICT ("amfiCode") DO UPDATE SET name = EXCLUDED.name, "updatedAt" = NOW()
            RETURNING id
            "#,
        )
        .bind(new_id.to_string())
        .bind(name)
        .bind(amfi_str)
        .fetch_one(pool)
        .await
    } else {
        sqlx::query_scalar::<_, String>(
            r#"
            INSERT INTO "Asset" (id, type, name, isin, "amfiCode", "createdAt", "updatedAt")
            VALUES ($1, 'MUTUAL_FUND', $2, NULL, NULL, NOW(), NOW())
            RETURNING id
            "#,
        )
        .bind(new_id.to_string())
        .bind(name)
        .fetch_one(pool)
        .await
    }?;

    Uuid::parse_str(&inserted).map_err(|e| DbError::Internal(format!("Invalid asset UUID: {e}")))
}

/// Upserts a folio account under a portfolio for an asset.
///
/// Normalizes sub-account suffixes (e.g. `15161515 / 16` vs `15161515`) to prevent duplicate folios,
/// while enforcing uniqueness on (`number`, `assetId`, `portfolioId`). If duplicate folios were
/// previously created under un-normalized names, purges duplicate records and retains the primary survivor.
pub async fn upsert_postgres_folio(
    pool: &sqlx::PgPool,
    portfolio_id: Uuid,
    asset_id: Uuid,
    folio_number: &str,
    amc: Option<&str>,
    pan: Option<&str>,
) -> Result<Uuid, DbError> {
    let canonical = portfolio_core::canonicalize_folio_number(folio_number);
    let base_number = portfolio_core::extract_folio_base(&canonical);

    // Look for all existing folios under this portfolio and asset that match either:
    // 1. The exact canonical number (ignoring spaces: REPLACE(number, ' ', '') = canonical)
    // 2. The base folio number (TRIM(split_part(REPLACE(number, ' ', ''), '/', 1)) = base_number)
    // Ordered such that exact canonical match comes first, followed by base match, then oldest created.
    let matching_rows = sqlx::query_as::<_, (String, String)>(
        r#"
        SELECT id, number FROM "Folio"
        WHERE "assetId" = $1 AND "portfolioId" = $2
          AND (
              REPLACE(number, ' ', '') = $3 
              OR regexp_replace(number, '\s*/\s*', '/', 'g') = $3
              OR regexp_replace(regexp_replace(number, '\s*/\s*', '/', 'g'), '/0+$', '') = $3
              OR (
                  $4 <> '' AND $4 <> 'DEFAULT-FOLIO' 
                  AND TRIM(split_part(REPLACE(number, ' ', ''), '/', 1)) = $4
              )
          )
        ORDER BY 
            CASE 
                WHEN REPLACE(number, ' ', '') = $3 THEN 0 
                WHEN regexp_replace(number, '\s*/\s*', '/', 'g') = $3 THEN 1
                WHEN regexp_replace(regexp_replace(number, '\s*/\s*', '/', 'g'), '/0+$', '') = $3 THEN 2
                WHEN TRIM(split_part(REPLACE(number, ' ', ''), '/', 1)) = $4 THEN 3
                ELSE 4
            END ASC,
            "createdAt" ASC
        "#,
    )
    .bind(asset_id.to_string())
    .bind(portfolio_id.to_string())
    .bind(&canonical)
    .bind(&base_number)
    .fetch_all(pool)
    .await?;

    if !matching_rows.is_empty() {
        let (survivor_id_str, survivor_number) = &matching_rows[0];
        let survivor_id = Uuid::parse_str(survivor_id_str)
            .map_err(|e| DbError::Internal(format!("Invalid survivor folio UUID: {e}")))?;

        // Deduplicate: If duplicate folios were previously created, purge their transactions and remove them
        for (dup_id_str, _) in &matching_rows[1..] {
            sqlx::query(r#"DELETE FROM "Transaction" WHERE "folioId" = $1"#)
                .bind(dup_id_str)
                .execute(pool)
                .await?;

            sqlx::query(r#"DELETE FROM "Folio" WHERE id = $1"#)
                .bind(dup_id_str)
                .execute(pool)
                .await?;
        }

        // Ensure the survivor folio's number is canonicalized and metadata updated
        if survivor_number != &canonical || amc.is_some() || pan.is_some() {
            sqlx::query(
                r#"
                UPDATE "Folio"
                SET number = $1,
                    amc = COALESCE($2, amc),
                    pan = COALESCE($3, pan),
                    "updatedAt" = NOW()
                WHERE id = $4
                "#,
            )
            .bind(&canonical)
            .bind(amc)
            .bind(pan)
            .bind(survivor_id_str)
            .execute(pool)
            .await?;
        }

        return Ok(survivor_id);
    }

    let new_id = Uuid::new_v4();
    let folio_id_str = sqlx::query_scalar::<_, String>(
        r#"
        INSERT INTO "Folio" (id, number, amc, pan, "portfolioId", "assetId", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        ON CONFLICT (number, "assetId", "portfolioId") DO UPDATE
        SET amc = COALESCE(EXCLUDED.amc, "Folio".amc),
            pan = COALESCE(EXCLUDED.pan, "Folio".pan),
            "updatedAt" = NOW()
        RETURNING id
        "#,
    )
    .bind(new_id.to_string())
    .bind(&canonical)
    .bind(amc)
    .bind(pan)
    .bind(portfolio_id.to_string())
    .bind(asset_id.to_string())
    .fetch_one(pool)
    .await?;

    Uuid::parse_str(&folio_id_str)
        .map_err(|e| DbError::Internal(format!("Invalid folio UUID: {e}")))
}

/// Reconciles an ingested folio by clearing out synthetic manual close and anchor markers,
/// ensuring newly uploaded authoritative CAS statements take precedence.
pub async fn reconcile_postgres_folio(pool: &sqlx::PgPool, folio_id: Uuid) -> Result<(), DbError> {
    sqlx::query(
        r#"
        DELETE FROM "Transaction"
        WHERE "folioId" = $1 AND ("externalId" LIKE 'MANUAL_CLOSE%' OR "externalId" LIKE 'ANCHOR%')
        "#,
    )
    .bind(folio_id.to_string())
    .execute(pool)
    .await?;
    Ok(())
}

/// Reconciles all folios within a portfolio by collapsing duplicate twin folios sharing the same
/// asset and base account number, ensuring clean-slate canonical state before fresh statement ingestion.
pub async fn reconcile_portfolio_folios(
    pool: &sqlx::PgPool,
    portfolio_id: Uuid,
) -> Result<(), DbError> {
    sqlx::query(
        r#"
        WITH "DuplicateFolioClusters" AS (
            SELECT id,
                   "assetId",
                   FIRST_VALUE(id) OVER (
                       PARTITION BY "assetId", TRIM(split_part(number, '/', 1))
                       ORDER BY "createdAt" ASC, id ASC
                   ) AS keeper_id,
                   ROW_NUMBER() OVER (
                       PARTITION BY "assetId", TRIM(split_part(number, '/', 1))
                       ORDER BY "createdAt" ASC, id ASC
                   ) AS cluster_rank
            FROM "Folio"
            WHERE "portfolioId" = $1
        ),
        "FoliosToMerge" AS (
            SELECT id AS orphan_id, keeper_id
            FROM "DuplicateFolioClusters"
            WHERE cluster_rank > 1
        )
        UPDATE "Transaction" t
        SET "folioId" = m.keeper_id
        FROM "FoliosToMerge" m
        WHERE t."folioId" = m.orphan_id
        "#,
    )
    .bind(portfolio_id.to_string())
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        WITH "DuplicateFolioClusters" AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY "assetId", TRIM(split_part(number, '/', 1))
                       ORDER BY "createdAt" ASC, id ASC
                   ) AS cluster_rank
            FROM "Folio"
            WHERE "portfolioId" = $1
        )
        DELETE FROM "Folio"
        WHERE id IN (
            SELECT id FROM "DuplicateFolioClusters" WHERE cluster_rank > 1
        )
        "#,
    )
    .bind(portfolio_id.to_string())
    .execute(pool)
    .await?;

    Ok(())
}

/// Purges all existing transactions for an ingested folio from PostgreSQL.
///
/// Because CAS statements contain the complete, authoritative transaction history from inception,
/// clearing all existing ledger entries for touched folios guarantees clean-slate predictability,
/// eliminating duplicate rows, legacy sign anomalies, and synthetic markers.
pub async fn purge_folio_transactions(pool: &sqlx::PgPool, folio_id: Uuid) -> Result<(), DbError> {
    sqlx::query(
        r#"
        DELETE FROM "Transaction"
        WHERE "folioId" = $1
        "#,
    )
    .bind(folio_id.to_string())
    .execute(pool)
    .await?;
    Ok(())
}

/// Inserts a transaction into PostgreSQL with idempotency on `externalId` and transaction signature deduplication.
#[allow(clippy::too_many_arguments)]
pub async fn insert_postgres_transaction(
    pool: &sqlx::PgPool,
    folio_id: Uuid,
    date: NaiveDate,
    tx_type: &str,
    amount: Decimal,
    units: Decimal,
    nav: Decimal,
    balance: Decimal,
    external_id: &str,
) -> Result<(), DbError> {
    let date_timestamp = date.and_hms_opt(0, 0, 0).unwrap_or_default();
    let amount_f64 = amount.to_string().parse::<f64>().unwrap_or(0.0);
    let units_f64 = units.to_string().parse::<f64>().unwrap_or(0.0);
    let nav_f64 = nav.to_string().parse::<f64>().unwrap_or(0.0);
    let balance_f64 = balance.to_string().parse::<f64>().unwrap_or(0.0);

    // Deduplication check: verify if an identical transaction already exists for this folio on this date
    // with the same type and magnitude of amount, units, and balance (handling positive vs negative signs across legacy imports and CAS formats).
    let existing_tx = sqlx::query_scalar::<_, String>(
        r#"
        SELECT id FROM "Transaction"
        WHERE "folioId" = $1
          AND date = $2
          AND type = $3
          AND ABS(ABS(amount) - ABS($4)) < 0.001
          AND ABS(ABS(units) - ABS($5)) < 0.0001
          AND ABS(ABS(balance) - ABS($6)) < 0.0001
        LIMIT 1
        "#,
    )
    .bind(folio_id.to_string())
    .bind(date_timestamp)
    .bind(tx_type)
    .bind(amount_f64)
    .bind(units_f64)
    .bind(balance_f64)
    .fetch_optional(pool)
    .await?;

    if existing_tx.is_some() {
        return Ok(());
    }

    let new_id = Uuid::new_v4();
    sqlx::query(
        r#"
        INSERT INTO "Transaction" (
            id, date, type, amount, units, nav, balance, "folioId", "externalId", "createdAt", "updatedAt"
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        ON CONFLICT ("externalId") DO NOTHING
        "#,
    )
    .bind(new_id.to_string())
    .bind(date_timestamp)
    .bind(tx_type)
    .bind(amount_f64)
    .bind(units_f64)
    .bind(nav_f64)
    .bind(balance_f64)
    .bind(folio_id.to_string())
    .bind(external_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Checks whether a portfolio exists in PostgreSQL.
pub async fn check_portfolio_exists(
    pool: &sqlx::PgPool,
    portfolio_id: Uuid,
) -> Result<bool, DbError> {
    let exists =
        sqlx::query_scalar::<_, bool>(r#"SELECT EXISTS(SELECT 1 FROM "Portfolio" WHERE id = $1)"#)
            .bind(portfolio_id.to_string())
            .fetch_one(pool)
            .await?;

    Ok(exists)
}

/// Fetches all transactions for a portfolio across all its folios from PostgreSQL.
pub async fn fetch_portfolio_transactions(
    pool: &sqlx::PgPool,
    portfolio_id: Uuid,
) -> Result<Vec<TransactionEntity>, DbError> {
    let txs = sqlx::query_as::<_, TransactionEntity>(
        r#"
        SELECT t.id::uuid, t."folioId"::uuid, t.date::date as date, t.type,
               t.amount::numeric as amount, t.units::numeric as units,
               t.nav::numeric as nav, t.balance::numeric as balance,
               t."externalId",
               t."createdAt" AT TIME ZONE 'UTC' as "createdAt",
               t."updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
        FROM "Transaction" t
        JOIN "Folio" f ON f.id = t."folioId"
        WHERE f."portfolioId" = $1
        ORDER BY t.date ASC, t."createdAt" ASC, t.id ASC
        "#,
    )
    .bind(portfolio_id.to_string())
    .fetch_all(pool)
    .await?;

    Ok(txs)
}

/// Inserts a historical portfolio valuation snapshot in PostgreSQL if no record exists for that date.
///
/// Preserves authoritative daily market history by ignoring conflicting coarse transaction snapshots.
pub async fn upsert_portfolio_history(
    pool: &sqlx::PgPool,
    id: Uuid,
    portfolio_id: Uuid,
    date: NaiveDate,
    value: Decimal,
    cost: Decimal,
) -> Result<(), DbError> {
    let val_f64 = value.to_string().parse::<f64>().unwrap_or(0.0);
    let cost_f64 = cost.to_string().parse::<f64>().unwrap_or(0.0);
    let date_timestamp = date.and_hms_opt(0, 0, 0).unwrap_or_default();

    sqlx::query(
        r#"
        INSERT INTO "PortfolioHistory" (id, "portfolioId", date, value, "investedAmount", "createdAt")
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT ("portfolioId", date) DO UPDATE SET
            value = EXCLUDED.value,
            "investedAmount" = EXCLUDED."investedAmount";
        "#,
    )
    .bind(id.to_string())
    .bind(portfolio_id.to_string())
    .bind(date_timestamp)
    .bind(val_f64)
    .bind(cost_f64)
    .execute(pool)
    .await?;

    Ok(())
}

/// Fetches mapping of `folio_id` -> `Option<amfiCode>` for all folios in the given portfolio.
pub async fn fetch_folio_amfi_codes_for_portfolio(
    pool: &sqlx::PgPool,
    portfolio_id: Uuid,
) -> Result<std::collections::HashMap<Uuid, String>, DbError> {
    let rows = sqlx::query_as::<_, (String, Option<String>)>(
        r#"
        SELECT f.id, a."amfiCode"
        FROM "Folio" f
        JOIN "Asset" a ON a.id = f."assetId"
        WHERE f."portfolioId" = $1 AND a."amfiCode" IS NOT NULL
        "#,
    )
    .bind(portfolio_id.to_string())
    .fetch_all(pool)
    .await?;

    let mut map = std::collections::HashMap::with_capacity(rows.len());
    for (folio_id_str, amfi_code_opt) in rows {
        if let (Ok(folio_id), Some(amfi_code)) = (Uuid::parse_str(&folio_id_str), amfi_code_opt) {
            map.insert(folio_id, amfi_code);
        }
    }

    Ok(map)
}

/// Fetches the entire historical NAV series for all schemes in the portfolio from `HistoricalNAV`.
///
/// Returns a map of `amfiCode` -> `BTreeMap<NaiveDate, Decimal>` sorted chronologically.
pub async fn fetch_historical_navs_for_portfolio(
    pool: &sqlx::PgPool,
    portfolio_id: Uuid,
) -> Result<
    std::collections::HashMap<String, std::collections::BTreeMap<NaiveDate, Decimal>>,
    DbError,
> {
    let rows = sqlx::query_as::<_, (String, NaiveDate, Decimal)>(
        r#"
        SELECT a."amfiCode", h.date::date as dt, h.nav::numeric
        FROM "Folio" f
        JOIN "Asset" a ON a.id = f."assetId"
        JOIN "HistoricalNAV" h ON h."amfiCode" = a."amfiCode"
        WHERE f."portfolioId" = $1 AND h.nav > 0
        ORDER BY a."amfiCode", dt ASC
        "#,
    )
    .bind(portfolio_id.to_string())
    .fetch_all(pool)
    .await?;

    let mut map: std::collections::HashMap<String, std::collections::BTreeMap<NaiveDate, Decimal>> =
        std::collections::HashMap::new();
    for (amfi_code, dt, nav) in rows {
        map.entry(amfi_code).or_default().insert(dt, nav);
    }

    Ok(map)
}

/// Fetches the latest published market NAV for each active folio in the given portfolio from `HistoricalNAV`.
pub async fn fetch_latest_navs_for_portfolio(
    pool: &sqlx::PgPool,
    portfolio_id: Uuid,
) -> Result<std::collections::HashMap<Uuid, Decimal>, DbError> {
    let rows = sqlx::query_as::<_, (String, Decimal)>(
        r#"
        SELECT f.id, h.nav::numeric
        FROM "Folio" f
        JOIN "Asset" a ON a.id = f."assetId"
        JOIN LATERAL (
            SELECT nav FROM "HistoricalNAV"
            WHERE "amfiCode" = a."amfiCode" AND nav > 0
            ORDER BY date DESC LIMIT 1
        ) h ON true
        WHERE f."portfolioId" = $1
        "#,
    )
    .bind(portfolio_id.to_string())
    .fetch_all(pool)
    .await?;

    let mut map = std::collections::HashMap::with_capacity(rows.len());
    for (folio_id_str, nav) in rows {
        if let Ok(folio_id) = Uuid::parse_str(&folio_id_str) {
            map.insert(folio_id, nav);
        }
    }

    Ok(map)
}

/// Purges existing historical valuation snapshots for a portfolio from PostgreSQL.
///
/// Since uploaded CAS statements contain complete transaction history from inception,
/// clearing existing `PortfolioHistory` for touched portfolios ensures a clean-slate
/// reconstruction without conflicting or stale checkpoints from older imports.
pub async fn purge_portfolio_history(
    pool: &sqlx::PgPool,
    portfolio_id: Uuid,
) -> Result<(), DbError> {
    sqlx::query(
        r#"
        DELETE FROM "PortfolioHistory"
        WHERE "portfolioId" = $1
        "#,
    )
    .bind(portfolio_id.to_string())
    .execute(pool)
    .await?;

    Ok(())
}
