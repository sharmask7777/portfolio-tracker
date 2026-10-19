//! Database entity models mapping PostgreSQL / Prisma tables 1:1.

use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::DbError;

/// Database entity for User table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UserEntity {
    pub id: Uuid,
    pub email: String,
    #[sqlx(rename = "password")]
    #[serde(rename = "passwordHash", alias = "password", alias = "password_hash")]
    pub password_hash: String,
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for ManagedProfile table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ManagedProfileEntity {
    pub id: Uuid,
    #[sqlx(rename = "userId")]
    #[serde(rename = "userId", alias = "user_id")]
    pub user_id: Uuid,
    pub name: String,
    pub pan: String,
    #[sqlx(rename = "taxSlab")]
    #[serde(rename = "taxSlab", alias = "tax_slab")]
    pub tax_slab: Decimal,
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for Portfolio table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct PortfolioEntity {
    pub id: Uuid,
    #[sqlx(rename = "userId")]
    #[serde(rename = "userId", alias = "user_id")]
    pub user_id: Uuid,
    #[sqlx(rename = "managedProfileId")]
    #[serde(rename = "managedProfileId", alias = "managed_profile_id")]
    pub managed_profile_id: Option<Uuid>,
    pub name: String,
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for Asset table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AssetEntity {
    pub id: Uuid,
    #[sqlx(rename = "type")]
    #[serde(rename = "assetType", alias = "type", alias = "asset_type")]
    pub asset_type: String,
    pub name: String,
    pub isin: Option<String>,
    #[sqlx(rename = "amfiCode")]
    #[serde(rename = "amfiCode", alias = "amfi_code")]
    pub amfi_code: Option<String>,
    pub symbol: Option<String>,
    #[sqlx(rename = "exitLoadMetadata")]
    #[serde(default, rename = "exitLoadMetadata", alias = "exit_load_metadata")]
    pub exit_load_metadata: Option<String>,
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for Folio table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FolioEntity {
    pub id: Uuid,
    #[sqlx(rename = "portfolioId")]
    #[serde(rename = "portfolioId", alias = "portfolio_id")]
    pub portfolio_id: Uuid,
    #[sqlx(rename = "assetId")]
    #[serde(rename = "assetId", alias = "asset_id")]
    pub asset_id: Uuid,
    pub number: String,
    pub amc: Option<String>,
    pub pan: Option<String>,
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for Transaction table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct TransactionEntity {
    pub id: Uuid,
    #[sqlx(rename = "folioId")]
    #[serde(rename = "folioId", alias = "folio_id")]
    pub folio_id: Uuid,
    pub date: NaiveDate,
    #[sqlx(rename = "type")]
    #[serde(rename = "txType", alias = "type", alias = "tx_type")]
    pub tx_type: String,
    pub amount: Decimal,
    pub units: Decimal,
    pub nav: Decimal,
    pub balance: Decimal,
    #[sqlx(rename = "externalId")]
    #[serde(rename = "externalId", alias = "external_id")]
    pub external_id: Option<String>,
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for FamilyGroup table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FamilyGroupEntity {
    pub id: Uuid,
    pub name: String,
    #[sqlx(rename = "ownerId")]
    #[serde(rename = "ownerId", alias = "owner_id")]
    pub owner_id: Uuid,
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Database entity for FamilyMember table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FamilyMemberEntity {
    pub id: Uuid,
    #[sqlx(rename = "userId")]
    #[serde(rename = "userId", alias = "user_id")]
    pub user_id: Uuid,
    #[sqlx(rename = "groupId")]
    #[serde(rename = "groupId", alias = "group_id")]
    pub group_id: Uuid,
    pub role: String,
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
}

/// Upload job status enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "UploadJobStatus", rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UploadJobStatus {
    Pending,
    Processing,
    Completed,
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

/// Database entity for UploadJob table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct UploadJobEntity {
    pub id: Uuid,
    #[sqlx(rename = "userId")]
    #[serde(rename = "userId", alias = "user_id")]
    pub user_id: Uuid,
    #[sqlx(rename = "filePath")]
    #[serde(rename = "filePath", alias = "file_path")]
    pub file_path: String,
    pub status: UploadJobStatus,
    pub message: Option<String>,
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
    #[sqlx(rename = "updatedAt")]
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: DateTime<Utc>,
    #[sqlx(rename = "startedAt")]
    #[serde(rename = "startedAt", alias = "started_at")]
    pub started_at: Option<DateTime<Utc>>,
    #[sqlx(rename = "completedAt")]
    #[serde(rename = "completedAt", alias = "completed_at")]
    pub completed_at: Option<DateTime<Utc>>,
}

/// Database entity for HistoricalNAV table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalNavEntity {
    pub id: Uuid,
    #[sqlx(rename = "amfiCode")]
    #[serde(rename = "amfiCode", alias = "amfi_code")]
    pub amfi_code: String,
    pub date: NaiveDate,
    pub nav: Decimal,
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
}

/// Database entity for HistoricalValuation table.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct HistoricalValuationEntity {
    pub id: Uuid,
    #[sqlx(rename = "portfolioId")]
    #[serde(rename = "portfolioId", alias = "portfolio_id")]
    pub portfolio_id: Uuid,
    pub date: NaiveDate,
    pub value: Decimal,
    pub cost: Decimal,
    #[sqlx(rename = "createdAt")]
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Conversion to / from portfolio-core domain models
// ---------------------------------------------------------------------------

impl TransactionEntity {
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
            _ => portfolio_core::holdings::TransactionType::Other,
        };

        let mut tx = portfolio_core::holdings::Transaction::new(
            self.id.to_string(),
            self.date,
            tx_type,
            portfolio_core::types::Money::new(self.amount),
            portfolio_core::types::Units::new(self.units),
            portfolio_core::types::Nav::new(self.nav),
            portfolio_core::types::Units::new(self.balance),
        );
        if let Some(ref ext_id) = self.external_id {
            tx = tx.with_external_id(ext_id);
        }
        Ok(tx)
    }
}

impl FolioEntity {
    pub fn to_core_folio(
        &self,
        asset: &AssetEntity,
        transactions: Vec<portfolio_core::holdings::Transaction>,
    ) -> Result<portfolio_core::holdings::Folio, DbError> {
        let folio_number = portfolio_core::types::FolioNumber::new(&self.number)?;
        let asset_type = asset
            .asset_type
            .parse::<portfolio_core::types::AssetType>()?;

        let mut folio = portfolio_core::holdings::Folio::new(
            self.id.to_string(),
            folio_number,
            &asset.name,
            asset_type,
        );

        if let Some(ref pan_str) = self.pan {
            folio = folio.with_pan(portfolio_core::types::Pan::new(pan_str)?);
        }
        if let Some(ref isin_str) = asset.isin {
            folio = folio.with_isin(portfolio_core::types::Isin::new(isin_str)?);
        }
        folio = folio.with_transactions(transactions);
        Ok(folio)
    }
}

impl PortfolioEntity {
    pub fn to_core_portfolio(
        &self,
        folios: Vec<portfolio_core::holdings::Folio>,
    ) -> portfolio_core::holdings::Portfolio {
        portfolio_core::holdings::Portfolio::new(self.id.to_string(), &self.name)
            .with_folios(folios)
    }
}

impl ManagedProfileEntity {
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
