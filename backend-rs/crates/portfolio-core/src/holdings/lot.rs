//! FIFO Tax Lot tracking and depletion engine.

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::holdings::{Transaction, TransactionType};
use crate::types::{Money, Nav, Units};

/// Classification helper: transactions that add units to the folio.
pub fn is_unit_addition(tx_type: TransactionType) -> bool {
    matches!(
        tx_type,
        TransactionType::Purchase
            | TransactionType::PurchaseSip
            | TransactionType::Buy
            | TransactionType::SwitchIn
            | TransactionType::DividendReinvestment
    )
}

/// Classification helper: transactions that redeem or remove units from the folio.
pub fn is_unit_redemption(tx_type: TransactionType) -> bool {
    matches!(
        tx_type,
        TransactionType::Redemption
            | TransactionType::Sell
            | TransactionType::SwitchOut
            | TransactionType::Reversal
    )
}

/// Sorts transactions chronologically with deterministic tie-breaking.
///
/// On the same date, unit additions (buys/inflows) precede redemptions (sells),
/// followed by transaction ID tie-breaking.
pub fn sort_transactions(transactions: &[Transaction]) -> Vec<Transaction> {
    let mut sorted = transactions.to_vec();
    sorted.sort_by(|a, b| {
        a.date
            .cmp(&b.date)
            .then_with(|| {
                let a_is_sell = is_unit_redemption(a.tx_type) || a.units.is_negative();
                let b_is_sell = is_unit_redemption(b.tx_type) || b.units.is_negative();
                a_is_sell.cmp(&b_is_sell)
            })
            .then_with(|| a.id.cmp(&b.id))
    });
    sorted
}

/// An individual tax lot representing a purchase of units on a specific date.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TaxLot {
    pub purchase_date: NaiveDate,
    pub original_units: Units,
    pub remaining_units: Units,
    pub purchase_nav: Nav,
    pub purchase_amount: Money,
}

impl TaxLot {
    pub fn new(
        purchase_date: NaiveDate,
        units: Units,
        purchase_nav: Nav,
        purchase_amount: Money,
    ) -> Self {
        Self {
            purchase_date,
            original_units: units,
            remaining_units: units,
            purchase_nav,
            purchase_amount,
        }
    }

    /// Depletes up to `units_to_consume` from this lot using FIFO.
    ///
    /// Returns a tuple of `(units_consumed, cost_basis)`.
    /// `cost_basis` is computed as `units_consumed * purchase_nav`.
    pub fn deplete(&mut self, units_to_consume: Units) -> (Units, Money) {
        if self.remaining_units <= Units::ZERO || units_to_consume <= Units::ZERO {
            return (Units::ZERO, Money::ZERO);
        }

        let consumed = if units_to_consume >= self.remaining_units {
            self.remaining_units
        } else {
            units_to_consume
        };

        self.remaining_units -= consumed;
        let cost_basis = consumed * self.purchase_nav;
        (consumed, cost_basis)
    }

    /// Returns whether this lot is completely depleted (zero remaining units).
    pub fn is_depleted(&self) -> bool {
        self.remaining_units.is_zero()
    }
}

/// Record of an individual redemption matched against a lot.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LotDepletion {
    pub lot_purchase_date: NaiveDate,
    pub redemption_date: NaiveDate,
    pub units: Units,
    pub purchase_nav: Nav,
    pub redemption_nav: Nav,
    pub cost_basis: Money,
    pub proceeds: Money,
    pub realized_gain: Money,
}

