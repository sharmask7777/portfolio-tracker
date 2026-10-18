//! Holdings aggregation, transaction processing, and position calculations.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::error::PortfolioError;
use crate::types::{AssetType, FolioNumber, Isin, Money, Nav, Pan, Units};

/// Classification of transaction types matching standard mutual fund / brokerage CAS statements.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TransactionType {
    Purchase,
    PurchaseSip,
    Redemption,
    Buy,
    Sell,
    SwitchIn,
    SwitchOut,
    DividendPayout,
    DividendReinvestment,
    Other,
}

impl TransactionType {
    /// Inflows to investor (cash realized / out of portfolio).
    pub fn is_inflow(&self) -> bool {
        matches!(
            self,
            TransactionType::Redemption
                | TransactionType::Sell
                | TransactionType::SwitchOut
                | TransactionType::DividendPayout
        )
    }

    /// Outflows from investor (cash invested / into portfolio).
    pub fn is_outflow(&self) -> bool {
        matches!(
            self,
            TransactionType::Purchase
                | TransactionType::PurchaseSip
                | TransactionType::Buy
                | TransactionType::SwitchIn
                | TransactionType::DividendReinvestment
        )
    }

    /// Whether this transaction carries active units.
    pub fn is_unit_bearing(&self) -> bool {
        true
    }
}

/// A single immutable financial transaction record in a folio.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub date: NaiveDate,
    pub tx_type: TransactionType,
    pub amount: Money,
    pub units: Units,
    pub nav: Nav,
    pub balance: Units,
    pub external_id: Option<String>,
}

impl Transaction {
    pub fn new(
        id: impl Into<String>,
        date: NaiveDate,
        tx_type: TransactionType,
        amount: Money,
        units: Units,
        nav: Nav,
        balance: Units,
    ) -> Self {
        Self {
            id: id.into(),
            date,
            tx_type,
            amount,
            units,
            nav,
            balance,
            external_id: None,
        }
    }

    pub fn with_external_id(mut self, ext_id: impl Into<String>) -> Self {
        self.external_id = Some(ext_id.into());
        self
    }
}

/// A folio representing an account with an AMC or broker holding units of an asset.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Folio {
    pub id: String,
    pub folio_number: FolioNumber,
    pub pan: Option<Pan>,
    pub isin: Option<Isin>,
    pub asset_name: String,
    pub asset_type: AssetType,
    pub transactions: Vec<Transaction>,
}

impl Folio {
    pub fn new(
        id: impl Into<String>,
        folio_number: FolioNumber,
        asset_name: impl Into<String>,
        asset_type: AssetType,
    ) -> Self {
        Self {
            id: id.into(),
            folio_number,
            pan: None,
            isin: None,
            asset_name: asset_name.into(),
            asset_type,
            transactions: Vec::new(),
        }
    }

    pub fn with_isin(mut self, isin: Isin) -> Self {
        self.isin = Some(isin);
        self
    }

    pub fn with_pan(mut self, pan: Pan) -> Self {
        self.pan = Some(pan);
        self
    }

    pub fn with_transactions(mut self, txs: Vec<Transaction>) -> Self {
        self.transactions = txs;
        self
    }
}

/// Consolidated scheme grouping multiple folios/PANs for the same scheme without duplicate valuation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConsolidatedScheme {
    pub isin: Option<Isin>,
    pub asset_name: String,
    pub total_units: Units,
    pub total_current_value: Money,
    pub total_invested_amount: Money,
    pub folios: Vec<Folio>,
}

/// A portfolio collection of folios under a managed profile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Portfolio {
    pub id: String,
    pub name: String,
    pub folios: Vec<Folio>,
}

impl Portfolio {
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            folios: Vec::new(),
        }
    }

    pub fn with_folios(mut self, folios: Vec<Folio>) -> Self {
        self.folios = folios;
        self
    }
}

/// A managed family profile with an associated PAN, tax slab, and constituent portfolios.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ManagedProfile {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub pan: Pan,
    pub tax_slab: rust_decimal::Decimal,
    pub portfolios: Vec<Portfolio>,
}

impl ManagedProfile {
    pub fn new(
        id: impl Into<String>,
        user_id: impl Into<String>,
        name: impl Into<String>,
        pan: Pan,
        tax_slab: rust_decimal::Decimal,
    ) -> Self {
        Self {
            id: id.into(),
            user_id: user_id.into(),
            name: name.into(),
            pan,
            tax_slab,
            portfolios: Vec::new(),
        }
    }

    pub fn with_portfolios(mut self, portfolios: Vec<Portfolio>) -> Self {
        self.portfolios = portfolios;
        self
    }
}

/// In-memory domain registry for managing multi-member family profiles.
#[derive(Debug, Clone, Default)]
pub struct FamilyRegistry {
    profiles: Vec<ManagedProfile>,
}

impl FamilyRegistry {
    pub fn new() -> Self {
        Self {
            profiles: Vec::new(),
        }
    }

    pub fn add_profile(&mut self, profile: ManagedProfile) {
        self.profiles.push(profile);
    }

    pub fn get_profile(&self, profile_id: &str) -> Option<&ManagedProfile> {
        self.profiles.iter().find(|p| p.id == profile_id)
    }

    pub fn get_profiles_for_user(&self, user_id: &str) -> Vec<&ManagedProfile> {
        self.profiles
            .iter()
            .filter(|p| p.user_id == user_id)
            .collect()
    }

    /// Transactionally deletes a managed profile and cascades to all its portfolios and folios,
    /// strictly isolating and leaving all other profiles untouched.
    ///
    /// NOTE: In TDD RED state, this returns an error stub to confirm test failure.
    pub fn delete_managed_profile(
        &mut self,
        _user_id: &str,
        _profile_id: &str,
    ) -> Result<ManagedProfile, PortfolioError> {
        // RED phase stub: fails to satisfy test assertion until GREEN phase is implemented
        Err(PortfolioError::EmptyPortfolio)
    }
}

/// Safely gets the latest unit balance from a list of transactions.
///
/// NOTE: In TDD RED state, this returns Units::zero() to confirm test failure.
pub fn get_latest_units(_transactions: &[Transaction]) -> Units {
    // RED phase stub
    Units::zero()
}

/// Safely gets the latest NAV from a list of transactions.
///
/// NOTE: In TDD RED state, this returns Nav::zero() to confirm test failure.
pub fn get_latest_nav(_transactions: &[Transaction]) -> Nav {
    // RED phase stub
    Nav::zero()
}

/// Consolidates multiple folios for the same scheme (grouped by ISIN / name),
/// aggregating total units, current valuation, and invested amount.
///
/// NOTE: In TDD RED state, this returns an empty Vec to confirm test failure.
pub fn consolidate_by_scheme(_folios: &[Folio], _current_nav: Nav) -> Vec<ConsolidatedScheme> {
    // RED phase stub
    Vec::new()
}
