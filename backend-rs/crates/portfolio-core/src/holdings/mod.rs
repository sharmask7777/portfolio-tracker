//! Holdings aggregation, transaction processing, and position calculations.
//!
//! Provides the primary domain entities for portfolios, folios, and transactions:
//! - [`Transaction`]: Immutable record of an individual investment activity (buy, sell, dividend, etc.).
//! - [`Folio`]: An account holding units of an asset under an AMC or depository.
//! - [`Portfolio`]: A logical group of folios belonging to a managed profile.
//! - [`ManagedProfile`]: An investor identity (PAN, user profile) tracking tax slabs and portfolios.
//! - [`ConsolidatedScheme`]: Scheme-level consolidation across folios sharing the same ISIN/name.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::types::{AssetType, FolioNumber, Isin, Money, Nav, Pan, Units};

/// Classification of transaction types matching standard mutual fund / brokerage CAS statements.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TransactionType {
    /// Lumpsum mutual fund purchase.
    Purchase,
    /// Systematic Investment Plan installment purchase.
    PurchaseSip,
    /// Mutual fund unit redemption.
    Redemption,
    /// Direct equity/stock buy.
    Buy,
    /// Direct equity/stock sell.
    Sell,
    /// Switch-in from another scheme within the same AMC.
    SwitchIn,
    /// Switch-out to another scheme within the same AMC.
    SwitchOut,
    /// Cash dividend payout directly credited to investor's bank account.
    DividendPayout,
    /// Dividend reinvested into additional units within the scheme.
    DividendReinvestment,
    /// Transaction reversal or cancellation by registrar/transfer agent.
    Reversal,
    /// Government statutory stamp duty deducted from invested principal.
    StampDuty,
    /// Miscellaneous administrative or auxiliary transaction.
    Other,
}

impl TransactionType {
    /// Cash inflows to investor (cash realized / out of portfolio into bank account).
    pub fn is_inflow(&self) -> bool {
        matches!(
            self,
            TransactionType::Redemption
                | TransactionType::Sell
                | TransactionType::SwitchOut
                | TransactionType::DividendPayout
                | TransactionType::Reversal
        )
    }

    /// Cash outflows from investor (cash invested / out of bank account into portfolio).
    pub fn is_outflow(&self) -> bool {
        matches!(
            self,
            TransactionType::Purchase
                | TransactionType::PurchaseSip
                | TransactionType::Buy
                | TransactionType::SwitchIn
                | TransactionType::DividendReinvestment
                | TransactionType::StampDuty
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
    /// Unique internal identifier for the transaction.
    pub id: String,
    /// Trade or settlement date of the transaction.
    pub date: NaiveDate,
    /// Categorization of the transaction.
    pub tx_type: TransactionType,
    /// Gross monetary amount associated with the transaction.
    pub amount: Money,
    /// Number of units transacted (positive for additions, negative/positive for sells depending on CAS format).
    pub units: Units,
    /// Net Asset Value per unit at which transaction executed.
    pub nav: Nav,
    /// Running cumulative unit balance reported by the CAS statement after this transaction.
    pub balance: Units,
    /// External registrar or broker transaction reference ID.
    pub external_id: Option<String>,
}

impl Transaction {
    /// Constructs a new [`Transaction`].
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

    /// Builder method attaching an external reference identifier to this transaction.
    pub fn with_external_id(mut self, ext_id: impl Into<String>) -> Self {
        self.external_id = Some(ext_id.into());
        self
    }

    /// Returns the signed cash flow amount from the investor's perspective.
    ///
    /// # Directionality:
    /// - **Outflows** (purchases/investments): Negative (`-amount.abs()`).
    /// - **Inflows** (redemptions/payouts): Positive (`amount.abs()`).
    /// - **Dividend Reinvestment**: `Money::ZERO` because dividend reinvestment is an internal
    ///   scheme NAV distribution converted into units without net cash crossing the investor's bank boundary.
    pub fn cash_flow_amount(&self) -> Money {
        if self.tx_type == TransactionType::DividendReinvestment {
            // Dividend reinvestment is an internal scheme action; no cash leaves investor's bank account
            Money::ZERO
        } else if self.tx_type.is_outflow() {
            -self.amount.abs()
        } else if self.tx_type.is_inflow() {
            self.amount.abs()
        } else {
            -self.amount.abs()
        }
    }

    /// Converts this transaction into a cash flow for performance (XIRR) calculation.
    pub fn to_cash_flow(&self) -> crate::performance::xirr::CashFlow {
        crate::performance::xirr::CashFlow::new(self.date, self.cash_flow_amount().to_decimal())
    }
}

/// A folio representing an account with an AMC or broker holding units of an asset.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Folio {
    /// Internal unique identifier for the folio.
    pub id: String,
    /// Folio number assigned by the Asset Management Company.
    pub folio_number: FolioNumber,
    /// Permanent Account Number (PAN) associated with the folio holder.
    pub pan: Option<Pan>,
    /// International Securities Identification Number (ISIN) for the security.
    pub isin: Option<Isin>,
    /// Human-readable scheme or stock name.
    pub asset_name: String,
    /// Asset class classification (MutualFund, Stock, etc.).
    pub asset_type: AssetType,
    /// Chronological list of transactions recorded in this folio.
    pub transactions: Vec<Transaction>,
}

impl Folio {
    /// Creates a new [`Folio`] instance.
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

