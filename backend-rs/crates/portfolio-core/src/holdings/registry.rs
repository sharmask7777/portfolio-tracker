//! Family profile registry and multi-folio scheme consolidation.
//!
//! Provides in-memory domain coordination for multi-member family profiles and schemes:
//! - [`FamilyRegistry`]: Manages member profiles, ensuring strict isolation between user accounts.
//! - [`consolidate_by_scheme`]: Groups multiple folios sharing the same ISIN or scheme name,
//!   aggregating units, invested amount, and current valuation without double-counting.
//! - [`get_latest_units`] and [`get_latest_nav`]: Extracts the current holding units and latest
//!   valuation prices from raw transaction histories with robust threshold checks for fractional dust.

use crate::error::PortfolioError;
use crate::holdings::lot::process_fifo_lots;
use crate::holdings::{ConsolidatedScheme, Folio, ManagedProfile, Transaction, TransactionType};
use crate::performance::{PerformanceOptions, get_metrics};
use crate::types::{Isin, Money, Nav, Units};

/// In-memory domain registry for managing multi-member family profiles.
///
/// Ensures profiles across different family members or accounts are stored cleanly
/// and provides atomic cascading deletion operations.
#[derive(Debug, Clone, Default)]
pub struct FamilyRegistry {
    profiles: Vec<ManagedProfile>,
}

impl FamilyRegistry {
    /// Creates a new empty [`FamilyRegistry`].
    pub fn new() -> Self {
        Self {
            profiles: Vec::new(),
        }
    }

    /// Adds a managed family profile to the registry.
    pub fn add_profile(&mut self, profile: ManagedProfile) {
        self.profiles.push(profile);
    }

    /// Finds a managed profile by its unique profile identifier.
    ///
    /// Returns `Some(&ManagedProfile)` if found, or `None` if no profile matches `profile_id`.
    pub fn get_profile(&self, profile_id: &str) -> Option<&ManagedProfile> {
        self.profiles
            .iter()
            .find(|profile| profile.id == profile_id)
    }

    /// Retrieves all managed profiles belonging to a specific user account.
    ///
    /// # Arguments
    /// * `user_id` - Identifier of the owning user.
    pub fn get_profiles_for_user(&self, user_id: &str) -> Vec<&ManagedProfile> {
        self.profiles
            .iter()
            .filter(|profile| profile.user_id == user_id)
            .collect()
    }

    /// Transactionally deletes a managed profile and cascades to all its portfolios and folios,
    /// strictly isolating and leaving all other profiles untouched.
    ///
    /// # Errors
    /// Returns [`PortfolioError::ProfileNotFound`] if no profile matching `profile_id`
    /// exists for the given `user_id`.
    pub fn delete_managed_profile(
        &mut self,
        user_id: &str,
        profile_id: &str,
    ) -> Result<ManagedProfile, PortfolioError> {
        let position = self
            .profiles
            .iter()
            .position(|profile| profile.id == profile_id && profile.user_id == user_id)
            .ok_or_else(|| PortfolioError::ProfileNotFound(profile_id.to_string()))?;
        Ok(self.profiles.remove(position))
    }
}

