//! Tax Harvesting Engine and Unrealized Gain Analytics.
//!
//! Identifies tax-loss and tax-gain harvesting opportunities under Section 112A:
//! - Up to ₹1,25,000 annual LTCG exemption limit (Budget 2024).
//! - Identifies eligible long-term equity lots (holding period >= 365 days).
//! - Excludes debt funds, alternative assets, and locked ELSS lots (< 3 years).
//! - Provides precision-safe unit harvesting calculations up to available exemption.

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::holdings::{Folio, Transaction, process_fifo_lots};
use crate::tax::rules::{elss_lock_in_expiry, is_elss, is_equity};
use crate::types::{AssetType, Money, Nav, Units};

/// Annual LTCG statutory tax exemption under Section 112A (Post-Budget 2024: ₹1,25,000).
pub const LTCG_EXEMPTION_LIMIT_BUDGET_2024_DECIMAL: Decimal =
    Decimal::from_parts(125000, 0, 0, false, 0);

/// Annual LTCG statutory tax exemption under Section 112A (Pre-Budget 2024: ₹1,00,000).
pub const LTCG_EXEMPTION_LIMIT_PRE_BUDGET_2024_DECIMAL: Decimal =
    Decimal::from_parts(100000, 0, 0, false, 0);

pub fn ltcg_exemption_limit_budget_2024() -> Money {
    Money::new(LTCG_EXEMPTION_LIMIT_BUDGET_2024_DECIMAL)
}

pub fn ltcg_exemption_limit_pre_budget_2024() -> Money {
    Money::new(LTCG_EXEMPTION_LIMIT_PRE_BUDGET_2024_DECIMAL)
}

/// Statutory Section 112A LTCG tax rate (Post-Budget 2024: 12.5%).
pub const LTCG_TAX_RATE_BUDGET_2024: Decimal = Decimal::from_parts(125, 0, 0, false, 3);

/// Specific harvesting recommendation for an individual scheme holding lot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HarvestingOpportunity {
    pub folio_id: Option<String>,
    pub scheme_name: String,
    pub units_to_harvest: Units,
    pub unrealized_gain: Money,
    pub current_value: Money,
}

/// An individual unrealized lot analysis.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UnrealizedLotGain {
    pub scheme_name: String,
    pub buy_date: NaiveDate,
    pub units: Units,
    pub purchase_nav: Nav,
    pub current_nav: Nav,
    pub holding_days: i64,
    pub is_ltcg: bool,
    pub unrealized_gain: Money,
}

/// Aggregated breakdown of unrealized capital gains and losses across active holdings.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct UnrealizedTaxSummary {
    pub stcg: Money,
    pub ltcg: Money,
    pub losses: Money,
    pub net_gain: Money,
    pub lots: Vec<UnrealizedLotGain>,
}

/// Overall tax harvesting summary for a portfolio or profile scope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HarvestingSummary {
    pub realized_ltcg_fy: Money,
    pub remaining_exemption: Money,
    pub total_potential_harvest: Money,
    pub opportunities: Vec<HarvestingOpportunity>,
    pub estimated_tax_savings: Money,
    pub unrealized_summary: UnrealizedTaxSummary,
}

/// Input descriptor for a folio holding with current valuation NAV.
#[derive(Debug, Clone)]
pub struct FolioHarvestingInput<'a> {
    pub folio_id: Option<&'a str>,
    pub scheme_name: &'a str,
    pub asset_type: AssetType,
    pub transactions: &'a [Transaction],
    pub current_nav: Nav,
}

impl<'a> FolioHarvestingInput<'a> {
    pub fn new(
        scheme_name: &'a str,
        asset_type: AssetType,
        transactions: &'a [Transaction],
        current_nav: Nav,
    ) -> Self {
        Self {
            folio_id: None,
            scheme_name,
            asset_type,
            transactions,
            current_nav,
        }
    }

    pub fn with_folio_id(mut self, folio_id: &'a str) -> Self {
        self.folio_id = Some(folio_id);
        self
    }

    pub fn from_folio(folio: &'a Folio, current_nav: Nav) -> Self {
        Self {
            folio_id: Some(&folio.id),
            scheme_name: &folio.asset_name,
            asset_type: folio.asset_type,
            transactions: &folio.transactions,
            current_nav,
        }
    }
}

