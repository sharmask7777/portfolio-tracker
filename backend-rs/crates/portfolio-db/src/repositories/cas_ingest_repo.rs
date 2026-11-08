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
/// Enforces uniqueness on (`number`, `assetId`, `portfolioId`).
pub async fn upsert_postgres_folio(
    pool: &sqlx::PgPool,
    portfolio_id: Uuid,
    asset_id: Uuid,
    folio_number: &str,
    amc: Option<&str>,
    pan: Option<&str>,
) -> Result<Uuid, DbError> {
    let existing = sqlx::query_scalar::<_, String>(
        r#"
        SELECT id FROM "Folio"
        WHERE number = $1 AND "assetId" = $2 AND "portfolioId" = $3
        LIMIT 1
        "#,
    )
    .bind(folio_number)
    .bind(asset_id.to_string())
    .bind(portfolio_id.to_string())
    .fetch_optional(pool)
    .await?;

    if let Some(parsed) = existing.and_then(|s| Uuid::parse_str(&s).ok()) {
        return Ok(parsed);
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
    .bind(folio_number)
    .bind(amc)
    .bind(pan)
    .bind(portfolio_id.to_string())
    .bind(asset_id.to_string())
    .fetch_one(pool)
    .await?;

    Uuid::parse_str(&folio_id_str)
        .map_err(|e| DbError::Internal(format!("Invalid folio UUID: {e}")))
}

/// Inserts a transaction into PostgreSQL with idempotency on `externalId`.
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
    let new_id = Uuid::new_v4();
    let date_timestamp = date.and_hms_opt(0, 0, 0).unwrap_or_default();
    let amount_f64 = amount.to_string().parse::<f64>().unwrap_or(0.0);
    let units_f64 = units.to_string().parse::<f64>().unwrap_or(0.0);
    let nav_f64 = nav.to_string().parse::<f64>().unwrap_or(0.0);
    let balance_f64 = balance.to_string().parse::<f64>().unwrap_or(0.0);

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

/// Upserts a historical portfolio valuation snapshot in PostgreSQL.
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
        ON CONFLICT ("portfolioId", date) DO UPDATE
        SET value = EXCLUDED.value, "investedAmount" = EXCLUDED."investedAmount";
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
