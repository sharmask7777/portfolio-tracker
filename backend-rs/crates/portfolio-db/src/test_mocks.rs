#![allow(clippy::unwrap_used, clippy::panic)]

//! Thread-safe in-memory database mock for fast hermetic testing.
//!
//! # Architecture & Concurrency Model
//! `InMemoryDatabase` provides a sub-millisecond, zero-I/O in-memory simulation of the
//! PostgreSQL database layer. It is built on `Arc<RwLock<InMemoryDatabaseState>>`:
//! - **Concurrent Readers**: Multiple test threads or asynchronous tasks can acquire concurrent
//!   read locks (`RwLock::read`) to inspect data without blocking each other.
//! - **Synchronized Mutations**: State mutations acquire write locks (`RwLock::write`), ensuring
//!   strict linearizability and race-free state transitions during test runs.
//! - **Relational Emulation**: Replicates foreign key validation, cascading deletions (User ->
//!   Profile -> Portfolio -> Folio -> Transaction), and unique constraint checking in pure memory.
//! - **Deterministic Sorting**: Transaction listings and portfolio queries enforce deterministic
//!   multi-key ordering matching PostgreSQL SQL semantics (e.g. `date ASC, createdAt ASC, id ASC`).

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};

use async_trait::async_trait;
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::entities::{
    AssetEntity, FamilyGroupEntity, FamilyMemberEntity, FolioEntity, FundHoldingEntity,
    HistoricalNavEntity, HistoricalValuationEntity, ManagedProfileEntity, PortfolioEntity,
    TransactionEntity, UploadJobEntity, UploadJobStatus, UserEntity,
};
use crate::error::DbError;
use crate::repositories::{
    FamilyRepository, FundHoldingsRepository, PortfolioRepository, TransactionRepository,
};

/// In-memory storage state holding entity tables as hash maps.
#[derive(Debug, Default, Clone)]
pub struct InMemoryDatabaseState {
    /// Table storing user accounts keyed by user UUID.
    pub users: HashMap<Uuid, UserEntity>,
    /// Table storing managed family profiles keyed by profile UUID.
    pub profiles: HashMap<Uuid, ManagedProfileEntity>,
    /// Table storing investment portfolios keyed by portfolio UUID.
    pub portfolios: HashMap<Uuid, PortfolioEntity>,
    /// Table storing security/asset catalog entries keyed by asset UUID.
    pub assets: HashMap<Uuid, AssetEntity>,
    /// Table storing investor folios keyed by folio UUID.
    pub folios: HashMap<Uuid, FolioEntity>,
    /// Table storing ledger transactions keyed by transaction UUID.
    pub transactions: HashMap<Uuid, TransactionEntity>,
    /// Table storing family group containers keyed by group UUID.
    pub family_groups: HashMap<Uuid, FamilyGroupEntity>,
    /// Table storing family membership links keyed by membership UUID.
    pub family_members: HashMap<Uuid, FamilyMemberEntity>,
    /// Table storing asynchronous statement upload jobs keyed by job UUID.
    pub upload_jobs: HashMap<Uuid, UploadJobEntity>,
    /// Table storing daily historical NAV time series keyed by `(amfi_code, date)`.
    pub historical_navs: HashMap<(String, NaiveDate), HistoricalNavEntity>,
    /// Table storing historical portfolio valuation snapshots keyed by `(portfolio_id, date)`.
    pub historical_valuations: HashMap<(Uuid, NaiveDate), HistoricalValuationEntity>,
    /// Table storing AMC fund look-through equity disclosures keyed by `(isin, as_of_date, stock_name)`.
    pub fund_holdings: HashMap<(String, NaiveDate, String), FundHoldingEntity>,
}

/// Thread-safe in-memory database mock.
/// Supports concurrent reads and synchronized mutations for sub-millisecond hermetic tests.
#[derive(Debug, Clone, Default)]
pub struct InMemoryDatabase {
    state: Arc<RwLock<InMemoryDatabaseState>>,
}