/// Processes a chronological slice of transactions into active lots and closed lot depletions.
pub fn process_fifo_lots(transactions: &[Transaction]) -> (Vec<TaxLot>, Vec<LotDepletion>) {
    let sorted = sort_transactions(transactions);
    let mut lots: Vec<TaxLot> = Vec::new();
    let mut depletions: Vec<LotDepletion> = Vec::new();

    for tx in &sorted {
        let is_addition = is_unit_addition(tx.tx_type) && !tx.units.is_negative();
        let is_redemption = is_unit_redemption(tx.tx_type)
            || (is_unit_addition(tx.tx_type) && tx.units.is_negative());

        if is_addition {
            let units = tx.units.abs();
            if units.is_positive() {
                let nav = if tx.nav.is_positive() {
                    tx.nav
                } else if tx.amount.abs().is_positive() {
                    tx.amount.abs() / units
                } else {
                    Nav::ZERO
                };
                let amount = if tx.amount.abs().is_positive() {
                    tx.amount.abs()
                } else {
                    units * nav
                };
                lots.push(TaxLot::new(tx.date, units, nav, amount));
            }
        } else if is_redemption {
            let mut units_to_sell = tx.units.abs();
            let effective_nav = if tx.nav.is_positive() {
                tx.nav
            } else if tx.units.abs().is_positive() && tx.amount.abs().is_positive() {
                tx.amount.abs() / tx.units.abs()
            } else {
                Nav::ZERO
            };

            for lot in &mut lots {
                if units_to_sell.is_zero() {
                    break;
                }
                if lot.is_depleted() {
                    continue;
                }

                let (consumed, cost_basis) = lot.deplete(units_to_sell);
                units_to_sell -= consumed;

                let proceeds = consumed * effective_nav;
                let realized_gain = proceeds - cost_basis;

                depletions.push(LotDepletion {
                    lot_purchase_date: lot.purchase_date,
                    redemption_date: tx.date,
                    units: consumed,
                    purchase_nav: lot.purchase_nav,
                    redemption_nav: effective_nav,
                    cost_basis,
                    proceeds,
                    realized_gain,
                });
            }
        }
    }

    let active_lots = lots.into_iter().filter(|l| !l.is_depleted()).collect();
    (active_lots, depletions)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::str::FromStr;

    fn date(y: i32, m: u32, d: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(y, m, d).expect("valid date")
    }

    fn money(s: &str) -> Money {
        Money::from_str(s).expect("valid money")
    }

    fn units(s: &str) -> Units {
        Units::from_str(s).expect("valid units")
    }

    fn nav(s: &str) -> Nav {
        Nav::from_str(s).expect("valid nav")
    }

    #[test]
    fn test_deplete_guard_negative_and_zero_units() {
        let mut lot = TaxLot::new(date(2023, 1, 1), units("100"), nav("10"), money("1000"));

        // Deplete zero units
        let (consumed, cost) = lot.deplete(Units::ZERO);
        assert_eq!(consumed, Units::ZERO);
        assert_eq!(cost, Money::ZERO);
        assert_eq!(lot.remaining_units, units("100"));

        // Deplete negative units
        let (consumed_neg, cost_neg) = lot.deplete(units("-50"));
        assert_eq!(consumed_neg, Units::ZERO);
        assert_eq!(cost_neg, Money::ZERO);
        assert_eq!(lot.remaining_units, units("100"));
    }

    #[test]
    fn test_multi_lot_redemption_with_derived_nav() {
        let tx1 = Transaction::new(
            "tx-buy-1",
            date(2023, 1, 1),
            TransactionType::Purchase,
            money("1000"),
            units("100"),
            nav("10"),
            units("100"),
        );
        let tx2 = Transaction::new(
            "tx-buy-2",
            date(2023, 2, 1),
            TransactionType::Purchase,
            money("1500"),
            units("100"),
            nav("15"),
            units("200"),
        );
        // Redemption of 150 units with tx.nav = 0 and total amount = 3000
        let tx_sell = Transaction::new(
            "tx-sell-1",
            date(2023, 3, 1),
            TransactionType::Redemption,
            money("3000"),
            units("150"),
            Nav::ZERO,
            units("50"),
        );

        let (active_lots, depletions) = process_fifo_lots(&[tx1, tx2, tx_sell]);

        // Total proceeds must equal the transaction redemption amount (3000)
        let total_proceeds: Money = depletions.iter().map(|d| d.proceeds).sum();
        assert_eq!(total_proceeds, money("3000"));

        assert_eq!(depletions.len(), 2);

        // Lot 1 fully consumed: 100 units at purchase NAV 10, redemption NAV derived = 20
        assert_eq!(depletions[0].units, units("100"));
        assert_eq!(depletions[0].purchase_nav, nav("10"));
        assert_eq!(depletions[0].redemption_nav, nav("20"));
        assert_eq!(depletions[0].cost_basis, money("1000"));
        assert_eq!(depletions[0].proceeds, money("2000"));
        assert_eq!(depletions[0].realized_gain, money("1000"));

        // Lot 2 partially consumed: 50 units at purchase NAV 15, redemption NAV derived = 20
        assert_eq!(depletions[1].units, units("50"));
        assert_eq!(depletions[1].purchase_nav, nav("15"));
        assert_eq!(depletions[1].redemption_nav, nav("20"));
        assert_eq!(depletions[1].cost_basis, money("750"));
        assert_eq!(depletions[1].proceeds, money("1000"));
        assert_eq!(depletions[1].realized_gain, money("250"));

        // Active lots: 1 remaining lot with 50 units
        assert_eq!(active_lots.len(), 1);
        assert_eq!(active_lots[0].remaining_units, units("50"));
        assert_eq!(active_lots[0].purchase_nav, nav("15"));
    }

    #[test]
    fn test_buy_lot_nav_derivation_when_zero() {
        // Buy transaction with nav = 0, units = 100, amount = 2500
        let tx = Transaction::new(
            "tx-buy-zero-nav",
            date(2023, 1, 15),
            TransactionType::Buy,
            money("2500"),
            units("100"),
            Nav::ZERO,
            units("100"),
        );

        let (active_lots, depletions) = process_fifo_lots(&[tx]);
        assert_eq!(depletions.len(), 0);
        assert_eq!(active_lots.len(), 1);
        assert_eq!(active_lots[0].purchase_nav, nav("25"));
        assert_eq!(active_lots[0].purchase_amount, money("2500"));
        assert_eq!(active_lots[0].remaining_units, units("100"));
    }

    #[test]
    fn test_sort_transactions_same_day_buy_before_sell_and_id_tiebreak() {
        let tx_sell_b = Transaction::new(
            "tx-sell-b",
            date(2023, 5, 1),
            TransactionType::Sell,
            money("500"),
            units("50"),
            nav("10"),
            units("0"),
        );
        let tx_sell_a = Transaction::new(
            "tx-sell-a",
            date(2023, 5, 1),
            TransactionType::Redemption,
            money("500"),
            units("50"),
            nav("10"),
            units("50"),
        );
        let tx_buy_b = Transaction::new(
            "tx-buy-b",
            date(2023, 5, 1),
            TransactionType::Purchase,
            money("1000"),
            units("100"),
            nav("10"),
            units("100"),
        );
        let tx_buy_a = Transaction::new(
            "tx-buy-a",
            date(2023, 5, 1),
            TransactionType::Buy,
            money("1000"),
            units("100"),
            nav("10"),
            units("100"),
        );
        let tx_earlier = Transaction::new(
            "tx-earlier",
            date(2023, 4, 15),
            TransactionType::Purchase,
            money("500"),
            units("50"),
            nav("10"),
            units("50"),
        );

        // Put them in scrambled order
        let txs = vec![tx_sell_b, tx_buy_b, tx_earlier, tx_sell_a, tx_buy_a];
        let sorted = sort_transactions(&txs);

        let sorted_ids: Vec<&str> = sorted.iter().map(|tx| tx.id.as_str()).collect();
        // 1. tx-earlier (date 2023-04-15)
        // 2. tx-buy-a (date 2023-05-01, buy, id tie-break "a" < "b")
        // 3. tx-buy-b (date 2023-05-01, buy)
        // 4. tx-sell-a (date 2023-05-01, sell, id tie-break "a" < "b")
        // 5. tx-sell-b (date 2023-05-01, sell)
        assert_eq!(
            sorted_ids,
            vec![
                "tx-earlier",
                "tx-buy-a",
                "tx-buy-b",
                "tx-sell-a",
                "tx-sell-b"
            ]
        );
    }
}