/// Computes detailed unrealized capital gains, losses, and holding classifications across active FIFO lots.
pub fn compute_unrealized_gains(
    inputs: &[FolioHarvestingInput],
    as_of: NaiveDate,
) -> UnrealizedTaxSummary {
    let mut stcg = Money::ZERO;
    let mut ltcg = Money::ZERO;
    let mut losses = Money::ZERO;
    let mut net_gain = Money::ZERO;
    let mut lots = Vec::new();

    for input in inputs {
        let (active_lots, _) = process_fifo_lots(input.transactions);
        let is_eq = is_equity(input.asset_type, input.scheme_name);

        for lot in active_lots {
            if lot.remaining_units.is_zero() {
                continue;
            }

            let holding_days = (as_of - lot.purchase_date).num_days();
            let is_lt = if is_eq {
                holding_days >= 365
            } else {
                holding_days >= 1095
            };

            let current_value = input.current_nav * lot.remaining_units;
            let cost_basis = lot.purchase_nav * lot.remaining_units;
            let gain = current_value - cost_basis;

            net_gain += gain;
            if gain.is_positive() {
                if is_lt {
                    ltcg += gain;
                } else {
                    stcg += gain;
                }
            } else {
                losses += gain.abs();
            }

            lots.push(UnrealizedLotGain {
                scheme_name: input.scheme_name.to_string(),
                buy_date: lot.purchase_date,
                units: lot.remaining_units,
                purchase_nav: lot.purchase_nav,
                current_nav: input.current_nav,
                holding_days,
                is_ltcg: is_lt,
                unrealized_gain: gain,
            });
        }
    }

    UnrealizedTaxSummary {
        stcg,
        ltcg,
        losses,
        net_gain,
        lots,
    }
}