impl InMemoryDatabase {
    /// Creates a new `InMemoryDatabase` pre-seeded with a default test user
    /// matching the PostgreSQL schema DDL seed (`00000000-0000-0000-0000-000000000001`).
    pub fn new() -> Self {
        let database = Self {
            state: Arc::new(RwLock::new(InMemoryDatabaseState::default())),
        };
        let default_test_user_id = Uuid::from_u128(1);
        database.create_user_with_id(default_test_user_id, "test@example.com", "test");
        database
    }

    /// Resets all data in the in-memory database and restores the default test user.
    pub fn clear(&self) {
        let mut state = self.state.write().expect("lock poisoned");
        *state = InMemoryDatabaseState::default();
        let default_test_user_id = Uuid::from_u128(1);
        let now = Utc::now();
        state.users.insert(
            default_test_user_id,
            UserEntity {
                id: default_test_user_id,
                email: "test@example.com".to_string(),
                password_hash: "test".to_string(),
                created_at: now,
                updated_at: now,
            },
        );
    }

    // -----------------------------------------------------------------------
    // User helpers
    // -----------------------------------------------------------------------

    /// Creates and persists a user record with an explicit UUID.
    pub fn create_user_with_id(&self, id: Uuid, email: &str, password_hash: &str) -> UserEntity {
        let mut state = self.state.write().expect("lock poisoned");
        let now = Utc::now();
        let user = UserEntity {
            id,
            email: email.to_string(),
            password_hash: password_hash.to_string(),
            created_at: now,
            updated_at: now,
        };
        state.users.insert(id, user.clone());
        user
    }

    /// Generates a random UUID and creates a new user record.
    pub fn create_user(&self, email: &str, password_hash: &str) -> UserEntity {
        let mut state = self.state.write().expect("lock poisoned");
        let id = Uuid::new_v4();
        let now = Utc::now();
        let user = UserEntity {
            id,
            email: email.to_string(),
            password_hash: password_hash.to_string(),
            created_at: now,
            updated_at: now,
        };
        state.users.insert(id, user.clone());
        user
    }

    /// Retrieves a user record by its UUID.
    pub fn get_user(&self, id: Uuid) -> Option<UserEntity> {
        let state = self.state.read().expect("lock poisoned");
        state.users.get(&id).cloned()
    }

    /// Finds a user record by email address (case-insensitive).
    pub fn get_user_by_email(&self, email: &str) -> Option<UserEntity> {
        let state = self.state.read().expect("lock poisoned");
        state
            .users
            .values()
            .find(|user| user.email.eq_ignore_ascii_case(email.trim()))
            .cloned()
    }

    // -----------------------------------------------------------------------
    // Asset helpers
    // -----------------------------------------------------------------------

    /// Creates and persists a financial asset in the asset catalog.
    pub fn create_asset(
        &self,
        asset_type: &str,
        name: &str,
        isin: Option<&str>,
        amfi_code: Option<&str>,
        symbol: Option<&str>,
        exit_load_metadata: Option<String>,
    ) -> AssetEntity {
        let mut state = self.state.write().expect("lock poisoned");
        let id = Uuid::new_v4();
        let now = Utc::now();
        let asset = AssetEntity {
            id,
            asset_type: asset_type.to_string(),
            name: name.to_string(),
            isin: isin.map(|isin_str| isin_str.to_string()),
            amfi_code: amfi_code.map(|code_str| code_str.to_string()),
            symbol: symbol.map(|sym_str| sym_str.to_string()),
            exit_load_metadata,
            created_at: now,
            updated_at: now,
        };
        state.assets.insert(id, asset.clone());
        asset
    }

    /// Retrieves an asset record by its UUID.
    pub fn get_asset(&self, id: Uuid) -> Option<AssetEntity> {
        let state = self.state.read().expect("lock poisoned");
        state.assets.get(&id).cloned()
    }

    // -----------------------------------------------------------------------
    // Folio helpers
    // -----------------------------------------------------------------------

