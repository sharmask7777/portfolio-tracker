//! Database entity models mapping PostgreSQL tables 1:1.
//!
//! Each entity mirrors a table in the database schema, with custom SQLx column
//! mappings (`#[sqlx(rename = ...)]`) and serde serialization conventions (`camelCase` with
//! snake_case aliases).
//!
//! Also provides bidirectional conversion between persistence entities and pure domain
//! models in `portfolio_core`.

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::DbError;

/// Database entity for the `"User"` table representing a registered account.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UserEntity {
    /// Unique user UUID primary key.
    pub id: Uuid,
    /// Unique email address used for authentication.
    pub email: String,
    /// Bcrypt/Argon2 password hash string.
    #[sqlx(rename = "password")]
    #[serde(rename = "passwordHash", alias = "password", alias = "password_hash")]
    pub password_hash: String,
    /// Timestamp when user record was created.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    /// Timestamp when user record was last updated.
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for the `"ManagedProfile"` table representing an individual investor profile.
///
/// A user may maintain multiple managed profiles for family members, each with their own
/// tax-identification PAN and statutory marginal tax slab.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ManagedProfileEntity {
    /// Unique profile UUID primary key.
    pub id: Uuid,
    /// Foreign key referencing the parent `"User"`.
    #[sqlx(rename = "userId")]
    #[serde(rename = "userId", alias = "user_id")]
    pub user_id: Uuid,
    /// Display name of the family member or entity (e.g. "Self", "Spouse", "HUF").
    pub name: String,
    /// Indian Permanent Account Number (PAN) formatted as 10 alphanumeric characters.
    pub pan: String,
    /// Marginal tax slab rate (e.g. 0.30 for 30% slab) used for tax liability estimations.
    #[sqlx(rename = "taxSlab")]
    #[serde(rename = "taxSlab", alias = "tax_slab")]
    pub tax_slab: Decimal,
    /// Timestamp when profile record was created.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    /// Timestamp when profile record was last updated.
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for the `"Portfolio"` table representing an investment container.
///
/// Portfolios aggregate folios and can either belong directly to a user or be assigned
/// to a specific `ManagedProfile`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioEntity {
    /// Unique portfolio UUID primary key.
    pub id: Uuid,
    /// Foreign key referencing the owning `"User"`.
    #[sqlx(rename = "userId")]
    #[serde(rename = "userId", alias = "user_id")]
    pub user_id: Uuid,
    /// Optional foreign key linking this portfolio to a specific `"ManagedProfile"`.
    #[sqlx(rename = "managedProfileId")]
    #[serde(rename = "managedProfileId", alias = "managed_profile_id")]
    pub managed_profile_id: Option<Uuid>,
    /// Descriptive name of the portfolio (e.g. "Retirement", "Kids Education", "Tax Saver").
    pub name: String,
    /// Timestamp when portfolio was created.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    /// Timestamp when portfolio was last updated.
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for the `"Asset"` table representing a financial security or instrument.
///
/// Supported types include Mutual Funds, Stocks, Fixed Deposits, EPF, PPF, SGBs, and Physical Gold.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AssetEntity {
    /// Unique asset UUID primary key.
    pub id: Uuid,
    /// Asset class classification (e.g. "MUTUAL_FUND", "STOCK", "SGB", etc.).
    #[sqlx(rename = "type")]
    #[serde(rename = "assetType", alias = "type", alias = "asset_type")]
    pub asset_type: String,
    /// Full commercial or statutory name of the asset.
    pub name: String,
    /// Optional International Securities Identification Number (ISIN).
    pub isin: Option<String>,
    /// Optional Association of Mutual Funds in India (AMFI) scheme code.
    #[sqlx(rename = "amfiCode")]
    #[serde(rename = "amfiCode", alias = "amfi_code")]
    pub amfi_code: Option<String>,
    /// Optional stock ticker or trading symbol (e.g. "RELIANCE.NS").
    pub symbol: Option<String>,
    /// JSON metadata describing exit load structures and holding duration tiers.
    #[sqlx(rename = "exitLoadMetadata")]
    #[serde(default, rename = "exitLoadMetadata", alias = "exit_load_metadata")]
    pub exit_load_metadata: Option<String>,
    /// Timestamp when asset was registered in the database.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    /// Timestamp when asset details were last updated.
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for the `"Folio"` table representing an investor's holding account.
///
/// Links a specific `"Asset"` to a `"Portfolio"` under a unique folio account number.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FolioEntity {
    /// Unique folio UUID primary key.
    pub id: Uuid,
    /// Foreign key referencing the parent `"Portfolio"`.
    #[sqlx(rename = "portfolioId")]
    #[serde(rename = "portfolioId", alias = "portfolio_id")]
    pub portfolio_id: Uuid,
    /// Foreign key referencing the associated `"Asset"`.
    #[sqlx(rename = "assetId")]
    #[serde(rename = "assetId", alias = "asset_id")]
    pub asset_id: Uuid,
    /// Account or folio identification number issued by the AMC / RTA.
    pub number: String,
    /// Asset Management Company (AMC) name (e.g. "HDFC Mutual Fund").
    pub amc: Option<String>,
    /// Investor PAN associated with this folio account.
    pub pan: Option<String>,
    /// Timestamp when folio was created.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    /// Timestamp when folio was last updated.
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for the `"Transaction"` table representing a financial ledger entry.
///
/// Records unit allotments, redemptions, switches, dividends, and charges.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TransactionEntity {
    /// Unique transaction UUID primary key.
    pub id: Uuid,
    /// Foreign key referencing the owning `"Folio"`.
    #[sqlx(rename = "folioId")]
    #[serde(rename = "folioId", alias = "folio_id")]
    pub folio_id: Uuid,
    /// Transaction settlement or execution date.
    pub date: NaiveDate,
    /// Transaction classification string (e.g. "PURCHASE", "REDEMPTION", "DIVIDEND_PAYOUT").
    #[sqlx(rename = "type")]
    #[serde(rename = "txType", alias = "type", alias = "tx_type")]
    pub tx_type: String,
    /// Monetary settlement amount in INR.
    pub amount: Decimal,
    /// Number of units transacted (positive for additions, negative/positive depending on convention).
    pub units: Decimal,
    /// Net Asset Value (NAV) or price per unit at execution.
    pub nav: Decimal,
    /// Cumulative cumulative unit balance after this transaction execution.
    pub balance: Decimal,
    /// Optional external statement identifier for deduplication (e.g. CAS transaction ID).
    #[sqlx(rename = "externalId")]
    #[serde(rename = "externalId", alias = "external_id")]
    pub external_id: Option<String>,
    /// Timestamp when transaction was created in the database.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    /// Timestamp when transaction was last updated.
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for the `"FamilyGroup"` table representing a family sharing unit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FamilyGroupEntity {
    /// Unique family group UUID primary key.
    pub id: Uuid,
    /// Name of the family group (e.g. "Sharma Family").
    pub name: String,
    /// Foreign key referencing the user who owns and administers this group.
    #[sqlx(rename = "ownerId")]
    #[serde(rename = "ownerId", alias = "owner_id")]
    pub owner_id: Uuid,
    /// Timestamp when family group was created.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    /// Timestamp when family group was last updated.
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for the `"FamilyMember"` table linking users to family groups.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FamilyMemberEntity {
    /// Unique family member link UUID primary key.
    pub id: Uuid,
    /// Foreign key referencing the member `"User"`.
    #[sqlx(rename = "userId")]
    #[serde(rename = "userId", alias = "user_id")]
    pub user_id: Uuid,
    /// Foreign key referencing the target `"FamilyGroup"`.
    #[sqlx(rename = "groupId")]
    #[serde(rename = "groupId", alias = "group_id")]
    pub group_id: Uuid,
    /// Role of the user within this group (e.g. "OWNER", "ADMIN", "MEMBER", "VIEWER").
    pub role: String,
    /// Timestamp when membership was created.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    /// Timestamp when membership was last updated.
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Processing lifecycle states for asynchronous CAS PDF upload jobs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "UploadJobStatus", rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UploadJobStatus {
    /// Job is queued and waiting for worker pickup.
    Pending,
    /// Worker is actively parsing the statement and ingesting transactions.
    Processing,
    /// Parsing and database ingestion finished successfully.
    Completed,
    /// Processing failed due to incorrect password, parse error, or database failure.
    Failed,
}

impl std::fmt::Display for UploadJobStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "PENDING"),
            Self::Processing => write!(f, "PROCESSING"),
            Self::Completed => write!(f, "COMPLETED"),
            Self::Failed => write!(f, "FAILED"),
        }
    }
}

