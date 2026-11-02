pub mod classification;
pub mod constants;
pub mod grandfathering;
pub mod harvesting;
pub mod rules;

use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use ts_rs::TS;

use crate::holdings::{Transaction, process_fifo_lots};
use crate::types::{AssetType, FolioNumber, Isin, Money, Nav, Pan, Units};

pub use classification::TaxClassification;
pub use constants::*;
pub use grandfathering::{calculate_gain, calculate_gain_with_expenses, compute_deemed_cost};
pub use harvesting::{
    FolioHarvestingInput, HarvestingOpportunity, HarvestingSummary, UnrealizedLotGain,
    UnrealizedTaxSummary, compute_unrealized_gains, get_harvesting_opportunities,
};
pub use rules::{
    elss_lock_in_expiry, get_exit_load, get_locked_units, is_elss, is_elss_scheme, is_equity,
    is_lot_locked, parse_exit_load_from_metadata, simulate_sell, simulate_sell_transactions,
    simulate_sell_transactions_with_metadata,
};

/// Indian Income Tax capital gains classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export_to = "TaxType.ts")]
pub enum TaxType {
    /// Short-Term Capital Gains (Section 111A or general STCG).
    Stcg,
    /// Long-Term Capital Gains (Section 112A or Section 112).
    Ltcg,
    /// Gains taxed at normal marginal income tax slab rates (e.g. Section 50AA debt mutual funds).
    Slab,
}

/// Relevant IT Act sections for capital gains under Pre/Post-Budget 2024 rules.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export_to = "TaxSection.ts")]
pub enum TaxSection {
    /// Section 111A equity STCG at 15% (sales executed prior to 23-Jul-2024).
    Sec111A15,
    /// Section 111A equity STCG at 20% (sales executed on or after 23-Jul-2024).
    Sec111A20,
    /// Section 112A equity LTCG at 10% (sales executed prior to 23-Jul-2024).
    Sec112A10,
    /// Section 112A equity LTCG at 12.5% (sales executed on or after 23-Jul-2024).
    Sec112A12_5,
    /// Finance Act 2023 Section 50AA debt mutual funds taxed at slab rates (purchased on/after 01-Apr-2023).
    Sec50AA,
    /// Section 112 debt LTCG at 12.5% unindexed (purchased before 01-Apr-2023, sold on/after 23-Jul-2024).
    Sec112Debt12_5,
    /// Section 112 debt LTCG at 20% with Cost Inflation Index (CII) indexation (sold prior to 23-Jul-2024).
    Sec112Debt20,
    /// General short-term capital gains or other income taxed at slab rates.
    Slab,
}

impl std::fmt::Display for TaxSection {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TaxSection::Sec111A15 => write!(f, "111A (15%)"),
            TaxSection::Sec111A20 => write!(f, "111A (20%)"),
            TaxSection::Sec112A10 => write!(f, "112A (10%)"),
            TaxSection::Sec112A12_5 => write!(f, "112A (12.5%)"),
            TaxSection::Sec50AA => write!(f, "50AA (Slab)"),
            TaxSection::Sec112Debt12_5 => write!(f, "112 Debt (12.5%)"),
            TaxSection::Sec112Debt20 => write!(f, "112 Debt (20% Indexed)"),
            TaxSection::Slab => write!(f, "SLAB"),
        }
    }
}

/// Holding period classification (Short-Term vs Long-Term).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export_to = "HoldingType.ts")]
pub enum HoldingType {
    /// Asset held for less than the statutory long-term threshold.
    ShortTerm,
    /// Asset held for at least the statutory long-term threshold.
    LongTerm,
}

/// Statutory advance tax quarters adjusted for Budget 2024 (23 July 2024).
///
/// In FY 2024-25, Quarter 2 was split into two sub-periods (`Q2a` and `Q2b`) because
/// the Finance Act (No. 2) 2024 changed capital gains tax rates effective July 23, 2024:
/// - `Q1`: April 1 to June 15
/// - `Q2a`: June 16 to July 22 (Pre-Budget 2024 rates apply)
/// - `Q2b`: July 23 to September 15 (Post-Budget 2024 rates apply)
/// - `Q3`: September 16 to December 15
/// - `Q4`: December 16 to March 15
/// - `Q5`: March 16 to March 31
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, TS)]
#[ts(export_to = "AdvanceTaxQuarter.ts")]
pub enum AdvanceTaxQuarter {
    /// First statutory installment: April 1 to June 15.
    #[serde(rename = "Q1 (01/04 - 15/06)")]
    Q1,
    /// Second installment pre-Budget 2024: June 16 to July 22.
    #[serde(rename = "Q2a (16/06 - 22/07)")]
    Q2A,
    /// Second installment post-Budget 2024: July 23 to September 15.
    #[serde(rename = "Q2b (23/07 - 15/09)")]
    Q2B,
    /// Third statutory installment: September 16 to December 15.
    #[serde(rename = "Q3 (16/09 - 15/12)")]
    Q3,
    /// Fourth statutory installment: December 16 to March 15.
    #[serde(rename = "Q4 (16/12 - 15/03)")]
    Q4,
    /// Fifth statutory installment (year-end true-up): March 16 to March 31.
    #[serde(rename = "Q5 (16/03 - 31/03)")]
    Q5,
}