    /// Builder method attaching an ISIN to the folio.
    pub fn with_isin(mut self, isin: Isin) -> Self {
        self.isin = Some(isin);
        self
    }

    /// Builder method attaching a PAN to the folio.
    pub fn with_pan(mut self, pan: Pan) -> Self {
        self.pan = Some(pan);
        self
    }

    /// Builder method setting the transaction list of the folio.
    pub fn with_transactions(mut self, txs: Vec<Transaction>) -> Self {
        self.transactions = txs;
        self
    }
}

/// Consolidated scheme grouping multiple folios/PANs for the same scheme without duplicate valuation.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConsolidatedScheme {
    /// ISIN of the underlying scheme, if available.
    pub isin: Option<Isin>,
    /// Standardized name of the asset scheme.
    pub asset_name: String,
    /// Sum of all active unsold units across constituent folios.
    pub total_units: Units,
    /// Total current valuation of all active units across constituent folios.
    pub total_current_value: Money,
    /// Total invested capital across all constituent folios.
    pub total_invested_amount: Money,
    /// Constituent folios consolidated under this scheme.
    pub folios: Vec<Folio>,
}

/// A portfolio collection of folios under a managed profile.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Portfolio {
    /// Unique identifier for the portfolio.
    pub id: String,
    /// Display name of the portfolio (e.g. "Core Wealth", "Retirement").
    pub name: String,
    /// List of member folios included in this portfolio.
    pub folios: Vec<Folio>,
}

impl Portfolio {
    /// Constructs a new [`Portfolio`].
    pub fn new(id: impl Into<String>, name: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            folios: Vec::new(),
        }
    }

    /// Builder method setting the member folios of the portfolio.
    pub fn with_folios(mut self, folios: Vec<Folio>) -> Self {
        self.folios = folios;
        self
    }
}

/// A managed family profile with an associated PAN, tax slab, and constituent portfolios.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ManagedProfile {
    /// Unique identifier for this managed profile.
    pub id: String,
    /// Identifier of the parent user owning this profile.
    pub user_id: String,
    /// Display name for the family member (e.g. "Self", "Spouse", "Parent").
    pub name: String,
    /// Tax Permanent Account Number (PAN) identifying the individual for tax reporting.
    pub pan: Pan,
    /// Investor's personal marginal income tax rate (e.g. `0.30` for 30% slab).
    pub tax_slab: rust_decimal::Decimal,
    /// Constituent investment portfolios managed under this profile.
    pub portfolios: Vec<Portfolio>,
}

impl ManagedProfile {
    /// Constructs a new [`ManagedProfile`].
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

    /// Builder method attaching portfolios to the managed profile.
    pub fn with_portfolios(mut self, portfolios: Vec<Portfolio>) -> Self {
        self.portfolios = portfolios;
        self
    }
}

pub mod lot;
pub mod registry;

pub use self::lot::{
    LotDepletion, TaxLot, is_unit_addition, is_unit_redemption, process_fifo_lots,
    sort_transactions,
};
pub use self::registry::{FamilyRegistry, consolidate_by_scheme, get_latest_nav, get_latest_units};