impl std::str::FromStr for UploadJobStatus {
    type Err = DbError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.trim().to_uppercase().as_str() {
            "PENDING" => Ok(Self::Pending),
            "PROCESSING" => Ok(Self::Processing),
            "COMPLETED" => Ok(Self::Completed),
            "FAILED" => Ok(Self::Failed),
            other => Err(DbError::Internal(format!(
                "Invalid upload job status: {other}"
            ))),
        }
    }
}

/// Database entity for the `"UploadJob"` table tracking asynchronous statement ingestion.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UploadJobEntity {
    /// Unique upload job UUID primary key.
    pub id: Uuid,
    /// Foreign key referencing the user who uploaded the document.
    #[sqlx(rename = "userId")]
    #[serde(rename = "userId", alias = "user_id")]
    pub user_id: Uuid,
    /// Filesystem or object storage path to the uploaded statement file.
    #[sqlx(rename = "filePath")]
    #[serde(rename = "filePath", alias = "file_path")]
    pub file_path: String,
    /// Current job execution status.
    pub status: UploadJobStatus,
    /// Error message or summary information if the job failed or succeeded.
    pub message: Option<String>,
    /// Timestamp when job was queued.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    /// Timestamp when job was last updated.
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
    /// Timestamp when worker commenced processing.
    #[sqlx(rename = "startedAt")]
    #[serde(rename = "startedAt", alias = "started_at")]
    pub started_at: Option<DateTime<Utc>>,
    /// Timestamp when worker completed or failed execution.
    #[sqlx(rename = "completedAt")]
    #[serde(rename = "completedAt", alias = "completed_at")]
    pub completed_at: Option<DateTime<Utc>>,
}

