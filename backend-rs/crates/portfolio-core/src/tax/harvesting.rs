//! Tax Harvesting Engine and Unrealized Capital Gains Analytics.
//!
//! Implements statutory Section 112A Long-Term Capital Gains (LTCG) tax harvesting:
//! - **Annual Exemption Threshold**: Section 112A grants an annual tax exemption on long-term capital
//!   gains from equity shares and equity mutual funds (₹1,25,000 post-Budget 2024; ₹1,00,000 prior).
//! - **Harvesting Optimization**: Identifies unsold equity lots held for at least 365 days whose unrealized
//!   gains can be realized without triggering any income tax liability.
//! - **Statutory Exclusion Filters**:
//!   - Debt and commodity/international funds are excluded (they do not qualify for Section 112A).
//!   - ELSS funds within their statutory 3-year lock-in are excluded (redemptions are legally barred).
//!   - Losses and short-term holdings are excluded from LTCG gain harvesting.
//! - **Fractional Lot Harvesting**: When remaining exemption is smaller than a lot's full gain, computes
//!   the exact fractional unit count to redeem (`units = exemption_portion / (current_nav - buy_nav)`).

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::holdings::{Folio, Transaction, process_fifo_lots};
use crate::tax::classification::TaxClassification;
pub use crate::tax::constants::*;
use crate::tax::rules::{elss_lock_in_expiry, is_elss, is_equity};
use crate::types::{AssetType, Money, Nav, Units};

/// Specific harvesting recommendation for an individual scheme holding lot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarvestingOpportunity {
    /// Identifier of the folio holding the units, if available.
    pub folio_id: Option<String>,
    /// Name of the scheme recommended for tax harvesting.
    pub scheme_name: String,
    /// Number of units to sell to harvest the targeted capital gain.
    pub units_to_harvest: Units,
    /// Capital gain amount that will be realized tax-free under Section 112A.
    pub unrealized_gain: Money,
    /// Current gross market value of the units to be harvested (`units * current_nav`).
    pub current_value: Money,
}

/// An individual unrealized holding lot analysis.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnrealizedLotGain {
    /// Name of the mutual fund or equity scheme.
    pub scheme_name: String,
    /// Calendar date when units were acquired.
    pub buy_date: NaiveDate,
    /// Number of unsold units currently held in this lot.
    pub units: Units,
    /// Original purchase NAV of the lot.
    pub purchase_nav: Nav,
    /// Current valuation NAV as of the evaluation date.
    pub current_nav: Nav,
    /// Elapsed calendar days since purchase.
    pub holding_days: i64,
    /// Whether the lot qualifies as Long-Term Capital Asset under statutory rules.
    pub is_ltcg: bool,
    /// Current unrealized gain or loss (`(current_nav - purchase_nav) * units`).
    pub unrealized_gain: Money,
}

/// Aggregated breakdown of unrealized capital gains and losses across active holdings.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UnrealizedTaxSummary {
    /// Total unrealized short-term capital gains across all active lots.
    pub stcg: Money,
    /// Total unrealized long-term capital gains across all active lots.
    pub ltcg: Money,
    /// Total unrealized capital losses across all active lots.
    pub losses: Money,
    /// Net unrealized position across all active holdings (`stcg + ltcg - losses`).
    pub net_gain: Money,
    /// Detailed lot-by-lot breakdown for each active position.
    pub lots: Vec<UnrealizedLotGain>,
}

/// Overall tax harvesting summary for a portfolio or profile scope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarvestingSummary {
    /// Long-term capital gains already realized in the current Financial Year.
    pub realized_ltcg_fy: Money,
    /// Remaining statutory Section 112A exemption available (`exemption_limit - realized_ltcg_fy`).
    pub remaining_exemption: Money,
    /// Total capital gains that can be harvested tax-free across all eligible positions.
    pub total_potential_harvest: Money,
    /// Actionable list of specific scheme lots recommended for harvesting.
    pub opportunities: Vec<HarvestingOpportunity>,
    /// Estimated statutory tax saved by harvesting before fiscal year end (`harvest * 12.5%`).
    pub estimated_tax_savings: Money,
    /// Complete unrealized gains and losses analysis.
    pub unrealized_summary: UnrealizedTaxSummary,
}

/// Input descriptor for a folio holding with current valuation NAV.
#[derive(Debug, Clone)]
pub struct FolioHarvestingInput<'a> {
    /// Identifier of the folio.
    pub folio_id: Option<&'a str>,
    /// Scheme or security name.
    pub scheme_name: &'a str,
    /// Asset type (Equity, Debt, etc.).
    pub asset_type: AssetType,
    /// Historical transaction records in the folio.
    pub transactions: &'a [Transaction],
    /// Current valuation NAV for the scheme.
    pub current_nav: Nav,
}

impl<'a> FolioHarvestingInput<'a> {
    /// Constructs a new [`FolioHarvestingInput`].
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

    /// Builder method attaching a folio ID to this input.
    pub fn with_folio_id(mut self, folio_id: &'a str) -> Self {
        self.folio_id = Some(folio_id);
        self
    }

    /// Convenience constructor converting a domain [`Folio`] reference into harvesting input.
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

            let classification =
                TaxClassification::classify(is_eq, lot.purchase_date, as_of, Decimal::ZERO);
            let is_lt = classification.holding_type == crate::tax::HoldingType::LongTerm;
            let holding_days = classification.holding_days;

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
///
/// # Optimization Algorithm:
/// 1. Determines remaining exemption limit:
///    `remaining_exemption = max(0, statutory_limit - realized_ltcg_fy)`.
/// 2. Iterates over active equity lots:
///    - Skips non-equity holdings (debt/commodity do not qualify for Section 112A exemption).
///    - Skips ELSS lots still subject to the 3-year statutory lock-in.
///    - Only considers long-term lots (holding >= 365 days) where `current_nav > purchase_nav`.
/// 3. Computes the harvestable gain capped by remaining exemption:
///    - If `lot_gain <= available_limit`: Harvest entire lot units.
///    - If `lot_gain > available_limit`: Harvest fractional units:
///      `units_to_harvest = available_limit / (current_nav - purchase_nav)`.
/// 4. Discards negligible gains (< ₹1) to prevent precision dust.
/// 5. Computes statutory tax savings: `total_potential_harvest * 12.5%`.
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
                if holding_days >= HOLDING_DAYS_EQUITY_LTCG && input.current_nav > lot.purchase_nav
                {
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
#[allow(clippy::unwrap_used, clippy::panic)]
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