impl AdvanceTaxQuarter {
    /// Returns the human-readable string representation of the advance tax quarter.
    pub fn as_str(&self) -> &'static str {
        match self {
            AdvanceTaxQuarter::Q1 => "Q1 (01/04 - 15/06)",
            AdvanceTaxQuarter::Q2A => "Q2a (16/06 - 22/07)",
            AdvanceTaxQuarter::Q2B => "Q2b (23/07 - 15/09)",
            AdvanceTaxQuarter::Q3 => "Q3 (16/09 - 15/12)",
            AdvanceTaxQuarter::Q4 => "Q4 (16/12 - 15/03)",
            AdvanceTaxQuarter::Q5 => "Q5 (16/03 - 31/03)",
        }
    }

    /// Resolves an advance tax quarter from a transaction date.
    pub fn from_date(date: NaiveDate) -> Self {
        use chrono::Datelike;
        let month = date.month();
        let day = date.day();

        if (month == 4) || (month == 5) || (month == 6 && day <= 15) {
            AdvanceTaxQuarter::Q1
        } else if (month == 6 && day >= 16) || (month == 7 && day <= 22) {
            AdvanceTaxQuarter::Q2A
        } else if (month == 7 && day >= 23) || (month == 8) || (month == 9 && day <= 15) {
            AdvanceTaxQuarter::Q2B
        } else if (month == 9 && day >= 16)
            || (month == 10)
            || (month == 11)
            || (month == 12 && day <= 15)
        {
            AdvanceTaxQuarter::Q3
        } else if (month == 12 && day >= 16)
            || (month == 1)
            || (month == 2)
            || (month == 3 && day <= 15)
        {
            AdvanceTaxQuarter::Q4
        } else {
            AdvanceTaxQuarter::Q5
        }
    }
}

impl std::fmt::Display for AdvanceTaxQuarter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Data for a single quarter in Schedule CG Table F.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TableFQuarterData {
    /// Section 111A STCG realized at 15%.
    pub stcg15: Money,
    /// Section 111A STCG realized at 20%.
    pub stcg20: Money,
    /// Section 112A LTCG realized at 10%.
    pub ltcg10: Money,
    /// Section 112A LTCG realized at 12.5%.
    pub ltcg12_5: Money,
    /// Section 112 debt LTCG realized at 12.5% unindexed.
    pub debt_ltcg12_5: Money,
    /// Section 112 debt LTCG realized at 20% indexed.
    pub debt_ltcg20: Money,
    /// Short-term debt gains taxed at slab rates (Section 50AA).
    pub slab: Money,
    /// Total net capital gain accrued in this quarter.
    pub total_gain: Money,
    /// Base tax liability before health and education cess.
    pub tax_before_cess: Money,
    /// 4% Health and Education Cess.
    pub cess: Money,
    /// Total estimated advance tax due for this quarter.
    pub estimated_tax: Money,
}

/// Schedule CG Table F: Advance Tax Accrual Matrix across the statutory quarters.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AdvanceTaxAccrualMatrix {
    /// Detailed quarterly accruals mapped by quarter key (e.g. "Q1 (01/04 - 15/06)").
    pub quarters: std::collections::HashMap<String, TableFQuarterData>,
    /// Cumulative tax total per quarter for advance tax payment tracking.
    pub quarter_totals: std::collections::HashMap<String, Money>,
}

/// Summary metrics for a specific statutory tax section.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SectionTotalData {
    /// Statutory section label (e.g. "112A (12.5%)").
    pub section: String,
    /// Total full value of consideration received on sale of assets.
    pub gross_consideration: Money,
    /// Original cost of acquisition before any deemed cost adjustment.
    pub cost_of_acquisition: Money,
    /// Statutory cost of acquisition (adjusted for Section 55(2)(ac) grandfathering).
    pub deemed_cost_of_acquisition: Money,
    /// Allowable expenditure wholly and exclusively incurred in connection with transfer.
    pub transfer_expenses: Money,
    /// Net capital gain or loss under this section.
    pub total_gain: Money,
    /// Applicable nominal statutory tax rate.
    pub tax_rate: Decimal,
    /// Base tax liability before cess.
    pub tax_before_cess: Money,
    /// 4% Health and Education Cess.
    pub cess: Money,
    /// Total tax liability under this section.
    pub total_tax: Money,
}

/// Mapping of statutory section keys (e.g. "112A_LTCG") to their aggregated tax computation totals.
pub type SectionTotalsMap = std::collections::HashMap<String, SectionTotalData>;

/// An active or historical purchase lot tracked for FIFO matching.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BuyLot {
    /// Date when units were purchased.
    pub date: NaiveDate,
    /// Current unsold units remaining in the lot.
    pub units: Units,
    /// Acquisition NAV per unit.
    pub nav: Nav,
    /// Total acquisition cost of remaining units.
    pub amount: Money,
    /// Original units originally purchased in this lot.
    pub original_units: Units,
    /// ISIN of the security.
    pub isin: Option<Isin>,
    /// Whether this lot represents bonus shares (zero cost of acquisition).
    pub is_bonus: bool,
    /// Whether this is a synthetic anchor lot (representing opening balance).
    pub is_anchor: bool,
}