/// Database entity for the `"HistoricalNAV"` table storing daily scheme NAV time series.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalNavEntity {
    /// Unique historical NAV record UUID primary key.
    pub id: Uuid,
    /// Association of Mutual Funds in India (AMFI) scheme code.
    #[sqlx(rename = "amfiCode")]
    #[serde(rename = "amfiCode", alias = "amfi_code")]
    pub amfi_code: String,
    /// Date of the reported NAV.
    pub date: NaiveDate,
    /// Net Asset Value per unit on this date.
    pub nav: Decimal,
    /// Timestamp when record was saved to the database.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
}

/// Database entity for the `"PortfolioHistory"` table storing daily portfolio valuation snapshots.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalValuationEntity {
    /// Unique valuation snapshot UUID primary key.
    pub id: Uuid,
    /// Foreign key referencing the target `"Portfolio"`.
    #[sqlx(rename = "portfolioId")]
    #[serde(rename = "portfolioId", alias = "portfolio_id")]
    pub portfolio_id: Uuid,
    /// Snapshot evaluation date.
    pub date: NaiveDate,
    /// Total current market value of the portfolio on this date.
    pub value: Decimal,
    /// Cumulative net invested capital (cost basis) on this date.
    pub cost: Decimal,
    /// Timestamp when record was saved.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
}

/// Default fallback sector designation when unclassified in AMC disclosures.
fn default_fund_holding_sector() -> String {
    "Other".to_string()
}

