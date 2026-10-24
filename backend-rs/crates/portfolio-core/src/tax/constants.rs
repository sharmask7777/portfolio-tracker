//! Statutory tax dates, rates, and holding period thresholds.
//!
//! Centralizes Indian Income Tax Act capital gains statutory parameters:
//! - Section 112A / Section 55(2)(ac) LTCG Grandfathering (31 January 2018).
//! - Finance Act 2023 Section 50AA Debt Mutual Fund regime (01 April 2023).
//! - Finance (No. 2) Act 2024 / Budget 2024 effective enactment (23 July 2024).
//! - Statutory tax rates, health & education cess (4%), and annual exemption limits.

use chrono::NaiveDate;
use rust_decimal::Decimal;

use crate::types::Money;

/// Statutory date for Section 55(2)(ac) LTCG Grandfathering (31 January 2018).
pub const GRANDFATHER_DATE: NaiveDate = match NaiveDate::from_ymd_opt(2018, 1, 31) {
    Some(d) => d,
    None => panic!("invalid statutory grandfather date"),
};

/// Budget 2024 effective enactment date (23 July 2024).
pub const BUDGET_2024_DATE: NaiveDate = match NaiveDate::from_ymd_opt(2024, 7, 23) {
    Some(d) => d,
    None => panic!("invalid budget 2024 date"),
};

/// Finance Act 2023 Section 50AA effective purchase date for specified mutual funds (01 April 2023).
pub const DEBT_NEW_REGIME_DATE: NaiveDate = match NaiveDate::from_ymd_opt(2023, 4, 1) {
    Some(d) => d,
    None => panic!("invalid debt regime date"),
};

/// Statutory Health and Education Cess rate (4%).
pub const CESS_RATE: Decimal = Decimal::from_parts(4, 0, 0, false, 2);

/// Section 111A STCG tax rate pre-Budget 2024 (15%).
pub const RATE_EQUITY_STCG_PRE_BUDGET: Decimal = Decimal::from_parts(15, 0, 0, false, 2);

/// Section 111A STCG tax rate post-Budget 2024 (20%).
pub const RATE_EQUITY_STCG_POST_BUDGET: Decimal = Decimal::from_parts(20, 0, 0, false, 2);

/// Section 112A LTCG tax rate pre-Budget 2024 (10%).
pub const RATE_EQUITY_LTCG_PRE_BUDGET: Decimal = Decimal::from_parts(10, 0, 0, false, 2);

/// Section 112A LTCG tax rate post-Budget 2024 (12.5%).
pub const RATE_EQUITY_LTCG_POST_BUDGET: Decimal = Decimal::from_parts(125, 0, 0, false, 3);

/// Section 112 Debt LTCG tax rate pre-Budget 2024 (20% with indexation).
pub const RATE_DEBT_LTCG_PRE_BUDGET: Decimal = Decimal::from_parts(20, 0, 0, false, 2);

/// Section 112 Debt LTCG tax rate post-Budget 2024 (12.5% without indexation).
pub const RATE_DEBT_LTCG_POST_BUDGET: Decimal = Decimal::from_parts(125, 0, 0, false, 3);

/// Holding period threshold for Equity Long-Term Capital Gains (365 days / 1 year).
pub const HOLDING_DAYS_EQUITY_LTCG: i64 = 365;

/// Holding period threshold for Debt Long-Term Capital Gains pre-Budget 2024 (1095 days / 3 years).
pub const HOLDING_DAYS_DEBT_LTCG_PRE_BUDGET: i64 = 1095;

/// Holding period threshold for Debt Long-Term Capital Gains post-Budget 2024 (730 days / 2 years).
pub const HOLDING_DAYS_DEBT_LTCG_POST_BUDGET: i64 = 730;

/// Annual LTCG statutory tax exemption under Section 112A (Post-Budget 2024: ₹1,25,000).
pub const LTCG_EXEMPTION_LIMIT_BUDGET_2024_DECIMAL: Decimal =
    Decimal::from_parts(125000, 0, 0, false, 0);

/// Annual LTCG statutory tax exemption under Section 112A (Pre-Budget 2024: ₹1,00,000).
pub const LTCG_EXEMPTION_LIMIT_PRE_BUDGET_2024_DECIMAL: Decimal =
    Decimal::from_parts(100000, 0, 0, false, 0);

/// Legacy alias for post-Budget 2024 LTCG tax rate (12.5%).
pub const LTCG_TAX_RATE_BUDGET_2024: Decimal = RATE_EQUITY_LTCG_POST_BUDGET;

/// Helper returning post-Budget 2024 LTCG exemption limit as Money.
pub fn ltcg_exemption_limit_budget_2024() -> Money {
    Money::new(LTCG_EXEMPTION_LIMIT_BUDGET_2024_DECIMAL)
}

/// Helper returning pre-Budget 2024 LTCG exemption limit as Money.
pub fn ltcg_exemption_limit_pre_budget_2024() -> Money {
    Money::new(LTCG_EXEMPTION_LIMIT_PRE_BUDGET_2024_DECIMAL)
}
