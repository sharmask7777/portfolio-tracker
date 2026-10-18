//! Family profile registry and scheme consolidation.

use crate::error::PortfolioError;
use crate::holdings::lot::process_fifo_lots;
use crate::holdings::{ConsolidatedScheme, Folio, ManagedProfile, Transaction};
use crate::performance::{PerformanceOptions, get_metrics};
use crate::types::{Isin, Money, Nav, Units};

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
    pub fn delete_managed_profile(
        &mut self,
        user_id: &str,
        profile_id: &str,
    ) -> Result<ManagedProfile, PortfolioError> {
        let pos = self
            .profiles
            .iter()
            .position(|p| p.id == profile_id && p.user_id == user_id)
            .ok_or_else(|| PortfolioError::ProfileNotFound(profile_id.to_string()))?;
        Ok(self.profiles.remove(pos))
    }
}

/// Safely gets the latest unit balance from a list of transactions.
pub fn get_latest_units(transactions: &[Transaction]) -> Units {
    if transactions.is_empty() {
        return Units::ZERO;
    }
    let (active_lots, _) = process_fifo_lots(transactions);
    let total_remaining: Units = active_lots.iter().map(|l| l.remaining_units).sum();
    total_remaining
}

/// Safely gets the latest NAV from a list of transactions.
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
    transactions.last().map(|tx| tx.nav).unwrap_or(Nav::ZERO)
}

/// Consolidates multiple folios for the same scheme (grouped by ISIN if present, or asset name),
/// aggregating total units, current valuation, and invested amount without duplicate counting.
pub fn consolidate_by_scheme(folios: &[Folio], current_nav: Nav) -> Vec<ConsolidatedScheme> {
    // Preserve deterministic order of scheme occurrence
    let mut groups: Vec<(String, Option<Isin>, String, Vec<Folio>)> = Vec::new();

    for folio in folios {
        let key = match &folio.isin {
            Some(isin) => isin.as_str().to_string(),
            None => folio.asset_name.clone(),
        };

        if let Some(group) = groups.iter_mut().find(|(k, _, _, _)| k == &key) {
            group.3.push(folio.clone());
        } else {
            groups.push((
                key,
                folio.isin.clone(),
                folio.asset_name.clone(),
                vec![folio.clone()],
            ));
        }
    }

    let mut result = Vec::with_capacity(groups.len());
    for (_key, isin, asset_name, group_folios) in groups {
        let mut total_units = Units::ZERO;
        let mut total_current_value = Money::ZERO;
        let mut total_invested_amount = Money::ZERO;

        for folio in &group_folios {
            let units = get_latest_units(&folio.transactions);
            let metrics = get_metrics(
                &folio.transactions,
                current_nav,
                Some(PerformanceOptions::new().with_units_override(units)),
            );
            total_units += units;
            total_current_value += metrics.current_value;
            total_invested_amount += metrics.invested_amount;
        }

        result.push(ConsolidatedScheme {
            isin,
            asset_name,
            total_units,
            total_current_value,
            total_invested_amount,
            folios: group_folios,
        });
    }

    result
}
