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

/// Specific harvesting recommendation for an individual scheme holding lot or consolidated folio.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HarvestingOpportunity {
    /// Identifier of the folio holding the units, if available.
    pub folio_id: Option<String>,
    /// Real investor folio number (from CAS statement), if available.
    pub folio_number: Option<String>,
    /// Name of the scheme recommended for tax harvesting.
    pub scheme_name: String,
    /// Total number of units to sell across qualifying lots to harvest the targeted capital gain.
    pub units_to_harvest: Units,
    /// Capital gain amount that will be realized tax-free under Section 112A.
    pub unrealized_gain: Money,
    /// Current gross market value of the units to be harvested (`units * current_nav`).
    pub current_value: Money,
    /// Number of distinct FIFO purchase lots (e.g. SIP installments) consolidated into this order.
    pub lots_count: usize,
    /// Calendar date of the earliest purchase lot redeemed under FIFO.
    pub first_lot_date: Option<NaiveDate>,
    /// Calendar date of the latest purchase lot redeemed under FIFO.
    pub last_lot_date: Option<NaiveDate>,
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
    /// Real investor folio number (from CAS statement).
    pub folio_number: Option<&'a str>,
    /// Scheme or security name.
    pub scheme_name: &'a str,
    /// Asset type (Equity, Debt, etc.).
    pub asset_type: AssetType,
    /// Historical transaction records in the folio.
    pub transactions: &'a [Transaction],
    /// Current valuation NAV for the scheme.
    pub current_nav: Nav,
    /// Fund exit load metadata string, if available.
    pub exit_load_metadata: Option<&'a str>,
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
            folio_number: None,
            scheme_name,
            asset_type,
            transactions,
            current_nav,
            exit_load_metadata: None,
        }
    }

    /// Builder method attaching a folio ID to this input.
    pub fn with_folio_id(mut self, folio_id: &'a str) -> Self {
        self.folio_id = Some(folio_id);
        self
    }

    /// Builder method attaching a real folio number to this input.
    pub fn with_folio_number(mut self, folio_number: &'a str) -> Self {
        self.folio_number = Some(folio_number);
        self
    }

    /// Builder method attaching exit load metadata to this input.
    pub fn with_exit_load_metadata(mut self, metadata: &'a str) -> Self {
        self.exit_load_metadata = Some(metadata);
        self
    }

    /// Convenience constructor converting a domain [`Folio`] reference into harvesting input.
    pub fn from_folio(folio: &'a Folio, current_nav: Nav) -> Self {
        Self {
            folio_id: Some(&folio.id),
            folio_number: Some(folio.folio_number.as_str()),
            scheme_name: &folio.asset_name,
            asset_type: folio.asset_type,
            transactions: &folio.transactions,
            current_nav,
            exit_load_metadata: None,
        }
    }
}