    /// Creates and persists a new folio, validating foreign key existence of portfolio and asset.
    ///
    /// # Errors
    /// Returns [`DbError::PortfolioNotFound`] or [`DbError::AssetNotFound`] if foreign keys are invalid.
    pub fn create_folio(
        &self,
        portfolio_id: Uuid,
        asset_id: Uuid,
        number: &str,
        amc: Option<&str>,
        pan: Option<&str>,
    ) -> Result<FolioEntity, DbError> {
        let mut state = self.state.write().expect("lock poisoned");
        if !state.portfolios.contains_key(&portfolio_id) {
            return Err(DbError::PortfolioNotFound(portfolio_id));
        }
        if !state.assets.contains_key(&asset_id) {
            return Err(DbError::AssetNotFound(asset_id));
        }

        let id = Uuid::new_v4();
        let now = Utc::now();
        let folio = FolioEntity {
            id,
            portfolio_id,
            asset_id,
            number: number.to_string(),
            amc: amc.map(|amc_str| amc_str.to_string()),
            pan: pan.map(|pan_str| pan_str.to_string()),
            created_at: now,
            updated_at: now,
        };
        state.folios.insert(id, folio.clone());
        Ok(folio)
    }

    /// Retrieves a folio record by its UUID.
    pub fn get_folio(&self, id: Uuid) -> Option<FolioEntity> {
        let state = self.state.read().expect("lock poisoned");
        state.folios.get(&id).cloned()
    }

    /// Reconciles an ingested folio by clearing out synthetic manual close and anchor markers.
    pub fn reconcile_folio_transactions(&self, folio_id: Uuid) {
        let mut state = self.state.write().expect("lock poisoned");
        state.transactions.retain(|_, tx| {
            if tx.folio_id != folio_id {
                return true;
            }
            if let Some(ref ext_id) = tx.external_id {
                !ext_id.starts_with("MANUAL_CLOSE") && !ext_id.starts_with("ANCHOR")
            } else {
                true
            }
        });
    }

    /// Checks if an existing transaction with identical date, type, amount, and units exists for a folio
    /// (comparing absolute values to be resilient against positive vs negative representation across formats).
    pub fn has_duplicate_transaction(
        &self,
        folio_id: Uuid,
        date: NaiveDate,
        tx_type: &str,
        amount: Decimal,
        units: Decimal,
    ) -> bool {
        let state = self.state.read().expect("lock poisoned");
        state.transactions.values().any(|tx| {
            tx.folio_id == folio_id
                && tx.date == date
                && tx.tx_type.eq_ignore_ascii_case(tx_type)
                && (tx.amount.abs() - amount.abs()).abs() < Decimal::new(1, 3)
                && (tx.units.abs() - units.abs()).abs() < Decimal::new(1, 4)
        })
    }

    /// Lists all folios within a portfolio, ordered by creation date.
    pub fn list_folios_by_portfolio(&self, portfolio_id: Uuid) -> Vec<FolioEntity> {
        let state = self.state.read().expect("lock poisoned");
        let mut folios: Vec<FolioEntity> = state
            .folios
            .values()
            .filter(|folio| folio.portfolio_id == portfolio_id)
            .cloned()
            .collect();
        folios.sort_by_key(|folio| folio.created_at);
        folios
    }

    /// Deletes a folio by UUID, cascading deletion to all its child ledger transactions.
    pub fn delete_folio(&self, id: Uuid) -> bool {
        let mut state = self.state.write().expect("lock poisoned");
        if state.folios.remove(&id).is_some() {
            state
                .transactions
                .retain(|_, transaction| transaction.folio_id != id);
            true
        } else {
            false
        }
    }