impl BuyLot {
    /// Constructs a new [`BuyLot`].
    pub fn new(date: NaiveDate, units: Units, nav: Nav, amount: Money) -> Self {
        Self {
            date,
            units,
            nav,
            amount,
            original_units: units,
            isin: None,
            is_bonus: false,
            is_anchor: false,
        }
    }

    /// Builder method attaching an ISIN to the lot.
    pub fn with_isin(mut self, isin: Isin) -> Self {
        self.isin = Some(isin);
        self
    }

    /// Builder method marking the lot as bonus units (zero cost basis).
    pub fn with_bonus(mut self, is_bonus: bool) -> Self {
        self.is_bonus = is_bonus;
        self
    }

    /// Builder method marking the lot as an anchor lot.
    pub fn with_anchor(mut self, is_anchor: bool) -> Self {
        self.is_anchor = is_anchor;
        self
    }
}

/// Detailed calculation for a single realized gain matching a redemption to a buy lot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export_to = "RealizedGain.ts", rename_all = "camelCase")]
pub struct RealizedGain {
    /// Asset or mutual fund scheme name.
    pub asset_name: String,
    /// Account folio number.
    pub folio_number: Option<FolioNumber>,
    /// ISIN of the underlying security.
    pub isin: Option<Isin>,
    /// Permanent Account Number (PAN) of the folio owner.
    pub pan: Option<Pan>,
    /// Asset class (e.g. "Equity", "Debt", "Fixed Deposit").
    pub asset_class: String,
    /// Statutory section under which gain is taxed (e.g. Sec112A12_5, Sec111A20).
    pub section: TaxSection,
    /// Acquisition date of the matched buy lot.
    pub buy_date: NaiveDate,
    /// Date when units were redeemed or sold.
    pub sell_date: NaiveDate,
    /// Number of calendar days held.
    #[ts(type = "number")]
    pub holding_period_days: i64,
    /// Short-Term vs Long-Term classification.
    pub holding_type: HoldingType,
    /// Number of units redeemed.
    pub units: Units,
    /// Original purchase NAV per unit.
    pub buy_nav: Nav,
    /// Redemption NAV per unit.
    pub sell_nav: Nav,
    /// Gross proceeds received on sale (`units * sell_nav`).
    pub gross_consideration: Money,
    /// Historical cost of acquisition (`units * buy_nav`).
    pub cost_of_acquisition: Money,
    /// Fair Market Value per unit as of 31-Jan-2018 (Section 55(2)(ac)).
    pub fmv_as_of_jan31_2018: Nav,
    /// Total FMV as of 31-Jan-2018 (`units * fmv`).
    pub total_fmv_jan31_2018: Money,
    /// Deemed statutory cost of acquisition under Section 55(2)(ac).
    pub deemed_cost_of_acquisition: Money,
    /// Transfer expenses or exit load deducted from proceeds.
    pub transfer_expenses: Money,
    /// Realized capital gain or loss (`gross_consideration - deemed_cost - expenses`).
    pub gain: Money,
    /// Tax treatment category (Ltcg, Stcg, Slab).
    pub tax_type: TaxType,
    /// Nominal statutory tax rate applied to positive gains.
    #[ts(type = "number")]
    pub tax_rate: Decimal,
    /// Tax liability prior to 4% cess.
    pub tax_before_cess: Money,
    /// 4% Health and Education Cess.
    pub cess: Money,
    /// Total estimated statutory tax liability.
    pub estimated_tax: Money,
    /// Whether Section 55(2)(ac) grandfathering was applied.
    pub is_grandfathered: bool,
    /// Descriptive description of grandfathering status.
    pub grandfathered_status: String,
    /// Advance tax quarter in which the redemption occurred.
    pub advance_tax_quarter: Option<AdvanceTaxQuarter>,
}

/// Tax summary for a category (realized or unrealized).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaxCategorySummary {
    /// Total short-term capital gains across lots.
    pub stcg: Money,
    /// Total long-term capital gains across lots.
    pub ltcg: Money,
    /// Total gains subject to slab rates (e.g. Section 50AA debt funds).
    pub slab: Money,
    /// Total gross gain across all categories (`stcg + ltcg + slab`).
    pub total: Money,
    /// Net taxable STCG after Section 70 loss set-offs.
    pub taxable_stcg: Money,
    /// Net taxable LTCG after Section 70 loss set-offs.
    pub taxable_ltcg: Money,
    /// Net taxable slab gain after Section 70 loss set-offs.
    #[serde(default)]
    pub taxable_slab: Money,
    /// Individual lot redemption details.
    pub details: Vec<RealizedGain>,
}

/// Overall portfolio tax summary separating realized from unrealized gains.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaxPortfolioSummary {
    /// Whether any transactions depend on synthetic opening balances.
    pub has_synthetic_anchors: bool,
    /// Summary of realized capital gains from historical sales/redemptions.
    pub realized: TaxCategorySummary,
    /// Summary of unrealized capital gains on active unsold holdings.
    pub unrealized: TaxCategorySummary,
    /// Advance tax accrual matrix matching Schedule CG Table F.
    pub table_f: Option<AdvanceTaxAccrualMatrix>,
    /// Totals broken down by statutory section matching ITR-2/ITR-3.
    pub section_totals: Option<SectionTotalsMap>,
}