/// Database entity for the `"FundHolding"` table storing monthly AMC stock look-through disclosures.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FundHoldingEntity {
    /// Unique fund holding UUID primary key.
    pub id: Uuid,
    /// Mutual fund scheme ISIN identifier.
    pub isin: String,
    /// Full mutual fund scheme name reported in the disclosure.
    #[sqlx(rename = "schemeName")]
    #[serde(rename = "schemeName", alias = "scheme_name")]
    pub scheme_name: String,
    /// Reporting month-end date for this portfolio disclosure.
    #[sqlx(rename = "asOfDate")]
    #[serde(rename = "asOfDate", alias = "as_of_date")]
    pub as_of_date: NaiveDate,
    /// Disclosed company name of the underlying stock holding.
    #[sqlx(rename = "stockName")]
    #[serde(rename = "stockName", alias = "stock_name")]
    pub stock_name: String,
    /// Disclosed ISIN of the underlying stock (if available).
    #[sqlx(rename = "stockIsin")]
    #[serde(default, rename = "stockIsin", alias = "stock_isin")]
    pub stock_isin: Option<String>,
    /// Economic sector classification (e.g. "Financial Services", "Technology").
    #[serde(default = "default_fund_holding_sector")]
    pub sector: String,
    /// Portfolio weight allocation percentage (e.g. 8.450 for 8.45%).
    pub weight: Decimal,
    /// Timestamp when disclosure entry was created.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
}

/// Database entity for the `"StockMetadata"` table representing equity classification master data.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct StockMetadataEntity {
    /// International Securities Identification Number.
    pub isin: String,
    /// Exchange ticker symbol.
    pub symbol: String,
    /// Canonical company name.
    pub name: String,
    /// Economic sector classification.
    pub sector: String,
    /// Market capitalization tier ("large", "mid", "small", "other").
    #[sqlx(rename = "marketCapTier")]
    #[serde(rename = "marketCapTier", alias = "market_cap_tier")]
    pub market_cap_tier: String,
    /// Market capitalization rank (1-100 Large, 101-250 Mid, 251+ Small).
    #[sqlx(rename = "marketCapRank")]
    #[serde(default, rename = "marketCapRank", alias = "market_cap_rank")]
    pub market_cap_rank: Option<i32>,
    /// Market capitalization in Crores (INR).
    #[sqlx(rename = "marketCapCr")]
    #[serde(default, rename = "marketCapCr", alias = "market_cap_cr")]
    pub market_cap_cr: Option<f64>,
    /// Date of classification data.
    #[sqlx(rename = "asOfDate")]
    #[serde(rename = "asOfDate", alias = "as_of_date")]
    pub as_of_date: NaiveDate,
    /// Timestamp when record was created.
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    /// Timestamp when record was last updated.
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Conversion to / from portfolio-core domain models
// ---------------------------------------------------------------------------