    /// Purges all data associated with a user account across portfolios, folios,
    /// transactions, profiles, and upload jobs.
    pub fn purge_user_data(&self, user_id: Uuid) {
        let mut state = self.state.write().expect("lock poisoned");
        let portfolio_ids: HashSet<Uuid> = state
            .portfolios
            .values()
            .filter(|portfolio| portfolio.user_id == user_id)
            .map(|portfolio| portfolio.id)
            .collect();

        let folio_ids: HashSet<Uuid> = state
            .folios
            .values()
            .filter(|folio| portfolio_ids.contains(&folio.portfolio_id))
            .map(|folio| folio.id)
            .collect();

        state
            .transactions
            .retain(|_, transaction| !folio_ids.contains(&transaction.folio_id));

        state
            .folios
            .retain(|_, folio| !portfolio_ids.contains(&folio.portfolio_id));

        state
            .portfolios
            .retain(|_, portfolio| portfolio.user_id != user_id);

        state
            .profiles
            .retain(|_, profile| profile.user_id != user_id);

        state.upload_jobs.retain(|_, job| job.user_id != user_id);
    }

    // -----------------------------------------------------------------------
    // UploadJob helpers
    // -----------------------------------------------------------------------

    /// Creates and persists an asynchronous upload job in the `Pending` state.
    pub fn create_upload_job(&self, id: Uuid, user_id: Uuid, file_path: &str) -> UploadJobEntity {
        let mut state = self.state.write().expect("lock poisoned");
        let now = Utc::now();
        let job = UploadJobEntity {
            id,
            user_id,
            file_path: file_path.to_string(),
            status: UploadJobStatus::Pending,
            message: None,
            created_at: now,
            updated_at: now,
            started_at: None,
            completed_at: None,
        };
        state.upload_jobs.insert(id, job.clone());
        job
    }

    /// Directly inserts a fully constructed upload job entity.
    pub fn insert_upload_job(&self, job: UploadJobEntity) {
        let mut state = self.state.write().expect("lock poisoned");
        state.upload_jobs.insert(job.id, job);
    }

    /// Retrieves an upload job by its UUID.
    pub fn get_upload_job(&self, id: Uuid) -> Option<UploadJobEntity> {
        let state = self.state.read().expect("lock poisoned");
        state.upload_jobs.get(&id).cloned()
    }

    /// Updates the status and message of an upload job, maintaining lifecycle timestamps
    /// (`started_at` when entering `Processing`, `completed_at` when entering `Completed`/`Failed`).
    ///
    /// # Errors
    /// Returns [`DbError::UploadJobNotFound`] if the job does not exist.
    pub fn update_upload_job_status(
        &self,
        id: Uuid,
        status: UploadJobStatus,
        message: Option<String>,
    ) -> Result<UploadJobEntity, DbError> {
        let mut state = self.state.write().expect("lock poisoned");
        let job = state
            .upload_jobs
            .get_mut(&id)
            .ok_or(DbError::UploadJobNotFound(id))?;
        let now = Utc::now();
        job.status = status;
        job.message = message;
        job.updated_at = now;
        if status == UploadJobStatus::Processing && job.started_at.is_none() {
            job.started_at = Some(now);
        }
        if matches!(status, UploadJobStatus::Completed | UploadJobStatus::Failed) {
            job.completed_at = Some(now);
        }
        Ok(job.clone())
    }

    /// Transitions an upload job status to `Processing`.
    pub fn set_upload_job_processing(&self, id: Uuid) -> Result<UploadJobEntity, DbError> {
        self.update_upload_job_status(id, UploadJobStatus::Processing, None)
    }

    /// Transitions an upload job status to `Completed`.
    pub fn set_upload_job_completed(&self, id: Uuid) -> Result<UploadJobEntity, DbError> {
        self.update_upload_job_status(id, UploadJobStatus::Completed, None)
    }

    /// Transitions an upload job status to `Failed` with an error message.
    pub fn set_upload_job_failed(
        &self,
        id: Uuid,
        message: &str,
    ) -> Result<UploadJobEntity, DbError> {
        self.update_upload_job_status(id, UploadJobStatus::Failed, Some(message.to_string()))
    }

    // -----------------------------------------------------------------------
    // NAV helpers
    // -----------------------------------------------------------------------