/// Invariant validation errors for statutory ITR capital gains reports.
#[derive(Debug, Error, PartialEq, Eq, Clone)]
pub enum TaxInvariantError {
    /// Quarterly sum in Table F does not match total net realized capital gains.
    #[error(
        "Quarterly accrued gains mismatch: sum of Table F quarters is {quarterly_sum}, but net realized gain is {net_realized}"
    )]
    QuarterlyMismatch {
        /// Sum of gains across all 5 quarters in Table F.
        quarterly_sum: Money,
        /// Actual net realized capital gains across the fiscal year.
        net_realized: Money,
    },

    /// Claimed LTCG exemption under Section 112A exceeds statutory ceiling.
    #[error(
        "Exempt LTCG under Section 112A exceeds statutory limit: claimed {claimed}, limit {limit}"
    )]
    ExemptionExceedsLimit {
        /// Claimed exempt capital gains amount.
        claimed: Money,
        /// Maximum statutory exemption limit (e.g., ₹1,25,000 for FY24-25).
        limit: Money,
    },

    /// Claimed exemption amount is negative.
    #[error("Exempt LTCG under Section 112A cannot be negative: claimed {claimed}")]
    NegativeExemption {
        /// Invalid negative exemption value.
        claimed: Money,
    },

    /// Taxable capital gain is negative after loss set-offs (must be non-negative).
    #[error("Taxable gain cannot be negative after set-off: {taxable_gain}")]
    NegativeTaxableGain {
        /// Invalid negative taxable gain.
        taxable_gain: Money,
    },

    /// Schedule CG report is missing Table F quarterly breakdown matrix.
    #[error("Missing Table F advance tax matrix")]
    MissingTableF,
}

/// Complete capital gains tax report for statutory filing (ITR Schedule CG).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxReport {
    /// Financial Year covered by this report (e.g. "2024-25").
    pub financial_year: String,
    /// Assessment Year corresponding to the financial year (e.g. "2025-26").
    pub assessment_year: Option<String>,
    /// Full legal name of the taxpayer / assessee.
    pub assessee_name: Option<String>,
    /// Permanent Account Number (PAN) of the taxpayer.
    pub pan: Option<Pan>,
    /// Comprehensive summary of realized and unrealized tax liabilities.
    pub summary: TaxPortfolioSummary,
    /// Total Section 112A exempt long-term capital gains claimed (capped by statutory limits).
    pub exempt_ltcg_112a: Money,
}

impl TaxReport {
    /// Constructs a new [`TaxReport`].
    pub fn new(
        financial_year: impl Into<String>,
        summary: TaxPortfolioSummary,
        exempt_ltcg_112a: Money,
    ) -> Self {
        Self {
            financial_year: financial_year.into(),
            assessment_year: None,
            assessee_name: None,
            pan: None,
            summary,
            exempt_ltcg_112a,
        }
    }

    /// Builder method attaching a PAN to the tax report.
    pub fn with_pan(mut self, pan: Pan) -> Self {
        self.pan = Some(pan);
        self
    }

    /// Builder method attaching the assessee name to the tax report.
    pub fn with_assessee_name(mut self, name: impl Into<String>) -> Self {
        self.assessee_name = Some(name.into());
        self
    }

    /// Builder method attaching the assessment year to the tax report.
    pub fn with_assessment_year(mut self, ay: impl Into<String>) -> Self {
        self.assessment_year = Some(ay.into());
        self
    }
}

/// Returns the Section 112A statutory LTCG exemption limit for a given Financial Year.
pub fn get_112a_statutory_limit(financial_year: &str) -> Money {
    let start_year = financial_year
        .split('-')
        .next()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(2024);
    if start_year >= 2024 {
        ltcg_exemption_limit_budget_2024()
    } else {
        ltcg_exemption_limit_pre_budget_2024()
    }
}

/// Verifies statutory ITR capital gains invariants before report generation/export:
/// 1. Sum of quarterly accrued gains across Table F equals net realized gains.
/// 2. Exempt LTCG under Sec 112A does not exceed statutory limits (₹1,25,000 post-Budget 2024, ₹1,00,000 pre-Budget 2024).
/// 3. Taxable gain cannot be negative after set-off.
pub fn verify_itr_invariants(report: &TaxReport) -> Result<(), TaxInvariantError> {
    let table_f = report
        .summary
        .table_f
        .as_ref()
        .ok_or(TaxInvariantError::MissingTableF)?;

    let quarterly_sum: Money = table_f.quarters.values().map(|q| q.total_gain).sum();
    let net_realized = report.summary.realized.total;

    if quarterly_sum != net_realized {
        return Err(TaxInvariantError::QuarterlyMismatch {
            quarterly_sum,
            net_realized,
        });
    }

    if report.exempt_ltcg_112a.is_negative() {
        return Err(TaxInvariantError::NegativeExemption {
            claimed: report.exempt_ltcg_112a,
        });
    }

    let limit = get_112a_statutory_limit(&report.financial_year);
    if report.exempt_ltcg_112a > limit {
        return Err(TaxInvariantError::ExemptionExceedsLimit {
            claimed: report.exempt_ltcg_112a,
            limit,
        });
    }

    if report.summary.realized.taxable_stcg.is_negative() {
        return Err(TaxInvariantError::NegativeTaxableGain {
            taxable_gain: report.summary.realized.taxable_stcg,
        });
    }
    if report.summary.realized.taxable_ltcg.is_negative() {
        return Err(TaxInvariantError::NegativeTaxableGain {
            taxable_gain: report.summary.realized.taxable_ltcg,
        });
    }
    if report.summary.realized.taxable_slab.is_negative() {
        return Err(TaxInvariantError::NegativeTaxableGain {
            taxable_gain: report.summary.realized.taxable_slab,
        });
    }
    let total_taxable = report.summary.realized.taxable_stcg
        + report.summary.realized.taxable_ltcg
        + report.summary.realized.taxable_slab;
    if total_taxable.is_negative() {
        return Err(TaxInvariantError::NegativeTaxableGain {
            taxable_gain: total_taxable,
        });
    }

    Ok(())
}