/// Computes detailed unrealized capital gains, losses, and holding classifications across active FIFO lots.
pub fn compute_unrealized_gains(
    inputs: &[FolioHarvestingInput<'_>],
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
/// # Optimization & Consolidation Algorithm:
/// 1. Determines remaining exemption limit:
///    `remaining_exemption = max(0, statutory_limit - realized_ltcg_fy)`.
/// 2. Gathers and aggregates qualifying equity lots per input scheme/folio:
///    - Excludes non-equity assets (Section 112A applies exclusively to equity).
///    - Excludes ELSS lots within their statutory 3-year lock-in (`holding_days < 1095`).
///    - Excludes short-term lots (`holding_days < 365`) and lots with zero or negative gains.
///    - Excludes lots with active exit load penalty schedules.
/// 3. Computes scheme-level **Gain Density** ($\frac{\text{Unrealized LTCG Gain}}{\text{Gross Market Value}}$).
/// 4. **Sorts candidate schemes in descending order of Gain Density**:
///    - Prioritizes schemes with the highest tax-alpha margin first (e.g. 50%–60% gain).
///    - Minimizes total capital turnover, avoiding liquidating funds with 0.8% gains for trivial tax savings.
/// 5. **Consolidates qualifying FIFO lots into a single redemption order per scheme/folio**:
///    - Accumulates units, gains, and current value across all eligible lots in the folio.
///    - Tracks the number of FIFO lots consolidated (`lots_count`), earliest purchase date (`first_lot_date`),
///      and latest purchase date (`last_lot_date`).
///    - Attaches the real investor `folio_number` from the statement.
/// 6. Computes estimated statutory tax savings: `total_potential_harvest * 12.5%`.
pub fn get_harvesting_opportunities(
    inputs: &[FolioHarvestingInput<'_>],
    as_of: NaiveDate,
    realized_ltcg_fy: Money,
    custom_exemption_limit: Option<Money>,
) -> HarvestingSummary {
    let exemption_limit = custom_exemption_limit.unwrap_or_else(ltcg_exemption_limit_budget_2024);
    let remaining_exemption = (exemption_limit - realized_ltcg_fy).max(Money::ZERO);

    let mut opportunities = Vec::new();
    let mut total_potential_harvest = Money::ZERO;

    if remaining_exemption.is_positive() {
        struct CandidateScheme<'a> {
            input: &'a FolioHarvestingInput<'a>,
            qualifying_lots: Vec<(Units, Money, Money, NaiveDate, Decimal)>, // (units, lot_gain, lot_val, buy_date, nav_gain)
            gain_density: Decimal,
        }

        let mut candidate_schemes: Vec<CandidateScheme<'_>> = Vec::new();

        for input in inputs {
            if !is_equity(input.asset_type, input.scheme_name) {
                continue;
            }

            let (active_lots, _) = process_fifo_lots(input.transactions);
            let is_elss_scheme = is_elss(input.scheme_name);

            let mut qualifying_lots = Vec::new();
            let mut scheme_total_gain = Money::ZERO;
            let mut scheme_total_val = Money::ZERO;

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
                    let lot_val = lot.remaining_units * input.current_nav;
                    let exit_load = crate::tax::rules::get_exit_load(
                        input.scheme_name,
                        input.asset_type,
                        lot.purchase_date,
                        as_of,
                        lot_val,
                        input.exit_load_metadata,
                    );
                    if !exit_load.is_zero() {
                        continue;
                    }

                    let nav_gain = input.current_nav.to_decimal() - lot.purchase_nav.to_decimal();
                    let lot_gain = input.current_nav * lot.remaining_units
                        - lot.purchase_nav * lot.remaining_units;

                    if lot_gain >= Money::new(Decimal::ONE) {
                        scheme_total_gain += lot_gain;
                        scheme_total_val += lot_val;
                        qualifying_lots.push((
                            lot.remaining_units,
                            lot_gain,
                            lot_val,
                            lot.purchase_date,
                            nav_gain,
                        ));
                    }
                }
            }

            if !qualifying_lots.is_empty() && scheme_total_gain.is_positive() {
                let gain_density = if scheme_total_val.is_positive() {
                    scheme_total_gain.to_decimal() / scheme_total_val.to_decimal()
                } else {
                    Decimal::ZERO
                };

                candidate_schemes.push(CandidateScheme {
                    input,
                    qualifying_lots,
                    gain_density,
                });
            }
        }

        // Sort candidate schemes by Gain Density descending (highest tax-alpha per rupee of turnover)
        candidate_schemes.sort_by_key(|a| std::cmp::Reverse(a.gain_density));

        'scheme_loop: for candidate in candidate_schemes {
            if total_potential_harvest >= remaining_exemption {
                break;
            }

            let mut consolidated_units = Units::ZERO;
            let mut consolidated_gain = Money::ZERO;
            let mut consolidated_value = Money::ZERO;
            let mut lots_count = 0;
            let mut first_lot_date = None;
            let mut last_lot_date = None;

            for (units, lot_gain, _, buy_date, nav_gain) in candidate.qualifying_lots {
                let available_limit = remaining_exemption - total_potential_harvest;
                if available_limit.is_zero() {
                    break 'scheme_loop;
                }

                let harvestable_gain = lot_gain.min(available_limit);
                if harvestable_gain < Money::new(Decimal::ONE) {
                    continue;
                }

                let units_to_harvest = if harvestable_gain == lot_gain {
                    units
                } else {
                    Units::new(harvestable_gain.to_decimal() / nav_gain)
                };

                let current_value = units_to_harvest * candidate.input.current_nav;

                consolidated_units += units_to_harvest;
                consolidated_gain += harvestable_gain;
                consolidated_value += current_value;
                lots_count += 1;

                if first_lot_date.is_none() || Some(buy_date) < first_lot_date {
                    first_lot_date = Some(buy_date);
                }
                if last_lot_date.is_none() || Some(buy_date) > last_lot_date {
                    last_lot_date = Some(buy_date);
                }

                total_potential_harvest += harvestable_gain;

                if total_potential_harvest >= remaining_exemption {
                    break;
                }
            }

            if consolidated_gain.is_positive() {
                opportunities.push(HarvestingOpportunity {
                    folio_id: candidate
                        .input
                        .folio_id
                        .map(std::string::ToString::to_string),
                    folio_number: candidate
                        .input
                        .folio_number
                        .map(std::string::ToString::to_string),
                    scheme_name: candidate.input.scheme_name.to_string(),
                    units_to_harvest: consolidated_units,
                    unrealized_gain: consolidated_gain,
                    current_value: consolidated_value,
                    lots_count,
                    first_lot_date,
                    last_lot_date,
                });
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

/// Alias for [`get_harvesting_opportunities`] providing a statutory Section 112A harvest ticket.
pub fn generate_section_112a_harvest_ticket(
    inputs: &[FolioHarvestingInput<'_>],
    as_of: NaiveDate,
    realized_ltcg_fy: Money,
    custom_exemption_limit: Option<Money>,
) -> HarvestingSummary {
    get_harvesting_opportunities(inputs, as_of, realized_ltcg_fy, custom_exemption_limit)
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

    #[test]
    fn test_harvesting_excludes_parag_parikh_with_active_exit_load() {
        // Parag Parikh Flexi Cap: 2% exit load < 365d, 1% exit load < 730d, 0% thereafter.
        // Purchase on 2023-01-01, as_of 2024-02-05 (400 days holding):
        // > 365 days (LTCG under Section 112A), but < 730 days (1% exit load active).
        let tx_400d = vec![Transaction::new(
            "tx-pp1",
            date(2023, 1, 1),
            TransactionType::Purchase,
            money("-100000"),
            units("1000"),
            nav("100"),
            units("1000"),
        )];
        let input_400d = FolioHarvestingInput::new(
            "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
            AssetType::MutualFund,
            &tx_400d,
            nav("150"),
        );

        let as_of_400d = date(2024, 2, 5);
        let summary_400d =
            get_harvesting_opportunities(&[input_400d], as_of_400d, Money::ZERO, None);
        assert_eq!(
            summary_400d.opportunities.len(),
            0,
            "Lot with 1% exit load (<730d) must be excluded from harvest ticket"
        );

        // Now evaluate at 800 days (as_of 2025-03-11): > 730 days -> 0% exit load.
        let input_800d = FolioHarvestingInput::new(
            "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
            AssetType::MutualFund,
            &tx_400d,
            nav("150"),
        );
        let as_of_800d = date(2025, 3, 11);
        let summary_800d =
            get_harvesting_opportunities(&[input_800d], as_of_800d, Money::ZERO, None);
        assert_eq!(
            summary_800d.opportunities.len(),
            1,
            "Lot with 0% exit load (>730d) should be eligible for harvesting"
        );
        assert_eq!(
            summary_800d.opportunities[0].unrealized_gain,
            money("50000")
        );
    }

    #[test]
    fn test_harvesting_consolidates_multiple_sip_lots_into_single_order() {
        // Simulate 36 monthly SIP installments in the same fund/folio
        let mut sip_txs = Vec::new();
        for month in 1..=36 {
            let year = 2020 + (month - 1) / 12;
            let m = (((month - 1) % 12) + 1) as u32;
            sip_txs.push(Transaction::new(
                format!("sip-{month}"),
                date(year, m, 5),
                TransactionType::Purchase,
                money("-5000"),
                units("100"), // 100 units @ NAV 50
                nav("50"),
                units("100"),
            ));
        }

        let input = FolioHarvestingInput::new(
            "Aditya Birla Sun Life Flexi Cap Fund - Growth",
            AssetType::MutualFund,
            &sip_txs,
            nav("100"), // 50 gain per unit * 3600 units = 180,000 unrealized gain
        )
        .with_folio_id("folio-absl-flexi")
        .with_folio_number("10482910/22");

        let as_of = date(2024, 6, 1); // All lots > 1 year
        let summary = get_harvesting_opportunities(&[input], as_of, Money::ZERO, None);

        // Crucial invariant: Multiple SIP lots for the same folio MUST consolidate into exactly 1 order!
        assert_eq!(
            summary.opportunities.len(),
            1,
            "All 36 monthly SIP lots must be consolidated into exactly 1 redemption order"
        );

        let op = &summary.opportunities[0];
        assert_eq!(op.folio_id.as_deref(), Some("folio-absl-flexi"));
        assert_eq!(op.folio_number.as_deref(), Some("10482910/22"));
        assert_eq!(op.unrealized_gain, money("125000")); // Capped at ₹1.25L exemption
        assert_eq!(op.lots_count, 25); // 25 lots * (100 units * 50 gain) = 125,000 gain
        assert_eq!(op.units_to_harvest, units("2500"));
        assert_eq!(op.current_value, money("250000"));
        assert_eq!(op.first_lot_date, Some(date(2020, 1, 5)));
        assert_eq!(op.last_lot_date, Some(date(2022, 1, 5)));
    }

    #[test]
    fn test_harvesting_prioritizes_high_gain_density_schemes() {
        // Scheme A: Low gain density (10% gain margin: Buy NAV 90 -> Current NAV 100)
        let txs_a = vec![Transaction::new(
            "tx-a",
            date(2022, 1, 1),
            TransactionType::Purchase,
            money("-900000"),
            units("10000"),
            nav("90"),
            units("10000"),
        )];
        let input_a = FolioHarvestingInput::new(
            "Low Margin Large Cap Fund",
            AssetType::MutualFund,
            &txs_a,
            nav("100"), // 10 gain per unit * 10,000 = 100,000 gain (Density: 100k / 1M = 10%)
        )
        .with_folio_id("folio-a");

        // Scheme B: High gain density (60% gain margin: Buy NAV 40 -> Current NAV 100)
        let txs_b = vec![Transaction::new(
            "tx-b",
            date(2022, 1, 1),
            TransactionType::Purchase,
            money("-400000"),
            units("10000"),
            nav("40"),
            units("10000"),
        )];
        let input_b = FolioHarvestingInput::new(
            "High Margin Mid Cap Fund",
            AssetType::MutualFund,
            &txs_b,
            nav("100"), // 60 gain per unit * 10,000 = 600,000 gain (Density: 600k / 1M = 60%)
        )
        .with_folio_id("folio-b");

        let as_of = date(2024, 6, 1);
        // Pass Low Margin first in the input slice to verify that sorting prioritizes High Margin
        let summary = get_harvesting_opportunities(&[input_a, input_b], as_of, Money::ZERO, None);

        // High margin scheme B must be harvested first to minimize capital turnover
        assert_eq!(summary.opportunities.len(), 1);
        assert_eq!(
            summary.opportunities[0].scheme_name,
            "High Margin Mid Cap Fund"
        );
        assert_eq!(summary.opportunities[0].unrealized_gain, money("125000"));
        // At 60 gain per unit, units = 125,000 / 60 = 2083.3333 units
        // Capital turnover = ~₹2,08,333 instead of ₹12,50,000 required for Scheme A!
        assert!(summary.opportunities[0].current_value < money("210000"));
    }
}