    /// Persists a NAV entry for an AMFI code and date into historical NAV storage.
    pub fn store_nav(&self, amfi_code: &str, date: NaiveDate, nav: Decimal) -> HistoricalNavEntity {
        let mut state = self.state.write().expect("lock poisoned");
        let id = Uuid::new_v4();
        let now = Utc::now();
        let record = HistoricalNavEntity {
            id,
            amfi_code: amfi_code.to_string(),
            date,
            nav,
            created_at: now,
        };
        state
            .historical_navs
            .insert((amfi_code.to_string(), date), record.clone());
        record
    }

    /// Looks up a historical NAV entry for an AMFI code and date.
    pub fn get_nav(&self, amfi_code: &str, date: NaiveDate) -> Option<HistoricalNavEntity> {
        let state = self.state.read().expect("lock poisoned");
        state
            .historical_navs
            .get(&(amfi_code.to_string(), date))
            .cloned()
    }

    /// Lists all stored NAV entries for an AMFI code, ordered chronologically by date.
    pub fn list_navs(&self, amfi_code: &str) -> Vec<HistoricalNavEntity> {
        let state = self.state.read().expect("lock poisoned");
        let mut navs: Vec<HistoricalNavEntity> = state
            .historical_navs
            .values()
            .filter(|nav_record| nav_record.amfi_code == amfi_code)
            .cloned()
            .collect();
        navs.sort_by_key(|nav_record| nav_record.date);
        navs
    }

    // -----------------------------------------------------------------------
    // Historical Valuation helpers
    // -----------------------------------------------------------------------

    /// Persists a daily portfolio valuation snapshot (value and cost basis).
    pub fn store_historical_valuation(
        &self,
        portfolio_id: Uuid,
        date: NaiveDate,
        value: Decimal,
        cost: Decimal,
    ) -> HistoricalValuationEntity {
        let mut state = self.state.write().expect("lock poisoned");
        let id = Uuid::new_v4();
        let now = Utc::now();
        let record = HistoricalValuationEntity {
            id,
            portfolio_id,
            date,
            value,
            cost,
            created_at: now,
        };
        state
            .historical_valuations
            .insert((portfolio_id, date), record.clone());
        record
    }

    /// Lists historical valuation snapshots for a portfolio, ordered chronologically by date.
    pub fn list_historical_valuations(&self, portfolio_id: Uuid) -> Vec<HistoricalValuationEntity> {
        let state = self.state.read().expect("lock poisoned");
        let mut list: Vec<HistoricalValuationEntity> = state
            .historical_valuations
            .values()
            .filter(|valuation| valuation.portfolio_id == portfolio_id)
            .cloned()
            .collect();
        list.sort_by_key(|valuation| valuation.date);
        list
    }

    // -----------------------------------------------------------------------
    // Lookup helpers
    // -----------------------------------------------------------------------

    /// Looks up an asset by its ISIN identifier.
    pub fn find_asset_by_isin(&self, isin: &str) -> Option<AssetEntity> {
        let state = self.state.read().expect("lock poisoned");
        state
            .assets
            .values()
            .find(|asset| asset.isin.as_deref() == Some(isin))
            .cloned()
    }

    /// Looks up an asset by its AMFI scheme code.
    pub fn find_asset_by_amfi_code(&self, amfi_code: &str) -> Option<AssetEntity> {
        let state = self.state.read().expect("lock poisoned");
        state
            .assets
            .values()
            .find(|asset| asset.amfi_code.as_deref() == Some(amfi_code))
            .cloned()
    }

    /// Looks up an asset by its name (case-insensitive).
    pub fn find_asset_by_name(&self, name: &str) -> Option<AssetEntity> {
        let state = self.state.read().expect("lock poisoned");
        state
            .assets
            .values()
            .find(|asset| asset.name.eq_ignore_ascii_case(name.trim()))
            .cloned()
    }

