//! Granular timeline policy for historical portfolio valuation reconstruction.

use chrono::{Datelike, Days, NaiveDate, Weekday};

/// Determines whether a given date requires a valuation checkpoint record.
///
/// Statutory and financial invariants enforced:
/// 1. **Transaction Dates**: Any date containing a trade/cashflow is strictly a checkpoint date.
/// 2. **Month Boundaries**: The first day and the last day of every month are mandatorily checkpoints,
///    ensuring accurate monthly, quarterly, and statutory FY reporting.
/// 3. **Recent Granularity (< 90 days from today)**: Every calendar day within the last 3 months
///    is recorded to provide fine-grained day-to-day visualization.
/// 4. **Long-Term Weekly Snapshots (>= 90 days from today)**: Every Friday is recorded to ensure
///    weekly market mark-to-market progression without artificial cliffs.
pub fn is_checkpoint_date(date: NaiveDate, today: NaiveDate, has_transaction: bool) -> bool {
    // 1. Transaction dates are always checkpoints
    if has_transaction {
        return true;
    }

    // 2. First day and last day of every month are mandatory
    if is_first_day_of_month(date) || is_last_day_of_month(date) {
        return true;
    }

    // 3. Last 3 months (90 days) from today: every single day
    let three_months_ago = today.checked_sub_days(Days::new(90)).unwrap_or(today);
    if date >= three_months_ago && date <= today {
        return true;
    }

    // 4. Older than 3 months: every Friday
    if date.weekday() == Weekday::Fri {
        return true;
    }

    false
}

/// Returns true if `date` is the first day of its month (day == 1).
#[inline]
pub fn is_first_day_of_month(date: NaiveDate) -> bool {
    date.day() == 1
}

/// Returns true if `date` is the last calendar day of its month.
#[inline]
pub fn is_last_day_of_month(date: NaiveDate) -> bool {
    let next_day = date.succ_opt();
    match next_day {
        Some(d) => d.day() == 1,
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_checkpoint_policy_rules() {
        let today = NaiveDate::from_ymd_opt(2026, 11, 18).expect("valid today date");

        // 1. Transaction date must always be true
        let old_wednesday = NaiveDate::from_ymd_opt(2024, 5, 15).expect("valid wednesday date");
        assert_eq!(old_wednesday.weekday(), Weekday::Wed);
        assert!(!is_checkpoint_date(old_wednesday, today, false));
        assert!(is_checkpoint_date(old_wednesday, today, true));

        // 2. Month boundaries (first and last day)
        let may_first = NaiveDate::from_ymd_opt(2024, 5, 1).expect("valid may 1 date");
        assert!(is_checkpoint_date(may_first, today, false));

        let may_last = NaiveDate::from_ymd_opt(2024, 5, 31).expect("valid may 31 date");
        assert!(is_checkpoint_date(may_last, today, false));

        let feb_leap = NaiveDate::from_ymd_opt(2024, 2, 29).expect("valid feb 29 date");
        assert!(is_checkpoint_date(feb_leap, today, false));

        // 3. Friday older than 3 months
        let old_friday = NaiveDate::from_ymd_opt(2024, 5, 17).expect("valid friday date");
        assert_eq!(old_friday.weekday(), Weekday::Fri);
        assert!(is_checkpoint_date(old_friday, today, false));

        // 4. Any day in last 90 days
        let recent_tuesday = NaiveDate::from_ymd_opt(2026, 10, 20).expect("valid recent date");
        assert_eq!(recent_tuesday.weekday(), Weekday::Tue);
        assert!(is_checkpoint_date(recent_tuesday, today, false));
    }
}
