//! Thread-safe in-memory database mock for fast hermetic testing.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};

use async_trait::async_trait;
use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::entities::{
    AssetEntity, FamilyGroupEntity, FamilyMemberEntity, FolioEntity, ManagedProfileEntity,
    PortfolioEntity, TransactionEntity, UserEntity,
};
use crate::error::DbError;
use crate::repositories::{FamilyRepository, PortfolioRepository, TransactionRepository};

/// In-memory storage state holding entity tables.
#[derive(Debug, Default, Clone)]
pub struct InMemoryDatabaseState {
    pub users: HashMap<Uuid, UserEntity>,
    pub profiles: HashMap<Uuid, ManagedProfileEntity>,
    pub portfolios: HashMap<Uuid, PortfolioEntity>,
    pub assets: HashMap<Uuid, AssetEntity>,
    pub folios: HashMap<Uuid, FolioEntity>,
    pub transactions: HashMap<Uuid, TransactionEntity>,
    pub family_groups: HashMap<Uuid, FamilyGroupEntity>,
    pub family_members: HashMap<Uuid, FamilyMemberEntity>,
}

/// Thread-safe in-memory database mock.
/// Supports concurrent reads and synchronized mutations for sub-millisecond tests.
#[derive(Debug, Clone, Default)]
pub struct InMemoryDatabase {
    state: Arc<RwLock<InMemoryDatabaseState>>,
}

impl InMemoryDatabase {
    pub fn new() -> Self {
        Self {
            state: Arc::new(RwLock::new(InMemoryDatabaseState::default())),
        }
    }

    /// Resets all data in the in-memory database.
    pub fn clear(&self) {
        let mut state = self.state.write().expect("lock poisoned");
        *state = InMemoryDatabaseState::default();
    }

    // -----------------------------------------------------------------------
    // User helpers
    // -----------------------------------------------------------------------

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

    pub fn get_user(&self, id: Uuid) -> Option<UserEntity> {
        let state = self.state.read().expect("lock poisoned");
        state.users.get(&id).cloned()
    }

    // -----------------------------------------------------------------------
    // Asset helpers
    // -----------------------------------------------------------------------

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
            isin: isin.map(|s| s.to_string()),
            amfi_code: amfi_code.map(|s| s.to_string()),
            symbol: symbol.map(|s| s.to_string()),
            exit_load_metadata,
            created_at: now,
            updated_at: now,
        };
        state.assets.insert(id, asset.clone());
        asset
    }

    pub fn get_asset(&self, id: Uuid) -> Option<AssetEntity> {
        let state = self.state.read().expect("lock poisoned");
        state.assets.get(&id).cloned()
    }

    // -----------------------------------------------------------------------
    // Folio helpers
    // -----------------------------------------------------------------------

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
            amc: amc.map(|s| s.to_string()),
            pan: pan.map(|s| s.to_string()),
            created_at: now,
            updated_at: now,
        };
        state.folios.insert(id, folio.clone());
        Ok(folio)
    }

    pub fn get_folio(&self, id: Uuid) -> Option<FolioEntity> {
        let state = self.state.read().expect("lock poisoned");
        state.folios.get(&id).cloned()
    }

    pub fn list_folios_by_portfolio(&self, portfolio_id: Uuid) -> Vec<FolioEntity> {
        let state = self.state.read().expect("lock poisoned");
        let mut folios: Vec<FolioEntity> = state
            .folios
            .values()
            .filter(|f| f.portfolio_id == portfolio_id)
            .cloned()
            .collect();
        folios.sort_by_key(|f| f.created_at);
        folios
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
            .filter(|p| p.user_id == user_id)
            .cloned()
            .collect();
        list.sort_by_key(|p| p.created_at);
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
            .filter(|f| f.portfolio_id == id)
            .map(|f| f.id)
            .collect();

        // Delete transactions belonging to these folios
        let folio_set: HashSet<Uuid> = folio_ids.into_iter().collect();
        state
            .transactions
            .retain(|_, tx| !folio_set.contains(&tx.folio_id));

        // Delete folios
        state.folios.retain(|_, f| f.portfolio_id != id);

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

        if let Some(ext_id) = external_id {
            let exists = state
                .transactions
                .values()
                .any(|t| t.external_id.as_deref() == Some(ext_id));
            if exists {
                return Err(DbError::ConstraintViolation(format!(
                    "Transaction with externalId '{ext_id}' already exists"
                )));
            }
        }

        let id = Uuid::new_v4();
        let now = Utc::now();
        let tx = TransactionEntity {
            id,
            folio_id,
            date,
            tx_type: tx_type.to_string(),
            amount,
            units,
            nav,
            balance,
            external_id: external_id.map(|s| s.to_string()),
            created_at: now,
            updated_at: now,
        };
        state.transactions.insert(id, tx.clone());
        Ok(tx)
    }

    async fn list_by_folio(&self, folio_id: Uuid) -> Result<Vec<TransactionEntity>, DbError> {
        let state = self.state.read().expect("lock poisoned");
        let mut txs: Vec<TransactionEntity> = state
            .transactions
            .values()
            .filter(|t| t.folio_id == folio_id)
            .cloned()
            .collect();
        txs.sort_by(|a, b| {
            a.date
                .cmp(&b.date)
                .then_with(|| a.created_at.cmp(&b.created_at))
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(txs)
    }

    async fn list_by_portfolio(
        &self,
        portfolio_id: Uuid,
    ) -> Result<Vec<TransactionEntity>, DbError> {
        let state = self.state.read().expect("lock poisoned");
        let folio_ids: HashSet<Uuid> = state
            .folios
            .values()
            .filter(|f| f.portfolio_id == portfolio_id)
            .map(|f| f.id)
            .collect();

        let mut txs: Vec<TransactionEntity> = state
            .transactions
            .values()
            .filter(|t| folio_ids.contains(&t.folio_id))
            .cloned()
            .collect();
        txs.sort_by(|a, b| {
            a.date
                .cmp(&b.date)
                .then_with(|| a.created_at.cmp(&b.created_at))
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(txs)
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
            .any(|p| p.user_id == user_id && p.pan.eq_ignore_ascii_case(pan));
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
            .filter(|p| p.user_id == user_id)
            .cloned()
            .collect();
        profiles.sort_by_key(|p| p.created_at);
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
            .filter(|p| p.user_id == user_id)
            .cloned()
            .ok_or(DbError::ProfileNotFound(profile_id))?;

        // 1. Find all portfolios under this profile
        let portfolio_ids: Vec<Uuid> = state
            .portfolios
            .values()
            .filter(|p| p.managed_profile_id == Some(profile_id))
            .map(|p| p.id)
            .collect();

        let portfolio_set: HashSet<Uuid> = portfolio_ids.into_iter().collect();

        // 2. Find all folios under these portfolios
        let folio_ids: Vec<Uuid> = state
            .folios
            .values()
            .filter(|f| portfolio_set.contains(&f.portfolio_id))
            .map(|f| f.id)
            .collect();

        let folio_set: HashSet<Uuid> = folio_ids.into_iter().collect();

        // 3. Delete transactions in those folios
        state
            .transactions
            .retain(|_, tx| !folio_set.contains(&tx.folio_id));

        // 4. Delete folios
        state
            .folios
            .retain(|_, f| !portfolio_set.contains(&f.portfolio_id));

        // 5. Delete portfolios
        state
            .portfolios
            .retain(|_, p| p.managed_profile_id != Some(profile_id));

        // 6. Delete managed profile
        state.profiles.remove(&profile_id);

        Ok(profile)
    }
}