    /// Looks up a folio within a portfolio by asset ID and folio number (case-insensitive and sub-account normalized).
    pub fn find_folio(
        &self,
        portfolio_id: Uuid,
        asset_id: Uuid,
        number: &str,
    ) -> Option<FolioEntity> {
        let state = self.state.read().expect("lock poisoned");
        let trimmed = number.trim();
        let base_number = trimmed.split('/').next().unwrap_or("").trim();
        state
            .folios
            .values()
            .find(|folio| {
                if folio.portfolio_id != portfolio_id || folio.asset_id != asset_id {
                    return false;
                }
                let folio_trimmed = folio.number.trim();
                let folio_base = folio_trimmed.split('/').next().unwrap_or("").trim();
                folio_trimmed.eq_ignore_ascii_case(trimmed)
                    || (!base_number.is_empty() && folio_base.eq_ignore_ascii_case(base_number))
            })
            .cloned()
    }

    /// Looks up a managed profile belonging to a user by PAN (case-insensitive).
    pub fn find_profile_by_pan(&self, user_id: Uuid, pan: &str) -> Option<ManagedProfileEntity> {
        let state = self.state.read().expect("lock poisoned");
        state
            .profiles
            .values()
            .find(|profile| {
                profile.user_id == user_id && profile.pan.eq_ignore_ascii_case(pan.trim())
            })
            .cloned()
    }

    /// Looks up a portfolio linked to a specific managed profile.
    pub fn find_portfolio_by_profile(
        &self,
        user_id: Uuid,
        profile_id: Uuid,
    ) -> Option<PortfolioEntity> {
        let state = self.state.read().expect("lock poisoned");
        state
            .portfolios
            .values()
            .find(|portfolio| {
                portfolio.user_id == user_id && portfolio.managed_profile_id == Some(profile_id)
            })
            .cloned()
    }

    /// Looks up a transaction by external transaction ID (e.g. CAS ID).
    pub fn find_transaction_by_external_id(&self, external_id: &str) -> Option<TransactionEntity> {
        let state = self.state.read().expect("lock poisoned");
        state
            .transactions
            .values()
            .find(|transaction| transaction.external_id.as_deref() == Some(external_id))
            .cloned()
    }
}

#[async_trait]
impl PortfolioRepository for InMemoryDatabase {
    async fn create_portfolio(
        &self,
        user_id: Uuid,
        name: &str,
        managed_profile_id: Option<Uuid>,
    ) -> Result<PortfolioEntity, DbError> {
        let mut state = self.state.write().expect("lock poisoned");
        let id = Uuid::new_v4();
        let now = Utc::now();
        let portfolio = PortfolioEntity {
            id,
            user_id,
            managed_profile_id,
            name: name.to_string(),
            created_at: now,
            updated_at: now,
        };
        state.portfolios.insert(id, portfolio.clone());
        Ok(portfolio)
    }

    async fn get_portfolio(&self, id: Uuid) -> Result<Option<PortfolioEntity>, DbError> {
        let state = self.state.read().expect("lock poisoned");
        Ok(state.portfolios.get(&id).cloned())
    }

    async fn list_user_portfolios(&self, user_id: Uuid) -> Result<Vec<PortfolioEntity>, DbError> {
        let state = self.state.read().expect("lock poisoned");
        let mut list: Vec<PortfolioEntity> = state
            .portfolios
            .values()
            .filter(|portfolio| portfolio.user_id == user_id)
            .cloned()
            .collect();
        list.sort_by_key(|portfolio| portfolio.created_at);
        Ok(list)
    }

    async fn delete_portfolio(&self, id: Uuid) -> Result<(), DbError> {
        let mut state = self.state.write().expect("lock poisoned");
        if state.portfolios.remove(&id).is_none() {
            return Ok(());
        }

        // Find folios under this portfolio
        let folio_ids: Vec<Uuid> = state
            .folios
            .values()
            .filter(|folio| folio.portfolio_id == id)
            .map(|folio| folio.id)
            .collect();

        // Delete transactions belonging to these folios
        let folio_set: HashSet<Uuid> = folio_ids.into_iter().collect();
        state
            .transactions
            .retain(|_, transaction| !folio_set.contains(&transaction.folio_id));

        // Delete folios
        state.folios.retain(|_, folio| folio.portfolio_id != id);

        Ok(())
    }
}

