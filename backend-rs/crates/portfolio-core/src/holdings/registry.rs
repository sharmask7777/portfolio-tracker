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
        for tx in sorted.iter().rev() {
            // ONLY consider unit-bearing transactions with valid reported balances!
            // Auxiliary, fee, tax, stamp duty, or 0-unit note transactions do NOT define the cumulative unit balance.
            // Furthermore, an addition of units (purchase/SIP) can NEVER legitimately result in a zero balance;
            // a balance of zero on an addition indicates unrecorded balance, not position closure.
            if tx.units.is_zero()
                || (crate::holdings::lot::is_unit_addition(tx.tx_type) && tx.balance.is_zero())
            {
                continue;
            }

            let is_auxiliary =
                tx.tx_type == TransactionType::Other || tx.tx_type == TransactionType::StampDuty;
            if !is_auxiliary {
                let current_balance = tx.balance;
                if current_balance >= fractional_dust_threshold {
                    return current_balance;
                }
                return Units::ZERO;
            }
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

        for folio in &member_folios {
            let units = get_latest_units(&folio.transactions);
            let nav_to_use = if current_nav.is_positive() {
                current_nav
            } else {
                get_latest_nav(&folio.transactions)
            };
            let metrics = get_metrics(
                &folio.transactions,
                nav_to_use,
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
        // Since tx-2 had balance 0 on an addition, it should not report 0 units for the fund;
        // it falls back to the valid explicit balance or FIFO lots
        assert_eq!(units, Units::from_str("100").unwrap());
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
}
