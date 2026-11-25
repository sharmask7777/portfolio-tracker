//! Folio lifecycle (close, delete) and user data purge route handlers.

use std::str::FromStr;

use axum::Json;
use axum::extract::{Path, State};
use chrono::Utc;
use portfolio_core::holdings::get_latest_units;
use portfolio_db::TransactionRepository;
use portfolio_db::error::DbError;
use rust_decimal::Decimal;
use serde::Serialize;
use ts_rs::TS;
use uuid::Uuid;

use super::{fetch_folio, fetch_portfolio, fetch_transactions_for_folio};
use crate::errors::ApiError;
use crate::middleware::AuthUser;
use crate::state::AppState;

/// Generic status response returned by mutation endpoints.
#[derive(Debug, Serialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct StatusResponse {
    /// Operation status (`"success"`).
    pub status: String,
    /// Optional human-readable message.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// Route handler for `POST /api/portfolio/folio/:folioId/close` manually closing an active folio.
///
/// Simulates full redemption of remaining units at current NAV to reset balance to zero,
/// recording positive `amount` and `units` on the `REDEMPTION` transaction.
pub async fn close_folio(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(folio_id): Path<String>,
) -> Result<Json<StatusResponse>, ApiError> {
    let folio_uuid = Uuid::parse_str(&folio_id)
        .map_err(|_| ApiError::NotFound("Folio not found".to_string()))?;

    let folio = fetch_folio(&state, folio_uuid)
        .await?
        .ok_or_else(|| ApiError::NotFound("Folio not found".to_string()))?;

    let portfolio = fetch_portfolio(&state, folio.portfolio_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Folio not found".to_string()))?;

    if portfolio.user_id != auth_user.user_id {
        return Err(ApiError::NotFound("Folio not found".to_string()));
    }

    let tx_entities = fetch_transactions_for_folio(&state, folio_uuid).await?;
    let mut core_txs = Vec::with_capacity(tx_entities.len());
    for transaction_entity in &tx_entities {
        core_txs.push(transaction_entity.to_core_transaction()?);
    }

    let units = get_latest_units(&core_txs);
    if units.to_decimal() > Decimal::from_str("0.001").unwrap_or(Decimal::ZERO) {
        let last_nav = core_txs
            .iter()
            .rev()
            .find(|t| t.nav.is_positive())
            .map_or(Decimal::ONE, |t| t.nav.to_decimal());
        let today = Utc::now().date_naive();
        let positive_units = units.to_decimal();
        let positive_amount = positive_units * last_nav;
        let ext_id = format!(
            "MANUAL_CLOSE-{folio_uuid}-{}",
            Utc::now().timestamp_millis()
        );

        if let Some(pool) = state.pool() {
            let mut db_tx = pool.begin().await.map_err(DbError::from)?;
            let tx_id = Uuid::new_v4();
            let now = Utc::now();
            let date_timestamp = today.and_hms_opt(0, 0, 0).unwrap_or_default();
            sqlx::query(
                r#"
                INSERT INTO "Transaction" (
                    id, "folioId", date, type, amount, units, nav, balance, "externalId", "createdAt", "updatedAt"
                )
                VALUES ($1, $2, $3, 'REDEMPTION', $4::text::float8, $5::text::float8, $6::text::float8, 0, $7, $8, $8)
                "#,
            )
            .bind(tx_id.to_string())
            .bind(folio_uuid.to_string())
            .bind(date_timestamp)
            .bind(positive_amount.to_string())
            .bind(positive_units.to_string())
            .bind(last_nav.to_string())
            .bind(&ext_id)
            .bind(now)
            .execute(&mut *db_tx)
            .await
            .map_err(DbError::from)?;
            db_tx.commit().await.map_err(DbError::from)?;
        } else {
            TransactionRepository::create_transaction(
                state.db.as_ref(),
                folio_uuid,
                today,
                "REDEMPTION",
                positive_amount,
                positive_units,
                last_nav,
                Decimal::ZERO,
                Some(&ext_id),
            )
            .await?;
        }
    }

    Ok(Json(StatusResponse {
        status: "success".to_string(),
        message: None,
    }))
}

/// Route handler for `DELETE /api/portfolio/folio/:folioId` permanently deleting a folio and its transactions.
pub async fn delete_folio(
    auth_user: AuthUser,
    State(state): State<AppState>,
    Path(folio_id): Path<String>,
) -> Result<Json<StatusResponse>, ApiError> {
    let folio_uuid = Uuid::parse_str(&folio_id)
        .map_err(|_| ApiError::NotFound("Folio not found".to_string()))?;

    let folio = fetch_folio(&state, folio_uuid)
        .await?
        .ok_or_else(|| ApiError::NotFound("Folio not found".to_string()))?;

    let portfolio = fetch_portfolio(&state, folio.portfolio_id)
        .await?
        .ok_or_else(|| ApiError::NotFound("Folio not found".to_string()))?;

    if portfolio.user_id != auth_user.user_id {
        return Err(ApiError::NotFound("Folio not found".to_string()));
    }

    state.db.delete_folio(folio_uuid);

    if let Some(pool) = state.pool() {
        let mut db_tx = pool.begin().await.map_err(DbError::from)?;
        sqlx::query(r#"DELETE FROM "Transaction" WHERE "folioId" = $1"#)
            .bind(folio_uuid.to_string())
            .execute(&mut *db_tx)
            .await
            .map_err(DbError::from)?;
        sqlx::query(r#"DELETE FROM "Folio" WHERE id = $1"#)
            .bind(folio_uuid.to_string())
            .execute(&mut *db_tx)
            .await
            .map_err(DbError::from)?;
        db_tx.commit().await.map_err(DbError::from)?;
    }

    Ok(Json(StatusResponse {
        status: "success".to_string(),
        message: None,
    }))
}

/// Route handler for `DELETE /api/portfolio/purge` cascadingly deleting all user financial data.
pub async fn purge_user_data(
    auth_user: AuthUser,
    State(state): State<AppState>,
) -> Result<Json<StatusResponse>, ApiError> {
    state.db.purge_user_data(auth_user.user_id);

    if let Some(pool) = state.pool() {
        let mut tx = pool.begin().await.map_err(DbError::from)?;
        let user_id_str = auth_user.user_id.to_string();
        sqlx::query(
            r#"DELETE FROM "Goal" WHERE "portfolioId" IN (SELECT id FROM "Portfolio" WHERE "userId" = $1)"#,
        )
        .bind(&user_id_str)
        .execute(&mut *tx)
        .await
        .map_err(DbError::from)?;
        sqlx::query(
            r#"DELETE FROM "Transaction" WHERE "folioId" IN (SELECT f.id FROM "Folio" f JOIN "Portfolio" p ON f."portfolioId" = p.id WHERE p."userId" = $1)"#,
        )
        .bind(&user_id_str)
        .execute(&mut *tx)
        .await
        .map_err(DbError::from)?;
        sqlx::query(
            r#"DELETE FROM "Folio" WHERE "portfolioId" IN (SELECT id FROM "Portfolio" WHERE "userId" = $1)"#,
        )
        .bind(&user_id_str)
        .execute(&mut *tx)
        .await
        .map_err(DbError::from)?;
        sqlx::query(r#"DELETE FROM "Portfolio" WHERE "userId" = $1"#)
            .bind(&user_id_str)
            .execute(&mut *tx)
            .await
            .map_err(DbError::from)?;
        sqlx::query(r#"DELETE FROM "ManagedProfile" WHERE "userId" = $1"#)
            .bind(&user_id_str)
            .execute(&mut *tx)
            .await
            .map_err(DbError::from)?;
        tx.commit().await.map_err(DbError::from)?;
    }

    Ok(Json(StatusResponse {
        status: "success".to_string(),
        message: Some("All user data has been purged.".to_string()),
    }))
}