#[async_trait]
impl TransactionRepository for InMemoryDatabase {
    async fn create_transaction(
        &self,
        folio_id: Uuid,
        date: NaiveDate,
        tx_type: &str,
        amount: Decimal,
        units: Decimal,
        nav: Decimal,
        balance: Decimal,
        external_id: Option<&str>,
    ) -> Result<TransactionEntity, DbError> {
        let mut state = self.state.write().expect("lock poisoned");
        if !state.folios.contains_key(&folio_id) {
            return Err(DbError::FolioNotFound(folio_id));
        }

        // Enforce externalId uniqueness constraint
        if let Some(ext_id) = external_id {
            let exists = state
                .transactions
                .values()
                .any(|transaction| transaction.external_id.as_deref() == Some(ext_id));
            if exists {
                return Err(DbError::ConstraintViolation(format!(
                    "Transaction with externalId '{ext_id}' already exists"
                )));
            }
        }

        let id = Uuid::new_v4();
        let now = Utc::now();
        let transaction = TransactionEntity {
            id,
            folio_id,
            date,
            tx_type: tx_type.to_string(),
            amount,
            units,
            nav,
            balance,
            external_id: external_id.map(|ext_str| ext_str.to_string()),
            created_at: now,
            updated_at: now,
        };
        state.transactions.insert(id, transaction.clone());
        Ok(transaction)
    }

    async fn list_by_folio(&self, folio_id: Uuid) -> Result<Vec<TransactionEntity>, DbError> {
        let state = self.state.read().expect("lock poisoned");
        let mut transactions: Vec<TransactionEntity> = state
            .transactions
            .values()
            .filter(|transaction| transaction.folio_id == folio_id)
            .cloned()
            .collect();
        // Deterministic FIFO multi-key sort
        transactions.sort_by(|tx_a, tx_b| {
            tx_a.date
                .cmp(&tx_b.date)
                .then_with(|| tx_a.created_at.cmp(&tx_b.created_at))
                .then_with(|| tx_a.id.cmp(&tx_b.id))
        });
        Ok(transactions)
    }

    async fn list_by_portfolio(
        &self,
        portfolio_id: Uuid,
    ) -> Result<Vec<TransactionEntity>, DbError> {
        let state = self.state.read().expect("lock poisoned");
        let folio_ids: HashSet<Uuid> = state
            .folios
            .values()
            .filter(|folio| folio.portfolio_id == portfolio_id)
            .map(|folio| folio.id)
            .collect();

        let mut transactions: Vec<TransactionEntity> = state
            .transactions
            .values()
            .filter(|transaction| folio_ids.contains(&transaction.folio_id))
            .cloned()
            .collect();
        // Deterministic FIFO multi-key sort
        transactions.sort_by(|tx_a, tx_b| {
            tx_a.date
                .cmp(&tx_b.date)
                .then_with(|| tx_a.created_at.cmp(&tx_b.created_at))
                .then_with(|| tx_a.id.cmp(&tx_b.id))
        });
        Ok(transactions)
    }
}

#[async_trait]
impl FamilyRepository for InMemoryDatabase {
    async fn create_managed_profile(
        &self,
        user_id: Uuid,
        name: &str,
        pan: &str,
        tax_slab: Decimal,
    ) -> Result<ManagedProfileEntity, DbError> {
        let mut state = self.state.write().expect("lock poisoned");

        let exists = state
            .profiles
            .values()
            .any(|profile| profile.user_id == user_id && profile.pan.eq_ignore_ascii_case(pan));
        if exists {
            return Err(DbError::ConstraintViolation(format!(
                "Profile with PAN '{pan}' already exists for user '{user_id}'"
            )));
        }

        let id = Uuid::new_v4();
        let now = Utc::now();
        let profile = ManagedProfileEntity {
            id,
            user_id,
            name: name.to_string(),
            pan: pan.to_uppercase(),
            tax_slab,
            created_at: now,
            updated_at: now,
        };
        state.profiles.insert(id, profile.clone());
        Ok(profile)
    }