/// Result of simulating a unit redemption, including tax impact and lock-in verification.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SellSimulation {
    /// Scheme or asset name being simulated.
    pub asset_name: String,
    /// Number of units requested for redemption.
    pub units_to_sell: Units,
    /// Gross market value of the units at the redemption NAV.
    pub estimated_value: Money,
    /// Total net capital gain or loss across all matched lots (`estimated_value - cost - exit_load`).
    pub total_gain: Money,
    /// Taxable portion of the capital gain (`max(0, total_gain)`).
    pub taxable_gain: Money,
    /// Estimated statutory tax liability including 4% cess.
    pub estimated_tax: Money,
    /// Total exit load deducted from proceeds.
    pub exit_load: Money,
    /// Detailed lot-by-lot realized gain records.
    pub matched_lots: Vec<RealizedGain>,
}

/// Builds Schedule CG Table F: Advance Tax Accrual Matrix across the statutory quarters.
pub fn build_advance_tax_matrix(details: &[RealizedGain]) -> AdvanceTaxAccrualMatrix {
    let quarters_list = [
        AdvanceTaxQuarter::Q1,
        AdvanceTaxQuarter::Q2A,
        AdvanceTaxQuarter::Q2B,
        AdvanceTaxQuarter::Q3,
        AdvanceTaxQuarter::Q4,
        AdvanceTaxQuarter::Q5,
    ];

    let mut quarters = std::collections::HashMap::new();
    let mut quarter_totals = std::collections::HashMap::new();

    for q in quarters_list {
        quarters.insert(q.as_str().to_string(), TableFQuarterData::default());
        quarter_totals.insert(q.as_str().to_string(), Money::ZERO);
    }

    for g in details {
        let q = g
            .advance_tax_quarter
            .unwrap_or_else(|| AdvanceTaxQuarter::from_date(g.sell_date));
        let q_str = q.as_str().to_string();
        if let Some(data) = quarters.get_mut(&q_str) {
            match g.section {
                TaxSection::Sec111A15 => data.stcg15 += g.gain,
                TaxSection::Sec111A20 => data.stcg20 += g.gain,
                TaxSection::Sec112A10 => data.ltcg10 += g.gain,
                TaxSection::Sec112A12_5 => data.ltcg12_5 += g.gain,
                TaxSection::Sec112Debt12_5 => data.debt_ltcg12_5 += g.gain,
                TaxSection::Sec112Debt20 => data.debt_ltcg20 += g.gain,
                TaxSection::Sec50AA | TaxSection::Slab => data.slab += g.gain,
            }
            data.total_gain += g.gain;
            data.tax_before_cess += g.tax_before_cess;
            data.cess += g.cess;
            data.estimated_tax += g.estimated_tax;

            if let Some(total) = quarter_totals.get_mut(&q_str) {
                *total += g.estimated_tax;
            }
        }
    }

    AdvanceTaxAccrualMatrix {
        quarters,
        quarter_totals,
    }
}

/// Builds statutory totals grouped by TaxSection matching Schedule CG.
pub fn build_section_totals(details: &[RealizedGain]) -> SectionTotalsMap {
    let mut totals = std::collections::HashMap::new();

    for g in details {
        let sec_str = g.section.to_string();
        let entry = totals
            .entry(sec_str.clone())
            .or_insert_with(|| SectionTotalData {
                section: sec_str,
                gross_consideration: Money::ZERO,
                cost_of_acquisition: Money::ZERO,
                deemed_cost_of_acquisition: Money::ZERO,
                transfer_expenses: Money::ZERO,
                total_gain: Money::ZERO,
                tax_rate: g.tax_rate,
                tax_before_cess: Money::ZERO,
                cess: Money::ZERO,
                total_tax: Money::ZERO,
            });

        entry.gross_consideration += g.gross_consideration;
        entry.cost_of_acquisition += g.cost_of_acquisition;
        entry.deemed_cost_of_acquisition += g.deemed_cost_of_acquisition;
        entry.transfer_expenses += g.transfer_expenses;
        entry.total_gain += g.gain;
        entry.tax_before_cess += g.tax_before_cess;
        entry.cess += g.cess;
        entry.total_tax += g.estimated_tax;
    }

    totals
}

