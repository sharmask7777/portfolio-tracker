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

/// Returns the Indian Financial Year start year (e.g. `2024` for FY 2024-25) for a given date.
pub fn financial_year_start_year(date: NaiveDate) -> i32 {
    use chrono::Datelike;
    if date.month() >= 4 {
        date.year()
    } else {
        date.year() - 1
    }
}

/// Returns the official CBDT Cost Inflation Index (CII) for a given Financial Year start year
/// (e.g. `2001` for FY 2001-02 = 100, `2024` for FY 2024-25 = 363, `2025` for FY 2025-26 = 376).
pub fn cost_inflation_index(fy_start_year: i32) -> Option<u32> {
    match fy_start_year {
        2001 => Some(100),
        2002 => Some(105),
        2003 => Some(109),
        2004 => Some(113),
        2005 => Some(117),
        2006 => Some(122),
        2007 => Some(129),
        2008 => Some(137),
        2009 => Some(148),
        2010 => Some(167),
        2011 => Some(184),
        2012 => Some(200),
        2013 => Some(220),
        2014 => Some(240),
        2015 => Some(254),
        2016 => Some(264),
        2017 => Some(272),
        2018 => Some(280),
        2019 => Some(289),
        2020 => Some(301),
        2021 => Some(317),
        2022 => Some(331),
        2023 => Some(348),
        2024 => Some(363),
        2025 => Some(376),
        _ => None,
    }
}
