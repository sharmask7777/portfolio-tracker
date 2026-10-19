//! Family profile repository trait and SQLx implementation.

use async_trait::async_trait;
use chrono::Utc;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::entities::ManagedProfileEntity;
use crate::error::DbError;

#[async_trait]
pub trait FamilyRepository: Send + Sync {
    /// Creates a new managed family profile for a user with PAN and tax slab.
    async fn create_managed_profile(
        &self,
        user_id: Uuid,
        name: &str,
        pan: &str,
        tax_slab: Decimal,
    ) -> Result<ManagedProfileEntity, DbError>;

    /// Lists all managed profiles owned by a user.
    async fn list_profiles(&self, user_id: Uuid) -> Result<Vec<ManagedProfileEntity>, DbError>;

    /// Deletes a managed profile and cascades to all associated portfolios, folios, and transactions.
    async fn delete_managed_profile(
        &self,
        user_id: Uuid,
        profile_id: Uuid,
    ) -> Result<ManagedProfileEntity, DbError>;
}

/// Production PostgreSQL repository for Family Profiles using SQLx.
#[derive(Clone, Debug)]
pub struct SqlxFamilyRepo {
    pool: sqlx::PgPool,
}

impl SqlxFamilyRepo {
    pub fn new(pool: sqlx::PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl FamilyRepository for SqlxFamilyRepo {
    async fn create_managed_profile(
        &self,
        user_id: Uuid,
        name: &str,
        pan: &str,
        tax_slab: Decimal,
    ) -> Result<ManagedProfileEntity, DbError> {
        let id = Uuid::new_v4();
        let now = Utc::now();

        let record = sqlx::query_as::<_, ManagedProfileEntity>(
            r#"
            INSERT INTO "ManagedProfile" (
                id, "userId", name, pan, "taxSlab", "createdAt", "updatedAt"
            )
            VALUES ($1, $2, $3, $4, $5::text::float8, $6, $6)
            RETURNING id::uuid, "userId"::uuid, name, pan, "taxSlab"::numeric as "taxSlab",
                      "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                      "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            "#,
        )
        .bind(id.to_string())
        .bind(user_id.to_string())
        .bind(name)
        .bind(pan)
        .bind(tax_slab.to_string())
        .bind(now)
        .fetch_one(&self.pool)
        .await?;

        Ok(record)
    }

    async fn list_profiles(&self, user_id: Uuid) -> Result<Vec<ManagedProfileEntity>, DbError> {
        let records = sqlx::query_as::<_, ManagedProfileEntity>(
            r#"
            SELECT id::uuid, "userId"::uuid, name, pan, "taxSlab"::numeric as "taxSlab",
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "ManagedProfile"
            WHERE "userId" = $1
            ORDER BY "createdAt" ASC
            "#,
        )
        .bind(user_id.to_string())
        .fetch_all(&self.pool)
        .await?;

        Ok(records)
    }

    async fn delete_managed_profile(
        &self,
        user_id: Uuid,
        profile_id: Uuid,
    ) -> Result<ManagedProfileEntity, DbError> {
        let mut tx = self.pool.begin().await?;

        // 1. Get profile to delete
        let profile = sqlx::query_as::<_, ManagedProfileEntity>(
            r#"
            SELECT id::uuid, "userId"::uuid, name, pan, "taxSlab"::numeric as "taxSlab",
                   "createdAt" AT TIME ZONE 'UTC' as "createdAt",
                   "updatedAt" AT TIME ZONE 'UTC' as "updatedAt"
            FROM "ManagedProfile"
            WHERE id = $1 AND "userId" = $2
            "#,
        )
        .bind(profile_id.to_string())
        .bind(user_id.to_string())
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(DbError::ProfileNotFound(profile_id))?;

        // 2. Cascade delete: transactions under folios belonging to portfolios under this profile
        sqlx::query(
            r#"
            DELETE FROM "Transaction"
            WHERE "folioId" IN (
                SELECT f.id FROM "Folio" f
                JOIN "Portfolio" p ON f."portfolioId" = p.id
                WHERE p."managedProfileId" = $1
            )
            "#,
        )
        .bind(profile_id.to_string())
        .execute(&mut *tx)
        .await?;

        // 3. Delete folios under portfolios belonging to this profile
        sqlx::query(
            r#"
            DELETE FROM "Folio"
            WHERE "portfolioId" IN (
                SELECT id FROM "Portfolio"
                WHERE "managedProfileId" = $1
            )
            "#,
        )
        .bind(profile_id.to_string())
        .execute(&mut *tx)
        .await?;

        // 4. Delete portfolios linked to this profile
        sqlx::query(
            r#"
            DELETE FROM "Portfolio"
            WHERE "managedProfileId" = $1
            "#,
        )
        .bind(profile_id.to_string())
        .execute(&mut *tx)
        .await?;

        // 5. Delete the profile itself
        sqlx::query(
            r#"
            DELETE FROM "ManagedProfile"
            WHERE id = $1 AND "userId" = $2
            "#,
        )
        .bind(profile_id.to_string())
        .bind(user_id.to_string())
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(profile)
    }
}