/// Identifies LTCG harvesting opportunities up to the statutory Section 112A annual exemption limit.
pub fn get_harvesting_opportunities(
    inputs: &[FolioHarvestingInput],
    as_of: NaiveDate,
    realized_ltcg_fy: Money,
    custom_exemption_limit: Option<Money>,
) -> HarvestingSummary {
    let exemption_limit = custom_exemption_limit.unwrap_or_else(ltcg_exemption_limit_budget_2024);
    let remaining_exemption = (exemption_limit - realized_ltcg_fy).max(Money::ZERO);

    let mut opportunities = Vec::new();
    let mut total_potential_harvest = Money::ZERO;

    if remaining_exemption.is_positive() {
        'outer: for input in inputs {
            // Exemption under Section 112A applies exclusively to equity assets
            if !is_equity(input.asset_type, input.scheme_name) {
                continue;
            }

            let (active_lots, _) = process_fifo_lots(input.transactions);
            let is_elss_scheme = is_elss(input.scheme_name);

            for lot in active_lots {
                if lot.remaining_units.is_zero() {
                    continue;
                }

                // ELSS 3-year statutory lock-in check
                if is_elss_scheme && as_of < elss_lock_in_expiry(lot.purchase_date) {
                    continue;
                }

                let holding_days = (as_of - lot.purchase_date).num_days();

                // Only LTCG lots (holding >= 365 days) with unrealized gains
                if holding_days >= 365 && input.current_nav > lot.purchase_nav {
                    let nav_gain = input.current_nav.to_decimal() - lot.purchase_nav.to_decimal();
                    let lot_gain = input.current_nav * lot.remaining_units
                        - lot.purchase_nav * lot.remaining_units;

                    let available_limit = remaining_exemption - total_potential_harvest;
                    let harvestable_gain = lot_gain.min(available_limit);

                    // Ignore negligible gains (< ₹1) to avoid precision noise
                    if harvestable_gain >= Money::new(Decimal::ONE) {
                        let units_to_harvest = if harvestable_gain == lot_gain {
                            lot.remaining_units
                        } else {
                            Units::new(harvestable_gain.to_decimal() / nav_gain)
                        };

                        let current_value = units_to_harvest * input.current_nav;

                        opportunities.push(HarvestingOpportunity {
                            folio_id: input.folio_id.map(|s| s.to_string()),
                            scheme_name: input.scheme_name.to_string(),
                            units_to_harvest,
                            unrealized_gain: harvestable_gain,
                            current_value,
                        });

                        total_potential_harvest += harvestable_gain;
                    }
                }

                if total_potential_harvest >= remaining_exemption {
                    break 'outer;
                }
            }
        }
    }

    let estimated_tax_savings =
        Money::new(total_potential_harvest.to_decimal() * LTCG_TAX_RATE_BUDGET_2024);
    let unrealized_summary = compute_unrealized_gains(inputs, as_of);

    HarvestingSummary {
        realized_ltcg_fy,
        remaining_exemption,
        total_potential_harvest,
        opportunities,
        estimated_tax_savings,
        unrealized_summary,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::holdings::TransactionType;
    use std::str::FromStr;

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("valid test date")
    }

    fn units(s: &str) -> Units {
        Units::from_str(s).expect("valid units")
    }

    fn nav(s: &str) -> Nav {
        Nav::from_str(s).expect("valid nav")
    }

    fn money(s: &str) -> Money {
        Money::from_str(s).expect("valid money")
    }

    #[test]
    fn test_harvesting_opportunities_within_exemption_limit() {
        // Equity fund holding > 1 year with gain
        let txs = vec![Transaction::new(
            "tx-h1",
            date(2022, 1, 1),
            TransactionType::Purchase,
            money("-100000"),
            units("1000"),
            nav("100"),
            units("1000"),
        )];

        let input = FolioHarvestingInput::new(
            "Parag Parikh Flexi Cap Fund",
            AssetType::MutualFund,
            &txs,
            nav("150"), // 50 gain per unit * 1000 = 50,000 unrealized LTCG
        );

        let as_of = date(2024, 6, 1);
        let summary = get_harvesting_opportunities(&[input], as_of, Money::ZERO, None);

        assert_eq!(summary.remaining_exemption, money("125000"));
        assert_eq!(summary.total_potential_harvest, money("50000"));
        assert_eq!(summary.opportunities.len(), 1);
        assert_eq!(summary.opportunities[0].units_to_harvest, units("1000"));
        assert_eq!(summary.opportunities[0].unrealized_gain, money("50000"));
        assert_eq!(summary.estimated_tax_savings, money("6250")); // 50,000 * 12.5% = 6,250
    }

    #[test]
    fn test_harvesting_caps_at_remaining_exemption() {
        // Lot with 200,000 unrealized gain, but exemption limit is 125,000
        let txs = vec![Transaction::new(
            "tx-h2",
            date(2022, 1, 1),
            TransactionType::Purchase,
            money("-100000"),
            units("1000"),
            nav("100"),
            units("1000"),
        )];

        let input = FolioHarvestingInput::new(
            "Large Cap Fund",
            AssetType::MutualFund,
            &txs,
            nav("300"), // 200 gain per unit * 1000 = 200,000 unrealized
        );

        let as_of = date(2024, 6, 1);
        // Say 25,000 already realized this FY
        let summary = get_harvesting_opportunities(&[input], as_of, money("25000"), None);

        assert_eq!(summary.remaining_exemption, money("100000"));
        assert_eq!(summary.total_potential_harvest, money("100000"));
        assert_eq!(summary.opportunities.len(), 1);
        // units = 100,000 / (300 - 100) = 500 units
        assert_eq!(summary.opportunities[0].units_to_harvest, units("500"));
        assert_eq!(summary.opportunities[0].unrealized_gain, money("100000"));
    }

    #[test]
    fn test_harvesting_excludes_debt_funds_and_locked_elss() {
        // Debt fund should be excluded
        let debt_txs = vec![Transaction::new(
            "tx-d1",
            date(2022, 1, 1),
            TransactionType::Purchase,
            money("-100000"),
            units("1000"),
            nav("100"),
            units("1000"),
        )];
        let debt_input = FolioHarvestingInput::new(
            "Liquid Cash Debt Fund",
            AssetType::MutualFund,
            &debt_txs,
            nav("150"),
        );

        // ELSS fund with units purchased 1.5 years ago (LTCG > 1yr, but LOCKED < 3yr)
        let elss_txs = vec![Transaction::new(
            "tx-e1",
            date(2023, 1, 1),
            TransactionType::Purchase,
            money("-50000"),
            units("500"),
            nav("100"),
            units("500"),
        )];
        let elss_input = FolioHarvestingInput::new(
            "Apex ELSS Tax Shield",
            AssetType::MutualFund,
            &elss_txs,
            nav("150"),
        );

        let as_of = date(2024, 6, 1);
        let summary =
            get_harvesting_opportunities(&[debt_input, elss_input], as_of, Money::ZERO, None);

        assert_eq!(summary.total_potential_harvest, Money::ZERO);
        assert_eq!(summary.opportunities.len(), 0);
    }
}
