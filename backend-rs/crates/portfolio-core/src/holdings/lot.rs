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
        TransactionType::Redemption | TransactionType::Sell | TransactionType::SwitchOut
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
                let a_is_sell = is_unit_redemption(a.tx_type);
                let b_is_sell = is_unit_redemption(b.tx_type);
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
        if self.remaining_units.is_zero() || units_to_consume.is_zero() {
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
        if is_unit_addition(tx.tx_type) {
            let units = tx.units.abs();
            if units.is_positive() {
                let nav = tx.nav;
                let amount = if tx.amount.abs().is_positive() {
                    tx.amount.abs()
                } else {
                    units * nav
                };
                lots.push(TaxLot::new(tx.date, units, nav, amount));
            }
        } else if is_unit_redemption(tx.tx_type) {
            let mut units_to_sell = tx.units.abs();
            for lot in &mut lots {
                if units_to_sell.is_zero() {
                    break;
                }
                if lot.is_depleted() {
                    continue;
                }

                let redemption_nav = tx.nav;
                let (consumed, cost_basis) = lot.deplete(units_to_sell);
                units_to_sell -= consumed;

                let proceeds = if redemption_nav.is_positive() {
                    consumed * redemption_nav
                } else {
                    tx.amount.abs()
                };

                let realized_gain = proceeds - cost_basis;

                depletions.push(LotDepletion {
                    lot_purchase_date: lot.purchase_date,
                    redemption_date: tx.date,
                    units: consumed,
                    purchase_nav: lot.purchase_nav,
                    redemption_nav,
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