impl TransactionEntity {
    /// Converts a persistence `TransactionEntity` into a pure domain `portfolio_core::holdings::Transaction`.
    ///
    /// Maps transaction type strings into canonical domain [`portfolio_core::holdings::TransactionType`]
    /// variants with case-insensitive normalization and synonym mapping (e.g. `BUY` -> `Purchase`,
    /// `SELL` -> `Redemption`, `SIP` -> `PurchaseSip`).
    ///
    /// # Errors
    /// Returns [`DbError`] if domain precision wrappers fail during construction.
    pub fn to_core_transaction(&self) -> Result<portfolio_core::holdings::Transaction, DbError> {
        let normalized_type = self.tx_type.trim().to_uppercase();
        let tx_type = match normalized_type.as_str() {
            "PURCHASE" | "BUY" => portfolio_core::holdings::TransactionType::Purchase,
            "PURCHASE_SIP" | "SIP" => portfolio_core::holdings::TransactionType::PurchaseSip,
            "REDEMPTION" | "SELL" => portfolio_core::holdings::TransactionType::Redemption,
            "SWITCH_IN" => portfolio_core::holdings::TransactionType::SwitchIn,
            "SWITCH_OUT" => portfolio_core::holdings::TransactionType::SwitchOut,
            "DIVIDEND_PAYOUT" => portfolio_core::holdings::TransactionType::DividendPayout,
            "DIVIDEND_REINVESTMENT" => {
                portfolio_core::holdings::TransactionType::DividendReinvestment
            }
            "REVERSAL" => portfolio_core::holdings::TransactionType::Reversal,
            "STAMP_DUTY_TAX" | "STAMP_DUTY" | "STT" | "TAX" | "CHARGES" | "FEE" => {
                portfolio_core::holdings::TransactionType::StampDuty
            }
            _ => portfolio_core::holdings::TransactionType::Other,
        };

        let mut core_transaction = portfolio_core::holdings::Transaction::new(
            self.id.to_string(),
            self.date,
            tx_type,
            portfolio_core::types::Money::new(self.amount),
            portfolio_core::types::Units::new(self.units),
            portfolio_core::types::Nav::new(self.nav),
            portfolio_core::types::Units::new(self.balance),
        );
        if let Some(ref external_id_str) = self.external_id {
            core_transaction = core_transaction.with_external_id(external_id_str);
        }
        Ok(core_transaction)
    }
}

impl FolioEntity {
    /// Converts a persistence `FolioEntity` and its associated `AssetEntity` and transactions
    /// into a pure domain `portfolio_core::holdings::Folio`.
    ///
    /// # Errors
    /// Returns [`DbError`] if folio number, asset type, PAN, or ISIN fail domain validation.
    pub fn to_core_folio(
        &self,
        asset: &AssetEntity,
        transactions: Vec<portfolio_core::holdings::Transaction>,
    ) -> Result<portfolio_core::holdings::Folio, DbError> {
        let folio_number = portfolio_core::types::FolioNumber::new(&self.number)?;
        let asset_type = asset
            .asset_type
            .parse::<portfolio_core::types::AssetType>()?;

        let mut core_folio = portfolio_core::holdings::Folio::new(
            self.id.to_string(),
            folio_number,
            &asset.name,
            asset_type,
        );

        if let Some(ref pan_string) = self.pan {
            core_folio = core_folio.with_pan(portfolio_core::types::Pan::new(pan_string)?);
        }
        if let Some(ref isin_string) = asset.isin {
            core_folio = core_folio.with_isin(portfolio_core::types::Isin::new(isin_string)?);
        }
        core_folio = core_folio.with_transactions(transactions);
        Ok(core_folio)
    }
}

impl PortfolioEntity {
    /// Converts a persistence `PortfolioEntity` and its child folios into a pure domain
    /// `portfolio_core::holdings::Portfolio`.
    pub fn to_core_portfolio(
        &self,
        folios: Vec<portfolio_core::holdings::Folio>,
    ) -> portfolio_core::holdings::Portfolio {
        portfolio_core::holdings::Portfolio::new(self.id.to_string(), &self.name)
            .with_folios(folios)
    }
}

impl ManagedProfileEntity {
    /// Converts a persistence `ManagedProfileEntity` and its child portfolios into a pure domain
    /// `portfolio_core::holdings::ManagedProfile`.
    ///
    /// # Errors
    /// Returns [`DbError`] if the profile's PAN fails statutory domain validation.
    pub fn to_core_profile(
        &self,
        portfolios: Vec<portfolio_core::holdings::Portfolio>,
    ) -> Result<portfolio_core::holdings::ManagedProfile, DbError> {
        let pan = portfolio_core::types::Pan::new(&self.pan)?;
        Ok(portfolio_core::holdings::ManagedProfile::new(
            self.id.to_string(),
            self.user_id.to_string(),
            &self.name,
            pan,
            self.tax_slab,
        )
        .with_portfolios(portfolios))
    }
}
