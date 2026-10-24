//! Unified statutory tax classification and capital gains lot categorization.
//!
//! Evaluates:
//! - Holding period against statutory equity (365 days) and debt (730 / 1095 days) thresholds.
//! - Finance Act 2023 Section 50AA debt mutual fund regime (purchases on/after 01-Apr-2023).
//! - Pre vs Post Budget 2024 (23-Jul-2024) rates for equity and debt.

use chrono::NaiveDate;
use rust_decimal::Decimal;

use crate::tax::constants::*;
use crate::tax::{HoldingType, TaxSection, TaxType};

/// Unified statutory classification result for a transaction or holding lot.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TaxClassification {
    pub holding_type: HoldingType,
    pub tax_type: TaxType,
    pub section: TaxSection,
    pub tax_rate: Decimal,
    pub holding_days: i64,
}

impl TaxClassification {
    /// Classifies an asset holding or transaction lot based on Indian Income Tax rules.
    pub fn classify(
        is_equity: bool,
        purchase_date: NaiveDate,
        realization_date: NaiveDate,
        tax_slab: Decimal,
    ) -> Self {
        let holding_days = (realization_date - purchase_date).num_days();
        let is_post_budget_2024 = realization_date >= BUDGET_2024_DATE;
        let is_post_debt_regime = purchase_date >= DEBT_NEW_REGIME_DATE;

        let (holding_type, tax_type, section, tax_rate) = if is_equity {
            if holding_days >= HOLDING_DAYS_EQUITY_LTCG {
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
            let lt_threshold = if is_post_budget_2024 {
                HOLDING_DAYS_DEBT_LTCG_POST_BUDGET
            } else {
                HOLDING_DAYS_DEBT_LTCG_PRE_BUDGET
            };
            if holding_days >= lt_threshold {
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