/// Safely extracts the latest active unit balance from a slice of transactions.
///
/// # Balance Resolution Hierarchy:
/// 1. **CAS Explicit Running Balance**: If transactions contain running cumulative balances
///    (standard in CAMS/KFintech statements), inspects the latest non-auxiliary transaction
///    (ignoring zero-unit stamp duty or administrative fee entries).
/// 2. **Fractional Dust Suppression**: If the final balance is below `0.001` units, treats the
///    holding as fully redeemed (`Units::ZERO`) to prevent fractional rounding dust from
///    resurrecting closed positions.
/// 3. **FIFO Reconstruction Fallback**: If explicit balances are absent, reconstructs active
///    lots via [`process_fifo_lots`] and sums the remaining units.
pub fn get_latest_units(transactions: &[Transaction]) -> Units {
    if transactions.is_empty() {
        return Units::ZERO;
    }
    // 0.001 unit threshold to eliminate fractional truncation dust
    let fractional_dust_threshold =
        Units::new(rust_decimal::Decimal::from_parts(1, 0, 0, false, 3));

    // Check if transactions carry explicit cumulative balance tracking (matching CAS statements)
    let sorted = crate::holdings::lot::sort_transactions(transactions);
    let has_explicit_balances = sorted.iter().any(|tx| !tx.balance.is_zero());

    if has_explicit_balances {
        // Find the last unit-bearing non-auxiliary transaction with a valid explicit balance
        // (or a genuine redemption closure to zero), then replay any subsequent unit-bearing
        // transactions that had missing (zero) balances forward.
        let mut anchor_idx: Option<usize> = None;
        for (idx, tx) in sorted.iter().enumerate().rev() {
            let is_auxiliary =
                tx.tx_type == TransactionType::Other || tx.tx_type == TransactionType::StampDuty;
            if tx.units.is_zero() || is_auxiliary {
                continue;
            }
            if !tx.balance.is_zero() || !crate::holdings::lot::is_unit_addition(tx.tx_type) {
                anchor_idx = Some(idx);
                break;
            }
        }

        if let Some(idx) = anchor_idx {
            let mut running_balance = sorted[idx].balance;
            for tx in sorted.iter().skip(idx + 1) {
                let is_auxiliary = tx.tx_type == TransactionType::Other
                    || tx.tx_type == TransactionType::StampDuty;
                if tx.units.is_zero() || is_auxiliary {
                    continue;
                }
                if tx.tx_type == TransactionType::Reversal {
                    if tx.units.is_negative() || tx.amount.is_negative() {
                        running_balance = (running_balance - tx.units.abs()).max(Units::ZERO);
                    } else {
                        running_balance += tx.units.abs();
                    }
                } else if crate::holdings::lot::is_unit_addition(tx.tx_type)
                    && !tx.units.is_negative()
                {
                    running_balance += tx.units.abs();
                } else if crate::holdings::lot::is_unit_redemption(tx.tx_type)
                    || tx.units.is_negative()
                {
                    running_balance = (running_balance - tx.units.abs()).max(Units::ZERO);
                }
            }
            if running_balance >= fractional_dust_threshold {
                return running_balance;
            }
            return Units::ZERO;
        }
    }

    let (active_lots, _) = process_fifo_lots(transactions);
    let total_remaining: Units = active_lots.iter().map(|lot| lot.remaining_units).sum();
    if total_remaining < fractional_dust_threshold {
        Units::ZERO
    } else {
        total_remaining
    }
}

/// Safely retrieves the latest known Net Asset Value (NAV) from a slice of transactions.
///
/// Scans transactions in reverse chronological order to find the latest transaction
/// with a strictly positive NAV. If no transactions carry a positive NAV, falls back
/// to the last chronological transaction's NAV (or `Nav::ZERO` if empty).
pub fn get_latest_nav(transactions: &[Transaction]) -> Nav {
    if transactions.is_empty() {
        return Nav::ZERO;
    }
    let sorted = crate::holdings::lot::sort_transactions(transactions);
    for tx in sorted.iter().rev() {
        if tx.nav.is_positive() {
            return tx.nav;
        }
    }
    sorted.last().map_or(Nav::ZERO, |tx| tx.nav)
}

/// Consolidates multiple folios for the same scheme (grouped by ISIN if present, or asset name),
/// aggregating total units, current valuation, and invested amount without duplicate counting.
///
/// # Arguments
/// * `folios` - Slice of individual folios potentially across multiple accounts or brokers.
/// * `current_nav` - Optional valuation NAV override. If positive, used for valuation;
///   otherwise, each folio's latest transaction NAV is used.
///
/// # Returns
/// A vector of [`ConsolidatedScheme`] structs with deduplicated scheme-level totals.
pub fn consolidate_by_scheme(folios: &[Folio], current_nav: Nav) -> Vec<ConsolidatedScheme> {
    // Preserve deterministic order of scheme occurrence: (group_key, isin, asset_name, folios)
    let mut scheme_groups: Vec<(String, Option<Isin>, String, Vec<Folio>)> = Vec::new();

    for folio in folios {
        let scheme_key = match &folio.isin {
            Some(isin) => isin.as_str().to_string(),
            None => folio.asset_name.clone(),
        };

        if let Some(existing_group) = scheme_groups
            .iter_mut()
            .find(|(key, _, _, _)| key == &scheme_key)
        {
            existing_group.3.push(folio.clone());
        } else {
            scheme_groups.push((
                scheme_key,
                folio.isin.clone(),
                folio.asset_name.clone(),
                vec![folio.clone()],
            ));
        }
    }

    let mut consolidated_schemes = Vec::with_capacity(scheme_groups.len());
    for (_key, isin, asset_name, member_folios) in scheme_groups {
        let mut total_units = Units::ZERO;
        let mut total_current_value = Money::ZERO;
        let mut total_invested_amount = Money::ZERO;

        // Resolve a single scheme-level latest NAV across all constituent folios when current_nav == 0
        let scheme_nav = if current_nav.is_positive() {
            current_nav
        } else {
            let all_txs: Vec<Transaction> = member_folios
                .iter()
                .flat_map(|f| f.transactions.iter().cloned())
                .collect();
            get_latest_nav(&all_txs)
        };

        for folio in &member_folios {
            let units = get_latest_units(&folio.transactions);
            let metrics = get_metrics(
                &folio.transactions,
                scheme_nav,
                Some(PerformanceOptions::new().with_units_override(units)),
            );
            total_units += units;
            total_current_value += metrics.current_value;
            total_invested_amount += metrics.invested_amount;
        }

        consolidated_schemes.push(ConsolidatedScheme {
            isin,
            asset_name,
            total_units,
            total_current_value,
            total_invested_amount,
            folios: member_folios,
        });
    }

    consolidated_schemes
}