/// Applies statutory capital loss set-off rules:
/// Applies statutory capital loss set-off rules under Section 70 of the Income Tax Act, 1961:
/// 1. LTCL can ONLY set off LTCG.
/// 2. STCL can set off both STCG and LTCG.
///
/// Returns (taxable_stcg, taxable_ltcg).
pub fn apply_capital_loss_set_off(realized_stcg: Money, realized_ltcg: Money) -> (Money, Money) {
    let (stcg, ltcg, _) =
        apply_capital_loss_set_off_with_slab(realized_stcg, realized_ltcg, Money::ZERO);
    (stcg, ltcg)
}

/// Applies Section 70 loss set-off rules including Section 50AA deemed short-term capital gains/losses.
///
/// Section 50AA gains/losses are statutorily deemed as short-term capital gains/losses.
/// Returns `(taxable_stcg, taxable_ltcg, taxable_slab)`.
pub fn apply_capital_loss_set_off_with_slab(
    realized_stcg: Money,
    realized_ltcg: Money,
    realized_slab: Money,
) -> (Money, Money, Money) {
    let mut total_stcl = Money::ZERO;
    let mut stcg = Money::ZERO;
    let mut slab_gain = Money::ZERO;

    if realized_stcg.is_negative() {
        total_stcl += realized_stcg.abs();
    } else {
        stcg = realized_stcg;
    }

    if realized_slab.is_negative() {
        total_stcl += realized_slab.abs();
    } else {
        slab_gain = realized_slab;
    }

    let ltcl = if realized_ltcg.is_negative() {
        realized_ltcg.abs()
    } else {
        Money::ZERO
    };
    let mut ltcg = if realized_ltcg.is_positive() {
        realized_ltcg
    } else {
        Money::ZERO
    };

    // 1. LTCL can ONLY set off LTCG
    let set_off_lt = ltcg.min(ltcl);
    ltcg -= set_off_lt;

    // 2. STCL can set off Slab STCG first (highest tax efficiency), then Equity STCG, then LTCG
    let mut remaining_stcl = total_stcl;

    let set_off_slab = slab_gain.min(remaining_stcl);
    slab_gain -= set_off_slab;
    remaining_stcl -= set_off_slab;

    let set_off_st = stcg.min(remaining_stcl);
    stcg -= set_off_st;
    remaining_stcl -= set_off_st;

    let set_off_st_lt = ltcg.min(remaining_stcl);
    ltcg -= set_off_st_lt;

    (stcg, ltcg, slab_gain)
}

/// Calculates portfolio-level realized and unrealized tax across all transactions in a scheme/folio,
/// with an explicit valuation date `as_of`.
pub fn calculate_portfolio_tax_with_as_of(
    asset_name: &str,
    asset_type: AssetType,
    transactions: &[Transaction],
    current_nav: Nav,
    tax_slab: Decimal,
    grandfather_nav: Option<Nav>,
    as_of: Option<NaiveDate>,
) -> TaxPortfolioSummary {
    let (active_lots, depletions) = process_fifo_lots(transactions);

    let mut realized_stcg = Money::ZERO;
    let mut realized_ltcg = Money::ZERO;
    let mut realized_slab = Money::ZERO;
    let mut realized_details = Vec::new();

    for d in depletions {
        let buy_lot = BuyLot::new(d.lot_purchase_date, d.units, d.purchase_nav, d.cost_basis);

        let gain_record = calculate_gain(
            asset_name,
            asset_type,
            &buy_lot,
            d.units,
            d.redemption_nav,
            d.redemption_date,
            tax_slab,
            grandfather_nav,
        );

        match gain_record.tax_type {
            TaxType::Ltcg => realized_ltcg += gain_record.gain,
            TaxType::Stcg => realized_stcg += gain_record.gain,
            TaxType::Slab => realized_slab += gain_record.gain,
        }

        realized_details.push(gain_record);
    }

    let (taxable_stcg, taxable_ltcg, taxable_slab) =
        apply_capital_loss_set_off_with_slab(realized_stcg, realized_ltcg, realized_slab);

    let as_of_date = as_of.unwrap_or_else(|| chrono::Utc::now().date_naive());
    let is_eq = is_equity(asset_type, asset_name);

    let mut u_stcg = Money::ZERO;
    let mut u_ltcg = Money::ZERO;
    let mut u_slab = Money::ZERO;
    let mut unrealized_total = Money::ZERO;

    for lot in &active_lots {
        if lot.remaining_units.is_zero() || lot.remaining_units.is_negative() {
            continue;
        }

        let (deemed_cost, _, _, _, _) = compute_deemed_cost(
            lot.purchase_date,
            as_of_date,
            lot.remaining_units,
            lot.purchase_nav,
            current_nav,
            grandfather_nav,
            is_eq,
            false,
        );

        let current_val = current_nav * lot.remaining_units;
        let gain = current_val - deemed_cost;
        unrealized_total += gain;

        let classification =
            TaxClassification::classify(is_eq, lot.purchase_date, as_of_date, tax_slab);
        match classification.tax_type {
            TaxType::Ltcg => u_ltcg += gain,
            TaxType::Stcg => u_stcg += gain,
            TaxType::Slab => u_slab += gain,
        }
    }

    let has_synthetic_anchors = false;

    let table_f = build_advance_tax_matrix(&realized_details);
    let section_totals = build_section_totals(&realized_details);

    TaxPortfolioSummary {
        has_synthetic_anchors,
        realized: TaxCategorySummary {
            stcg: realized_stcg,
            ltcg: realized_ltcg,
            slab: realized_slab,
            total: realized_stcg + realized_ltcg + realized_slab,
            taxable_stcg,
            taxable_ltcg,
            taxable_slab,
            details: realized_details,
        },
        unrealized: TaxCategorySummary {
            stcg: u_stcg,
            ltcg: u_ltcg,
            slab: u_slab,
            total: unrealized_total,
            taxable_stcg: if u_stcg.is_positive() {
                u_stcg
            } else {
                Money::ZERO
            },
            taxable_ltcg: if u_ltcg.is_positive() {
                u_ltcg
            } else {
                Money::ZERO
            },
            taxable_slab: if u_slab.is_positive() {
                u_slab
            } else {
                Money::ZERO
            },
            details: Vec::new(),
        },
        table_f: Some(table_f),
        section_totals: Some(section_totals),
    }
}

