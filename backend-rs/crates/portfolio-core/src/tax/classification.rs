//! Unified statutory tax classification and capital gains lot categorization.
//!
//! Evaluates transactions and holding lots against Indian statutory tax provisions:
//!
//! 1. **Holding Period Thresholds**:
//!    - **Equity & Equity Mutual Funds**: 12 calendar months (Section 2(42A)).
//!    - **Debt Mutual Funds (Pre-Budget 2024)**: 36 calendar months.
//!    - **Debt Mutual Funds (Post-Budget 2024, >= 23-Jul-2024)**: 24 calendar months.
//!
//! 2. **Finance Act 2023 Section 50AA (Debt Mutual Fund Regime)**:
//!    - Debt mutual funds acquired on or after 01-Apr-2023 are statutorily deemed as short-term capital
//!      assets, with capital gains taxed at the investor's applicable marginal income tax slab rate.
//!
//! 3. **Union Budget 2024 Statutory Rate Cutoff (23-Jul-2024)**:
//!    - **Equity LTCG (Section 112A)**: 12.5% for sales on/after 23-Jul-2024 (previously 10%).
//!    - **Equity STCG (Section 111A)**: 20.0% for sales on/after 23-Jul-2024 (previously 15%).
//!    - **Pre-50AA Debt LTCG (Section 112)**: 12.5% without indexation on/after 23-Jul-2024 (previously 20% with indexation).

use chrono::NaiveDate;
use rust_decimal::Decimal;

use crate::tax::constants::*;
use crate::tax::{HoldingType, TaxSection, TaxType};

/// Unified statutory classification result for a transaction or holding lot.
///
/// Encapsulates the holding period, tax classification, statutory section, and nominal tax rate.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TaxClassification {
    /// Long-Term vs Short-Term asset holding classification.
    pub holding_type: HoldingType,
    /// Tax treatment category: LTCG, STCG, or Slab income.
    pub tax_type: TaxType,
    /// Statutory section under the Indian Income Tax Act, 1961 (e.g. 112A, 111A, 50AA).
    pub section: TaxSection,
    /// Nominal statutory tax rate before health and education cess (e.g. `0.125` for 12.5%).
    pub tax_rate: Decimal,
    /// Exact elapsed calendar days between acquisition and realization.
    pub holding_days: i64,
}

impl TaxClassification {
    /// Classifies an asset holding or transaction lot based on Indian Income Tax statutory rules.
    ///
    /// # Statutory Logic:
    /// 1. **Holding Period Determination**:
    ///    - Equity: Checks if `realization_date >= purchase_date + 12 months` using calendar month arithmetic.
    ///    - Debt: Checks against 24 months (if realized on/after 23-Jul-2024) or 36 months (prior to 23-Jul-2024).
    /// 2. **Equity Classification**:
    ///    - Long-Term: [`TaxSection::Sec112A12_5`] (12.5%) post-Budget 2024, or [`TaxSection::Sec112A10`] (10%) pre-Budget 2024.
    ///    - Short-Term: [`TaxSection::Sec111A20`] (20%) post-Budget 2024, or [`TaxSection::Sec111A15`] (15%) pre-Budget 2024.
    /// 3. **Debt Classification**:
    ///    - Acquired on/after 01-Apr-2023: Statutorily deemed short-term under **Section 50AA**, taxed at `tax_slab`.
    ///    - Acquired before 01-Apr-2023 (Grandfathered under pre-50AA rules):
    ///      - Long-Term: [`TaxSection::Sec112Debt12_5`] (12.5%) post-Budget 2024, or [`TaxSection::Sec112Debt20`] (20% indexed) pre-Budget 2024.
    ///      - Short-Term: Taxed at `tax_slab`.
    ///
    /// # Arguments
    /// * `is_equity` - Whether the underlying security is classified as an equity asset.
    /// * `purchase_date` - Date of lot acquisition.
    /// * `realization_date` - Date of lot redemption, sale, or portfolio valuation as-of date.
    /// * `tax_slab` - Investor's marginal income tax slab rate (e.g. `0.30` for 30%).
    pub fn classify(
        is_equity: bool,
        purchase_date: NaiveDate,
        realization_date: NaiveDate,
        tax_slab: Decimal,
    ) -> Self {
        let holding_days = (realization_date - purchase_date).num_days();
        let is_post_budget_2024 = realization_date >= BUDGET_2024_DATE;
        let is_post_debt_regime = purchase_date >= DEBT_NEW_REGIME_DATE;

        // Holding period threshold evaluation using calendar-month addition (preserves leap-year accuracy)
        let is_ltcg = if is_equity {
            let anniversary = purchase_date
                .checked_add_months(chrono::Months::new(12))
                .unwrap_or(purchase_date + chrono::Duration::days(365));
            realization_date >= anniversary
        } else {
            let threshold_months = if is_post_budget_2024 { 24 } else { 36 };
            let anniversary = purchase_date
                .checked_add_months(chrono::Months::new(threshold_months))
                .unwrap_or(purchase_date + chrono::Duration::days(threshold_months as i64 * 30));
            realization_date >= anniversary
        };

        let (holding_type, tax_type, section, tax_rate) = if is_equity {
            if is_ltcg {
                let (sec, rate) = if is_post_budget_2024 {
                    (TaxSection::Sec112A12_5, RATE_EQUITY_LTCG_POST_BUDGET)
                } else {
                    (TaxSection::Sec112A10, RATE_EQUITY_LTCG_PRE_BUDGET)
                };
                (HoldingType::LongTerm, TaxType::Ltcg, sec, rate)
            } else {
                let (sec, rate) = if is_post_budget_2024 {
                    (TaxSection::Sec111A20, RATE_EQUITY_STCG_POST_BUDGET)
                } else {
                    (TaxSection::Sec111A15, RATE_EQUITY_STCG_PRE_BUDGET)
                };
                (HoldingType::ShortTerm, TaxType::Stcg, sec, rate)
            }
        } else if is_post_debt_regime {
            // Finance Act 2023 Sec 50AA: All debt mutual funds purchased >= 01-Apr-2023 are taxed at slab rates
            (
                HoldingType::ShortTerm,
                TaxType::Slab,
                TaxSection::Sec50AA,
                tax_slab,
            )
        } else {
            // Pre-01-Apr-2023 debt funds: indexation / LTCG threshold
            if is_ltcg {
                let (sec, rate) = if is_post_budget_2024 {
                    (TaxSection::Sec112Debt12_5, RATE_DEBT_LTCG_POST_BUDGET)
                } else {
                    (TaxSection::Sec112Debt20, RATE_DEBT_LTCG_PRE_BUDGET)
                };
                (HoldingType::LongTerm, TaxType::Ltcg, sec, rate)
            } else {
                (
                    HoldingType::ShortTerm,
                    TaxType::Slab,
                    TaxSection::Slab,
                    tax_slab,
                )
            }
        };

        Self {
            holding_type,
            tax_type,
            section,
            tax_rate,
            holding_days,
        }
    }
}