    async fn list_profiles(&self, user_id: Uuid) -> Result<Vec<ManagedProfileEntity>, DbError> {
        let state = self.state.read().expect("lock poisoned");
        let mut profiles: Vec<ManagedProfileEntity> = state
            .profiles
            .values()
            .filter(|profile| profile.user_id == user_id)
            .cloned()
            .collect();
        profiles.sort_by_key(|profile| profile.created_at);
        Ok(profiles)
    }

    async fn delete_managed_profile(
        &self,
        user_id: Uuid,
        profile_id: Uuid,
    ) -> Result<ManagedProfileEntity, DbError> {
        let mut state = self.state.write().expect("lock poisoned");

        // Verify profile exists and belongs to user
        let profile = state
            .profiles
            .get(&profile_id)
            .filter(|profile| profile.user_id == user_id)
            .cloned()
            .ok_or(DbError::ProfileNotFound(profile_id))?;

        // 1. Find all portfolios under this profile
        let portfolio_ids: Vec<Uuid> = state
            .portfolios
            .values()
            .filter(|portfolio| portfolio.managed_profile_id == Some(profile_id))
            .map(|portfolio| portfolio.id)
            .collect();

        let portfolio_set: HashSet<Uuid> = portfolio_ids.into_iter().collect();

        // 2. Find all folios under these portfolios
        let folio_ids: Vec<Uuid> = state
            .folios
            .values()
            .filter(|folio| portfolio_set.contains(&folio.portfolio_id))
            .map(|folio| folio.id)
            .collect();

        let folio_set: HashSet<Uuid> = folio_ids.into_iter().collect();

        // 3. Delete transactions in those folios
        state
            .transactions
            .retain(|_, transaction| !folio_set.contains(&transaction.folio_id));

        // 4. Delete folios
        state
            .folios
            .retain(|_, folio| !portfolio_set.contains(&folio.portfolio_id));

        // 5. Delete portfolios
        state
            .portfolios
            .retain(|_, portfolio| portfolio.managed_profile_id != Some(profile_id));

        // 6. Delete managed profile
        state.profiles.remove(&profile_id);

        Ok(profile)
    }
}

#[async_trait]
impl FundHoldingsRepository for InMemoryDatabase {
    async fn upsert_fund_holdings(&self, holdings: &[FundHoldingEntity]) -> Result<(), DbError> {
        let mut state = self.state.write().expect("lock poisoned");
        for holding in holdings {
            state.fund_holdings.insert(
                (
                    holding.isin.clone(),
                    holding.as_of_date,
                    holding.stock_name.clone(),
                ),
                holding.clone(),
            );
        }
        Ok(())
    }

    async fn get_latest_holdings_by_isin(
        &self,
        isin: &str,
    ) -> Result<Vec<FundHoldingEntity>, DbError> {
        let state = self.state.read().expect("lock poisoned");
        let max_date = state
            .fund_holdings
            .values()
            .filter(|holding| holding.isin == isin)
            .map(|holding| holding.as_of_date)
            .max();

        let Some(date) = max_date else {
            return Ok(Vec::new());
        };

        let mut holdings: Vec<FundHoldingEntity> = state
            .fund_holdings
            .values()
            .filter(|holding| holding.isin == isin && holding.as_of_date == date)
            .cloned()
            .collect();

        holdings.sort_by(|holding_a, holding_b| {
            holding_b
                .weight
                .cmp(&holding_a.weight)
                .then_with(|| holding_a.stock_name.cmp(&holding_b.stock_name))
        });
        Ok(holdings)
    }

    async fn get_latest_holdings_batch(
        &self,
        isins: &[&str],
    ) -> Result<HashMap<String, Vec<FundHoldingEntity>>, DbError> {
        let mut result_map: HashMap<String, Vec<FundHoldingEntity>> = HashMap::new();
        for &isin_str in isins {
            let holdings = self.get_latest_holdings_by_isin(isin_str).await?;
            result_map.insert(isin_str.to_string(), holdings);
        }
        Ok(result_map)
    }
}