/// Calculates portfolio-level realized and unrealized tax across all transactions in a scheme/folio.
pub fn calculate_portfolio_tax(
    asset_name: &str,
    asset_type: AssetType,
    transactions: &[Transaction],
    current_nav: Nav,
    tax_slab: Decimal,
    grandfather_nav: Option<Nav>,
) -> TaxPortfolioSummary {
    calculate_portfolio_tax_with_as_of(
        asset_name,
        asset_type,
        transactions,
        current_nav,
        tax_slab,
        grandfather_nav,
        None,
    )
}

/// Calculates unrealized capital gains tax liability across active holdings.
pub fn calculate_unrealized_tax(
    asset_name: &str,
    asset_type: AssetType,
    transactions: &[Transaction],
    current_nav: Nav,
    tax_slab: Decimal,
    as_of: Option<NaiveDate>,
    grandfather_nav: Option<Nav>,
) -> Money {
    let as_of_date = as_of.unwrap_or_else(|| chrono::Utc::now().date_naive());
    let summary = calculate_portfolio_tax_with_as_of(
        asset_name,
        asset_type,
        transactions,
        current_nav,
        tax_slab,
        grandfather_nav,
        Some(as_of_date),
    );

    let is_eq = is_equity(asset_type, asset_name);
    let is_post_budget = as_of_date >= BUDGET_2024_DATE;

    let stcg_rate = if is_eq {
        if is_post_budget {
            RATE_EQUITY_STCG_POST_BUDGET
        } else {
            RATE_EQUITY_STCG_PRE_BUDGET
        }
    } else {
        tax_slab
    };

    let ltcg_rate = if is_eq || is_post_budget {
        if is_post_budget {
            RATE_EQUITY_LTCG_POST_BUDGET
        } else {
            RATE_EQUITY_LTCG_PRE_BUDGET
        }
    } else {
        RATE_DEBT_LTCG_PRE_BUDGET
    };

    let mut estimated_tax = Money::ZERO;

    if summary.unrealized.stcg.is_positive() {
        estimated_tax += Money::new(summary.unrealized.stcg.to_decimal() * stcg_rate);
    }
    if summary.unrealized.ltcg.is_positive() {
        estimated_tax += Money::new(summary.unrealized.ltcg.to_decimal() * ltcg_rate);
    }
    if summary.unrealized.slab.is_positive() {
        estimated_tax += Money::new(summary.unrealized.slab.to_decimal() * tax_slab);
    }

    if estimated_tax.is_negative() {
        Money::ZERO
    } else {
        estimated_tax
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used, clippy::panic)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn date(year: i32, month: u32, day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(year, month, day).expect("valid test date")
    }

    fn dec(s: &str) -> Decimal {
        Decimal::from_str(s).expect("valid decimal")
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

    // 1. Section 112A deemed cost when sell_nav > fmv > buy_nav
    #[test]
    fn test_section_112a_sell_greater_than_fmv_greater_than_buy() {
        let buy_lot = BuyLot::new(date(2017, 3, 1), units("100"), nav("50"), money("5000"));
        let fmv = nav("100");
        let sell_nav = nav("150");
        let sell_date = date(2024, 8, 1);

        let gain = calculate_gain(
            "Bluechip Growth Fund",
            AssetType::MutualFund,
            &buy_lot,
            units("100"),
            sell_nav,
            sell_date,
            dec("0.3"),
            Some(fmv),
        );

        // Deemed unit cost = max(50, min(100, 150)) = 100
        // Deemed total cost = 100 * 100 = 10,000
        // Gross consideration = 100 * 150 = 15,000
        // Taxable gain = 15,000 - 10,000 = 5,000
        assert!(gain.is_grandfathered);
        assert_eq!(gain.deemed_cost_of_acquisition, money("10000"));
        assert_eq!(gain.gain, money("5000"));
        assert_eq!(gain.tax_type, TaxType::Ltcg);
        assert_eq!(gain.section, TaxSection::Sec112A12_5);
    }

    // 2. Section 112A deemed cost when sell_nav < fmv (loss limitation rule)
    #[test]
    fn test_section_112a_sell_less_than_fmv_loss_limitation() {
        let buy_lot = BuyLot::new(date(2017, 3, 1), units("100"), nav("50"), money("5000"));
        let fmv = nav("100");
        let sell_nav = nav("80");
        let sell_date = date(2024, 8, 1);

        let gain = calculate_gain(
            "Bluechip Growth Fund",
            AssetType::MutualFund,
            &buy_lot,
            units("100"),
            sell_nav,
            sell_date,
            dec("0.3"),
            Some(fmv),
        );

        // Deemed unit cost = max(50, min(100, 80)) = max(50, 80) = 80
        // Deemed total cost = 100 * 80 = 8,000
        // Gross consideration = 100 * 80 = 8,000
        // Taxable gain = 0 (no artificial loss permitted)
        assert!(gain.is_grandfathered);
        assert_eq!(gain.deemed_cost_of_acquisition, money("8000"));
        assert_eq!(gain.gain, money("0"));

        // Case B: Genuine economic loss where sell_nav < buy_nav < fmv
        let sell_nav_loss = nav("40");
        let loss_gain = calculate_gain(
            "Bluechip Growth Fund",
            AssetType::MutualFund,
            &buy_lot,
            units("100"),
            sell_nav_loss,
            sell_date,
            dec("0.3"),
            Some(fmv),
        );
        // Deemed unit cost = max(50, min(100, 40)) = max(50, 40) = 50
        // Deemed total cost = 100 * 50 = 5,000
        // Gross consideration = 100 * 40 = 4,000
        // Gain = 4,000 - 5,000 = -1,000 (actual economic loss allowed)
        assert!(loss_gain.is_grandfathered);
        assert_eq!(loss_gain.deemed_cost_of_acquisition, money("5000"));
        assert_eq!(loss_gain.gain, money("-1000"));
    }

    // 3. Section 112A when bought after Jan 31 2018 (not grandfathered)
    #[test]
    fn test_section_112a_bought_after_jan_31_2018_not_grandfathered() {
        let buy_lot = BuyLot::new(date(2018, 2, 1), units("100"), nav("50"), money("5000"));
        let fmv = nav("100");
        let sell_nav = nav("150");
        let sell_date = date(2024, 8, 1);

        let gain = calculate_gain(
            "Bluechip Growth Fund",
            AssetType::MutualFund,
            &buy_lot,
            units("100"),
            sell_nav,
            sell_date,
            dec("0.3"),
            Some(fmv),
        );

        // Acquired after 31-Jan-2018: Grandfathering does not apply!
        // Deemed cost = 100 * 50 = 5,000
        // Gross consideration = 100 * 150 = 15,000
        // Gain = 10,000
        assert!(!gain.is_grandfathered);
        assert_eq!(gain.deemed_cost_of_acquisition, money("5000"));
        assert_eq!(gain.gain, money("10000"));
    }

    // 4. ELSS lock-in date calculations across leap years
    #[test]
    fn test_elss_lock_in_date_calculations_across_leap_years() {
        // Purchased on leap day: 2020-02-29
        let leap_buy = date(2020, 2, 29);
        let expiry = elss_lock_in_expiry(leap_buy);
        // 2023 is non-leap year: matures on Feb 28, 2023
        assert_eq!(expiry, date(2023, 2, 28));

        assert!(is_lot_locked(leap_buy, date(2023, 2, 27)));
        assert!(!is_lot_locked(leap_buy, date(2023, 2, 28)));
        assert!(!is_lot_locked(leap_buy, date(2023, 3, 1)));

        // Purchased on Feb 28 in non-leap year: 2021-02-28
        let non_leap_buy = date(2021, 2, 28);
        let expiry_2024 = elss_lock_in_expiry(non_leap_buy);
        // 2024 is leap year: matures on Feb 28, 2024
        assert_eq!(expiry_2024, date(2024, 2, 28));
    }

    // 5. Debt post-April 2023 taxation classification
    #[test]
    fn test_debt_post_april_2023_taxation_classification() {
        // Post 01-Apr-2023 purchase: Section 50AA applies (Slab rate regardless of holding period)
        let new_debt_lot =
            BuyLot::new(date(2023, 4, 2), units("1000"), nav("100"), money("100000"));
        let sell_nav = nav("130");
        // Held for 4 years (well over 3 years)
        let sell_date = date(2027, 4, 2);

        let gain_new = calculate_gain(
            "Corporate Bond Debt Fund",
            AssetType::MutualFund,
            &new_debt_lot,
            units("1000"),
            sell_nav,
            sell_date,
            dec("0.30"),
            None,
        );

        assert_eq!(gain_new.tax_type, TaxType::Slab);
        assert_eq!(gain_new.section, TaxSection::Sec50AA);
        assert_eq!(gain_new.holding_type, HoldingType::ShortTerm);
        assert!(!gain_new.is_grandfathered);

        // Pre 01-Apr-2023 purchase: Eligible for LTCG with indexation / lower rate
        let old_debt_lot =
            BuyLot::new(date(2022, 1, 1), units("1000"), nav("100"), money("100000"));
        let gain_old = calculate_gain(
            "Corporate Bond Debt Fund",
            AssetType::MutualFund,
            &old_debt_lot,
            units("1000"),
            sell_nav,
            date(2025, 2, 1), // > 3 years, post Budget 2024
            dec("0.30"),
            None,
        );

        assert_eq!(gain_old.tax_type, TaxType::Ltcg);
        assert_eq!(gain_old.section, TaxSection::Sec112Debt12_5);
        assert_eq!(gain_old.holding_type, HoldingType::LongTerm);
        assert!(gain_old.is_grandfathered);
    }
}