/// Consolidated scheme DTO with true multi-folio cash-flow XIRR, post-tax XIRR,
/// active/closed status, day change, and deterministic sorting keys for web & mobile clients.
#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize, ts_rs::TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ConsolidatedSchemeDto {
    /// Optional ISIN of the scheme.
    pub isin: Option<Isin>,
    /// Canonical scheme / asset name.
    pub asset_name: String,
    /// Total active units across all constituent folios.
    pub total_units: Units,
    /// Total current market value across all constituent folios.
    pub total_current_value: Money,
    /// Total invested cost basis across all constituent folios.
    pub total_invested_amount: Money,
    /// Absolute unrealized/total gain (`total_current_value - total_invested_amount`).
    pub absolute_gain: Money,
    /// True multi-folio cash-flow XIRR (percentage, e.g. `12.5` for `12.5%`).
    #[ts(type = "number | null")]
    pub xirr: Option<rust_decimal::Decimal>,
    /// Post-tax XIRR (percentage) after accounting for unrealized/realized tax drag.
    #[ts(type = "number | null")]
    pub post_tax_xirr: Option<rust_decimal::Decimal>,
    /// Whether the scheme is currently active (`total_units > 0`).
    pub is_active: bool,
    /// Day change in rupees (`units * (current_nav - previous_nav)`), if previous NAV is known.
    pub day_change: Option<Money>,
    /// Day change percentage, if previous NAV is positive.
    pub day_change_pct: Option<f64>,
    /// Number of constituent folios.
    pub folio_count: usize,
    /// Constituent folios.
    #[ts(type = "unknown[]")]
    pub folios: Vec<Folio>,
}

