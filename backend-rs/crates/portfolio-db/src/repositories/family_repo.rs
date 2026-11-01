//! Family profile repository trait and SQLx PostgreSQL implementation.
//!
//! Provides data access and lifecycle management for multi-member family profiles,
//! investor PAN registrations, and cascading profile deletion.

use async_trait::async_trait;
use chrono::Utc;
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::entities::ManagedProfileEntity;
use crate::error::DbError;

/// Repository interface for managing family member profiles, PAN mappings, and tax slabs.
#[async_trait]
pub trait FamilyRepository: Send + Sync {
    /// Creates a new managed family profile for a user with their statutory PAN and marginal tax slab.
    ///
    /// # Arguments
    /// * `user_id` - UUID of the managing parent user account.
    /// * `name` - Descriptive name of the family member (e.g. "Spouse", "HUF", "Child").
    /// * `pan` - Indian Permanent Account Number (PAN).
    /// * `tax_slab` - Marginal statutory tax rate (e.g. 0.30 for 30%).
    ///
    /// # Errors
    /// Returns [`DbError`] if a profile with the same PAN already exists for this user,
    /// or if the database query fails.
    async fn create_managed_profile(
        &self,
        user_id: Uuid,
        name: &str,
        pan: &str,
        tax_slab: Decimal,
    ) -> Result<ManagedProfileEntity, DbError>;

    /// Lists all managed profiles owned by a specific user, ordered chronologically by creation date.
    ///
    /// # Arguments
    /// * `user_id` - UUID of the managing user account.
    ///
    /// # Errors
    /// Returns [`DbError`] if query execution fails.
    async fn list_profiles(&self, user_id: Uuid) -> Result<Vec<ManagedProfileEntity>, DbError>;

    /// Deletes a managed profile and performs an atomic cascading deletion across all
    /// associated portfolios, folios, and ledger transactions.
    ///
    /// Returns the deleted profile entity upon successful deletion.
    ///
    /// # Arguments
    /// * `user_id` - UUID of the managing user account verifying ownership.
    /// * `profile_id` - UUID of the profile to permanently remove.
    ///
    /// # Errors
    /// Returns [`DbError::ProfileNotFound`] if the profile does not exist or does not belong
    /// to the specified user, or [`DbError`] on query failure.
    async fn delete_managed_profile(
        &self,
        user_id: Uuid,
        profile_id: Uuid,
    ) -> Result<ManagedProfileEntity, DbError>;
}

/// Production PostgreSQL implementation of [`FamilyRepository`] using SQLx.
#[derive(Clone, Debug)]
pub struct SqlxFamilyRepo {
    pool: sqlx::PgPool,
}

impl SqlxFamilyRepo {
    /// Creates a new repository instance backed by the given PostgreSQL connection pool.
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
        let profile_id = Uuid::new_v4();
        let now = Utc::now();

        // Inserts new profile, casting taxSlab through float8 to preserve decimal compatibility
        // with the PostgreSQL DOUBLE PRECISION column definition while returning a Decimal.
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
        .bind(profile_id.to_string())
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
        // Atomic transaction guarantees that cascading profile deletion is all-or-nothing.
        let mut transaction = self.pool.begin().await?;

        // 1. Fetch the target profile while verifying ownership by the caller user_id.
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
        .fetch_optional(&mut *transaction)
        .await?
        .ok_or(DbError::ProfileNotFound(profile_id))?;

        // 2. Cascade delete: delete all transactions under folios belonging to portfolios
        //    associated with this profile.
        sqlx::query(
            r#"
            DELETE FROM "Transaction"
            WHERE "folioId" IN (
                SELECT folio.id FROM "Folio" folio
                JOIN "Portfolio" portfolio ON folio."portfolioId" = portfolio.id
                WHERE portfolio."managedProfileId" = $1
            )
            "#,
        )
        .bind(profile_id.to_string())
        .execute(&mut *transaction)
        .await?;

        // 3. Delete all folios under portfolios belonging to this profile.
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
        .execute(&mut *transaction)
        .await?;

        // 4. Delete all portfolios linked to this profile.
        sqlx::query(
            r#"
            DELETE FROM "Portfolio"
            WHERE "managedProfileId" = $1
            "#,
        )
        .bind(profile_id.to_string())
        .execute(&mut *transaction)
        .await?;

        // 5. Delete the managed profile itself.
        sqlx::query(
            r#"
            DELETE FROM "ManagedProfile"
            WHERE id = $1 AND "userId" = $2
            "#,
        )
        .bind(profile_id.to_string())
        .bind(user_id.to_string())
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;

        Ok(profile)
    }
}
