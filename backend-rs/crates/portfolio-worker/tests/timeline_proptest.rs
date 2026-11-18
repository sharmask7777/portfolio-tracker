//! Property-based tests for timeline checkpoint policy invariants.

use chrono::{Datelike, Days, NaiveDate, Weekday};
use portfolio_worker::jobs::timeline_policy::{
    is_checkpoint_date, is_first_day_of_month, is_last_day_of_month,
};
use proptest::prelude::*;

proptest! {
    #[test]
    fn prop_transaction_dates_are_always_checkpoints(
        year in 2015i32..2030i32,
        month in 1u32..=12u32,
        day in 1u32..=28u32,
        today_offset in 0u64..1000u64,
    ) {
        if let (Some(date), Some(today)) = (
            NaiveDate::from_ymd_opt(year, month, day),
            NaiveDate::from_ymd_opt(year, month, day).and_then(|d| d.checked_add_days(Days::new(today_offset))),
        ) {
            // Invariant: any date with a transaction MUST evaluate to true
            prop_assert!(is_checkpoint_date(date, today, true));
        }
    }

    #[test]
    fn prop_month_boundaries_are_always_checkpoints(
        year in 2015i32..2030i32,
        month in 1u32..=12u32,
        today_offset in 0u64..1000u64,
    ) {
        if let Some(first_of_month) = NaiveDate::from_ymd_opt(year, month, 1)
            && let Some(today) = first_of_month.checked_add_days(Days::new(today_offset))
        {
            prop_assert!(is_first_day_of_month(first_of_month));
            prop_assert!(is_checkpoint_date(first_of_month, today, false));

            // Last day of month
            let next_month_opt = if month == 12 {
                NaiveDate::from_ymd_opt(year + 1, 1, 1)
            } else {
                NaiveDate::from_ymd_opt(year, month + 1, 1)
            };
            if let Some(next_month) = next_month_opt
                && let Some(last_of_month) = next_month.pred_opt()
            {
                prop_assert!(is_last_day_of_month(last_of_month));
                prop_assert!(is_checkpoint_date(last_of_month, today, false));
            }
        }
    }

    #[test]
    fn prop_recent_days_within_90_days_are_always_checkpoints(
        days_ago in 0u64..=90u64,
    ) {
        let today = NaiveDate::from_ymd_opt(2026, 11, 18).expect("valid test date");
        if let Some(date) = today.checked_sub_days(Days::new(days_ago)) {
            prop_assert!(is_checkpoint_date(date, today, false));
        }
    }

    #[test]
    fn prop_fridays_older_than_90_days_are_always_checkpoints(
        weeks_ago in 14u64..200u64,
    ) {
        let today = NaiveDate::from_ymd_opt(2026, 11, 18).expect("valid test date");
        let days = weeks_ago * 7;
        if let Some(mut date) = today.checked_sub_days(Days::new(days)) {
            // Advance to closest Friday
            while date.weekday() != Weekday::Fri {
                if let Some(next_day) = date.succ_opt() {
                    date = next_day;
                } else {
                    break;
                }
            }

            prop_assert!(is_checkpoint_date(date, today, false));
        }
    }
}