/// Consolidates folios by scheme and computes true multi-folio cash-flow XIRR,
/// post-tax XIRR, active/closed status, and day change, sorted with active schemes
/// first (by descending current value) followed by closed schemes (by asset name).
pub fn consolidate_schemes_with_metrics(
    folios: &[Folio],
    current_nav: Nav,
    previous_nav: Option<Nav>,
    as_of_date: chrono::NaiveDate,
    tax_slab: rust_decimal::Decimal,
) -> Vec<ConsolidatedSchemeDto> {
    let base = consolidate_by_scheme(folios, current_nav);
    let mut dtos: Vec<ConsolidatedSchemeDto> = base
        .into_iter()
        .map(|scheme| {
            let all_txs: Vec<Transaction> = scheme
                .folios
                .iter()
                .flat_map(|f| f.transactions.iter().cloned())
                .collect();
            let scheme_nav = if current_nav.is_positive() {
                current_nav
            } else {
                get_latest_nav(&all_txs)
            };
            let opts = PerformanceOptions::new()
                .with_as_of_date(as_of_date)
                .with_units_override(scheme.total_units)
                .with_tax_slab(tax_slab);
            let metrics = get_metrics(&all_txs, scheme_nav, Some(opts));
            let is_active = scheme.total_units.is_positive();
            let (day_change, day_change_pct) = match previous_nav {
                Some(prev) if prev.is_positive() && scheme_nav.is_positive() && is_active => {
                    let change_val = Money::new(
                        scheme.total_units.as_decimal()
                            * (scheme_nav.as_decimal() - prev.as_decimal()),
                    );
                    let pct = ((scheme_nav.as_decimal() - prev.as_decimal()) / prev.as_decimal())
                        * rust_decimal::Decimal::from(100);
                    let pct_f64 = rust_decimal::prelude::ToPrimitive::to_f64(&pct).unwrap_or(0.0);
                    (Some(change_val), Some(pct_f64))
                }
                _ => (None, None),
            };
            ConsolidatedSchemeDto {
                isin: scheme.isin,
                asset_name: scheme.asset_name,
                total_units: scheme.total_units,
                total_current_value: scheme.total_current_value,
                total_invested_amount: scheme.total_invested_amount,
                absolute_gain: scheme.total_current_value - scheme.total_invested_amount,
                xirr: metrics.xirr,
                post_tax_xirr: metrics.post_tax_xirr,
                is_active,
                day_change,
                day_change_pct,
                folio_count: scheme.folios.len(),
                folios: scheme.folios,
            }
        })
        .collect();

    dtos.sort_by(|a, b| {
        b.is_active
            .cmp(&a.is_active)
            .then_with(|| b.total_current_value.cmp(&a.total_current_value))
            .then_with(|| a.asset_name.cmp(&b.asset_name))
    });
    dtos
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::panic)]
mod tests {
    use super::*;
    use crate::holdings::TransactionType;
    use chrono::NaiveDate;
    use std::str::FromStr;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).expect("valid date")
    }

    #[test]
    fn test_get_latest_nav_empty_and_fallback() {
        assert_eq!(get_latest_nav(&[]), Nav::ZERO);

        // Transactions where none have positive NAV, entered out of order
        let tx1 = Transaction::new(
            "tx-later",
            date(2023, 5, 1),
            TransactionType::Buy,
            Money::from_str("100").unwrap(),
            Units::from_str("10").unwrap(),
            Nav::ZERO,
            Units::from_str("10").unwrap(),
        );
        let tx2 = Transaction::new(
            "tx-earlier",
            date(2023, 1, 1),
            TransactionType::Buy,
            Money::from_str("100").unwrap(),
            Units::from_str("10").unwrap(),
            Nav::ZERO,
            Units::from_str("10").unwrap(),
        );

        // Input slice has tx1 then tx2. Sorted order is tx2 then tx1.
        // Fallback sorted.last() must return tx1's NAV (Nav::ZERO).
        let nav = get_latest_nav(&[tx1, tx2]);
        assert_eq!(nav, Nav::ZERO);
    }

    #[test]
    fn test_get_latest_nav_picks_latest_chronological_positive_nav() {
        let tx_old = Transaction::new(
            "tx-old",
            date(2023, 1, 1),
            TransactionType::Buy,
            Money::from_str("1000").unwrap(),
            Units::from_str("100").unwrap(),
            Nav::from_str("10").unwrap(),
            Units::from_str("100").unwrap(),
        );
        let tx_new = Transaction::new(
            "tx-new",
            date(2023, 6, 1),
            TransactionType::Buy,
            Money::from_str("2000").unwrap(),
            Units::from_str("100").unwrap(),
            Nav::from_str("20").unwrap(),
            Units::from_str("200").unwrap(),
        );
        let tx_newest_zero_nav = Transaction::new(
            "tx-newest-zero",
            date(2023, 12, 1),
            TransactionType::Redemption,
            Money::from_str("1000").unwrap(),
            Units::from_str("50").unwrap(),
            Nav::ZERO,
            Units::from_str("150").unwrap(),
        );

        // Unsorted input slice: newest (zero nav), then new (20), then old (10)
        let nav = get_latest_nav(&[tx_newest_zero_nav, tx_new, tx_old]);
        // Must return 20, the latest positive nav chronologically
        assert_eq!(nav, Nav::from_str("20").unwrap());
    }

    #[test]
    fn test_get_latest_units_ignores_zero_unit_auxiliary_transactions_with_zero_balance() {
        let tx_purchase = Transaction::new(
            "tx-1",
            date(2025, 7, 16),
            TransactionType::PurchaseSip,
            Money::from_str("1000").unwrap(),
            Units::from_str("16.382").unwrap(),
            Nav::from_str("61.04").unwrap(),
            Units::from_str("3006.521").unwrap(),
        );
        // Stamp duty or auxiliary entry on same or later date with units = 0 and balance = 0
        let tx_stamp_duty = Transaction::new(
            "tx-2",
            date(2025, 7, 16),
            TransactionType::Purchase, // even if misclassified as Purchase
            Money::from_str("0.05").unwrap(),
            Units::ZERO,
            Nav::ZERO,
            Units::ZERO,
        );
        // Another 0-unit remark row on next day
        let tx_remark = Transaction::new(
            "tx-3",
            date(2025, 7, 17),
            TransactionType::Purchase,
            Money::ZERO,
            Units::ZERO,
            Nav::ZERO,
            Units::ZERO,
        );

        let units = get_latest_units(&[tx_purchase, tx_stamp_duty, tx_remark]);
        assert_eq!(units, Units::from_str("3006.521").unwrap());
    }

    #[test]
    fn test_get_latest_units_ignores_purchase_with_missing_zero_balance() {
        let tx_initial = Transaction::new(
            "tx-1",
            date(2025, 1, 1),
            TransactionType::Purchase,
            Money::from_str("10000").unwrap(),
            Units::from_str("100").unwrap(),
            Nav::from_str("100").unwrap(),
            Units::from_str("100").unwrap(),
        );
        // Purchase with missing balance (balance = 0)
        let tx_unrecorded_bal = Transaction::new(
            "tx-2",
            date(2025, 2, 1),
            TransactionType::Purchase,
            Money::from_str("5000").unwrap(),
            Units::from_str("50").unwrap(),
            Nav::from_str("100").unwrap(),
            Units::ZERO,
        );

        let units = get_latest_units(&[tx_initial, tx_unrecorded_bal]);
        // Since tx-2 had balance 0 on an addition, we anchor at tx-1 (100) and replay tx-2 (+50) -> 150
        assert_eq!(units, Units::from_str("150").unwrap());
    }

    #[test]
    fn test_get_latest_units_correctly_identifies_full_redemption_to_zero() {
        let tx_initial = Transaction::new(
            "tx-1",
            date(2025, 1, 1),
            TransactionType::Purchase,
            Money::from_str("10000").unwrap(),
            Units::from_str("100").unwrap(),
            Nav::from_str("100").unwrap(),
            Units::from_str("100").unwrap(),
        );
        let tx_redemption = Transaction::new(
            "tx-2",
            date(2025, 6, 1),
            TransactionType::Redemption,
            Money::from_str("-10000").unwrap(),
            Units::from_str("-100").unwrap(),
            Nav::from_str("100").unwrap(),
            Units::ZERO,
        );

        let units = get_latest_units(&[tx_initial, tx_redemption]);
        assert_eq!(units, Units::ZERO);
    }

    #[test]
    fn test_get_latest_units_replay_reversal_and_addition() {
        let tx_initial = Transaction::new(
            "tx-1",
            date(2025, 1, 1),
            TransactionType::Purchase,
            Money::from_str("10000").unwrap(),
            Units::from_str("100").unwrap(),
            Nav::from_str("100").unwrap(),
            Units::from_str("100").unwrap(),
        );
        let tx_rev_neg = Transaction::new(
            "tx-2",
            date(2025, 2, 1),
            TransactionType::Reversal,
            Money::from_str("-1000").unwrap(),
            Units::from_str("-10").unwrap(),
            Nav::from_str("100").unwrap(),
            Units::from_str("90").unwrap(),
        );
        let tx_rev_pos = Transaction::new(
            "tx-3",
            date(2025, 3, 1),
            TransactionType::Purchase,
            Money::from_str("500").unwrap(),
            Units::from_str("5").unwrap(),
            Nav::from_str("100").unwrap(),
            Units::ZERO,
        );
        let units = get_latest_units(&[tx_initial, tx_rev_neg, tx_rev_pos]);
        // 100 - 10 + 5 = 95
        assert_eq!(units, Units::from_str("95").unwrap());
    }

    #[test]
    fn test_consolidate_schemes_with_metrics_active_and_closed() {
        let tx_active = Transaction::new(
            "tx-1",
            date(2025, 1, 1),
            TransactionType::Purchase,
            Money::from_str("10000").unwrap(),
            Units::from_str("100").unwrap(),
            Nav::from_str("100").unwrap(),
            Units::from_str("100").unwrap(),
        );
        let folio_active = Folio {
            id: "f-1".to_string(),
            folio_number: crate::FolioNumber::new("12345").unwrap(),
            isin: Some(Isin::new("INF179K01BB8").unwrap()),
            asset_name: "HDFC Top 100 Fund".to_string(),
            asset_type: crate::AssetType::MutualFund,
            pan: None,
            transactions: vec![tx_active],
        };
        let dtos = consolidate_schemes_with_metrics(
            &[folio_active],
            Nav::ZERO,
            Some(Nav::from_str("95").unwrap()),
            date(2025, 6, 1),
            rust_decimal::Decimal::from_str("0.30").unwrap(),
        );
        assert_eq!(dtos.len(), 1);
        assert!(dtos[0].is_active);
        assert!(dtos[0].day_change.is_some());
    }
}
